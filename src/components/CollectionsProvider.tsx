"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { COLLECTIONS as INITIAL_COLLECTIONS, type Collection } from "@/lib/mock-data";

interface CollectionsContextValue {
  collections: Collection[];
  createCollection: (name: string, createdByName: string) => string;
  renameCollection: (id: string, name: string) => void;
  deleteCollection: (id: string) => void;
  addProductToCollection: (id: string, productCode: string) => void;
  removeProductFromCollection: (id: string, productCode: string) => void;
  sendCollection: (id: string) => void;
}

const CollectionsContext = createContext<CollectionsContextValue | null>(null);

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const [collections, setCollections] = useState<Collection[]>(INITIAL_COLLECTIONS);

  function createCollection(name: string, createdByName: string) {
    const id = `col-${Date.now()}`;
    setCollections((prev) => [
      {
        id,
        name,
        createdByName,
        createdAt: "Vừa xong",
        status: "DRAFT",
        productCodes: [],
      },
      ...prev,
    ]);
    return id;
  }

  function renameCollection(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c)));
  }

  function deleteCollection(id: string) {
    setCollections((prev) => prev.filter((c) => c.id !== id));
  }

  function addProductToCollection(id: string, productCode: string) {
    setCollections((prev) =>
      prev.map((c) =>
        c.id === id && !c.productCodes.includes(productCode)
          ? { ...c, productCodes: [...c.productCodes, productCode] }
          : c,
      ),
    );
  }

  function removeProductFromCollection(id: string, productCode: string) {
    setCollections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, productCodes: c.productCodes.filter((p) => p !== productCode) } : c)),
    );
  }

  function sendCollection(id: string) {
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, status: "SENT" } : c)));
  }

  return (
    <CollectionsContext.Provider
      value={{
        collections,
        createCollection,
        renameCollection,
        deleteCollection,
        addProductToCollection,
        removeProductFromCollection,
        sendCollection,
      }}
    >
      {children}
    </CollectionsContext.Provider>
  );
}

export function useCollections() {
  const ctx = useContext(CollectionsContext);
  if (!ctx) throw new Error("useCollections must be used within CollectionsProvider");
  return ctx;
}
