-- CreateTable
CREATE TABLE "drawing_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "logoDataUrl" TEXT,
    "views" JSONB NOT NULL,
    "fields" JSONB NOT NULL,
    "titleBlockWidthMm" DOUBLE PRECISION NOT NULL,
    "fieldRowMinHeightMm" DOUBLE PRECISION NOT NULL,
    "showViewFrame" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drawing_templates_pkey" PRIMARY KEY ("id")
);
