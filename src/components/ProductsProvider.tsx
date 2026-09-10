"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  PRODUCTS as INITIAL_PRODUCTS,
  PRODUCT_FEEDBACK as INITIAL_PRODUCT_FEEDBACK,
  PRODUCT_VERSIONS as INITIAL_PRODUCT_VERSIONS,
  CATEGORIES as INITIAL_CATEGORIES,
  MATERIALS as INITIAL_MATERIALS,
  SIZES as INITIAL_SIZES,
  COLORS as INITIAL_COLORS,
  feedbackIdentity,
  nextProductCode,
  nextVersionNumber,
  todayDDMMYYYY,
  CURRENT_USER_NAME,
  type Product,
  type ProductSizeVariant,
  type ProductFeedbackItem,
  type ReusePermission,
  type VersionItem,
} from "@/lib/mock-data";
import { useRole } from "@/components/RoleProvider";
import { useNotifications } from "@/components/NotificationsProvider";

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
  // Path A: a standalone (no project) draft is submitted straight to the
  // Admin review queue.
  submitForReview: (code: string) => void;
  // Path B: R&D releases a design out of a (closed) project into the
  // general library — also lands in the same review queue.
  releaseToLibrary: (code: string, projectName: string) => void;
  // exclusiveBy is who to credit/ask when reuse is EXCLUSIVE — omit (or
  // pass undefined) when clearing it back to REUSABLE.
  setReusePermission: (code: string, reuse: ReusePermission, exclusiveBy?: string) => void;
  toggleFavorite: (code: string) => void;
  addProductFeedback: (productCode: string, content: string) => void;
  // Appends a new, auto-numbered version entry for this product and, if
  // an image was included, makes it the product's live main image too.
  addProductVersion: (productCode: string, note: string, image?: string) => void;
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
  ) => string;
  // Bulk intake — one placeholder product per image, see createProductsBulk.
  createProductsBulk: (images: { name: string; mainImage: string }[], originCustomer?: string) => string[];
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

