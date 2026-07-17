-- AlterEnum
ALTER TYPE "RoomTypeEnum" ADD VALUE 'Standard';

-- AlterTable
ALTER TABLE "BranchCapacity" ADD COLUMN     "standardCap" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "branch_room_pricing" ADD COLUMN     "standardPrice" DOUBLE PRECISION NOT NULL DEFAULT 4000,
ALTER COLUMN "deluxePrice" SET DEFAULT 6000,
ALTER COLUMN "premiumPrice" SET DEFAULT 10000;
