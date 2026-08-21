-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "aiEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Admins existentes conservan la IA; el resto debe recibirla explícitamente.
UPDATE "User" SET "aiEnabled" = true WHERE "role" = 'ADMIN';
