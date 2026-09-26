import { useState } from 'react';
import { useQuotations, useUpdateQuotationStatus, useConvertQuotation } from '../api/hooks';
import { useAuth } from '../context/AuthContext';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SENT: 'bg-blue-100 text-blue-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export default function Quotations() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuotations(page);
  const updateStatus = useUpdateQuotationStatus();
  const convertQuotation = useConvertQuotation();
  const { user } = useAuth();

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Quotations</h2>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Number
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
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data?.items.map((quotation) => (
              <tr key={quotation.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {quotation.quotationNumber}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {quotation.customer?.name || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[quotation.status]}`}>
                    {quotation.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ₹{Number(quotation.grandTotal).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(quotation.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 space-x-2">
                  {quotation.status === 'DRAFT' && (
                    <button
                      onClick={() => updateStatus.mutate({ id: quotation.id, status: 'SENT' })}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Send
                    </button>
                  )}
                  {quotation.status === 'SENT' && (
                    <>
                      <button
                        onClick={() => updateStatus.mutate({ id: quotation.id, status: 'ACCEPTED' })}
                        className="text-green-600 hover:text-green-900"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => updateStatus.mutate({ id: quotation.id, status: 'REJECTED' })}
                        className="text-red-600 hover:text-red-900 ml-2"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {quotation.status === 'ACCEPTED' && !quotation.salesOrder && (
                    <button
                      onClick={() => convertQuotation.mutate(quotation.id)}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      Convert to Order
                    </button>
                  )}
                  {quotation.salesOrder && (
                    <span className="text-gray-500">Order: {quotation.salesOrder.orderNumber}</span>
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
