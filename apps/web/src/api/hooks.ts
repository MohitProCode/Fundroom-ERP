import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  Customer,
  Product,
  Inventory,
  Enquiry,
  Quotation,
  SalesOrder,
  Dispatch,
  PaginatedResponse,
  CustomerActivity,
} from './types';

// Customers
export function useCustomers(page = 1, limit = 10, search?: string) {
  return useQuery({
    queryKey: ['customers', page, limit, search],
    queryFn: () =>
      api.get<PaginatedResponse<Customer>>(
        `/customers?page=${page}&limit=${limit}${search ? `&search=${search}` : ''}`
      ),
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get<Customer>(`/customers/${id}`),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Customer>) => api.post<Customer>('/customers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useCustomerActivities(customerId?: string) {
  return useQuery({ queryKey: ['customer-activities', customerId], queryFn: () => api.get<CustomerActivity[]>(`/customers/${customerId}/activities`), enabled: !!customerId });
}

export function useCreateCustomerActivity() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ customerId, type, subject, notes, dueAt }: { customerId: string; type: CustomerActivity['type']; subject: string; notes?: string; dueAt?: string }) => api.post<CustomerActivity>(`/customers/${customerId}/activities`, { type, subject, notes, dueAt }), onSuccess: (_data, variables) => { queryClient.invalidateQueries({ queryKey: ['customer-activities', variables.customerId] }); } });
}

export function useCompleteCustomerActivity() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ customerId, activityId }: { customerId: string; activityId: string }) => api.patch<CustomerActivity>(`/customers/${customerId}/activities/${activityId}/complete`), onSuccess: (_data, variables) => { queryClient.invalidateQueries({ queryKey: ['customer-activities', variables.customerId] }); } });
}

// Products
export function useProducts(page = 1, limit = 10, search?: string) {
  return useQuery({
    queryKey: ['products', page, limit, search],
    queryFn: () =>
      api.get<PaginatedResponse<Product>>(
        `/products?page=${page}&limit=${limit}${search ? `&search=${search}` : ''}`
      ),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get<Product>(`/products/${id}`),
    enabled: !!id,
  });
}

// Inventory
export function useInventory(page = 1, limit = 10, search?: string) {
  return useQuery({
    queryKey: ['inventory', page, limit, search],
    queryFn: () =>
      api.get<PaginatedResponse<Inventory & { product: { id: string; sku: string; name: string } }>>(
        `/inventory?page=${page}&limit=${limit}${search ? `&search=${search}` : ''}`
      ),
  });
}

// Enquiries
export function useEnquiries(page = 1, limit = 10, status?: string, customerId?: string) {
  return useQuery({
    queryKey: ['enquiries', page, limit, status, customerId],
    queryFn: () =>
      api.get<PaginatedResponse<Enquiry>>(
        `/enquiries?page=${page}&limit=${limit}${status ? `&status=${status}` : ''}${customerId ? `&customerId=${customerId}` : ''}`
      ),
  });
}

export function useEnquiry(id: string) {
  return useQuery({
    queryKey: ['enquiry', id],
    queryFn: () => api.get<Enquiry>(`/enquiries/${id}`),
    enabled: !!id,
  });
}

export function useCreateEnquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { customerId: string; notes?: string; items: { productId: string; quantity: number }[] }) =>
      api.post<Enquiry>('/enquiries', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
    },
  });
}

export function useUpdateEnquiryStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch<Enquiry>(`/enquiries/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
    },
  });
}

// Quotations
export function useQuotations(page = 1, limit = 10, status?: string, customerId?: string) {
  return useQuery({
    queryKey: ['quotations', page, limit, status, customerId],
    queryFn: () =>
      api.get<PaginatedResponse<Quotation>>(
        `/quotations?page=${page}&limit=${limit}${status ? `&status=${status}` : ''}${customerId ? `&customerId=${customerId}` : ''}`
      ),
  });
}

export function useQuotation(id: string) {
  return useQuery({
    queryKey: ['quotation', id],
    queryFn: () => api.get<Quotation>(`/quotations/${id}`),
    enabled: !!id,
  });
}

export function useCreateQuotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      enquiryId?: string;
      customerId: string;
      validUntil?: string;
      terms?: string;
      notes?: string;
      specialDiscountPercent?: number;
      items: {
        productId: string;
        quantity: number;
        unitPrice: number;
        discountPercent?: number;
        gstPercent?: number;
      }[];
    }) => api.post<Quotation>('/quotations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
    },
  });
}

export function useUpdateQuotationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch<Quotation>(`/quotations/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
  });
}

// Sales Orders
export function useSalesOrders(page = 1, limit = 10, status?: string, customerId?: string) {
  return useQuery({
    queryKey: ['sales-orders', page, limit, status, customerId],
    queryFn: () =>
      api.get<PaginatedResponse<SalesOrder>>(
        `/sales-orders?page=${page}&limit=${limit}${status ? `&status=${status}` : ''}${customerId ? `&customerId=${customerId}` : ''}`
      ),
  });
}

export function useSalesOrder(id: string) {
  return useQuery({
    queryKey: ['sales-order', id],
    queryFn: () => api.get<SalesOrder>(`/sales-orders/${id}`),
    enabled: !!id,
  });
}

export function useConvertQuotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quotationId: string) =>
      api.post<SalesOrder>('/sales-orders/from-quotation', { quotationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
  });
}

export function useConfirmSalesOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<SalesOrder>(`/sales-orders/${id}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useCancelSalesOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<SalesOrder>(`/sales-orders/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

// Dispatches
export function useDispatches(page = 1, limit = 10, salesOrderId?: string) {
  return useQuery({
    queryKey: ['dispatches', page, limit, salesOrderId],
    queryFn: () =>
      api.get<PaginatedResponse<Dispatch>>(
        `/dispatches?page=${page}&limit=${limit}${salesOrderId ? `&salesOrderId=${salesOrderId}` : ''}`
      ),
  });
}

export function useCreateDispatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { salesOrderId: string; notes?: string; items: { productId: string; quantity: number }[] }) =>
      api.post<Dispatch>('/dispatches', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
