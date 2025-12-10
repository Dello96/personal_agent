-- DropForeignKey
ALTER TABLE "Team" DROP CONSTRAINT IF EXISTS "Team_teamLeadId_fkey";

-- AlterTable
ALTER TABLE "Team" DROP COLUMN IF EXISTS "teamLeadId";

-- AlterTable
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "teamName" TEXT NOT NULL DEFAULT '';

-- Update existing rows: set teamName to name if teamName is empty
UPDATE "Team" SET "teamName" = "name" WHERE "teamName" = '' OR "teamName" IS NULL;

