"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  PRODUCTS as INITIAL_PRODUCTS,
  INITIAL_NOTIFICATIONS,
  PRODUCT_FEEDBACK as INITIAL_PRODUCT_FEEDBACK,
  CATEGORIES as INITIAL_CATEGORIES,
  MATERIALS as INITIAL_MATERIALS,
  feedbackIdentity,
  nextProductCode,
  CURRENT_USER_NAME,
  type Product,
  type NotificationItem,
  type ProductFeedbackItem,
  type ReusePermission,
} from "@/lib/mock-data";
import { useRole } from "@/components/RoleProvider";

interface ProductsContextValue {
  products: Product[];
  notifications: NotificationItem[];
  favoritedCodes: Set<string>;
  productFeedback: ProductFeedbackItem[];
  categories: string[];
  materials: string[];
  approveProduct: (code: string) => void;
  rejectProduct: (code: string, reason: string) => void;
  markNotificationRead: (id: string) => void;
  // Path A: a standalone (no project) draft is submitted straight to the
  // Admin review queue.
  submitForReview: (code: string) => void;
  // Path B: R&D releases a design out of a (closed) project into the
  // general library — also lands in the same review queue.
  releaseToLibrary: (code: string, projectName: string) => void;
  setReusePermission: (code: string, reuse: ReusePermission) => void;
  toggleFavorite: (code: string) => void;
  addProductFeedback: (productCode: string, content: string) => void;
  createProduct: (input: { name: string; category: string; material: string; description: string; originCustomer: string }) => string;
  addCategory: (name: string) => void;
  renameCategory: (oldName: string, newName: string) => void;
  removeCategory: (name: string) => void;
  addMaterial: (name: string) => void;
  renameMaterial: (oldName: string, newName: string) => void;
  removeMaterial: (name: string) => void;
}

const ProductsContext = createContext<ProductsContextValue | null>(null);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const { role } = useRole();
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [favoritedCodes, setFavoritedCodes] = useState<Set<string>>(new Set());
  const [productFeedback, setProductFeedback] = useState<ProductFeedbackItem[]>(INITIAL_PRODUCT_FEEDBACK);
  const [categories, setCategories] = useState<string[]>(INITIAL_CATEGORIES);
  const [materials, setMaterials] = useState<string[]>(INITIAL_MATERIALS);

  function approveProduct(code: string) {
    setProducts((prev) =>
      prev.map((p) => (p.code === code ? { ...p, status: "RELEASED", lastRejectionReason: undefined } : p)),
    );
  }

  function rejectProduct(code: string, reason: string) {
    const product = products.find((p) => p.code === code);
    setProducts((prev) =>
      prev.map((p) => (p.code === code ? { ...p, status: "DRAFT", lastRejectionReason: reason } : p)),
    );
    if (product) {
      setNotifications((prev) => [
        {
          id: `${code}-${Date.now()}`,
          type: "PRODUCT_REJECTED",
          title: `${product.name} bị từ chối`,
          message: reason,
          link: `/library/${code}`,
          recipientName: product.designer,
          isRead: false,
          time: "Vừa xong",
        },
        ...prev,
      ]);
    }
  }

  function markNotificationRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }

  function submitForReview(code: string) {
    setProducts((prev) =>
      prev.map((p) =>
        p.code === code
          ? { ...p, status: "PENDING_REVIEW", submittedAt: "Vừa xong", sourceProjectName: undefined }
          : p,
      ),
    );
  }

  function releaseToLibrary(code: string, projectName: string) {
    setProducts((prev) =>
      prev.map((p) =>
        p.code === code
          ? { ...p, status: "PENDING_REVIEW", submittedAt: "Vừa xong", sourceProjectName: projectName }
          : p,
      ),
    );
  }

  function setReusePermission(code: string, reuse: ReusePermission) {
    setProducts((prev) => prev.map((p) => (p.code === code ? { ...p, reuse } : p)));
  }

  function toggleFavorite(code: string) {
    setFavoritedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function addProductFeedback(productCode: string, content: string) {
    const { author, initials, tint } = feedbackIdentity(role);
    setProductFeedback((prev) => [...prev, { productCode, author, content, time: "Vừa xong", initials, tint }]);
  }

  function createProduct(input: { name: string; category: string; material: string; description: string; originCustomer: string }) {
    const code = nextProductCode(products);
    const newProduct: Product = {
      code,
      name: input.name,
      category: input.category,
      material: input.material,
      designer: CURRENT_USER_NAME[role],
      originCustomer: input.originCustomer.trim() || "—",
      description: input.description,
      status: "DRAFT",
      reuse: "REUSABLE",
      favorites: 0,
      tint: "blue",
    };
    setProducts((prev) => [newProduct, ...prev]);
    return code;
  }

  function addCategory(name: string) {
    const trimmed = name.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    setCategories((prev) => [...prev, trimmed]);
  }

  function renameCategory(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName || categories.includes(trimmed)) return;
    setCategories((prev) => prev.map((c) => (c === oldName ? trimmed : c)));
    setProducts((prev) => prev.map((p) => (p.category === oldName ? { ...p, category: trimmed } : p)));
  }

  function removeCategory(name: string) {
    if (products.some((p) => p.category === name)) return;
    setCategories((prev) => prev.filter((c) => c !== name));
  }

  function addMaterial(name: string) {
    const trimmed = name.trim();
    if (!trimmed || materials.includes(trimmed)) return;
    setMaterials((prev) => [...prev, trimmed]);
  }

  function renameMaterial(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName || materials.includes(trimmed)) return;
    setMaterials((prev) => prev.map((m) => (m === oldName ? trimmed : m)));
    setProducts((prev) => prev.map((p) => (p.material === oldName ? { ...p, material: trimmed } : p)));
  }

  function removeMaterial(name: string) {
    if (products.some((p) => p.material === name)) return;
    setMaterials((prev) => prev.filter((m) => m !== name));
  }

  return (
    <ProductsContext.Provider
      value={{
        products,
        notifications,
        favoritedCodes,
        productFeedback,
        categories,
        materials,
        approveProduct,
        rejectProduct,
        markNotificationRead,
        submitForReview,
        releaseToLibrary,
        setReusePermission,
        toggleFavorite,
        addProductFeedback,
        createProduct,
        addCategory,
        renameCategory,
        removeCategory,
        addMaterial,
        renameMaterial,
        removeMaterial,
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
