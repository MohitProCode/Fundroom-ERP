ALTER TABLE "quotations" ADD COLUMN "specialDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "quotations" ADD COLUMN "specialDiscountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
