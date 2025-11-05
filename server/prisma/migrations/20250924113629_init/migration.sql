/*
  Warnings:

  - You are about to drop the column `userAgent` on the `AuditLog` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "userAgent",
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "username" DROP NOT NULL,
ALTER COLUMN "entity" DROP NOT NULL,
ALTER COLUMN "details" DROP NOT NULL;
