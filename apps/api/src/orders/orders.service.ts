import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@shop/db';
import type { PaymentGateway } from '@shop/payments';
import type { Order, OrderList, OrderListQuery, Role } from '@shop/shared';
import { CONFIG, type AppConfig } from '../config/config';
import { PAYMENTS } from '../core/core.module';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { verifyOrderAccessToken } from './order-access-token';

const ORDER_INCLUDE = { items: true } satisfies Prisma.OrderInclude;
type OrderRow = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(PAYMENTS) private readonly payments: PaymentGateway,
    private readonly inventory: InventoryService,
  ) {}

  /**
   * Read one order.
   *
   * Access is four-way. An admin sees anything. A signed-in customer sees their
   * own orders. A guest sees an order by presenting either the signed access
   * token from their confirmation link or the email the order was placed with.
   *
   * The token is what the gateway's success URL carries, because it proves
   * access without putting an email address into browser history and server
   * logs. The email route stays as a fallback for a customer who kept the
   * confirmation email but lost the link.
   */
  async getOrder(
    orderId: string,
    viewer: {
      userId: string | null;
      role: Role | null;
      email: string | null;
      token?: string | undefined;
    },
  ): Promise<Order> {
    const row = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    });
    if (!row) throw new NotFoundException('Order not found');

    const isAdmin = viewer.role === 'ADMIN';
    const isOwner = viewer.userId !== null && row.userId === viewer.userId;
    const matchesEmail =
      viewer.email !== null && row.email.toLowerCase() === viewer.email.toLowerCase();
    const hasToken = verifyOrderAccessToken(orderId, viewer.token, this.config.authSecret);

    if (!isAdmin && !isOwner && !matchesEmail && !hasToken) {
      // 404 rather than 403: a 403 confirms the order exists, which is itself a
      // fact worth not leaking when the id is guessable.
      throw new NotFoundException('Order not found');
    }
    return this.toOrder(row);
  }

  /** A signed-in customer's own order history. */
  async listForUser(userId: string, query: OrderListQuery): Promise<OrderList> {
    const where: Prisma.OrderWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
    };
    return this.paginate(where, query);
  }

  /** Admin order list, with the same pagination contract. */
  async listAll(query: OrderListQuery): Promise<OrderList> {
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.email ? { email: query.email.toLowerCase() } : {}),
    };
    return this.paginate(where, query);
  }

  /**
   * Mark a paid order as fulfilled. Guarded on PAID so it is idempotent and
   * cannot resurrect a cancelled order.
   *
   * No stock moves here: stock left on payment, in the webhook's transaction.
   * Decrementing again on fulfilment would double-count every sale.
   */
  async fulfill(orderId: string, actorRole: Role): Promise<Order> {
    if (actorRole !== 'ADMIN') throw new ForbiddenException('Admins only');

    const updated = await this.prisma.$executeRaw`
      UPDATE "orders"
         SET "status" = 'FULFILLED'::"OrderStatus",
             "fulfilled_at" = NOW(),
             "closed_at" = NOW(),
             "updated_at" = NOW()
       WHERE "id" = ${orderId}
         AND "status" = 'PAID'::"OrderStatus"`;

    const row = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    });
    if (!row) throw new NotFoundException('Order not found');
    if (updated === 0 && row.status !== 'FULFILLED') {
      throw new ForbiddenException(`Cannot fulfil an order in state ${row.status}`);
    }
    return this.toOrder(row);
  }

  /**
   * Refund a paid order via the payment gateway and restock inventory.
   *
   * Idempotent: if already REFUNDED, returns the order.
   * Guarded on PAID: only PAID orders can transition to REFUNDED.
   */
  async refund(orderId: string, actorRole: Role, reason?: string): Promise<Order> {
    if (actorRole !== 'ADMIN') throw new ForbiddenException('Admins only');

    const row = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        ...ORDER_INCLUDE,
        payments: {
          where: { status: 'SUCCEEDED' },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!row) throw new NotFoundException('Order not found');

    if (row.status === 'REFUNDED') {
      return this.toOrder(row);
    }
    if (row.status !== 'PAID') {
      throw new ForbiddenException(`Cannot refund an order in state ${row.status}`);
    }

    const succeededPayment = row.payments[0];
    if (succeededPayment?.paymentIntentId) {
      await this.payments.refundPayment({
        orderId: row.id,
        paymentIntentId: succeededPayment.paymentIntentId,
        amountCents: row.totalCents,
        reason: 'requested_by_customer',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.$executeRaw`
        UPDATE "orders"
           SET "status" = 'REFUNDED'::"OrderStatus",
               "closed_at" = NOW(),
               "updated_at" = NOW()
         WHERE "id" = ${orderId}
           AND "status" = 'PAID'::"OrderStatus"`;

      if (updated === 1) {
        await tx.payment.updateMany({
          where: { orderId, status: 'SUCCEEDED' },
          data: { status: 'REFUNDED', updatedAt: new Date() },
        });

        const items = row.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));
        await this.inventory.restockRefunded(tx, orderId, items);
      }
    });

    const updatedRow = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    });
    return this.toOrder(updatedRow!);
  }

  private async paginate(where: Prisma.OrderWhereInput, query: OrderListQuery): Promise<OrderList> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.toOrder(row)),
      total,
      page: query.page,
      perPage: query.perPage,
      totalPages: Math.ceil(total / query.perPage),
    };
  }

  toOrder(row: OrderRow): Order {
    return {
      id: row.id,
      number: row.number,
      email: row.email,
      status: row.status,
      currency: row.currency,
      subtotalCents: row.subtotalCents,
      shippingCents: row.shippingCents,
      taxCents: row.taxCents,
      totalCents: row.totalCents,
      items: row.items.map((item) => ({
        id: item.id,
        variantId: item.variantId,
        productTitle: item.productTitle,
        variantName: item.variantName,
        sku: item.sku,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        lineTotalCents: item.lineTotalCents,
      })),
      shippingAddress: {
        name: row.shippingName,
        line1: row.shippingLine1,
        city: row.shippingCity,
        postalCode: row.shippingPostalCode,
        country: row.shippingCountry,
      },
      reservationExpiresAt: row.reservationExpiresAt?.toISOString() ?? null,
      paidAt: row.paidAt?.toISOString() ?? null,
      fulfilledAt: row.fulfilledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
