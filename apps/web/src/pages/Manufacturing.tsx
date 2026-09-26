import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInventory, useSalesOrders } from '../api/hooks';
import type { SalesOrder } from '../api/types';

type WorkReadiness = 'READY' | 'MATERIAL_SHORTAGE' | 'AWAITING_RELEASE' | 'COMPLETE';

function getReadiness(order: SalesOrder, inventoryByProduct: Map<string, number>): WorkReadiness {
  if (order.status === 'DISPATCHED') return 'COMPLETE';
  if (order.status === 'PENDING') return 'AWAITING_RELEASE';
  const shortage = order.items.some((item) => {
    const available = inventoryByProduct.get(item.productId) ?? 0;
    return available + Number(item.reservedQuantity) < Number(item.quantity);
  });
  return shortage ? 'MATERIAL_SHORTAGE' : 'READY';
}

const readinessStyles: Record<WorkReadiness, string> = {
  READY: 'bg-green-100 text-green-800',
  MATERIAL_SHORTAGE: 'bg-red-100 text-red-800',
  AWAITING_RELEASE: 'bg-yellow-100 text-yellow-800',
  COMPLETE: 'bg-gray-100 text-gray-600',
};

export default function Manufacturing() {
  const [search, setSearch] = useState('');
  const ordersQuery = useSalesOrders(1, 100);
  const inventoryQuery = useInventory(1, 100);

  const inventoryByProduct = useMemo(() => {
    const map = new Map<string, number>();
    inventoryQuery.data?.items.forEach((item) => map.set(item.productId, Number(item.availableQuantity)));
    return map;
  }, [inventoryQuery.data]);

  const workOrders = useMemo(() => {
    const orders = ordersQuery.data?.items ?? [];
    return orders
      .map((order) => ({ order, readiness: getReadiness(order, inventoryByProduct) }))
      .filter(({ order }) => {
        const query = search.toLowerCase();
        return !query || order.orderNumber.toLowerCase().includes(query) || order.customer?.name.toLowerCase().includes(query);
      });
  }, [ordersQuery.data, inventoryByProduct, search]);

  const metrics = useMemo(() => ({
    planned: workOrders.filter(({ order }) => order.status !== 'DISPATCHED').length,
    ready: workOrders.filter(({ readiness }) => readiness === 'READY').length,
    shortages: workOrders.filter(({ readiness }) => readiness === 'MATERIAL_SHORTAGE').length,
    overdue: workOrders.filter(({ order }) => order.expectedDelivery && new Date(order.expectedDelivery) < new Date() && order.status !== 'DISPATCHED').length,
  }), [workOrders]);

  if (ordersQuery.isLoading || inventoryQuery.isLoading) return <div className="animate-pulse text-gray-500">Loading production control...</div>;
  if (ordersQuery.isError || inventoryQuery.isError) return <div className="rounded-lg bg-red-50 p-4 text-red-700">Production data could not be loaded. Check the API connection and try again.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manufacturing control</h2>
          <p className="mt-1 text-sm text-gray-600">Live order readiness, material availability, and delivery risk.</p>
        </div>
        <Link to="/inventory" className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">Review inventory</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          ['Open demand', metrics.planned, 'text-gray-900'],
          ['Ready to schedule', metrics.ready, 'text-green-700'],
          ['Material shortages', metrics.shortages, 'text-red-700'],
          ['Late delivery risk', metrics.overdue, 'text-orange-700'],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-5">
          <div>
            <h3 className="font-semibold text-gray-900">Order release board</h3>
            <p className="mt-1 text-sm text-gray-500">Orders are evaluated against current available stock before production release.</p>
          </div>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order or customer" className="w-64 rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase text-gray-500">Order</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase text-gray-500">Customer</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase text-gray-500">Delivery</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase text-gray-500">Release decision</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
              {workOrders.map(({ order, readiness }) => (
                <tr key={order.id}>
                  <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-gray-900">{order.orderNumber}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{order.customer?.name ?? 'Unknown customer'}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{order.expectedDelivery ? new Date(order.expectedDelivery).toLocaleDateString() : 'Not scheduled'}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{order.status}</td>
                  <td className="whitespace-nowrap px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${readinessStyles[readiness]}`}>{readiness.replace('_', ' ')}</span></td>
                </tr>
              ))}
              {!workOrders.length && <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">No production demand matches this search.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
        <p className="font-semibold">Operational rule</p>
        <p className="mt-1">A confirmed order is eligible for production only when every line has available material. Inventory reservations remain the source of truth for customer commitments.</p>
      </div>
    </div>
  );
}
