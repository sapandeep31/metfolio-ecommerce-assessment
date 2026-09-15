import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PaymentGateway } from '@shop/payments';
import { describe, expect, it, vi } from 'vitest';
import type { CartService } from '../cart/cart.service';
import type { AppConfig } from '../config/config';
import type { InventoryService } from '../inventory/inventory.service';
import type { ReservationSweepService } from '../inventory/reservation-sweep.service';
import { DEFAULT_TRANSACTION_OPTIONS, type PrismaService } from '../prisma/prisma.service';
import { CheckoutService } from './checkout.service';

const baseConfig: AppConfig = {
  pricing: {
    taxBasisPoints: 875,
    freeShippingThresholdCents: 5000,
    shippingFlatCents: 599,
  },
  reservationTtlMinutes: 15,
  currency: 'usd',
  appBaseUrl: 'http://localhost:3000',
  authSecret: 'a-test-secret-at-least-16-chars-long',
} as unknown as AppConfig;

const sampleAddress = {
  name: 'Jane Doe',
  line1: '123 Main St',
  city: 'Metropolis',
  postalCode: '12345',
  country: 'US',
};

function createService(overrides?: {
  prisma?: Partial<PrismaService>;
  cart?: Partial<CartService>;
  inventory?: Partial<InventoryService>;
  sweep?: Partial<ReservationSweepService>;
  gateway?: Partial<PaymentGateway>;
  config?: Partial<AppConfig>;
}) {
  const prisma = overrides?.prisma ?? {};
  const cart = overrides?.cart ?? {
    getCart: vi.fn().mockResolvedValue({ lines: [] }),
  };
  const inventory = overrides?.inventory ?? {
    reserve: vi.fn().mockResolvedValue([]),
    release: vi.fn().mockResolvedValue(1),
  };
  const sweep = overrides?.sweep ?? {
    sweepQuietly: vi.fn().mockResolvedValue(undefined),
  };
  const gateway = overrides?.gateway ?? {
    name: 'stripe',
    createCheckoutSession: vi.fn().mockResolvedValue({
      sessionId: 'cs_test_123',
      url: 'https://checkout.stripe.com/pay/cs_test_123',
    }),
  };
  const config = { ...baseConfig, ...overrides?.config };

  return new CheckoutService(
    prisma as PrismaService,
    cart as CartService,
    inventory as InventoryService,
    sweep as ReservationSweepService,
    gateway as PaymentGateway,
    config as AppConfig,
  );
}

