import { useState } from 'react';
import { useSalesOrders, useConfirmSalesOrder, useCancelSalesOrder } from '../api/hooks';
import { useAuth } from '../context/AuthContext';

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  DISPATCHED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function SalesOrders() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSalesOrders(page);
  const confirmOrder = useConfirmSalesOrder();
  const cancelOrder = useCancelSalesOrder();
  const { user } = useAuth();

  const isAdmin = user?.role === 'ADMIN';

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Sales Orders</h2>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Grand Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data?.items.map((order) => (
              <tr key={order.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {order.orderNumber}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {order.customer?.name || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[order.status]}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ₹{Number(order.grandTotal).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(order.orderDate).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 space-x-2">
                  {order.status === 'PENDING' && isAdmin && (
                    <>
                      <button
                        onClick={() => confirmOrder.mutate(order.id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => cancelOrder.mutate(order.id)}
                        className="text-red-600 hover:text-red-900 ml-2"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {order.status === 'CONFIRMED' && (
                    <>
                      <span className="text-green-600">Inventory Reserved</span>
                      {isAdmin && (
                        <button
                          onClick={() => cancelOrder.mutate(order.id)}
                          className="text-red-600 hover:text-red-900 ml-2"
                        >
                          Cancel
                        </button>
                      )}
                    </>
                  )}
                  {order.status === 'DISPATCHED' && (
                    <span className="text-blue-600">Dispatched</span>
                  )}
                  {order.status === 'CANCELLED' && (
                    <span className="text-red-600">Cancelled</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
