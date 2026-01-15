-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('MEETING_ROOM', 'MEETING', 'LEAVE', 'VACATION');

-- CreateEnum
CREATE TYPE "CalendarEventStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "type" "CalendarEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "status" "CalendarEventStatus" NOT NULL DEFAULT 'APPROVED',
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarEvent_startDate_endDate_idx" ON "CalendarEvent"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "CalendarEvent_teamId_idx" ON "CalendarEvent"("teamId");

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("teamName") ON DELETE RESTRICT ON UPDATE CASCADE;
