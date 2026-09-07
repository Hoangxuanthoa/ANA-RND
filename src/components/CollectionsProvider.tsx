"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { COLLECTIONS as INITIAL_COLLECTIONS, todayDDMMYYYY, type Collection } from "@/lib/mock-data";
import { useNotifications } from "@/components/NotificationsProvider";

interface CollectionsContextValue {
  collections: Collection[];
  createCollection: (name: string, createdByName: string) => string;
  renameCollection: (id: string, name: string) => void;
  deleteCollection: (id: string) => void;
  addProductToCollection: (id: string, productCode: string) => void;
  removeProductFromCollection: (id: string, productCode: string) => void;
  // Logs one pitch (export-for-a-customer event) and moves the
  // collection to SENT — see CollectionPitch in mock-data.ts for why
  // this replaced the old bare "mark as sent" action.
  logPitch: (id: string, customer: string, loggedByName: string, note?: string) => void;
}

const CollectionsContext = createContext<CollectionsContextValue | null>(null);

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const { addNotification } = useNotifications();
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
        pitches: [],
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

  function logPitch(id: string, customer: string, loggedByName: string, note?: string) {
    const collection = collections.find((c) => c.id === id);
    setCollections((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: "SENT",
              pitches: [...c.pitches, { customer, loggedByName, date: todayDDMMYYYY(), note: note?.trim() || undefined }],
            }
          : c,
      ),
    );
    if (collection && collection.createdByName !== loggedByName) {
      addNotification({
        type: "NEW_PITCH",
        title: `Collection "${collection.name}" vừa được chào ${customer}`,
        message: note?.trim() || `Đã chào ${customer}.`,
        link: `/collections/${id}`,
        recipientName: collection.createdByName,
      });
    }
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
        logPitch,
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
