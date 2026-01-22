-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "isDevelopmentTask" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TaskGitHubRepository" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "webhookSecret" TEXT,
    "webhookId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskGitHubRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskGitHubActivity" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "action" TEXT,
    "author" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sha" TEXT,
    "branch" TEXT,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskGitHubActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskGitHubRepository_taskId_key" ON "TaskGitHubRepository"("taskId");

-- CreateIndex
CREATE INDEX "TaskGitHubRepository_taskId_idx" ON "TaskGitHubRepository"("taskId");

-- CreateIndex
CREATE INDEX "TaskGitHubActivity_repositoryId_createdAt_idx" ON "TaskGitHubActivity"("repositoryId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskGitHubActivity_type_createdAt_idx" ON "TaskGitHubActivity"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "TaskGitHubRepository" ADD CONSTRAINT "TaskGitHubRepository_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskGitHubActivity" ADD CONSTRAINT "TaskGitHubActivity_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "TaskGitHubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
