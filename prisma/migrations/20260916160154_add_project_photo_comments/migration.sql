-- AlterTable
ALTER TABLE "feedback" ADD COLUMN     "projectPhotoId" UUID;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_projectPhotoId_fkey" FOREIGN KEY ("projectPhotoId") REFERENCES "project_photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
