"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Product, ProductSizeVariant, ProductFeedbackItem, ReusePermission, VersionItem } from "@/lib/mock-data";
import { useRole } from "@/components/RoleProvider";

interface ProductsContextValue {
  products: Product[];
  favoritedCodes: Set<string>;
  productFeedback: ProductFeedbackItem[];
  productVersions: VersionItem[];
  categories: string[];
  materials: string[];
  sizes: string[];
  colors: string[];
  approveProduct: (code: string) => void;
  rejectProduct: (code: string, reason: string) => void;
  submitForReview: (code: string) => void;
  releaseToLibrary: (code: string, projectName: string) => void;
  setReusePermission: (code: string, reuse: ReusePermission, exclusiveBy?: string) => void;
  toggleFavorite: (code: string) => void;
  addProductFeedback: (productCode: string, content: string) => void;
  addProductVersion: (productCode: string, note: string, image?: string) => Promise<void>;
  createProduct: (
    input: {
      name: string;
      category: string;
      material: string;
      sizeVariants: ProductSizeVariant[];
      color: string;
      mainImage?: string;
      images?: string[];
      originCustomer?: string;
    },
    options?: { autoSubmit?: boolean },
  ) => Promise<string>;
  createProductsBulk: (images: { name: string; mainImage: string }[], originCustomer?: string) => Promise<string[]>;
  updateProduct: (code: string, patch: Partial<Product>) => void;
  archiveProduct: (code: string) => void;
  deleteProduct: (code: string) => void;
  addCategory: (name: string) => void;
  renameCategory: (oldName: string, newName: string) => void;
  removeCategory: (name: string) => void;
  addMaterial: (name: string) => void;
  renameMaterial: (oldName: string, newName: string) => void;
  removeMaterial: (name: string) => void;
  addSize: (name: string) => void;
  renameSize: (oldName: string, newName: string) => void;
  removeSize: (name: string) => void;
  addColor: (name: string) => void;
  renameColor: (oldName: string, newName: string) => void;
  removeColor: (name: string) => void;
}

const ProductsContext = createContext<ProductsContextValue | null>(null);

const JSON_HEADERS = { "Content-Type": "application/json" };

// undefined values silently vanish from JSON.stringify's output — but a
// patch clearing a field (e.g. removing the main image) needs that key
// to actually arrive as `null`, not disappear, so the server can tell
// "clear this" apart from "field not included in this patch".
function bodyWithNulls(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (v === undefined ? null : v));
}

async function postJson<T>(url: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<T> {
  const res = await fetch(url, { method, headers: JSON_HEADERS, body: bodyWithNulls(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Thao tác thất bại — thử lại.");
  return data as T;
}

interface LookupRow {
  id: string;
  name: string;
  isActive: boolean;
}

// Real-backend equivalent of the mock's useManagedField — same
// add/rename/remove shape (rename cascades to every already-fetched
// product using the old value, so open tabs stay visually consistent;
// remove deactivates server-side instead of hard-deleting/being blocked
// while in use). One instance per endpoint (categories/materials/colors).
function useLookupField(
  endpoint: string,
  field: "category" | "material" | "color",
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>,
) {
  const [rows, setRows] = useState<LookupRow[]>([]);

  useEffect(() => {
    fetch(endpoint)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: LookupRow[]) => setRows(data));
  }, [endpoint]);

  function add(name: string) {
    const trimmed = name.trim();
    if (!trimmed || rows.some((r) => r.name === trimmed)) return;
    postJson<LookupRow>(endpoint, { name: trimmed })
      .then((created) => setRows((prev) => [...prev, created]))
      .catch(() => {});
  }

  function rename(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName || rows.some((r) => r.name === trimmed)) return;
    const row = rows.find((r) => r.name === oldName);
    if (!row) return;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: trimmed } : r)));
    setProducts((prev) => prev.map((p) => (p[field] === oldName ? { ...p, [field]: trimmed } : p)));
    postJson(`${endpoint}/${row.id}`, { name: trimmed }, "PATCH").catch(() => {});
  }

  function remove(name: string) {
    const row = rows.find((r) => r.name === name);
    if (!row) return;
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    postJson(`${endpoint}/${row.id}`, { isActive: false }, "PATCH").catch(() => {});
  }

  return { items: rows.map((r) => r.name), add, rename, remove };
}

