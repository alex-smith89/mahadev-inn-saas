-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "singleTotal" INTEGER NOT NULL DEFAULT 10,
    "doubleTotal" INTEGER NOT NULL DEFAULT 10,
    "tripleTotal" INTEGER NOT NULL DEFAULT 10,
    "quardTotal" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchCapacity" (
    "id" SERIAL NOT NULL,
    "branch" TEXT NOT NULL,
    "singleCap" INTEGER NOT NULL DEFAULT 10,
    "doubleCap" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchCapacity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_branch_key" ON "Inventory"("branch");

-- CreateIndex
CREATE UNIQUE INDEX "BranchCapacity_branch_key" ON "BranchCapacity"("branch");
