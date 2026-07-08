/*
  Warnings:

  - You are about to drop the column `diningCharges` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `selfCooking` on the `Booking` table. All the data in the column will be lost.
  - Made the column `price` on table `Booking` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "diningCharges",
DROP COLUMN "selfCooking",
ADD COLUMN     "dinnerCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "extraPersons" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "roomsCount" SET DEFAULT 1,
ALTER COLUMN "roomType" SET DEFAULT 'Double',
ALTER COLUMN "price" SET NOT NULL,
ALTER COLUMN "price" SET DEFAULT 0,
ALTER COLUMN "mealPlan" SET DEFAULT 'EP',
ALTER COLUMN "nights" SET DEFAULT 1,
ALTER COLUMN "branch" SET DEFAULT 'Pokhara';

-- CreateIndex
CREATE INDEX "Booking_bookingNo_idx" ON "Booking"("bookingNo");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
