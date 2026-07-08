-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "bookingNo" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "stayDate" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "branch" "Branch" NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_bookingId_key" ON "Feedback"("bookingId");

-- CreateIndex
CREATE INDEX "Feedback_bookingId_idx" ON "Feedback"("bookingId");

-- CreateIndex
CREATE INDEX "Feedback_guestEmail_idx" ON "Feedback"("guestEmail");

-- CreateIndex
CREATE INDEX "Feedback_submittedAt_idx" ON "Feedback"("submittedAt");
