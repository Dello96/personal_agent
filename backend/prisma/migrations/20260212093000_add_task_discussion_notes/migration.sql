-- CreateTable
CREATE TABLE "TaskDiscussionNote" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskDiscussionNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskDiscussionNote_taskId_authorId_key" ON "TaskDiscussionNote"("taskId", "authorId");

-- CreateIndex
CREATE INDEX "TaskDiscussionNote_taskId_updatedAt_idx" ON "TaskDiscussionNote"("taskId", "updatedAt");

-- CreateIndex
CREATE INDEX "TaskDiscussionNote_authorId_updatedAt_idx" ON "TaskDiscussionNote"("authorId", "updatedAt");

-- AddForeignKey
ALTER TABLE "TaskDiscussionNote" ADD CONSTRAINT "TaskDiscussionNote_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDiscussionNote" ADD CONSTRAINT "TaskDiscussionNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
