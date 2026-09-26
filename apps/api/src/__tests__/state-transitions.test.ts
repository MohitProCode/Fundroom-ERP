import { describe, it, expect } from 'vitest';
import { EnquiryStatus, QuotationStatus, SalesOrderStatus } from '@prisma/client';

/**
 * State Transition Tests
 * Verifies that status transitions follow business rules
 */

describe('State Transitions', () => {
  describe('Enquiry Status Transitions', () => {
    const validTransitions: Record<EnquiryStatus, EnquiryStatus[]> = {
      [EnquiryStatus.NEW]: [EnquiryStatus.QUOTED, EnquiryStatus.LOST],
      [EnquiryStatus.QUOTED]: [EnquiryStatus.WON, EnquiryStatus.LOST],
      [EnquiryStatus.WON]: [],
      [EnquiryStatus.LOST]: [],
    };

    it('should allow NEW -> QUOTED', () => {
      expect(validTransitions[EnquiryStatus.NEW]).toContain(EnquiryStatus.QUOTED);
    });

    it('should allow NEW -> LOST', () => {
      expect(validTransitions[EnquiryStatus.NEW]).toContain(EnquiryStatus.LOST);
    });

    it('should allow QUOTED -> WON', () => {
      expect(validTransitions[EnquiryStatus.QUOTED]).toContain(EnquiryStatus.WON);
    });

    it('should allow QUOTED -> LOST', () => {
      expect(validTransitions[EnquiryStatus.QUOTED]).toContain(EnquiryStatus.LOST);
    });

    it('should not allow transitions from WON', () => {
      expect(validTransitions[EnquiryStatus.WON]).toHaveLength(0);
    });

    it('should not allow transitions from LOST', () => {
      expect(validTransitions[EnquiryStatus.LOST]).toHaveLength(0);
    });

    it('should not allow NEW -> WON directly', () => {
      expect(validTransitions[EnquiryStatus.NEW]).not.toContain(EnquiryStatus.WON);
    });
  });

  describe('Quotation Status Transitions', () => {
    const validTransitions: Record<QuotationStatus, QuotationStatus[]> = {
      [QuotationStatus.DRAFT]: [QuotationStatus.SENT],
      [QuotationStatus.SENT]: [QuotationStatus.ACCEPTED, QuotationStatus.REJECTED],
      [QuotationStatus.ACCEPTED]: [],
      [QuotationStatus.REJECTED]: [],
    };

    it('should allow DRAFT -> SENT', () => {
      expect(validTransitions[QuotationStatus.DRAFT]).toContain(QuotationStatus.SENT);
    });

    it('should allow SENT -> ACCEPTED', () => {
      expect(validTransitions[QuotationStatus.SENT]).toContain(QuotationStatus.ACCEPTED);
    });

    it('should allow SENT -> REJECTED', () => {
      expect(validTransitions[QuotationStatus.SENT]).toContain(QuotationStatus.REJECTED);
    });

    it('should not allow DRAFT -> ACCEPTED directly', () => {
      expect(validTransitions[QuotationStatus.DRAFT]).not.toContain(QuotationStatus.ACCEPTED);
    });

    it('should not allow DRAFT -> REJECTED directly', () => {
      expect(validTransitions[QuotationStatus.DRAFT]).not.toContain(QuotationStatus.REJECTED);
    });

    it('should not allow transitions from ACCEPTED', () => {
      expect(validTransitions[QuotationStatus.ACCEPTED]).toHaveLength(0);
    });

    it('should not allow REJECTED -> ACCEPTED', () => {
      expect(validTransitions[QuotationStatus.REJECTED]).not.toContain(QuotationStatus.ACCEPTED);
    });
  });

  describe('Sales Order Status Transitions', () => {
    const validTransitions: Record<SalesOrderStatus, SalesOrderStatus[]> = {
      [SalesOrderStatus.PENDING]: [SalesOrderStatus.CONFIRMED, SalesOrderStatus.CANCELLED],
      [SalesOrderStatus.CONFIRMED]: [SalesOrderStatus.DISPATCHED, SalesOrderStatus.CANCELLED],
      [SalesOrderStatus.DISPATCHED]: [],
      [SalesOrderStatus.CANCELLED]: [],
    };

    it('should allow PENDING -> CONFIRMED', () => {
      expect(validTransitions[SalesOrderStatus.PENDING]).toContain(SalesOrderStatus.CONFIRMED);
    });

    it('should allow PENDING -> CANCELLED', () => {
      expect(validTransitions[SalesOrderStatus.PENDING]).toContain(SalesOrderStatus.CANCELLED);
    });

    it('should allow CONFIRMED -> DISPATCHED', () => {
      expect(validTransitions[SalesOrderStatus.CONFIRMED]).toContain(SalesOrderStatus.DISPATCHED);
    });

    it('should allow CONFIRMED -> CANCELLED (releases reserved stock)', () => {
      expect(validTransitions[SalesOrderStatus.CONFIRMED]).toContain(SalesOrderStatus.CANCELLED);
    });

    it('should not allow PENDING -> DISPATCHED directly', () => {
      expect(validTransitions[SalesOrderStatus.PENDING]).not.toContain(SalesOrderStatus.DISPATCHED);
    });

    it('should not allow transitions from DISPATCHED', () => {
      expect(validTransitions[SalesOrderStatus.DISPATCHED]).toHaveLength(0);
    });

    it('should not allow CANCELLED -> CONFIRMED', () => {
      expect(validTransitions[SalesOrderStatus.CANCELLED]).not.toContain(SalesOrderStatus.CONFIRMED);
    });

    it('should not allow DISPATCHED -> CANCELLED', () => {
      expect(validTransitions[SalesOrderStatus.DISPATCHED]).not.toContain(SalesOrderStatus.CANCELLED);
    });
  });

  describe('Transition Validation Helper', () => {
    function isValidTransition<T extends string>(
      current: T,
      target: T,
      validMap: Record<T, T[]>
    ): boolean {
      return validMap[current]?.includes(target) ?? false;
    }

    it('should validate enquiry transitions', () => {
      const enquiryTransitions: Record<EnquiryStatus, EnquiryStatus[]> = {
        [EnquiryStatus.NEW]: [EnquiryStatus.QUOTED, EnquiryStatus.LOST],
        [EnquiryStatus.QUOTED]: [EnquiryStatus.WON, EnquiryStatus.LOST],
        [EnquiryStatus.WON]: [],
        [EnquiryStatus.LOST]: [],
      };

      expect(isValidTransition(EnquiryStatus.NEW, EnquiryStatus.QUOTED, enquiryTransitions)).toBe(true);
      expect(isValidTransition(EnquiryStatus.NEW, EnquiryStatus.WON, enquiryTransitions)).toBe(false);
    });

    it('should validate quotation transitions', () => {
      const quotationTransitions: Record<QuotationStatus, QuotationStatus[]> = {
        [QuotationStatus.DRAFT]: [QuotationStatus.SENT],
        [QuotationStatus.SENT]: [QuotationStatus.ACCEPTED, QuotationStatus.REJECTED],
        [QuotationStatus.ACCEPTED]: [],
        [QuotationStatus.REJECTED]: [],
      };

      expect(isValidTransition(QuotationStatus.DRAFT, QuotationStatus.SENT, quotationTransitions)).toBe(true);
      expect(isValidTransition(QuotationStatus.DRAFT, QuotationStatus.ACCEPTED, quotationTransitions)).toBe(false);
    });

    it('should validate sales order transitions', () => {
      const orderTransitions: Record<SalesOrderStatus, SalesOrderStatus[]> = {
        [SalesOrderStatus.PENDING]: [SalesOrderStatus.CONFIRMED, SalesOrderStatus.CANCELLED],
        [SalesOrderStatus.CONFIRMED]: [SalesOrderStatus.DISPATCHED, SalesOrderStatus.CANCELLED],
        [SalesOrderStatus.DISPATCHED]: [],
        [SalesOrderStatus.CANCELLED]: [],
      };

      expect(isValidTransition(SalesOrderStatus.PENDING, SalesOrderStatus.CONFIRMED, orderTransitions)).toBe(true);
      expect(isValidTransition(SalesOrderStatus.PENDING, SalesOrderStatus.DISPATCHED, orderTransitions)).toBe(false);
    });
  });
});
