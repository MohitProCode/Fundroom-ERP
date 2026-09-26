-- Customer CRM follow-up timeline
CREATE TYPE "CustomerActivityType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE');

CREATE TABLE "customer_activities" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "CustomerActivityType" NOT NULL,
    "subject" TEXT NOT NULL,
    "notes" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_activities_customerId_dueAt_idx" ON "customer_activities"("customerId", "dueAt");
CREATE INDEX "customer_activities_createdAt_idx" ON "customer_activities"("createdAt");
ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
