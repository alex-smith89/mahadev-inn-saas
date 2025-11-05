/*
  Warnings:

  - You are about to drop the column `phoneNumber` on the `TrialSignup` table. All the data in the column will be lost.
  - Added the required column `password` to the `TrialSignup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `TrialSignup` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "TrialSignup_email_key";

-- AlterTable
ALTER TABLE "TrialSignup" DROP COLUMN "phoneNumber",
ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT NOT NULL;
