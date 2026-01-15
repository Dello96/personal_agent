-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "referenceImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
