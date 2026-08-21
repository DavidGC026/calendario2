-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "googleEventId" TEXT,
ADD COLUMN     "googleRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "googleSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "GoogleCalendarLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "syncToken" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleDeletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleDeletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarLink_userId_key" ON "GoogleCalendarLink"("userId");

-- CreateIndex
CREATE INDEX "GoogleDeletion_userId_idx" ON "GoogleDeletion"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleDeletion_userId_googleEventId_key" ON "GoogleDeletion"("userId", "googleEventId");

-- CreateIndex
CREATE INDEX "Event_userId_googleSyncedAt_idx" ON "Event"("userId", "googleSyncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Event_userId_googleEventId_key" ON "Event"("userId", "googleEventId");

-- AddForeignKey
ALTER TABLE "GoogleCalendarLink" ADD CONSTRAINT "GoogleCalendarLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleDeletion" ADD CONSTRAINT "GoogleDeletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

