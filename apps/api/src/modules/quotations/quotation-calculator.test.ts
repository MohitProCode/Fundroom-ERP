import { describe, it, expect } from 'vitest';
import { calculateLineItem, calculateQuotationTotals } from '../modules/quotations/quotation-calculator';

describe('Quotation Calculator', () => {
  describe('calculateLineItem', () => {
    it('should calculate line item without discount', () => {
      const result = calculateLineItem(10, 100, 0, 18);

      expect(result.baseAmount.toNumber()).toBe(1000);
      expect(result.discountAmount.toNumber()).toBe(0);
      expect(result.taxableAmount.toNumber()).toBe(1000);
      expect(result.gstAmount.toNumber()).toBe(180);
      expect(result.lineTotal.toNumber()).toBe(1180);
    });

    it('should calculate line item with discount', () => {
      const result = calculateLineItem(10, 100, 10, 18);

      expect(result.baseAmount.toNumber()).toBe(1000);
      expect(result.discountAmount.toNumber()).toBe(100);
      expect(result.taxableAmount.toNumber()).toBe(900);
      expect(result.gstAmount.toNumber()).toBe(162);
      expect(result.lineTotal.toNumber()).toBe(1062);
    });

    it('should calculate line item with different GST rates', () => {
      const result = calculateLineItem(5, 200, 0, 12);

      expect(result.baseAmount.toNumber()).toBe(1000);
      expect(result.gstAmount.toNumber()).toBe(120);
      expect(result.lineTotal.toNumber()).toBe(1120);
    });

    it('should handle decimal quantities', () => {
      const result = calculateLineItem(2.5, 100, 0, 18);

      expect(result.baseAmount.toNumber()).toBe(250);
      expect(result.gstAmount.toNumber()).toBe(45);
      expect(result.lineTotal.toNumber()).toBe(295);
    });

    it('should handle decimal unit prices', () => {
      const result = calculateLineItem(3, 99.99, 0, 18);

      expect(result.baseAmount.toNumber()).toBeCloseTo(299.97, 2);
      expect(result.gstAmount.toNumber()).toBeCloseTo(53.99, 2);
      expect(result.lineTotal.toNumber()).toBeCloseTo(353.96, 2);
    });

    it('should round to 2 decimal places', () => {
      const result = calculateLineItem(7, 33.33, 5, 18);

      // Verify all amounts are rounded to 2 decimal places
      expect(result.baseAmount.decimalPlaces()).toBe(2);
      expect(result.discountAmount.decimalPlaces()).toBe(2);
      expect(result.taxableAmount.decimalPlaces()).toBe(2);
      expect(result.gstAmount.decimalPlaces()).toBe(2);
      expect(result.lineTotal.decimalPlaces()).toBe(2);
    });
  });

  describe('calculateQuotationTotals', () => {
    it('should calculate totals for multiple line items', () => {
      const items = [
        { productId: 'p1', quantity: 10, unitPrice: 100, discountPercent: 0, gstPercent: 18 },
        { productId: 'p2', quantity: 5, unitPrice: 200, discountPercent: 10, gstPercent: 18 },
      ];

      const totals = calculateQuotationTotals(items);

      // Item 1: 10 * 100 = 1000, GST 180, Total 1180
      // Item 2: 5 * 200 = 1000, Disc 100, Taxable 900, GST 162, Total 1062
      // Grand Total: 2242

      expect(totals.subtotal.toNumber()).toBe(2000);
      expect(totals.totalDiscount.toNumber()).toBe(100);
      expect(totals.totalGst.toNumber()).toBe(342);
      expect(totals.grandTotal.toNumber()).toBe(2242);
      expect(totals.items).toHaveLength(2);
    });

    it('should calculate totals with mixed GST rates', () => {
      const items = [
        { productId: 'p1', quantity: 10, unitPrice: 100, discountPercent: 0, gstPercent: 18 },
        { productId: 'p2', quantity: 5, unitPrice: 200, discountPercent: 0, gstPercent: 12 },
      ];

      const totals = calculateQuotationTotals(items);

      // Item 1: 1000 + 180 = 1180
      // Item 2: 1000 + 120 = 1120
      // Grand Total: 2300

      expect(totals.totalGst.toNumber()).toBe(300);
      expect(totals.grandTotal.toNumber()).toBe(2300);
    });

    it('should handle empty items array', () => {
      const totals = calculateQuotationTotals([]);

      expect(totals.subtotal.toNumber()).toBe(0);
      expect(totals.totalDiscount.toNumber()).toBe(0);
      expect(totals.totalGst.toNumber()).toBe(0);
      expect(totals.grandTotal.toNumber()).toBe(0);
      expect(totals.items).toHaveLength(0);
    });

    it('should use default values for optional fields', () => {
      const items = [
        { productId: 'p1', quantity: 10, unitPrice: 100 },
      ];

      const totals = calculateQuotationTotals(items);

      // Default discount: 0%, GST: 18%
      expect(totals.items[0].discountPercent.toNumber()).toBe(0);
      expect(totals.items[0].gstPercent.toNumber()).toBe(18);
      expect(totals.grandTotal.toNumber()).toBe(1180);
    });

    it('should calculate realistic industrial quotation', () => {
      const items = [
        { productId: 'motor-001', quantity: 5, unitPrice: 75000, discountPercent: 5, gstPercent: 18 },
        { productId: 'gear-001', quantity: 3, unitPrice: 50000, discountPercent: 5, gstPercent: 18 },
      ];

      const totals = calculateQuotationTotals(items);

      // Motor: 5 * 75000 = 375000, Disc 18750, Taxable 356250, GST 64125, Total 420375
      // Gear: 3 * 50000 = 150000, Disc 7500, Taxable 142500, GST 25650, Total 168150

      expect(totals.subtotal.toNumber()).toBe(525000);
      expect(totals.totalDiscount.toNumber()).toBe(26250);
      expect(totals.totalGst.toNumber()).toBe(89850);
      expect(totals.grandTotal.toNumber()).toBe(588600);
    });
  });
});
