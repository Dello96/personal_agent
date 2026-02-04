-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "chatRoomId" TEXT,
ADD COLUMN     "chatType" TEXT;

-- CreateIndex
CREATE INDEX "Notification_userId_chatRoomId_isRead_createdAt_idx" ON "Notification"("userId", "chatRoomId", "isRead", "createdAt");