// Shared CRUD for the lookup lists (Category/Material/Color) that hang
// off a Product by plain string field — add/rename/remove, with rename
// cascading to every product using the old value and remove blocked
// while any product still does. Size is handled separately below since a
// product can have several size variants, not one flat field.
function useManagedField(
  initial: string[],
  field: "category" | "material" | "color",
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
  const { addNotification } = useNotifications();
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [favoritedCodes, setFavoritedCodes] = useState<Set<string>>(new Set());
  const [productFeedback, setProductFeedback] = useState<ProductFeedbackItem[]>(INITIAL_PRODUCT_FEEDBACK);
  const [productVersions, setProductVersions] = useState<VersionItem[]>(INITIAL_PRODUCT_VERSIONS);
  const categoryField = useManagedField(INITIAL_CATEGORIES, "category", products, setProducts);
  const materialField = useManagedField(INITIAL_MATERIALS, "material", products, setProducts);
  const colorField = useManagedField(INITIAL_COLORS, "color", products, setProducts);
  const [sizes, setSizes] = useState<string[]>(INITIAL_SIZES);

  function addSize(name: string) {
    const trimmed = name.trim();
    if (!trimmed || sizes.includes(trimmed)) return;
    setSizes((prev) => [...prev, trimmed]);
  }

  function renameSize(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName || sizes.includes(trimmed)) return;
    setSizes((prev) => prev.map((v) => (v === oldName ? trimmed : v)));
    setProducts((prev) =>
      prev.map((p) =>
        p.sizeVariants
          ? { ...p, sizeVariants: p.sizeVariants.map((v) => (v.size === oldName ? { ...v, size: trimmed } : v)) }
          : p,
      ),
    );
  }

  function removeSize(name: string) {
    if (products.some((p) => p.sizeVariants?.some((v) => v.size === name))) return;
    setSizes((prev) => prev.filter((v) => v !== name));
  }

  function approveProduct(code: string) {
    const product = products.find((p) => p.code === code);
    setProducts((prev) =>
      prev.map((p) => (p.code === code ? { ...p, status: "RELEASED", lastRejectionReason: undefined } : p)),
    );
    if (product) {
      addNotification({
        type: "PRODUCT_APPROVED",
        title: `${product.name} đã được duyệt`,
        message: "Sản phẩm đã Released vào Design Library.",
        link: `/library/${code}`,
        recipientName: product.designer,
      });
    }
  }

  function rejectProduct(code: string, reason: string) {
    const product = products.find((p) => p.code === code);
    setProducts((prev) =>
      prev.map((p) => (p.code === code ? { ...p, status: "DRAFT", lastRejectionReason: reason } : p)),
    );
    if (product) {
      addNotification({
        type: "PRODUCT_REJECTED",
        title: `${product.name} bị từ chối`,
        message: reason,
        link: `/library/${code}`,
        recipientName: product.designer,
      });
    }
  }

  // No bell notification here on purpose — the "Duyệt sản phẩm" nav badge
  // (pendingCount) is already the signal Admin watches for this; a second
  // notification would just duplicate it.
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

  function setReusePermission(code: string, reuse: ReusePermission, exclusiveBy?: string) {
    setProducts((prev) =>
      prev.map((p) => (p.code === code ? { ...p, reuse, exclusiveBy: reuse === "EXCLUSIVE" ? exclusiveBy : undefined } : p)),
    );
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
    const product = products.find((p) => p.code === productCode);
    const actorName = CURRENT_USER_NAME[role];
    if (product && !product.designer.startsWith(actorName)) {
      addNotification({
        type: "NEW_FEEDBACK",
        title: `Bình luận mới trên ${product.name}`,
        message: content,
        link: `/library/${productCode}`,
        recipientName: product.designer,
      });
    }
  }

  function addProductVersion(productCode: string, note: string, image?: string) {
    const existing = productVersions.filter((v) => v.productCode === productCode);
    const entry: VersionItem = {
      productCode,
      number: nextVersionNumber(existing),
      note,
      by: CURRENT_USER_NAME[role],
      date: todayDDMMYYYY(),
      image,
    };
    setProductVersions((prev) => [entry, ...prev]);
    if (image) {
      setProducts((prev) => prev.map((p) => (p.code === productCode ? { ...p, mainImage: image } : p)));
    }
  }

  function createProduct(
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
    // Standalone Library/Dashboard uploads go straight to Admin review —
    // no separate "Nộp duyệt" click needed. Designs created inside a
    // project stay DRAFT (its own internal review happens at the
    // ProjectProductItem level, not here) until R&D releases it once the
    // project completes, so this defaults to off.
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
      createdAt: todayDDMMYYYY(),
      sizeVariants: input.sizeVariants,
      color: input.color,
      mainImage: input.mainImage,
      images: input.images,
    };
    setProducts((prev) => [newProduct, ...prev]);
    return code;
  }

  // Bulk intake for a rush project — one image in, one placeholder
  // product out, `incomplete: true` so it can move through review but
  // can't be Released until someone fills in the real name/category/
  // material (see isProjectProductReadyToRelease). Codes are assigned
  // sequentially off one `products` snapshot (not looped calls to
  // createProduct, which would all compute the same "next" code since
  // none of the intermediate setProducts calls would have landed yet).
  function createProductsBulk(images: { name: string; mainImage: string }[], originCustomer?: string): string[] {
    let pool = products;
    const newProducts: Product[] = images.map((img) => {
      const code = nextProductCode(pool);
      const product: Product = {
        code,
        name: img.name,
        category: categoryField.items[0] ?? "",
        material: materialField.items[0] ?? "",
        designer: CURRENT_USER_NAME[role],
        originCustomer: originCustomer?.trim() || "—",
        status: "DRAFT",
        reuse: "REUSABLE",
        favorites: 0,
        tint: "blue",
        createdAt: todayDDMMYYYY(),
        sizeVariants: [],
        color: colorField.items[0] ?? "",
        mainImage: img.mainImage,
        incomplete: true,
      };
      pool = [...pool, product];
      return product;
    });
    setProducts((prev) => [...newProducts, ...prev]);
    return newProducts.map((p) => p.code);
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
        favoritedCodes,
        productFeedback,
        productVersions,
        categories: categoryField.items,
        materials: materialField.items,
        sizes,
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
