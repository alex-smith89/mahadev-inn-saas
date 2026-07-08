/*
  Warnings:

  - You are about to drop the column `dinnerCharges` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `extraPersons` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `totalCost` on the `Booking` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_bookingId_fkey";

-- DropIndex
DROP INDEX "Booking_bookingNo_idx";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "dinnerCharges",
DROP COLUMN "extraPersons",
DROP COLUMN "totalCost",
ADD COLUMN     "diningCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "selfCooking" BOOLEAN,
ALTER COLUMN "roomsCount" DROP DEFAULT,
ALTER COLUMN "roomType" DROP DEFAULT,
ALTER COLUMN "price" DROP NOT NULL,
ALTER COLUMN "price" DROP DEFAULT,
ALTER COLUMN "mealPlan" DROP DEFAULT,
ALTER COLUMN "nights" DROP DEFAULT,
ALTER COLUMN "branch" DROP DEFAULT;
