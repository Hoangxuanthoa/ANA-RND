"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Collection } from "@/lib/mock-data";

interface CollectionsContextValue {
  // False until the initial GET /api/collections resolves — see
  // ProductsProvider's productsLoaded for why a detail page needs this
  // (collections/[id]/page.tsx must wait for it before concluding
  // "not found").
  collectionsLoaded: boolean;
  collections: Collection[];
  createCollection: (name: string, productCodes?: string[], sourceProjectCode?: string) => Promise<string>;
  renameCollection: (id: string, name: string) => void;
  deleteCollection: (id: string) => void;
  addProductToCollection: (id: string, productCode: string) => void;
  removeProductFromCollection: (id: string, productCode: string) => void;
  // Logs one pitch (export-for-a-customer event) and moves the
  // collection to SENT — see CollectionPitch in mock-data.ts for why
  // this replaced the old bare "mark as sent" action. Async because the
  // "Lấy link online" flow needs the server-generated publicSlug back
  // before it can show the real share link.
  logPitch: (id: string, customer: string, note?: string) => Promise<void>;
}

const CollectionsContext = createContext<CollectionsContextValue | null>(null);

const JSON_HEADERS = { "Content-Type": "application/json" };

function bodyWithNulls(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (v === undefined ? null : v));
}

async function postJson<T>(url: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<T> {
  const res = await fetch(url, { method, headers: JSON_HEADERS, body: bodyWithNulls(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Thao tác thất bại — thử lại.");
  return data as T;
}

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsLoaded, setCollectionsLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/collections")
      .then((res) => (res.ok ? res.json() : []))
      .then(setCollections)
      .finally(() => setCollectionsLoaded(true));
  }, []);

  function replaceCollection(id: string, updated: Collection) {
    setCollections((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }

  async function createCollection(name: string, productCodes: string[] = [], sourceProjectCode?: string) {
    const created = await postJson<Collection>("/api/collections", { name, productCodes, sourceProjectCode });
    setCollections((prev) => [created, ...prev]);
    return created.id;
  }

  function renameCollection(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c)));
    postJson<Collection>(`/api/collections/${id}`, { name: trimmed }, "PATCH").then((c) => replaceCollection(id, c)).catch(() => {});
  }

  function deleteCollection(id: string) {
    setCollections((prev) => prev.filter((c) => c.id !== id));
    fetch(`/api/collections/${id}`, { method: "DELETE" }).catch(() => {});
  }

  function addProductToCollection(id: string, productCode: string) {
    setCollections((prev) =>
      prev.map((c) =>
        c.id === id && !c.productCodes.includes(productCode)
          ? { ...c, productCodes: [...c.productCodes, productCode] }
          : c,
      ),
    );
    postJson<Collection>(`/api/collections/${id}/items`, { productCode }).then((c) => replaceCollection(id, c)).catch(() => {});
  }

  function removeProductFromCollection(id: string, productCode: string) {
    setCollections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, productCodes: c.productCodes.filter((p) => p !== productCode) } : c)),
    );
    fetch(`/api/collections/${id}/items/${encodeURIComponent(productCode)}`, { method: "DELETE" }).catch(() => {});
  }

  async function logPitch(id: string, customer: string, note?: string) {
    const updated = await postJson<Collection>(`/api/collections/${id}/pitch`, { customer, note });
    replaceCollection(id, updated);
  }

  return (
    <CollectionsContext.Provider
      value={{
        collectionsLoaded,
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
