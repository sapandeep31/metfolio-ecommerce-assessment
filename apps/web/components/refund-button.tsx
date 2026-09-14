'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { adminRefundOrder } from '../app/actions';

export function RefundButton({ orderId, number }: { orderId: string; number: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleRefund = () => {
    if (
      !window.confirm(
        `Are you sure you want to refund Order ${number}? This will issue a Stripe refund and restock the items.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await adminRefundOrder(orderId, 'requested_by_customer');
      if (result.error) setError(result.error);
      else router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-danger"
        disabled={pending}
        data-testid={`refund-${number}`}
        onClick={handleRefund}
      >
        {pending ? 'Refunding…' : 'Refund'}
      </button>
      {error && <span className="error">{error}</span>}
    </>
  );
}
