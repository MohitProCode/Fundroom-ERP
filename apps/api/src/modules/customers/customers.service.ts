import { PrismaClient, Customer } from '@prisma/client';
import { NotFoundError, DuplicateResourceError, ErrorCode } from '../../shared/errors';
import { PaginationMeta } from '../../shared/types';

const prisma = new PrismaClient();

export interface CreateCustomerInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber?: string;
  contactPerson?: string;
}

export interface UpdateCustomerInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber?: string;
  contactPerson?: string;
  isActive?: boolean;
}

export interface CustomerListResult {
  items: Customer[];
  meta: PaginationMeta;
}

export class CustomersService {
  /**
   * List all customers with pagination
   */
  async list(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<CustomerListResult> {
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
            { gstNumber: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get customer by ID
   */
  async getById(id: string): Promise<Customer> {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: { enquiries: true, quotations: true, salesOrders: true },
        },
      },
    });

    if (!customer) {
      throw new NotFoundError('Customer', id);
    }

    return customer as Customer;
  }

  /**
   * Create new customer
   */
  async create(data: CreateCustomerInput): Promise<Customer> {
    // Check for duplicate email if provided
    if (data.email) {
      const existing = await prisma.customer.findFirst({
        where: { email: data.email },
      });
      if (existing) {
        throw new DuplicateResourceError('Customer with this email', data.email);
      }
    }

    // Check for duplicate GST if provided
    if (data.gstNumber) {
      const existing = await prisma.customer.findFirst({
        where: { gstNumber: data.gstNumber },
      });
      if (existing) {
        throw new DuplicateResourceError('Customer with this GST number', data.gstNumber);
      }
    }

    return prisma.customer.create({
      data,
    });
  }

  /**
   * Update customer
   */
  async update(id: string, data: UpdateCustomerInput): Promise<Customer> {
    // Check if customer exists
    await this.getById(id);

    // Check for duplicate email if updating
    if (data.email) {
      const existing = await prisma.customer.findFirst({
        where: {
          email: data.email,
          NOT: { id },
        },
      });
      if (existing) {
        throw new DuplicateResourceError('Customer with this email', data.email);
      }
    }

    // Check for duplicate GST if updating
    if (data.gstNumber) {
      const existing = await prisma.customer.findFirst({
        where: {
          gstNumber: data.gstNumber,
          NOT: { id },
        },
      });
      if (existing) {
        throw new DuplicateResourceError('Customer with this GST number', data.gstNumber);
      }
    }

    return prisma.customer.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete customer (soft delete by setting isActive = false)
   */
  async delete(id: string): Promise<void> {
    // Check if customer exists
    await this.getById(id);

    // Check for related records
    const relatedCount = await prisma.customer.findUnique({
      where: { id },
      select: {
        _count: {
          select: { salesOrders: true },
        },
      },
    });

    if (relatedCount && relatedCount._count.salesOrders > 0) {
      // Soft delete if has related records
      await prisma.customer.update({
        where: { id },
        data: { isActive: false },
      });
    } else {
      // Hard delete if no related records
      await prisma.customer.delete({
        where: { id },
      });
    }
  }
}
