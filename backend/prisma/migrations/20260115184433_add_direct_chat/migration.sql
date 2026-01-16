-- CreateEnum
CREATE TYPE "ChatRoomType" AS ENUM ('TEAM', 'DIRECT');

-- DropForeignKey
ALTER TABLE "ChatRoom" DROP CONSTRAINT "ChatRoom_teamId_fkey";

-- AlterTable
ALTER TABLE "ChatRoom" ADD COLUMN     "type" "ChatRoomType" NOT NULL DEFAULT 'TEAM',
ALTER COLUMN "teamId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ChatRoomParticipant" (
    "id" TEXT NOT NULL,
    "chatRoomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRoomParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatRoomParticipant_userId_idx" ON "ChatRoomParticipant"("userId");

-- CreateIndex
CREATE INDEX "ChatRoomParticipant_chatRoomId_idx" ON "ChatRoomParticipant"("chatRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoomParticipant_chatRoomId_userId_key" ON "ChatRoomParticipant"("chatRoomId", "userId");

-- CreateIndex
CREATE INDEX "ChatRoom_type_idx" ON "ChatRoom"("type");

-- AddForeignKey
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("teamName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoomParticipant" ADD CONSTRAINT "ChatRoomParticipant_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoomParticipant" ADD CONSTRAINT "ChatRoomParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
