-- CreateTable
CREATE TABLE "FigmaWebhookSubscription" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "figmaWebhookId" INTEGER NOT NULL,
    "passcode" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FigmaWebhookSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FigmaWebhookSubscription_figmaWebhookId_key" ON "FigmaWebhookSubscription"("figmaWebhookId");

-- CreateIndex
CREATE INDEX "FigmaWebhookSubscription_connectionId_idx" ON "FigmaWebhookSubscription"("connectionId");

-- CreateIndex
CREATE INDEX "FigmaWebhookSubscription_eventType_idx" ON "FigmaWebhookSubscription"("eventType");

-- AddForeignKey
ALTER TABLE "FigmaWebhookSubscription" ADD CONSTRAINT "FigmaWebhookSubscription_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "FigmaTeamConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
