-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('Single', 'Double', 'Triple', 'Quard');

-- CreateEnum
CREATE TYPE "MealPlan" AS ENUM ('BB', 'MAP', 'AP', 'EP', 'EPKitchen');

-- CreateEnum
CREATE TYPE "Facility" AS ENUM ('AC', 'NonAC');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('Owner', 'Manager', 'Viewer');

-- CreateEnum
CREATE TYPE "Branch" AS ENUM ('Kathmandu1', 'Kathmandu2', 'Pokhara', 'Bhairawaha');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "branch" "Branch" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "bookingNo" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "agentContact" TEXT NOT NULL,
    "roomsCount" INTEGER NOT NULL,
    "roomType" "RoomType" NOT NULL,
    "facility" "Facility" NOT NULL,
    "price" INTEGER,
    "mealPlan" "MealPlan" NOT NULL,
    "selfCooking" INTEGER,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "nights" INTEGER NOT NULL,
    "remark" TEXT,
    "branch" "Branch" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingNo_key" ON "Booking"("bookingNo");

-- CreateIndex
CREATE INDEX "Booking_branch_checkIn_checkOut_idx" ON "Booking"("branch", "checkIn", "checkOut");
