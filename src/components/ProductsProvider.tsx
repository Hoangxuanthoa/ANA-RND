"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  PRODUCTS as INITIAL_PRODUCTS,
  INITIAL_NOTIFICATIONS,
  type Product,
  type NotificationItem,
} from "@/lib/mock-data";

interface ProductsContextValue {
  products: Product[];
  notifications: NotificationItem[];
  approveProduct: (code: string) => void;
  rejectProduct: (code: string, reason: string) => void;
  markNotificationRead: (id: string) => void;
}

const ProductsContext = createContext<ProductsContextValue | null>(null);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

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

  return (
    <ProductsContext.Provider
      value={{ products, notifications, approveProduct, rejectProduct, markNotificationRead }}
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