describe('CheckoutService', () => {
  it('throws BadRequestException when cart is empty', async () => {
    const service = createService({
      cart: { getCart: vi.fn().mockResolvedValue({ lines: [] }) },
    });

    await expect(
      service.createCheckout('empty_cart', { email: 'test@example.com', shippingAddress: sampleAddress }, null),
    ).rejects.toThrow(BadRequestException);
  });

  it('runs reservation sweep and passes DEFAULT_TRANSACTION_OPTIONS to $transaction', async () => {
    const sweepQuietly = vi.fn().mockResolvedValue(undefined);
    let capturedOptions: unknown = null;

    const mockOrder = {
      id: 'order_1',
      number: 'SHOP-1001',
      email: 'buyer@example.com',
      currency: 'usd',
      totalCents: 10000,
      subtotalCents: 9000,
      taxCents: 787,
      shippingCents: 0,
      items: [
        {
          variantId: 'v1',
          productTitle: 'Sneaker',
          variantName: 'Black / 42',
          unitPriceCents: 9000,
          quantity: 1,
        },
      ],
    };

    const txMock = {
      productVariant: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'v1',
            priceCents: 9000,
            sku: 'SNK-BLK-42',
            name: 'Black / 42',
            product: { title: 'Sneaker' },
          },
        ]),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ number: 'SHOP-1001' }]),
      order: {
        create: vi.fn().mockResolvedValue(mockOrder),
      },
    };

    const prismaMock: Partial<PrismaService> = {
      $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => unknown, options?: unknown) => {
        capturedOptions = options;
        return fn(txMock);
      }),
      payment: {
        create: vi.fn().mockResolvedValue({ id: 'pmt_1' }),
      },
    } as unknown as Partial<PrismaService>;

    const reserveMock = vi.fn().mockResolvedValue([]);
    const gatewayMock = {
      name: 'stripe',
      createCheckoutSession: vi.fn().mockResolvedValue({
        sessionId: 'cs_test_abc',
        url: 'https://checkout.stripe.com/pay/cs_test_abc',
      }),
    };

    const service = createService({
      prisma: prismaMock,
      cart: {
        getCart: vi.fn().mockResolvedValue({
          lines: [{ variantId: 'v1', quantity: 1 }],
        }),
      },
      inventory: { reserve: reserveMock },
      sweep: { sweepQuietly },
      gateway: gatewayMock,
    });

    const result = await service.createCheckout(
      'cart_1',
      { email: 'buyer@example.com', shippingAddress: sampleAddress },
      'user_1',
    );

    expect(sweepQuietly).toHaveBeenCalledTimes(1);
    expect(capturedOptions).toEqual(DEFAULT_TRANSACTION_OPTIONS);
    expect(capturedOptions).toEqual({ maxWait: 10000, timeout: 25000 });
    expect(reserveMock).toHaveBeenCalledWith(txMock, 'order_1', [{ variantId: 'v1', quantity: 1 }]);
    expect(result.orderId).toBe('order_1');
    expect(result.sessionId).toBe('cs_test_abc');
    expect(result.checkoutUrl).toBe('https://checkout.stripe.com/pay/cs_test_abc');
  });

  it('throws ConflictException when stock reservation fails', async () => {
    const txMock = {
      productVariant: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'v1',
            priceCents: 9000,
            sku: 'SNK-BLK-42',
            name: 'Black / 42',
            product: { title: 'Sneaker' },
          },
        ]),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ number: 'SHOP-1001' }]),
      order: {
        create: vi.fn().mockResolvedValue({ id: 'order_1', number: 'SHOP-1001' }),
      },
    };

    const prismaMock: Partial<PrismaService> = {
      $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(txMock)),
    } as unknown as Partial<PrismaService>;

    const service = createService({
      prisma: prismaMock,
      cart: {
        getCart: vi.fn().mockResolvedValue({
          lines: [{ variantId: 'v1', quantity: 5 }],
        }),
      },
      inventory: {
        reserve: vi.fn().mockResolvedValue([
          {
            variantId: 'v1',
            requested: 5,
            available: 2,
          },
        ]),
      },
    });

    await expect(
      service.createCheckout('cart_1', { email: 'buyer@example.com', shippingAddress: sampleAddress }, null),
    ).rejects.toThrow(ConflictException);
  });

  it('cancels order and releases stock if gateway fails', async () => {
    const mockOrder = {
      id: 'order_1',
      number: 'SHOP-1001',
      email: 'buyer@example.com',
      currency: 'usd',
      totalCents: 10000,
      subtotalCents: 9000,
      taxCents: 787,
      shippingCents: 0,
      items: [{ variantId: 'v1', productTitle: 'Sneaker', variantName: 'Black / 42', unitPriceCents: 9000, quantity: 1 }],
    };

    const txMock = {
      productVariant: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'v1', priceCents: 9000, sku: 'SNK', name: 'Black', product: { title: 'Sneaker' } },
        ]),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ number: 'SHOP-1001' }]),
      order: { create: vi.fn().mockResolvedValue(mockOrder) },
      $executeRaw: vi.fn().mockResolvedValue(1),
      orderItem: { findMany: vi.fn().mockResolvedValue([{ variantId: 'v1', quantity: 1 }]) },
    };

    const prismaMock: Partial<PrismaService> = {
      $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(txMock)),
    } as unknown as Partial<PrismaService>;

    const releaseMock = vi.fn().mockResolvedValue(1);

    const service = createService({
      prisma: prismaMock,
      cart: {
        getCart: vi.fn().mockResolvedValue({
          lines: [{ variantId: 'v1', quantity: 1 }],
        }),
      },
      inventory: {
        reserve: vi.fn().mockResolvedValue([]),
        release: releaseMock,
      },
      gateway: {
        createCheckoutSession: vi.fn().mockRejectedValue(new Error('Stripe API error')),
      },
    });

    await expect(
      service.createCheckout('cart_1', { email: 'buyer@example.com', shippingAddress: sampleAddress }, null),
    ).rejects.toThrow(BadRequestException);

    expect(releaseMock).toHaveBeenCalledWith(txMock, 'order_1', [{ variantId: 'v1', quantity: 1 }], 'gateway-session-failed');
  });

  it('cancelAndRelease executes transaction with DEFAULT_TRANSACTION_OPTIONS', async () => {
    let capturedOptions: unknown = null;
    const txMock = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      orderItem: { findMany: vi.fn().mockResolvedValue([{ variantId: 'v1', quantity: 2 }]) },
    };

    const releaseMock = vi.fn().mockResolvedValue(1);

    const prismaMock: Partial<PrismaService> = {
      $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => unknown, options?: unknown) => {
        capturedOptions = options;
        return fn(txMock);
      }),
    } as unknown as Partial<PrismaService>;

    const service = createService({
      prisma: prismaMock,
      inventory: { release: releaseMock },
    });

    const cancelled = await service.cancelAndRelease('order_99', 'user-cancelled');
    expect(cancelled).toBe(true);
    expect(capturedOptions).toEqual(DEFAULT_TRANSACTION_OPTIONS);
    expect(releaseMock).toHaveBeenCalledWith(txMock, 'order_99', [{ variantId: 'v1', quantity: 2 }], 'user-cancelled');
  });
});
