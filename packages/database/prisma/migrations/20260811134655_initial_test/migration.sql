-- DropIndex
DROP INDEX "Question_testId_order_key";

-- CreateIndex
CREATE INDEX "Question_testId_order_idx" ON "Question"("testId", "order");
