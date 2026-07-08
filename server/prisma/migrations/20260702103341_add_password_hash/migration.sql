/*
  Warnings:

  - You are about to alter the column `username` on the `AuditLog` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `action` on the `AuditLog` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `entity` on the `AuditLog` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `entityId` on the `AuditLog` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `ip` on the `AuditLog` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `agentName` on the `Booking` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `agentContact` on the `Booking` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `facility` on the `Booking` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `currency` on the `Booking` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(10)`.
  - You are about to alter the column `email` on the `Booking` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `bookingNo` on the `Feedback` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `guestName` on the `Feedback` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `guestEmail` on the `Feedback` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `status` on the `Feedback` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `email` on the `TrialSignup` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `name` on the `TrialSignup` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `phone` on the `TrialSignup` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `company` on the `TrialSignup` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `password` on the `TrialSignup` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `status` on the `TrialSignup` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to drop the column `branch` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `branches` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - You are about to alter the column `username` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `email` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `phone` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - Added the required column `updated_at` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `roomType` on the `Booking` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `password_hash` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RoomTypeEnum" AS ENUM ('Single', 'Double', 'Suite', 'Deluxe', 'Premium');

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "username" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "action" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "entity" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "entityId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "ip" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "agentName" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "agentContact" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "roomsCount" SET DEFAULT 1,
DROP COLUMN "roomType",
ADD COLUMN     "roomType" "RoomTypeEnum" NOT NULL,
ALTER COLUMN "facility" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "price" SET DEFAULT 0,
ALTER COLUMN "mealPlan" SET DEFAULT 'EP',
ALTER COLUMN "currency" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "email" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "selfCooking" SET DEFAULT false;

-- AlterTable
ALTER TABLE "Feedback" ALTER COLUMN "bookingNo" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "guestName" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "guestEmail" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "status" SET DATA TYPE VARCHAR(20);

-- AlterTable
ALTER TABLE "TrialSignup" ALTER COLUMN "email" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "phone" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "company" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "password" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "status" SET DATA TYPE VARCHAR(20);

-- AlterTable
ALTER TABLE "User" DROP COLUMN "branch",
DROP COLUMN "branches",
DROP COLUMN "createdAt",
DROP COLUMN "password",
DROP COLUMN "updatedAt",
ADD COLUMN     "canCreateBookings" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canViewAllBranches" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "password_hash" VARCHAR(255) NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "username" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "email" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "phone" SET DATA TYPE VARCHAR(20);

-- DropEnum
DROP TYPE "RoomType";

-- CreateTable
CREATE TABLE "UserBranch" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "branch_name" VARCHAR(100) NOT NULL,

    CONSTRAINT "UserBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomTypeModel" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "maxOccupancy" INTEGER NOT NULL DEFAULT 1,
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomTypeModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomPricing" (
    "id" SERIAL NOT NULL,
    "branch" "Branch" NOT NULL,
    "roomType" VARCHAR(50) NOT NULL,
    "season" VARCHAR(50) NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingHistory" (
    "id" SERIAL NOT NULL,
    "branch" "Branch" NOT NULL,
    "roomType" VARCHAR(50) NOT NULL,
    "season" VARCHAR(50) NOT NULL,
    "oldPrice" DOUBLE PRECISION NOT NULL,
    "newPrice" DOUBLE PRECISION NOT NULL,
    "changedBy" VARCHAR(50) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonalPricingRule" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "season" VARCHAR(50) NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "startMonth" INTEGER NOT NULL,
    "endMonth" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonalPricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomTypeCapacity" (
    "id" SERIAL NOT NULL,
    "branch" "Branch" NOT NULL,
    "roomType" VARCHAR(50) NOT NULL,
    "totalRooms" INTEGER NOT NULL DEFAULT 0,
    "occupiedRooms" INTEGER NOT NULL DEFAULT 0,
    "availableRooms" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomTypeCapacity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserBranch_branch_name_idx" ON "UserBranch"("branch_name");

-- CreateIndex
CREATE UNIQUE INDEX "UserBranch_user_id_branch_name_key" ON "UserBranch"("user_id", "branch_name");

-- CreateIndex
CREATE UNIQUE INDEX "RoomTypeModel_name_key" ON "RoomTypeModel"("name");

-- CreateIndex
CREATE INDEX "RoomTypeModel_name_idx" ON "RoomTypeModel"("name");

-- CreateIndex
CREATE INDEX "RoomTypeModel_isActive_idx" ON "RoomTypeModel"("isActive");

-- CreateIndex
CREATE INDEX "RoomPricing_branch_roomType_idx" ON "RoomPricing"("branch", "roomType");

-- CreateIndex
CREATE INDEX "RoomPricing_isActive_idx" ON "RoomPricing"("isActive");

-- CreateIndex
CREATE INDEX "RoomPricing_season_idx" ON "RoomPricing"("season");

-- CreateIndex
CREATE UNIQUE INDEX "RoomPricing_branch_roomType_season_startDate_endDate_key" ON "RoomPricing"("branch", "roomType", "season", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "PricingHistory_branch_roomType_idx" ON "PricingHistory"("branch", "roomType");

-- CreateIndex
CREATE INDEX "PricingHistory_created_at_idx" ON "PricingHistory"("created_at");

-- CreateIndex
CREATE INDEX "PricingHistory_season_idx" ON "PricingHistory"("season");

-- CreateIndex
CREATE INDEX "SeasonalPricingRule_season_isActive_idx" ON "SeasonalPricingRule"("season", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonalPricingRule_season_key" ON "SeasonalPricingRule"("season");

-- CreateIndex
CREATE INDEX "RoomTypeCapacity_branch_roomType_idx" ON "RoomTypeCapacity"("branch", "roomType");

-- CreateIndex
CREATE UNIQUE INDEX "RoomTypeCapacity_branch_roomType_key" ON "RoomTypeCapacity"("branch", "roomType");

-- CreateIndex
CREATE INDEX "AuditLog_username_idx" ON "AuditLog"("username");

-- CreateIndex
CREATE INDEX "AuditLog_branch_idx" ON "AuditLog"("branch");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "Booking_bookingNo_idx" ON "Booking"("bookingNo");

-- CreateIndex
CREATE INDEX "Booking_created_at_idx" ON "Booking"("created_at");

-- CreateIndex
CREATE INDEX "BranchCapacity_branch_idx" ON "BranchCapacity"("branch");

-- CreateIndex
CREATE INDEX "Feedback_branch_idx" ON "Feedback"("branch");

-- CreateIndex
CREATE INDEX "Feedback_status_idx" ON "Feedback"("status");

-- CreateIndex
CREATE INDEX "TrialSignup_email_idx" ON "TrialSignup"("email");

-- CreateIndex
CREATE INDEX "TrialSignup_status_idx" ON "TrialSignup"("status");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- AddForeignKey
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomPricing" ADD CONSTRAINT "RoomPricing_roomType_fkey" FOREIGN KEY ("roomType") REFERENCES "RoomTypeModel"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