export function ProductsProvider({ children }: { children: ReactNode }) {
  const { effectiveUserName } = useRole();
  const [products, setProducts] = useState<Product[]>([]);
  const [favoritedCodes, setFavoritedCodes] = useState<Set<string>>(new Set());
  const [productFeedback, setProductFeedback] = useState<ProductFeedbackItem[]>([]);
  const [productVersions, setProductVersions] = useState<VersionItem[]>([]);
  const categoryField = useLookupField("/api/categories", "category", setProducts);
  const materialField = useLookupField("/api/materials", "material", setProducts);
  const colorField = useLookupField("/api/colors", "color", setProducts);
  const [sizeRows, setSizeRows] = useState<LookupRow[]>([]);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: (Product & { favoritedByMe: boolean })[]) => {
        setProducts(data);
        setFavoritedCodes(new Set(data.filter((p) => p.favoritedByMe).map((p) => p.code)));
      });
    fetch("/api/products/feedback")
      .then((res) => (res.ok ? res.json() : []))
      .then(setProductFeedback);
    fetch("/api/products/versions")
      .then((res) => (res.ok ? res.json() : []))
      .then(setProductVersions);
    fetch("/api/sizes")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: LookupRow[]) => setSizeRows(data));
  }, []);

  function addSize(name: string) {
    const trimmed = name.trim();
    if (!trimmed || sizeRows.some((r) => r.name === trimmed)) return;
    postJson<LookupRow>("/api/sizes", { name: trimmed })
      .then((created) => setSizeRows((prev) => [...prev, created]))
      .catch(() => {});
  }

  function renameSize(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName || sizeRows.some((r) => r.name === trimmed)) return;
    const row = sizeRows.find((r) => r.name === oldName);
    if (!row) return;
    setSizeRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: trimmed } : r)));
    setProducts((prev) =>
      prev.map((p) =>
        p.sizeVariants
          ? { ...p, sizeVariants: p.sizeVariants.map((v) => (v.size === oldName ? { ...v, size: trimmed } : v)) }
          : p,
      ),
    );
    postJson(`/api/sizes/${row.id}`, { name: trimmed }, "PATCH").catch(() => {});
  }

  function removeSize(name: string) {
    const row = sizeRows.find((r) => r.name === name);
    if (!row) return;
    setSizeRows((prev) => prev.filter((r) => r.id !== row.id));
    postJson(`/api/sizes/${row.id}`, { isActive: false }, "PATCH").catch(() => {});
  }

  function replaceProduct(code: string, updated: Product) {
    setProducts((prev) => prev.map((p) => (p.code === code ? updated : p)));
  }

  function approveProduct(code: string) {
    setProducts((prev) => prev.map((p) => (p.code === code ? { ...p, status: "RELEASED", lastRejectionReason: undefined } : p)));
    postJson<Product>(`/api/products/${code}/approve`, {}).then((p) => replaceProduct(code, p)).catch(() => {});
  }

  function rejectProduct(code: string, reason: string) {
    setProducts((prev) => prev.map((p) => (p.code === code ? { ...p, status: "DRAFT", lastRejectionReason: reason } : p)));
    postJson<Product>(`/api/products/${code}/reject`, { reason }).then((p) => replaceProduct(code, p)).catch(() => {});
  }

  function submitForReview(code: string) {
    setProducts((prev) =>
      prev.map((p) => (p.code === code ? { ...p, status: "PENDING_REVIEW", submittedAt: "Vừa xong", sourceProjectName: undefined } : p)),
    );
    postJson<Product>(`/api/products/${code}/submit`, {}).then((p) => replaceProduct(code, p)).catch(() => {});
  }

  function releaseToLibrary(code: string, projectName: string) {
    setProducts((prev) =>
      prev.map((p) => (p.code === code ? { ...p, status: "PENDING_REVIEW", submittedAt: "Vừa xong", sourceProjectName: projectName } : p)),
    );
    postJson<Product>(`/api/products/${code}/release`, { projectName }).then((p) => replaceProduct(code, p)).catch(() => {});
  }

  function setReusePermission(code: string, reuse: ReusePermission) {
    setProducts((prev) =>
      prev.map((p) => (p.code === code ? { ...p, reuse, exclusiveBy: reuse === "EXCLUSIVE" ? effectiveUserName : undefined } : p)),
    );
    postJson<Product>(`/api/products/${code}/reuse`, { reuse }).then((p) => replaceProduct(code, p)).catch(() => {});
  }

  function toggleFavorite(code: string) {
    const willFavorite = !favoritedCodes.has(code);
    setFavoritedCodes((prev) => {
      const next = new Set(prev);
      if (willFavorite) next.add(code);
      else next.delete(code);
      return next;
    });
    setProducts((prev) =>
      prev.map((p) => (p.code === code ? { ...p, favorites: p.favorites + (willFavorite ? 1 : -1) } : p)),
    );
    postJson<Product & { favoritedByMe: boolean }>(`/api/products/${code}/favorite`, { favorited: willFavorite })
      .then((p) => replaceProduct(code, p))
      .catch(() => {});
  }

  function addProductFeedback(productCode: string, content: string) {
    postJson<ProductFeedbackItem>(`/api/products/${productCode}/feedback`, { content })
      .then((entry) => setProductFeedback((prev) => [...prev, entry]))
      .catch(() => {});
  }

  async function addProductVersion(productCode: string, note: string, image?: string) {
    const entry = await postJson<VersionItem>(`/api/products/${productCode}/versions`, { note, image });
    setProductVersions((prev) => [entry, ...prev]);
    if (image) {
      setProducts((prev) => prev.map((p) => (p.code === productCode ? { ...p, mainImage: image } : p)));
    }
  }

  async function createProduct(
    input: {
      name: string;
      category: string;
      material: string;
      sizeVariants: ProductSizeVariant[];
      color: string;
      mainImage?: string;
      images?: string[];
      originCustomer?: string;
    },
    options?: { autoSubmit?: boolean },
  ): Promise<string> {
    const created = await postJson<Product>("/api/products", { ...input, autoSubmit: options?.autoSubmit ?? false });
    setProducts((prev) => [created, ...prev]);
    return created.code;
  }

  async function createProductsBulk(images: { name: string; mainImage: string }[], originCustomer?: string): Promise<string[]> {
    const created = await postJson<Product[]>("/api/products/bulk", { images, originCustomer });
    setProducts((prev) => [...created, ...prev]);
    return created.map((p) => p.code);
  }

  function updateProduct(code: string, patch: Partial<Product>) {
    setProducts((prev) => prev.map((p) => (p.code === code ? { ...p, ...patch } : p)));
    postJson<Product>(`/api/products/${code}`, patch, "PATCH").then((p) => replaceProduct(code, p)).catch(() => {});
  }

  function archiveProduct(code: string) {
    setProducts((prev) => prev.map((p) => (p.code === code ? { ...p, status: "ARCHIVED" } : p)));
    postJson<Product>(`/api/products/${code}/archive`, {}).then((p) => replaceProduct(code, p)).catch(() => {});
  }

  function deleteProduct(code: string) {
    setProducts((prev) => prev.filter((p) => p.code !== code));
    fetch(`/api/products/${code}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <ProductsContext.Provider
      value={{
        products,
        favoritedCodes,
        productFeedback,
        productVersions,
        categories: categoryField.items,
        materials: materialField.items,
        sizes: sizeRows.map((r) => r.name),
        colors: colorField.items,
        approveProduct,
        rejectProduct,
        submitForReview,
        releaseToLibrary,
        setReusePermission,
        toggleFavorite,
        addProductFeedback,
        addProductVersion,
        createProduct,
        createProductsBulk,
        updateProduct,
        archiveProduct,
        deleteProduct,
        addCategory: categoryField.add,
        renameCategory: categoryField.rename,
        removeCategory: categoryField.remove,
        addMaterial: materialField.add,
        renameMaterial: materialField.rename,
        removeMaterial: materialField.remove,
        addSize,
        renameSize,
        removeSize,
        addColor: colorField.add,
        renameColor: colorField.rename,
        removeColor: colorField.remove,
      }}
    >
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts must be used within ProductsProvider");
  return ctx;
}
