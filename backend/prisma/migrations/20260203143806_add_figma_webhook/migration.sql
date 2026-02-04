-- CreateTable
CREATE TABLE "FigmaTeamConnection" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "figmaWebhookId" INTEGER,
    "passcode" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FigmaTeamConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FigmaActivity" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "fileKey" TEXT,
    "fileName" TEXT,
    "message" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FigmaActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FigmaTeamConnection_teamId_key" ON "FigmaTeamConnection"("teamId");

-- CreateIndex
CREATE INDEX "FigmaTeamConnection_teamId_idx" ON "FigmaTeamConnection"("teamId");

-- CreateIndex
CREATE INDEX "FigmaActivity_connectionId_createdAt_idx" ON "FigmaActivity"("connectionId", "createdAt");

-- CreateIndex
CREATE INDEX "FigmaActivity_eventType_createdAt_idx" ON "FigmaActivity"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "FigmaTeamConnection" ADD CONSTRAINT "FigmaTeamConnection_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("teamName") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FigmaActivity" ADD CONSTRAINT "FigmaActivity_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "FigmaTeamConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
