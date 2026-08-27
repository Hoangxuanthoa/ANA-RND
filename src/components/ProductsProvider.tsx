"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  PRODUCTS as INITIAL_PRODUCTS,
  INITIAL_NOTIFICATIONS,
  PRODUCT_FEEDBACK as INITIAL_PRODUCT_FEEDBACK,
  CATEGORIES as INITIAL_CATEGORIES,
  MATERIALS as INITIAL_MATERIALS,
  SIZES as INITIAL_SIZES,
  COLORS as INITIAL_COLORS,
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
  sizes: string[];
  colors: string[];
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
  createProduct: (
    input: {
      name: string;
      category: string;
      material: string;
      size: string;
      length?: number;
      width?: number;
      height?: number;
      color: string;
      mainImage?: string;
      images?: string[];
      originCustomer?: string;
    },
    options?: { autoSubmit?: boolean },
  ) => string;
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

// Shared CRUD for the 4 lookup lists (Category/Material/Size/Color) that
// hang off a Product by plain string field — add/rename/remove, with
// rename cascading to every product using the old value and remove
// blocked while any product still does.
function useManagedField(
  initial: string[],
  field: "category" | "material" | "size" | "color",
  products: Product[],
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>,
) {
  const [items, setItems] = useState<string[]>(initial);

  function add(name: string) {
    const trimmed = name.trim();
    if (!trimmed || items.includes(trimmed)) return;
    setItems((prev) => [...prev, trimmed]);
  }

  function rename(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName || items.includes(trimmed)) return;
    setItems((prev) => prev.map((v) => (v === oldName ? trimmed : v)));
    setProducts((prev) => prev.map((p) => (p[field] === oldName ? { ...p, [field]: trimmed } : p)));
  }

  function remove(name: string) {
    if (products.some((p) => p[field] === name)) return;
    setItems((prev) => prev.filter((v) => v !== name));
  }

  return { items, add, rename, remove };
}

export function ProductsProvider({ children }: { children: ReactNode }) {
  const { role } = useRole();
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [favoritedCodes, setFavoritedCodes] = useState<Set<string>>(new Set());
  const [productFeedback, setProductFeedback] = useState<ProductFeedbackItem[]>(INITIAL_PRODUCT_FEEDBACK);
  const categoryField = useManagedField(INITIAL_CATEGORIES, "category", products, setProducts);
  const materialField = useManagedField(INITIAL_MATERIALS, "material", products, setProducts);
  const sizeField = useManagedField(INITIAL_SIZES, "size", products, setProducts);
  const colorField = useManagedField(INITIAL_COLORS, "color", products, setProducts);

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
          productCode: code,
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

  // Takes the product object directly rather than looking it up by code —
  // when this fires right after createProduct in the same event handler,
  // the `products` state closure here is still the pre-create snapshot
  // (React batches the setProducts from createProduct), so a lookup by
  // code would silently miss the just-created product.
  function notifyAdminPendingReview(product: Product, message: string) {
    setNotifications((prev) => [
      {
        id: `${product.code}-submit-${Date.now()}`,
        type: "PRODUCT_SUBMITTED",
        title: `${product.name} chờ duyệt`,
        message,
        link: "/review",
        productCode: product.code,
        recipientName: CURRENT_USER_NAME.ADMIN,
        isRead: false,
        time: "Vừa xong",
      },
      ...prev,
    ]);
  }

  function submitForReview(code: string) {
    const product = products.find((p) => p.code === code);
    setProducts((prev) =>
      prev.map((p) =>
        p.code === code
          ? { ...p, status: "PENDING_REVIEW", submittedAt: "Vừa xong", sourceProjectName: undefined }
          : p,
      ),
    );
    if (product) notifyAdminPendingReview(product, "Vừa được nộp duyệt trực tiếp từ Design Library.");
  }

  function releaseToLibrary(code: string, projectName: string) {
    const product = products.find((p) => p.code === code);
    setProducts((prev) =>
      prev.map((p) =>
        p.code === code
          ? { ...p, status: "PENDING_REVIEW", submittedAt: "Vừa xong", sourceProjectName: projectName }
          : p,
      ),
    );
    if (product) notifyAdminPendingReview(product, `Vừa được release từ dự án ${projectName}.`);
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

  function createProduct(
    input: {
      name: string;
      category: string;
      material: string;
      size: string;
      length?: number;
      width?: number;
      height?: number;
      color: string;
      mainImage?: string;
      images?: string[];
      originCustomer?: string;
    },
    // Standalone Library/Dashboard uploads go straight to Admin review —
    // no separate "Nộp duyệt" click needed. Designs created inside a
    // project stay DRAFT/DEVELOPING until the project closes and it's
    // explicitly released, so this defaults to off.
    options?: { autoSubmit?: boolean },
  ) {
    const code = nextProductCode(products);
    const autoSubmit = options?.autoSubmit ?? false;
    const newProduct: Product = {
      code,
      name: input.name,
      category: input.category,
      material: input.material,
      designer: CURRENT_USER_NAME[role],
      originCustomer: input.originCustomer?.trim() || "—",
      status: autoSubmit ? "PENDING_REVIEW" : "DRAFT",
      submittedAt: autoSubmit ? "Vừa xong" : undefined,
      reuse: "REUSABLE",
      favorites: 0,
      tint: "blue",
      size: input.size,
      length: input.length,
      width: input.width,
      height: input.height,
      color: input.color,
      mainImage: input.mainImage,
      images: input.images,
    };
    setProducts((prev) => [newProduct, ...prev]);
    if (autoSubmit) notifyAdminPendingReview(newProduct, "Vừa được nộp duyệt trực tiếp từ Design Library.");
    return code;
  }

  function updateProduct(code: string, patch: Partial<Product>) {
    setProducts((prev) => prev.map((p) => (p.code === code ? { ...p, ...patch } : p)));
  }

  // Hard delete only when nothing references the product yet (see
  // canHardDeleteProduct); otherwise archive so existing project/reuse
  // history stays valid instead of pointing at a missing product.
  function archiveProduct(code: string) {
    setProducts((prev) => prev.map((p) => (p.code === code ? { ...p, status: "ARCHIVED" } : p)));
  }

  function deleteProduct(code: string) {
    setProducts((prev) => prev.filter((p) => p.code !== code));
  }

  return (
    <ProductsContext.Provider
      value={{
        products,
        notifications,
        favoritedCodes,
        productFeedback,
        categories: categoryField.items,
        materials: materialField.items,
        sizes: sizeField.items,
        colors: colorField.items,
        approveProduct,
        rejectProduct,
        markNotificationRead,
        submitForReview,
        releaseToLibrary,
        setReusePermission,
        toggleFavorite,
        addProductFeedback,
        createProduct,
        updateProduct,
        archiveProduct,
        deleteProduct,
        addCategory: categoryField.add,
        renameCategory: categoryField.rename,
        removeCategory: categoryField.remove,
        addMaterial: materialField.add,
        renameMaterial: materialField.rename,
        removeMaterial: materialField.remove,
        addSize: sizeField.add,
        renameSize: sizeField.rename,
        removeSize: sizeField.remove,
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
