/*
  Warnings:

  - You are about to drop the column `name` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `teamId` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[teamName]` on the table `Team` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_teamId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_teamId_fkey";

-- AlterTable
ALTER TABLE "Team" DROP COLUMN "name",
ALTER COLUMN "teamName" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "teamId",
ADD COLUMN     "teamName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Team_teamName_key" ON "Team"("teamName");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamName_fkey" FOREIGN KEY ("teamName") REFERENCES "Team"("teamName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("teamName") ON DELETE RESTRICT ON UPDATE CASCADE;
