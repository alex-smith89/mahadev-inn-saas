/*
  Warnings:

  - Changed the type of `branch` on the `notifications` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "actual_check_in" TIMESTAMP(3),
ADD COLUMN     "actual_check_out" TIMESTAMP(3),
ADD COLUMN     "checkin_reminder_sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "checkout_reminder_sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "room_number" VARCHAR(50);

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "branch",
ADD COLUMN     "branch" "Branch" NOT NULL;

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "to" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "template" VARCHAR(100) NOT NULL,
    "data" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "booking_id" TEXT,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_logs" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "branch" "Branch" NOT NULL,
    "booking_id" TEXT,
    "status" VARCHAR(20) NOT NULL,
    "message" TEXT,
    "details" JSONB,
    "executedBy" VARCHAR(50) NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_logs_to_idx" ON "email_logs"("to");

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "email_logs"("status");

-- CreateIndex
CREATE INDEX "email_logs_sent_at_idx" ON "email_logs"("sent_at");

-- CreateIndex
CREATE INDEX "email_logs_created_at_idx" ON "email_logs"("created_at");

-- CreateIndex
CREATE INDEX "email_logs_booking_id_idx" ON "email_logs"("booking_id");

-- CreateIndex
CREATE INDEX "automation_logs_branch_idx" ON "automation_logs"("branch");

-- CreateIndex
CREATE INDEX "automation_logs_type_idx" ON "automation_logs"("type");

-- CreateIndex
CREATE INDEX "automation_logs_status_idx" ON "automation_logs"("status");

-- CreateIndex
CREATE INDEX "automation_logs_executed_at_idx" ON "automation_logs"("executed_at");

-- CreateIndex
CREATE INDEX "automation_logs_booking_id_idx" ON "automation_logs"("booking_id");

-- CreateIndex
CREATE INDEX "Booking_actual_check_in_idx" ON "Booking"("actual_check_in");

-- CreateIndex
CREATE INDEX "Booking_actual_check_out_idx" ON "Booking"("actual_check_out");

-- CreateIndex
CREATE INDEX "notifications_branch_idx" ON "notifications"("branch");

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
