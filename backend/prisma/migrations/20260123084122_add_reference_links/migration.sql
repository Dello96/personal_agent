-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "referenceLinks" TEXT[] DEFAULT ARRAY[]::TEXT[];
