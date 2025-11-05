/*
  Warnings:

  - You are about to drop the column `branch` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Booking" ALTER COLUMN "bookingStatus" SET DEFAULT 'Confirmed';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "branch",
ADD COLUMN     "branches" "Branch"[];
