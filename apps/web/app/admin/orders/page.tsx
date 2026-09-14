import { formatMoney, type OrderList, type OrderStatus } from '@shop/shared';
import Link from 'next/link';
import { FulfillButton } from '../../../components/fulfill-button';
import { RefundButton } from '../../../components/refund-button';
import { apiFetch } from '../../../lib/api';

export const dynamic = 'force-dynamic';

const BADGE: Record<OrderStatus, string> = {
  PENDING: 'badge-pending',
  PAID: 'badge-paid',
  FULFILLED: 'badge-fulfilled',
  CANCELLED: 'badge-cancelled',
  EXPIRED: 'badge-expired',
  REFUNDED: 'badge-refunded',
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { status } = await searchParams;
  const filter = typeof status === 'string' ? status : undefined;
  const orders = await apiFetch<OrderList>(
    `/admin/orders?perPage=100${filter ? `&status=${encodeURIComponent(filter)}` : ''}`,
  );

  return (
    <>
      <div className="row space-between">
        <h1>Orders</h1>
        <div className="row" style={{ gap: 6 }}>
          <Link href="/admin/orders" className="badge">
            All
          </Link>
          {(['PENDING', 'PAID', 'FULFILLED', 'EXPIRED', 'REFUNDED'] as const).map((value) => (
            <Link key={value} href={`/admin/orders?status=${value}`} className="badge">
              {value}
            </Link>
          ))}
        </div>
      </div>

      {orders.items.length === 0 ? (
        <p className="empty">No orders</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Email</th>
              <th>Status</th>
              <th className="num">Items</th>
              <th className="num">Total</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.items.map((order) => (
              <tr key={order.id} data-testid="admin-order-row" data-number={order.number}>
                <td>
                  <Link href={`/orders/${order.id}`}>{order.number}</Link>
                </td>
                <td className="mono">{order.email}</td>
                <td>
                  <span className={`badge ${BADGE[order.status]}`}>{order.status}</span>
                </td>
                <td className="num">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                <td className="num">{formatMoney(order.totalCents, order.currency)}</td>
                <td>
                  {/* A PAID order can be fulfilled or refunded via Stripe. */}
                  {order.status === 'PAID' && (
                    <div className="row" style={{ gap: 8 }}>
                      <FulfillButton orderId={order.id} number={order.number} />
                      <RefundButton orderId={order.id} number={order.number} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
