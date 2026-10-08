-- CreateTable
CREATE TABLE "weave_specs" (
    "shape" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weave_specs_pkey" PRIMARY KEY ("shape")
);
