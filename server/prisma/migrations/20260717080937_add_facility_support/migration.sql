/*
  Warnings:

  - The values [Deluxe,Premium,Standard] on the enum `RoomTypeEnum` will be removed. If these variants are still used in the database, this will fail.
  - The `facility` column on the `Booking` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `deluxeCap` on the `BranchCapacity` table. All the data in the column will be lost.
  - You are about to drop the column `premiumCap` on the `BranchCapacity` table. All the data in the column will be lost.
  - You are about to drop the column `standardCap` on the `BranchCapacity` table. All the data in the column will be lost.
  - You are about to drop the column `deluxePrice` on the `branch_room_pricing` table. All the data in the column will be lost.
  - You are about to drop the column `premiumPrice` on the `branch_room_pricing` table. All the data in the column will be lost.
  - You are about to drop the column `standardPrice` on the `branch_room_pricing` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "FacilityEnum" AS ENUM ('Standard', 'Deluxe', 'Premium');

-- AlterEnum
BEGIN;
CREATE TYPE "RoomTypeEnum_new" AS ENUM ('Single', 'Double', 'Triple', 'Quard', 'Suite');
ALTER TABLE "Booking" ALTER COLUMN "roomType" TYPE "RoomTypeEnum_new" USING ("roomType"::text::"RoomTypeEnum_new");
ALTER TABLE "Room" ALTER COLUMN "roomType" TYPE "RoomTypeEnum_new" USING ("roomType"::text::"RoomTypeEnum_new");
ALTER TYPE "RoomTypeEnum" RENAME TO "RoomTypeEnum_old";
ALTER TYPE "RoomTypeEnum_new" RENAME TO "RoomTypeEnum";
DROP TYPE "RoomTypeEnum_old";
COMMIT;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "facilityMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
DROP COLUMN "facility",
ADD COLUMN     "facility" "FacilityEnum" NOT NULL DEFAULT 'Standard';

-- AlterTable
ALTER TABLE "BranchCapacity" DROP COLUMN "deluxeCap",
DROP COLUMN "premiumCap",
DROP COLUMN "standardCap";

-- AlterTable
ALTER TABLE "branch_room_pricing" DROP COLUMN "deluxePrice",
DROP COLUMN "premiumPrice",
DROP COLUMN "standardPrice";

-- CreateIndex
CREATE INDEX "Booking_facility_idx" ON "Booking"("facility");
