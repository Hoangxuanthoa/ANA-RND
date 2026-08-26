"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  PRODUCTS as INITIAL_PRODUCTS,
  INITIAL_NOTIFICATIONS,
  type Product,
  type NotificationItem,
  type ReusePermission,
} from "@/lib/mock-data";

interface ProductsContextValue {
  products: Product[];
  notifications: NotificationItem[];
  favoritedCodes: Set<string>;
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
}

const ProductsContext = createContext<ProductsContextValue | null>(null);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [favoritedCodes, setFavoritedCodes] = useState<Set<string>>(new Set());

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

  return (
    <ProductsContext.Provider
      value={{
        products,
        notifications,
        favoritedCodes,
        approveProduct,
        rejectProduct,
        markNotificationRead,
        submitForReview,
        releaseToLibrary,
        setReusePermission,
        toggleFavorite,
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
