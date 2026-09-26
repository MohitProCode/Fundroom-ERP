/**
 * Quotation Calculation Engine
 * Backend-authoritative calculation of quotation totals
 *
 * Formula per line item:
 *   baseAmount = quantity × unitPrice
 *   discountAmount = baseAmount × discountPercent / 100
 *   taxableAmount = baseAmount - discountAmount
 *   gstAmount = taxableAmount × gstPercent / 100
 *   lineTotal = taxableAmount + gstAmount
 *
 * Grand total = sum(lineTotal)
 */

import { Decimal } from '@prisma/client/runtime/library';

export interface QuotationItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  gstPercent?: number;
}

export interface QuotationItemCalculation {
  productId: string;
  quantity: Decimal;
  unitPrice: Decimal;
  discountPercent: Decimal;
  gstPercent: Decimal;
  baseAmount: Decimal;
  discountAmount: Decimal;
  taxableAmount: Decimal;
  gstAmount: Decimal;
  lineTotal: Decimal;
}

export interface QuotationTotals {
  subtotal: Decimal;
  totalDiscount: Decimal;
  specialDiscountPercent: Decimal;
  specialDiscountAmount: Decimal;
  totalGst: Decimal;
  grandTotal: Decimal;
  items: QuotationItemCalculation[];
}

/**
 * Calculate line item totals
 */
export function calculateLineItem(
  quantity: number | Decimal,
  unitPrice: number | Decimal,
  discountPercent: number | Decimal = 0,
  gstPercent: number | Decimal = 18
): Omit<QuotationItemCalculation, 'productId'> {
  const qty = new Decimal(quantity);
  const price = new Decimal(unitPrice);
  const discount = new Decimal(discountPercent);
  const gst = new Decimal(gstPercent);

  // baseAmount = quantity × unitPrice
  const baseAmount = qty.times(price);

  // discountAmount = baseAmount × discountPercent / 100
  const discountAmount = baseAmount.times(discount).div(100);

  // taxableAmount = baseAmount - discountAmount
  const taxableAmount = baseAmount.minus(discountAmount);

  // gstAmount = taxableAmount × gstPercent / 100
  const gstAmount = taxableAmount.times(gst).div(100);

  // lineTotal = taxableAmount + gstAmount
  const lineTotal = taxableAmount.plus(gstAmount);

  return {
    quantity: qty,
    unitPrice: price,
    discountPercent: discount,
    gstPercent: gst,
    baseAmount: baseAmount.toDecimalPlaces(2),
    discountAmount: discountAmount.toDecimalPlaces(2),
    taxableAmount: taxableAmount.toDecimalPlaces(2),
    gstAmount: gstAmount.toDecimalPlaces(2),
    lineTotal: lineTotal.toDecimalPlaces(2),
  };
}

/**
 * Calculate quotation totals
 */
export function calculateQuotationTotals(
  items: QuotationItemInput[],
  specialDiscountPercent: number | Decimal = 0
): QuotationTotals {
  const calculatedItems: QuotationItemCalculation[] = items.map((item) => ({
    productId: item.productId,
    ...calculateLineItem(
      item.quantity,
      item.unitPrice,
      item.discountPercent ?? 0,
      item.gstPercent ?? 18
    ),
  }));

  let subtotal = new Decimal(0);
  let totalDiscount = new Decimal(0);
  let totalGst = new Decimal(0);
  let grandTotal = new Decimal(0);

  for (const item of calculatedItems) {
    subtotal = subtotal.plus(item.baseAmount);
    totalDiscount = totalDiscount.plus(item.discountAmount);
    totalGst = totalGst.plus(item.gstAmount);
    grandTotal = grandTotal.plus(item.lineTotal);
  }

  const specialPercent = new Decimal(specialDiscountPercent);
  const taxableBeforeSpecial = subtotal.minus(totalDiscount);
  const specialDiscountAmount = taxableBeforeSpecial.times(specialPercent).div(100).toDecimalPlaces(2);
  const adjustedTaxable = taxableBeforeSpecial.minus(specialDiscountAmount);
  const gstRatio = taxableBeforeSpecial.isZero() ? new Decimal(0) : adjustedTaxable.div(taxableBeforeSpecial);
  totalGst = totalGst.times(gstRatio).toDecimalPlaces(2);
  grandTotal = adjustedTaxable.plus(totalGst).toDecimalPlaces(2);

  return {
    subtotal: subtotal.toDecimalPlaces(2),
    totalDiscount: totalDiscount.plus(specialDiscountAmount).toDecimalPlaces(2),
    specialDiscountPercent: specialPercent,
    specialDiscountAmount,
    totalGst: totalGst.toDecimalPlaces(2),
    grandTotal: grandTotal.toDecimalPlaces(2),
    items: calculatedItems,
  };
}
