CREATE TYPE "QuestionType" AS ENUM ('VIDEO', 'MULTIPLE_CHOICE', 'SHORT_ANSWER');
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "QuestionAssetKind" AS ENUM ('VIDEO', 'THUMBNAIL');

CREATE TABLE "Question" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "QuestionType" NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "testId" TEXT,
  "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
  "creatorId" TEXT,
  "creatorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoQuestionItem" (
  "questionId" TEXT NOT NULL,
  "videoAssetId" TEXT,
  "thumbnailAssetId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoQuestionItem_pkey" PRIMARY KEY ("questionId")
);

CREATE TABLE "MultipleChoiceQuestionItem" (
  "questionId" TEXT NOT NULL,
  "allowMultipleSelection" BOOLEAN NOT NULL DEFAULT FALSE,
  "shuffleOptions" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MultipleChoiceQuestionItem_pkey" PRIMARY KEY ("questionId")
);

CREATE TABLE "MultipleChoiceQuestionOption" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "isCorrect" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MultipleChoiceQuestionOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShortAnswerQuestionItem" (
  "questionId" TEXT NOT NULL,
  "placeholder" TEXT,
  "maxLength" INTEGER,
  "answerHint" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShortAnswerQuestionItem_pkey" PRIMARY KEY ("questionId")
);

CREATE TABLE "QuestionAsset" (
  "id" TEXT NOT NULL,
  "kind" "QuestionAssetKind" NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "durationSeconds" DOUBLE PRECISION,
  "checksum" TEXT NOT NULL,
  "ownerId" TEXT,
  "originalName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuestionAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Question_testId_order_key" ON "Question"("testId", "order");
CREATE INDEX "Question_type_idx" ON "Question"("type");
CREATE UNIQUE INDEX "VideoQuestionItem_videoAssetId_key" ON "VideoQuestionItem"("videoAssetId");
CREATE UNIQUE INDEX "VideoQuestionItem_thumbnailAssetId_key" ON "VideoQuestionItem"("thumbnailAssetId");
CREATE INDEX "MultipleChoiceQuestionOption_questionId_order_idx" ON "MultipleChoiceQuestionOption"("questionId", "order");
CREATE INDEX "QuestionAsset_kind_idx" ON "QuestionAsset"("kind");
CREATE UNIQUE INDEX "QuestionAsset_storageKey_key" ON "QuestionAsset"("storageKey");

ALTER TABLE "VideoQuestionItem"
  ADD CONSTRAINT "VideoQuestionItem_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VideoQuestionItem"
  ADD CONSTRAINT "VideoQuestionItem_videoAssetId_fkey"
  FOREIGN KEY ("videoAssetId") REFERENCES "QuestionAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VideoQuestionItem"
  ADD CONSTRAINT "VideoQuestionItem_thumbnailAssetId_fkey"
  FOREIGN KEY ("thumbnailAssetId") REFERENCES "QuestionAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MultipleChoiceQuestionItem"
  ADD CONSTRAINT "MultipleChoiceQuestionItem_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MultipleChoiceQuestionOption"
  ADD CONSTRAINT "MultipleChoiceQuestionOption_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "MultipleChoiceQuestionItem"("questionId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShortAnswerQuestionItem"
  ADD CONSTRAINT "ShortAnswerQuestionItem_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
