import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Business Identifier Generator
 * Generates human-readable unique identifiers:
 * ENQ-YYYY-NNNNNN (Enquiry)
 * QUO-YYYY-NNNNNN (Quotation)
 * SO-YYYY-NNNNNN (Sales Order)
 * DSP-YYYY-NNNNNN (Dispatch)
 */

type IdentifierType = 'ENQ' | 'QUO' | 'SO' | 'DSP';

interface CounterRecord {
  id: string;
  year: number;
  last_number: number;
}

const MODEL_MAP = {
  ENQ: 'enquiry',
  QUO: 'quotation',
  SO: 'salesOrder',
  DSP: 'dispatch',
} as const;

/**
 * Generate next business identifier
 * Uses database-level locking to ensure uniqueness
 */
export async function generateBusinessIdentifier(
  type: IdentifierType,
  year: number = new Date().getFullYear()
): Promise<string> {
  const counterTable = `${MODEL_MAP[type]}_counters`;

  // Use raw query with row-level locking for concurrency safety
  const result = await prisma.$queryRaw<{ last_number: number }[]>`
    INSERT INTO ${prisma.$queryRawUnsafe(counterTable)} (year, last_number)
    VALUES (${year}, 1)
    ON CONFLICT (year) DO UPDATE
    SET last_number = ${prisma.$queryRawUnsafe(counterTable)}.last_number + 1
    RETURNING last_number
  `;

  const number = result[0]?.last_number ?? 1;
  const paddedNumber = String(number).padStart(6, '0');

  return `${type}-${year}-${paddedNumber}`;
}

/**
 * Alternative: Simple counter using Prisma transactions
 * This version uses the actual model's max number + 1
 */
export async function generateEnquiryNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ENQ-${year}-`;

  const lastEnquiry = await prisma.enquiry.findFirst({
    where: {
      enquiryNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      enquiryNumber: 'desc',
    },
    select: {
      enquiryNumber: true,
    },
  });

  let nextNumber = 1;
  if (lastEnquiry) {
    const lastNumber = parseInt(lastEnquiry.enquiryNumber.split('-')[2], 10);
    nextNumber = lastNumber + 1;
  }

  const paddedNumber = String(nextNumber).padStart(6, '0');
  return `${prefix}${paddedNumber}`;
}

export async function generateQuotationNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `QUO-${year}-`;

  const lastQuotation = await prisma.quotation.findFirst({
    where: {
      quotationNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      quotationNumber: 'desc',
    },
    select: {
      quotationNumber: true,
    },
  });

  let nextNumber = 1;
  if (lastQuotation) {
    const lastNumber = parseInt(lastQuotation.quotationNumber.split('-')[2], 10);
    nextNumber = lastNumber + 1;
  }

  const paddedNumber = String(nextNumber).padStart(6, '0');
  return `${prefix}${paddedNumber}`;
}

export async function generateSalesOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SO-${year}-`;

  const lastOrder = await prisma.salesOrder.findFirst({
    where: {
      orderNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      orderNumber: 'desc',
    },
    select: {
      orderNumber: true,
    },
  });

  let nextNumber = 1;
  if (lastOrder) {
    const lastNumber = parseInt(lastOrder.orderNumber.split('-')[2], 10);
    nextNumber = lastNumber + 1;
  }

  const paddedNumber = String(nextNumber).padStart(6, '0');
  return `${prefix}${paddedNumber}`;
}

export async function generateDispatchNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DSP-${year}-`;

  const lastDispatch = await prisma.dispatch.findFirst({
    where: {
      dispatchNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      dispatchNumber: 'desc',
    },
    select: {
      dispatchNumber: true,
    },
  });

  let nextNumber = 1;
  if (lastDispatch) {
    const lastNumber = parseInt(lastDispatch.dispatchNumber.split('-')[2], 10);
    nextNumber = lastNumber + 1;
  }

  const paddedNumber = String(nextNumber).padStart(6, '0');
  return `${prefix}${paddedNumber}`;
}
