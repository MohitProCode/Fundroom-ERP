import { CustomerActivity, CustomerActivityType, PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../shared/errors';

const prisma = new PrismaClient();

export interface CreateCustomerActivityInput {
  type: CustomerActivityType;
  subject: string;
  notes?: string;
  dueAt?: string;
}

export class CustomerActivitiesService {
  async list(customerId: string): Promise<CustomerActivity[]> {
    const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!customer) throw new NotFoundError('Customer', customerId);
    return prisma.customerActivity.findMany({ where: { customerId }, orderBy: [{ completedAt: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }] });
  }

  async create(customerId: string, data: CreateCustomerActivityInput, userId: string): Promise<CustomerActivity> {
    const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!customer) throw new NotFoundError('Customer', customerId);
    return prisma.customerActivity.create({ data: { customerId, type: data.type, subject: data.subject, notes: data.notes, dueAt: data.dueAt ? new Date(data.dueAt) : undefined, createdBy: userId } });
  }

  async complete(id: string): Promise<CustomerActivity> {
    const activity = await prisma.customerActivity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundError('Customer activity', id);
    return prisma.customerActivity.update({ where: { id }, data: { completedAt: activity.completedAt ? null : new Date() } });
  }
}
