/*
  Warnings:

  - The `facility` column on the `Booking` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "facility",
ADD COLUMN     "facility" VARCHAR(50) NOT NULL DEFAULT 'Standard';

-- DropEnum
DROP TYPE "FacilityEnum";

-- CreateIndex
CREATE INDEX "Booking_facility_idx" ON "Booking"("facility");
