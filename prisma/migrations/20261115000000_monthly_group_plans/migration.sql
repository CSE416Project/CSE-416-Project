BEGIN;
ALTER TABLE "GroupBudgetPlan" ADD COLUMN "month" TEXT;
UPDATE "GroupBudgetPlan" SET "month" = to_char("updatedAt", 'YYYY-MM');
ALTER TABLE "GroupBudgetPlan" ALTER COLUMN "month" SET NOT NULL,
  DROP CONSTRAINT "GroupBudgetPlan_pkey",
  ADD PRIMARY KEY ("groupId", "month");
COMMIT;
