/*
  Warnings:

  - You are about to drop the column `userId` on the `AuditLog` table. All the data in the column will be lost.
  - Made the column `username` on table `AuditLog` required. This step will fail if there are existing NULL values in that column.
  - Made the column `entity` on table `AuditLog` required. This step will fail if there are existing NULL values in that column.
  - Made the column `details` on table `AuditLog` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "userId",
ADD COLUMN     "ip" TEXT,
ADD COLUMN     "userAgent" TEXT,
ALTER COLUMN "username" SET NOT NULL,
ALTER COLUMN "entity" SET NOT NULL,
ALTER COLUMN "details" SET NOT NULL;
