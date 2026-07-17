-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RoomTypeEnum" ADD VALUE 'Triple';
ALTER TYPE "RoomTypeEnum" ADD VALUE 'Quard';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "breakfastCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "createdByRole" VARCHAR(20),
ADD COLUMN     "extraPersons" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "roomCapacity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "totalCapacity" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "BranchCapacity" ADD COLUMN     "deluxeCap" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "premiumCap" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "suiteCap" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "roomNumber" VARCHAR(50) NOT NULL,
    "branch" "Branch" NOT NULL,
    "roomType" "RoomTypeEnum" NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(20) NOT NULL DEFAULT 'available',
    "floor" VARCHAR(10),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomAvailability" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "bookingId" TEXT,

    CONSTRAINT "RoomAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingRoom" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_room_pricing" (
    "id" TEXT NOT NULL,
    "branch" "Branch" NOT NULL,
    "singlePrice" DOUBLE PRECISION NOT NULL DEFAULT 2000,
    "doublePrice" DOUBLE PRECISION NOT NULL DEFAULT 3000,
    "triplePrice" DOUBLE PRECISION NOT NULL DEFAULT 4500,
    "quardPrice" DOUBLE PRECISION NOT NULL DEFAULT 5500,
    "suitePrice" DOUBLE PRECISION NOT NULL DEFAULT 8000,
    "deluxePrice" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "premiumPrice" DOUBLE PRECISION NOT NULL DEFAULT 12000,
    "extraPersonPrice" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_room_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Room_roomNumber_key" ON "Room"("roomNumber");

-- CreateIndex
CREATE INDEX "Room_branch_idx" ON "Room"("branch");

-- CreateIndex
CREATE INDEX "Room_roomType_idx" ON "Room"("roomType");

-- CreateIndex
CREATE INDEX "Room_status_idx" ON "Room"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Room_branch_roomNumber_key" ON "Room"("branch", "roomNumber");

-- CreateIndex
CREATE INDEX "RoomAvailability_date_idx" ON "RoomAvailability"("date");

-- CreateIndex
CREATE INDEX "RoomAvailability_isAvailable_idx" ON "RoomAvailability"("isAvailable");

-- CreateIndex
CREATE INDEX "RoomAvailability_bookingId_idx" ON "RoomAvailability"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomAvailability_roomId_date_key" ON "RoomAvailability"("roomId", "date");

-- CreateIndex
CREATE INDEX "BookingRoom_bookingId_idx" ON "BookingRoom"("bookingId");

-- CreateIndex
CREATE INDEX "BookingRoom_roomId_idx" ON "BookingRoom"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingRoom_bookingId_roomId_key" ON "BookingRoom"("bookingId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "branch_room_pricing_branch_key" ON "branch_room_pricing"("branch");

-- CreateIndex
CREATE INDEX "Booking_roomType_idx" ON "Booking"("roomType");

-- AddForeignKey
ALTER TABLE "RoomAvailability" ADD CONSTRAINT "RoomAvailability_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomAvailability" ADD CONSTRAINT "RoomAvailability_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRoom" ADD CONSTRAINT "BookingRoom_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRoom" ADD CONSTRAINT "BookingRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
