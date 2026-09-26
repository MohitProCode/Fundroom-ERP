import { useState } from 'react';
import { useInventory } from '../api/hooks';

export default function Inventory() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useInventory(page);

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Inventory</h2>
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Physical</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reserved</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data?.items.map((inv) => (
              <tr key={inv.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {inv.product.name}
                  <span className="ml-2 text-gray-400 text-xs">({inv.product.sku})</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {Number(inv.physicalQuantity).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">
                  {Number(inv.reservedQuantity).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <span className={Number(inv.availableQuantity) < 10 ? 'text-red-600' : 'text-green-600'}>
                    {Number(inv.availableQuantity).toLocaleString()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
