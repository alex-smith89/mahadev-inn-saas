-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'VIEWER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Branch" AS ENUM ('Pokhara', 'Kathmandu', 'Bhairawaha', 'Kathmandu1', 'Kathmandu2');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('Confirm', 'Confirmed', 'Pending', 'Cancelled', 'CheckedIn', 'CheckedOut');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('Single', 'Double', 'Suite', 'Deluxe', 'Premium');

-- CreateEnum
CREATE TYPE "MealPlan" AS ENUM ('EP', 'CP', 'MAP', 'AP', 'EPKitchen');

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "bookingNo" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "agentContact" TEXT NOT NULL,
    "roomsCount" INTEGER NOT NULL,
    "roomType" "RoomType" NOT NULL,
    "facility" TEXT,
    "price" DOUBLE PRECISION,
    "mealPlan" "MealPlan" NOT NULL,
    "selfCooking" BOOLEAN,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "nights" INTEGER NOT NULL,
    "remark" TEXT,
    "branch" "Branch" NOT NULL,
    "bookingStatus" "BookingStatus" NOT NULL DEFAULT 'Confirm',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "roomCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kitchenCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diningCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NPR',
    "heads" INTEGER NOT NULL DEFAULT 1,
    "extraPersonCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "childrenCount" INTEGER NOT NULL DEFAULT 0,
    "childrenBelow10" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchCapacity" (
    "id" TEXT NOT NULL,
    "branch" "Branch" NOT NULL,
    "singleCap" INTEGER NOT NULL DEFAULT 0,
    "doubleCap" INTEGER NOT NULL DEFAULT 0,
    "tripleCap" INTEGER NOT NULL DEFAULT 0,
    "quardCap" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchCapacity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "branch" "Branch" NOT NULL DEFAULT 'Pokhara',
    "branches" "Branch"[] DEFAULT ARRAY[]::"Branch"[],
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "branch" "Branch",
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialSignup" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "password" TEXT NOT NULL,
    "branch" "Branch" NOT NULL DEFAULT 'Pokhara',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialSignup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingNo_key" ON "Booking"("bookingNo");

-- CreateIndex
CREATE INDEX "Booking_branch_idx" ON "Booking"("branch");

-- CreateIndex
CREATE INDEX "Booking_checkIn_idx" ON "Booking"("checkIn");

-- CreateIndex
CREATE INDEX "Booking_checkOut_idx" ON "Booking"("checkOut");

-- CreateIndex
CREATE INDEX "Booking_bookingStatus_idx" ON "Booking"("bookingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "BranchCapacity_branch_key" ON "BranchCapacity"("branch");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "TrialSignup_email_key" ON "TrialSignup"("email");
