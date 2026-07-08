-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "branchName" VARCHAR(100),
ADD COLUMN     "createdBy" VARCHAR(50),
ADD COLUMN     "createdByUsername" VARCHAR(50),
ADD COLUMN     "creatorRole" VARCHAR(20),
ADD COLUMN     "userRole" VARCHAR(20);

-- CreateIndex
CREATE INDEX "Booking_branchName_idx" ON "Booking"("branchName");

-- CreateIndex
CREATE INDEX "Booking_createdBy_idx" ON "Booking"("createdBy");

-- CreateIndex
CREATE INDEX "Booking_userRole_idx" ON "Booking"("userRole");
