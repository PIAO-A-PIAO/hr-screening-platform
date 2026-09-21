-- Positions now have only open and closed states. Existing drafts become open.
ALTER TABLE "Position" ALTER COLUMN "status" DROP DEFAULT;
UPDATE "Position" SET "status" = 'OPEN' WHERE "status" = 'DRAFT';

ALTER TYPE "PositionStatus" RENAME TO "PositionStatus_old";
CREATE TYPE "PositionStatus" AS ENUM ('OPEN', 'CLOSED');
ALTER TABLE "Position" ALTER COLUMN "status" TYPE "PositionStatus"
  USING ("status"::text::"PositionStatus");
ALTER TABLE "Position" ALTER COLUMN "status" SET DEFAULT 'OPEN';
DROP TYPE "PositionStatus_old";
