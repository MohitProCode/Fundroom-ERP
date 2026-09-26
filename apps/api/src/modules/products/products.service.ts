import { PrismaClient, Product } from '@prisma/client';
import { NotFoundError, DuplicateResourceError } from '../../shared/errors';
import { PaginationMeta } from '../../shared/types';

const prisma = new PrismaClient();

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit?: string;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  category?: string;
  unit?: string;
  isActive?: boolean;
}

export interface ProductListResult {
  items: Product[];
  meta: PaginationMeta;
}

export class ProductsService {
  async list(page: number = 1, limit: number = 10, search?: string): Promise<ProductListResult> {
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { sku: { contains: search, mode: 'insensitive' as const } },
            { category: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string): Promise<Product> {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { inventory: true },
    });

    if (!product) {
      throw new NotFoundError('Product', id);
    }

    return product as Product;
  }

  async create(data: CreateProductInput): Promise<Product> {
    const existing = await prisma.product.findUnique({
      where: { sku: data.sku },
    });

    if (existing) {
      throw new DuplicateResourceError('Product with SKU', data.sku);
    }

    const product = await prisma.product.create({ data });

    // Create inventory record
    await prisma.inventory.create({
      data: { productId: product.id },
    });

    return product;
  }

  async update(id: string, data: UpdateProductInput): Promise<Product> {
    await this.getById(id);
    return prisma.product.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await prisma.product.update({ where: { id }, data: { isActive: false } });
  }
}
