-- CreateEnum
CREATE TYPE "ResponseType" AS ENUM ('VIDEO', 'MULTIPLE_CHOICE', 'SHORT_ANSWER');

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL,
    "type" "ResponseType" NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "attemptId" TEXT,
    "score" DOUBLE PRECISION,
    "evaluatorUserId" TEXT,
    "evaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoResponseItem" (
    "responseId" TEXT NOT NULL,
    "assetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoResponseItem_pkey" PRIMARY KEY ("responseId")
);

-- CreateTable
CREATE TABLE "MultipleChoiceResponseItem" (
    "responseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MultipleChoiceResponseItem_pkey" PRIMARY KEY ("responseId")
);

-- CreateTable
CREATE TABLE "MultipleChoiceResponseSelection" (
    "responseId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MultipleChoiceResponseSelection_pkey" PRIMARY KEY ("responseId","optionId")
);

-- CreateTable
CREATE TABLE "ShortAnswerResponseItem" (
    "responseId" TEXT NOT NULL,
    "textValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShortAnswerResponseItem_pkey" PRIMARY KEY ("responseId")
);

-- CreateTable
CREATE TABLE "ResponseAsset" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "checksum" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "originalName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponseAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Response_testId_userId_idx" ON "Response"("testId", "userId");

-- CreateIndex
CREATE INDEX "Response_questionId_idx" ON "Response"("questionId");

-- CreateIndex
CREATE INDEX "Response_attemptId_idx" ON "Response"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "Response_userId_testId_questionId_key" ON "Response"("userId", "testId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoResponseItem_assetId_key" ON "VideoResponseItem"("assetId");

-- CreateIndex
CREATE INDEX "MultipleChoiceResponseSelection_optionId_idx" ON "MultipleChoiceResponseSelection"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseAsset_storageKey_key" ON "ResponseAsset"("storageKey");

-- CreateIndex
CREATE INDEX "ResponseAsset_ownerId_idx" ON "ResponseAsset"("ownerId");

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_evaluatorUserId_fkey" FOREIGN KEY ("evaluatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoResponseItem" ADD CONSTRAINT "VideoResponseItem_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoResponseItem" ADD CONSTRAINT "VideoResponseItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "ResponseAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MultipleChoiceResponseItem" ADD CONSTRAINT "MultipleChoiceResponseItem_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MultipleChoiceResponseSelection" ADD CONSTRAINT "MultipleChoiceResponseSelection_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "MultipleChoiceResponseItem"("responseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MultipleChoiceResponseSelection" ADD CONSTRAINT "MultipleChoiceResponseSelection_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "MultipleChoiceQuestionOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortAnswerResponseItem" ADD CONSTRAINT "ShortAnswerResponseItem_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;
