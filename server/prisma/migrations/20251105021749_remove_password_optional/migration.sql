/*
  Warnings:

  - You are about to drop the column `password` on the `TrialSignup` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `TrialSignup` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `TrialSignup` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `phoneNumber` to the `TrialSignup` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TrialSignup" DROP COLUMN "password",
DROP COLUMN "phone",
ADD COLUMN     "phoneNumber" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TrialSignup_email_key" ON "TrialSignup"("email");
