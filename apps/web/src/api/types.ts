// API Types

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SALES_USER';
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstNumber: string | null;
  contactPerson: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  activities?: CustomerActivity[];
}

export type CustomerActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'TASK' | 'NOTE';
export interface CustomerActivity { id: string; customerId: string; type: CustomerActivityType; subject: string; notes: string | null; dueAt: string | null; completedAt: string | null; createdBy: string; createdAt: string; updatedAt: string; }

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  inventory?: Inventory;
}

export interface Inventory {
  id: string;
  productId: string;
  physicalQuantity: string;
  reservedQuantity: string;
  availableQuantity: string;
}

export interface Enquiry {
  id: string;
  enquiryNumber: string;
  customerId: string;
  status: 'NEW' | 'QUOTED' | 'WON' | 'LOST';
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
  items: EnquiryItem[];
}

export interface EnquiryItem {
  id: string;
  enquiryId: string;
  productId: string;
  quantity: string;
  notes: string | null;
  product?: Product;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  enquiryId: string | null;
  customerId: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';
  validUntil: string | null;
  terms: string | null;
  notes: string | null;
  subtotal: string;
  totalDiscount: string;
  specialDiscountPercent?: string;
  specialDiscountAmount?: string;
  totalGst: string;
  grandTotal: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
  items: QuotationItem[];
  salesOrder?: SalesOrder | null;
}

export interface QuotationItem {
  id: string;
  quotationId: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  gstPercent: string;
  baseAmount: string;
  discountAmount: string;
  taxableAmount: string;
  gstAmount: string;
  lineTotal: string;
  notes: string | null;
  product?: Product;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  quotationId: string;
  customerId: string;
  status: 'PENDING' | 'CONFIRMED' | 'DISPATCHED' | 'CANCELLED';
  orderDate: string;
  expectedDelivery: string | null;
  notes: string | null;
  subtotal: string;
  totalDiscount: string;
  totalGst: string;
  grandTotal: string;
  createdBy: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
  items: SalesOrderItem[];
  dispatches?: Dispatch[];
}

export interface SalesOrderItem {
  id: string;
  salesOrderId: string;
  productId: string;
  quantity: string;
  reservedQuantity: string;
  dispatchedQuantity: string;
  unitPrice: string;
  discountPercent: string;
  gstPercent: string;
  baseAmount: string;
  discountAmount: string;
  taxableAmount: string;
  gstAmount: string;
  lineTotal: string;
  product?: Product;
}

export interface Dispatch {
  id: string;
  dispatchNumber: string;
  salesOrderId: string;
  dispatchDate: string;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: DispatchItem[];
  salesOrder?: SalesOrder;
}

export interface DispatchItem {
  id: string;
  dispatchId: string;
  productId: string;
  quantity: string;
  product?: Product;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
