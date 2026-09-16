"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { INITIAL_PROJECT_PHOTOS, feedbackIdentity, todayDDMMYYYY, type ProjectPhoto } from "@/lib/mock-data";
import { useRole } from "@/components/RoleProvider";

interface ProjectPhotosContextValue {
  photos: ProjectPhoto[];
  // One call for the whole batch (not looped single-adds) so a multi-file
  // upload lands as one state update, same reasoning as
  // ProductsProvider.createProductsBulk.
  addPhotos: (projectCode: string, files: { fileName: string; url: string }[]) => void;
  deletePhoto: (id: string) => void;
  markPhotoReleased: (id: string, productCode: string) => void;
  addPhotoComment: (id: string, content: string) => void;
}

const ProjectPhotosContext = createContext<ProjectPhotosContextValue | null>(null);

export function ProjectPhotosProvider({ children }: { children: ReactNode }) {
  const { role } = useRole();
  const [photos, setPhotos] = useState<ProjectPhoto[]>(INITIAL_PROJECT_PHOTOS);

  function addPhotos(projectCode: string, files: { fileName: string; url: string }[]) {
    const uploadedAt = todayDDMMYYYY();
    const newPhotos: ProjectPhoto[] = files.map((f, i) => ({
      id: `photo-${Date.now()}-${i}`,
      projectCode,
      fileName: f.fileName,
      url: f.url,
      uploadedAt,
      comments: [],
    }));
    setPhotos((prev) => [...newPhotos, ...prev]);
  }

  function deletePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  function markPhotoReleased(id: string, productCode: string) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, releasedProductCode: productCode } : p)));
  }

  function addPhotoComment(id: string, content: string) {
    const { author, initials, tint } = feedbackIdentity(role);
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, comments: [...p.comments, { author, content, time: "Vừa xong", initials, tint }] }
          : p,
      ),
    );
  }

  return (
    <ProjectPhotosContext.Provider value={{ photos, addPhotos, deletePhoto, markPhotoReleased, addPhotoComment }}>
      {children}
    </ProjectPhotosContext.Provider>
  );
}

export function useProjectPhotos() {
  const ctx = useContext(ProjectPhotosContext);
  if (!ctx) throw new Error("useProjectPhotos must be used within ProjectPhotosProvider");
  return ctx;
}
