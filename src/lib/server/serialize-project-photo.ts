import type { Prisma } from "@prisma/client";
import { formatDDMMYYYY } from "@/lib/mock-data";

export function projectPhotoInclude() {
  return {
    project: { select: { projectCode: true } },
    releasedProduct: { select: { productCode: true } },
  } satisfies Prisma.ProjectPhotoInclude;
}

type ProjectPhotoWithRelations = Prisma.ProjectPhotoGetPayload<{ include: ReturnType<typeof projectPhotoInclude> }>;

export function serializeProjectPhoto(p: ProjectPhotoWithRelations) {
  return {
    id: p.id,
    projectCode: p.project.projectCode,
    fileName: p.fileName,
    url: p.fileUrl,
    uploadedAt: formatDDMMYYYY(p.createdAt),
    releasedProductCode: p.releasedProduct?.productCode,
  };
}
