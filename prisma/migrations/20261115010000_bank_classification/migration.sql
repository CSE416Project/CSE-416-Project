ALTER TABLE "BankTransaction" ADD COLUMN "classificationVersion" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "BankTransaction_accountId_classificationVersion_idx" ON "BankTransaction"("accountId", "classificationVersion");
