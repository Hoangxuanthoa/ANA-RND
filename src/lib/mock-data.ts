export type Role = "ADMIN" | "RND" | "SALES" | "MARKETING" | "CUSTOMER";

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  RND: "R&D",
  SALES: "Sales",
  MARKETING: "Marketing",
  CUSTOMER: "Customer",
};

export const ROLE_INITIALS: Record<Role, string> = {
  ADMIN: "MI",
  RND: "AN",
  SALES: "HA",
  MARKETING: "LI",
  CUSTOMER: "JY",
};

// Plain name of "the person currently previewing this role" — matches the
// `sales` / `rndOwner` / `createdByName` strings in the mock data below, so
// ownership checks (canEditProject, isAssignedRndOwner, ...) have someone
// concrete to compare against.
export const CURRENT_USER_NAME: Record<Role, string> = {
  ADMIN: "Minh",
  RND: "An",
  SALES: "Hà",
  MARKETING: "Linh",
  CUSTOMER: "JYSK",
};

// Default contact info shown in the account dropdown / profile modal —
// editable there (kept in RoleProvider, per role), but never used for
// ownership/identity matching. That stays keyed on CURRENT_USER_NAME above.
export const CURRENT_USER_EMAIL: Record<Role, string> = {
  ADMIN: "minh@rattanco.vn",
  RND: "an@rattanco.vn",
  SALES: "ha@rattanco.vn",
  MARKETING: "linh@rattanco.vn",
  CUSTOMER: "purchasing@jysk.com",
};

export const CURRENT_USER_PHONE: Record<Role, string> = {
  ADMIN: "090 123 4567",
  RND: "090 234 5678",
  SALES: "090 345 6789",
  MARKETING: "090 456 7890",
  CUSTOMER: "090 567 8901",
};

// Company roster — used to be a hardcoded mock array here. Now real: see
// StaffProvider.tsx (fetches from /api/staff, backed by the `User` table)
// — that file also re-exports the `StaffMember` shape callers used to
// import from this one.

export const CUSTOMERS = ["JYSK", "ADE", "SCG", "Habitat"];

// How a person's comment should be attributed, derived from whichever
// role they're currently browsing as — keeps every feedback thread
// (product, project, project-product) formatted the same way.
export function feedbackIdentity(role: Role): { author: string; initials: string; tint: "accent" | "blue" | "green" | "amber" } {
  const name = CURRENT_USER_NAME[role];
  const tint: Record<Role, "accent" | "blue" | "green" | "amber"> = {
    ADMIN: "accent",
    RND: "blue",
    SALES: "amber",
    MARKETING: "accent",
    CUSTOMER: "green",
  };
  const author = role === "CUSTOMER" ? `${name} Buyer` : `${name} (${ROLE_LABEL[role]})`;
  return { author, initials: ROLE_INITIALS[role], tint: tint[role] };
}

export type ProductStatus =
  | "DRAFT"
  | "DEVELOPING"
  // Submitted for Admin review — either uploaded straight to the library,
  // or released from a closed project. Reject sends it back to DRAFT.
  | "PENDING_REVIEW"
  | "RELEASED"
  | "ARCHIVED";
export type ReusePermission = "REUSABLE" | "EXCLUSIVE";
export type ProjectType = "CUSTOMER" | "INTERNAL" | "MARKETING";
// Simplified on purpose: per-product customer approval already lives on
// ProjectProduct (usage/status/approval below) — the project itself only
// needs to say whether work has started, not duplicate that per stage.
export type ProjectStatus = "CREATED" | "DEVELOPING" | "COMPLETED" | "CLOSED";
export type UsageType = "NEW" | "REUSE";
export type ProjectProductStatus =
  | "DEVELOPING"
  | "SALES_REVIEW"
  | "CUSTOMER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED";
export type CustomerApproval = "PENDING" | "CHANGE_REQUESTED" | "APPROVED";

// R&D "My Task" To Do List — shared between a Project's own rnd* fields
// (one row per project the viewer owns) and RndTask (ad-hoc, self-added
// work outside any project). See my-tasks/page.tsx.
export type TaskCategory = "Thiết kế 3D" | "Bản vẽ" | "Hỗ trợ tính giá" | "Khác";
export const TASK_CATEGORIES: TaskCategory[] = ["Thiết kế 3D", "Bản vẽ", "Hỗ trợ tính giá", "Khác"];
export type TaskPriority = "Trọng tâm" | "Cao" | "Trung bình" | "Thấp";
export const TASK_PRIORITIES: TaskPriority[] = ["Trọng tâm", "Cao", "Trung bình", "Thấp"];

// An ad-hoc task R&D added themselves via "Thêm công việc" — not tied to
// any project. Trạng thái is deliberately not a stored field: it's
// derived as "Hoàn thành" once completedAt is filled in, "Đang làm"
// otherwise (see my-tasks/page.tsx) — filling in the completion date is
// what marks it done, not a separate status toggle.
export interface RndTask {
  id: string;
  ownerName: string;
  title: string;
  category: TaskCategory;
  priority: TaskPriority;
  requester: string;
  startDate: string;
  deadline: string;
  completedAt?: string;
  needsSupport?: string;
  // Admin-writable directive down to whoever owns this task — R&D never
  // gets edit UI for it, only Admin (see my-tasks/page.tsx's isAdmin gate).
  importantNote?: string;
}

// A product can come in several sizes (e.g. S/M/L), each with its own
// dimensions — not one fixed size per design.
export interface ProductSizeVariant {
  size: string;
  length?: number;
  width?: number;
  height?: number;
}

export interface Product {
  code: string;
  name: string;
  category: string;
  material: string;
  designer: string;
  originCustomer: string;
  description?: string;
  status: ProductStatus;
  reuse: ReusePermission;
  // Who marked it Exclusive — only ever set via the "Gắn Exclusive" action
  // on a freshly-designed (NEW usage) product inside a project, never on a
  // picked/REUSE product or a standalone R&D upload. Cleared when
  // un-marked. Drives the "ask this person first" warning when someone
  // else tries to pick this product elsewhere.
  exclusiveBy?: string;
  favorites: number;
  tint: "accent" | "blue" | "green" | "slate";
  createdAt: string;
  // Real per-product images (object URLs from the browser file picker —
  // there's no upload backend yet, so these only last for the session).
  // Legacy seed products have none and fall back to the tint placeholder.
  mainImage?: string;
  images?: string[];
  sizeVariants?: ProductSizeVariant[];
  color?: string;
  // Set when this product was submitted via "Release to Library" from a
  // completed project, rather than uploaded straight to the library.
  sourceProjectName?: string;
  submittedAt?: string;
  lastRejectionReason?: string;
  // Set by bulk image upload — a placeholder record with an auto-cropped
  // image and no real name/category/material yet. Cleared the first time
  // someone saves an edit via NewProductModal. Blocks Release (see
  // isProjectProductReadyToRelease in permissions.ts) but not the review
  // pipeline itself — Sales/Customer can still review it mid-flight.
  incomplete?: boolean;
}

export const PRODUCTS: Product[] = [
  {
    code: "RND-00125",
    name: "Woven Storage Basket",
    category: "Storage",
    material: "Rattan",
    designer: "An Nguyễn",
    originCustomer: "JYSK",
    description:
      "Giỏ đựng đồ đan tay từ mây, khung tre gia cố đáy. Thiết kế module — xếp chồng được, 3 kích cỡ.",
    status: "RELEASED",
    reuse: "REUSABLE",
    favorites: 12,
    tint: "accent",
    createdAt: "14/01/2026",
  },
  {
    code: "RND-00142",
    name: "Hanging Pendant Lamp",
    category: "Lighting",
    material: "Water Hyacinth",
    designer: "An Nguyễn",
    originCustomer: "—",
    description: "Đèn thả đan bèo tây, khung dây thép sơn tĩnh điện.",
    status: "DEVELOPING",
    reuse: "REUSABLE",
    favorites: 2,
    tint: "blue",
    createdAt: "20/07/2026",
  },
  {
    code: "RND-00098",
    name: "Nesting Planter Set",
    category: "Planter",
    material: "Bamboo",
    designer: "Lan Phạm",
    originCustomer: "Habitat",
    description: "Bộ chậu cây tre lồng nhau 3 size, có lót nhựa chống ẩm.",
    status: "PENDING_REVIEW",
    reuse: "REUSABLE",
    favorites: 6,
    tint: "blue",
    submittedAt: "hôm nay",
    createdAt: "28/08/2026",
  },
  {
    code: "RND-00071",
    name: "Bath Caddy Tray",
    category: "Kitchen & Bath",
    material: "Seagrass",
    designer: "An Nguyễn",
    originCustomer: "—",
    description: "Khay để đồ phòng tắm đan cói, tay cầm gỗ.",
    status: "RELEASED",
    reuse: "REUSABLE",
    favorites: 15,
    tint: "accent",
    createdAt: "03/02/2026",
  },
  {
    code: "RND-00210",
    name: "Wall Mirror Frame",
    category: "Decor",
    material: "Rattan",
    designer: "Lan Phạm",
    originCustomer: "ADE",
    description: "Khung gương treo tường đan mây hình mặt trời.",
    status: "DRAFT",
    reuse: "REUSABLE",
    favorites: 0,
    tint: "slate",
    createdAt: "12/08/2026",
  },
  {
    code: "RND-00305",
    name: "Stacking Cube Shelf",
    category: "Storage",
    material: "Bamboo",
    designer: "An Nguyễn",
    originCustomer: "JYSK",
    description: "Kệ hộp vuông xếp tầng, khung tre ghép mộng.",
    status: "RELEASED",
    reuse: "REUSABLE",
    favorites: 9,
    tint: "accent",
    createdAt: "22/03/2026",
  },
  {
    code: "RND-00188",
    name: "Table Runner Weave",
    category: "Decor",
    material: "Jute",
    designer: "Lan Phạm",
    originCustomer: "—",
    description: "Khăn trải bàn đan đay, viền tua rua thủ công.",
    status: "ARCHIVED",
    reuse: "REUSABLE",
    favorites: 1,
    tint: "slate",
    createdAt: "05/11/2025",
  },
  {
    code: "RND-00256",
    name: "Floor Lamp Cone",
    category: "Lighting",
    material: "Rattan",
    designer: "An Nguyễn",
    originCustomer: "SCG",
    description: "Đèn sàn chao hình nón đan mây, chân gỗ cao su.",
    status: "DEVELOPING",
    reuse: "REUSABLE",
    favorites: 3,
    tint: "blue",
    createdAt: "15/07/2026",
  },
  {
    code: "RND-00320",
    name: "Kitchen Utensil Pot",
    category: "Kitchen & Bath",
    material: "Water Hyacinth",
    designer: "Lan Phạm",
    originCustomer: "Habitat",
    description: "Ống đựng dụng cụ bếp đan bèo tây, đáy chống thấm.",
    status: "RELEASED",
    reuse: "REUSABLE",
    favorites: 4,
    tint: "accent",
    createdAt: "18/04/2026",
  },
  {
    code: "RND-00410",
    name: "Rattan Room Divider",
    category: "Decor",
    material: "Rattan",
    designer: "An Nguyễn",
    originCustomer: "—",
    description: "Vách ngăn phòng đan mây 3 tấm gấp, khung gỗ cao su.",
    status: "RELEASED",
    reuse: "REUSABLE",
    favorites: 7,
    tint: "accent",
    createdAt: "09/05/2026",
  },
  {
    code: "RND-00415",
    name: "Bamboo Coat Rack",
    category: "Storage",
    material: "Bamboo",
    designer: "Lan Phạm",
    originCustomer: "—",
    description: "Giá treo áo tre đứng, 3 tầng, đế chống lật.",
    status: "DEVELOPING",
    reuse: "REUSABLE",
    favorites: 0,
    tint: "blue",
    createdAt: "02/08/2026",
  },
  {
    code: "RND-00420",
    name: "Seagrass Placemat Set",
    category: "Kitchen & Bath",
    material: "Seagrass",
    designer: "An Nguyễn",
    originCustomer: "Habitat",
    description: "Bộ lót bàn ăn đan cói, set 6 cái, viền chỉ may tay.",
    status: "RELEASED",
    reuse: "REUSABLE",
    favorites: 11,
    tint: "accent",
    createdAt: "27/02/2026",
  },
  {
    code: "RND-00425",
    name: "Water Hyacinth Ottoman",
    category: "Decor",
    material: "Water Hyacinth",
    designer: "Lan Phạm",
    originCustomer: "SCG",
    description: "Ghế đôn đan bèo tây, khung gỗ, đệm mút bọc vải.",
    status: "RELEASED",
    reuse: "REUSABLE",
    favorites: 3,
    tint: "accent",
    createdAt: "11/06/2026",
  },
  {
    code: "RND-00430",
    name: "Jute Wall Hanging",
    category: "Decor",
    material: "Jute",
    designer: "An Nguyễn",
    originCustomer: "—",
    description: "Tranh treo tường đan đay macramé, khung gỗ tròn.",
    status: "DRAFT",
    reuse: "REUSABLE",
    favorites: 0,
    tint: "slate",
    createdAt: "19/08/2026",
  },
  {
    code: "RND-00435",
    name: "Rattan Pendant Cluster",
    category: "Lighting",
    material: "Rattan",
    designer: "Lan Phạm",
    originCustomer: "JYSK",
    description: "Cụm đèn thả 3 bóng đan mây, dây treo điều chỉnh độ cao.",
    status: "RELEASED",
    reuse: "REUSABLE",
    favorites: 8,
    tint: "accent",
    createdAt: "30/03/2026",
  },
  {
    // A NEW design still inside an active project — Hà (that project's
    // Sales) flagged it Exclusive for JYSK. Only a project's own NEW item
    // can ever be Exclusive; picked/REUSE items and standalone R&D
    // uploads never are. Not submitted for review yet: for project-origin
    // work that only happens once the project completes and R&D releases
    // it.
    code: "RND-00341",
    name: "Storage Lid Insert",
    category: "Storage",
    material: "Rattan",
    designer: "An Nguyễn",
    originCustomer: "JYSK",
    description: "Thiết kế mới theo yêu cầu riêng — nắp đậy khớp với basket hiện có.",
    status: "DRAFT",
    reuse: "EXCLUSIVE",
    exclusiveBy: "Hà",
    favorites: 0,
    tint: "blue",
    createdAt: "24/08/2026",
  },
  {
    // Released from a project that has actually completed and closed
    // (ADE Decor Refresh) — the valid case for sourceProjectName +
    // PENDING_REVIEW.
    code: "RND-00440",
    name: "Decor Wall Sconce",
    category: "Decor",
    material: "Rattan",
    designer: "Lan Phạm",
    originCustomer: "ADE",
    description: "Đèn tường trang trí đan mây, có thể gắn theo cụm.",
    status: "PENDING_REVIEW",
    reuse: "REUSABLE",
    favorites: 0,
    tint: "blue",
    sourceProjectName: "ADE Decor Refresh",
    submittedAt: "3 ngày trước",
    createdAt: "25/08/2026",
  },
];

export const CATEGORIES = ["Storage", "Lighting", "Decor", "Kitchen & Bath", "Planter"];
export const MATERIALS = ["Rattan", "Bamboo", "Water Hyacinth", "Seagrass", "Jute"];

// "120 × 45 × 80 cm" from whichever of length/width/height are set — null
// when none are, so callers can skip the row instead of showing "— cm".
export function formatSizeVariantDimensions(v: ProductSizeVariant): string | null {
  const parts = [v.length, v.width, v.height].filter((n): n is number => typeof n === "number");
  if (parts.length === 0) return null;
  return `${[v.length, v.width, v.height].map((n) => n ?? "—").join(" × ")} cm`;
}

// Generates the next product code as RND + month(2) + year(2) + a 3-digit
// sequence that resets every month — e.g. RND0826001, next one RND0826002,
// then RND0927001 once September rolls around. Scanning existing codes for
// the current month/year prefix (rather than keeping a separate counter)
// is what keeps this collision-free without any extra state.
export function nextProductCode(products: Product[]): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const prefix = `RND${mm}${yy}`;
  const nums = products
    .filter((p) => p.code.startsWith(prefix))
    .map((p) => parseInt(p.code.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export const SIZES = ["XS", "SM", "ME", "LG", "XL"];
export const COLORS = ["Tự nhiên", "Nâu nhạt", "Nâu đậm", "Trắng", "Đen"];

export interface AssetItem {
  label: string;
  tint: "accent" | "blue" | "green" | "slate";
}

export const PRODUCT_ASSETS: AssetItem[] = [
  { label: "Main Render", tint: "accent" },
  { label: "Render — góc nghiêng", tint: "accent" },
  { label: "Product Photo — mẫu thật", tint: "blue" },
  { label: "Sample Photo — xưởng", tint: "blue" },
  { label: "3D Source (.glb)", tint: "green" },
  { label: "Drawing kỹ thuật (.pdf)", tint: "slate" },
];

// Kept newest-first, per product — the "Mới nhất" badge in the UI just
// marks whichever entry comes first for that productCode.
export interface VersionItem {
  productCode: string;
  number: string;
  note: string;
  by: string;
  date: string;
  image?: string;
}

export const PRODUCT_VERSIONS: VersionItem[] = [
  { productCode: "RND-00125", number: "V04", note: "Gia cố đáy, đổi kiểu đan viền", by: "An Nguyễn", date: "12/08/2026" },
  { productCode: "RND-00125", number: "V03", note: "Điều chỉnh theo feedback JYSK — thu nhỏ 10%", by: "An Nguyễn", date: "02/07/2026" },
  { productCode: "RND-00125", number: "V02", note: "Thêm size M, L", by: "An Nguyễn", date: "18/05/2026" },
  { productCode: "RND-00125", number: "V01", note: "Bản thiết kế gốc", by: "An Nguyễn", date: "30/03/2026" },
];

// The next version's label for one product's history — count starts from
// 1 even with zero real entries yet, since the UI always synthesizes an
// implicit "V01 — Bản thiết kế gốc" when a product has no real history.
export function nextVersionNumber(existingForProduct: VersionItem[]): string {
  const count = existingForProduct.length > 0 ? existingForProduct.length : 1;
  return `V${String(count + 1).padStart(2, "0")}`;
}

export interface FeedbackItem {
  author: string;
  content: string;
  time: string;
  initials: string;
  tint: "accent" | "blue" | "green" | "amber";
}

export interface Project {
  code: string;
  name: string;
  type: ProjectType;
  customer?: string;
  sales?: string;
  rndOwner?: string;
  // Who actually created it — the basis for edit/delete ownership, since
  // not every project has a Sales rep (internal/marketing ones may not).
  createdByName: string;
  createdAt: string;
  status: ProjectStatus;
  deadline: string;
  brief: string;
  isMine: boolean;
  attachments: string[];
  // Stamped by markCompleted — feeds "Ngày hoàn thành thực tế" on the
  // R&D To Do List (see RndTask / my-tasks page), which needs the real
  // day this happened rather than recomputing "today" on every render.
  completedAt?: string;
  // The rest of these back the R&D "My Task" To Do List entry for this
  // project (one row per project the viewer is rndOwner of, not one per
  // ProjectProductItem — see my-tasks/page.tsx). rndPriority defaults to
  // "Trung bình" when absent; rndImportantNote is Admin-writable only (a
  // directive down to the rndOwner, notifies them when set) — R&D never
  // gets edit UI for it; rndNeedsSupport is R&D-writable and notifies
  // Admin when set — the two fields are one-way channels in opposite
  // directions, not a shared note.
  rndPriority?: TaskPriority;
  rndImportantNote?: string;
  rndNeedsSupport?: string;
}

export const PROJECTS: Project[] = [
  {
    code: "PRJ-2025-014",
    name: "JYSK Storage 2025",
    type: "CUSTOMER",
    customer: "JYSK",
    sales: "Hà",
    rndOwner: "An",
    createdByName: "Hà",
    createdAt: "15/07/2026",
    status: "DEVELOPING",
    deadline: "20/09/2026",
    brief: "Bộ sưu tập giỏ đựng đồ & kệ lưu trữ mây tre cho dòng Storage Q1 2025 — 4 sản phẩm, ưu tiên tái sử dụng từ Library hiện có.",
    isMine: true,
    attachments: ["brief-jysk-storage-2025.pdf", "moodboard.jpg"],
  },
  {
    code: "PRJ-2026-002",
    name: "ADE Storage 2026",
    type: "CUSTOMER",
    customer: "ADE",
    sales: "Hà",
    rndOwner: "An",
    createdByName: "Hà",
    createdAt: "01/08/2026",
    status: "DEVELOPING",
    deadline: "05/10/2026",
    brief: "Mở rộng dòng Storage cho ADE, tái sử dụng thiết kế đã release.",
    isMine: false,
    attachments: [],
  },
  {
    code: "PRJ-2026-006",
    name: "SCG Basket 2026",
    type: "CUSTOMER",
    customer: "SCG",
    sales: "Minh",
    rndOwner: "An",
    createdByName: "Minh",
    createdAt: "10/08/2026",
    status: "DEVELOPING",
    deadline: "30/10/2026",
    brief: "Bộ giỏ mới theo brief riêng của SCG, phối hợp 3 chất liệu.",
    isMine: false,
    attachments: [],
  },
  {
    code: "PRJ-2026-011",
    name: "JYSK Lighting Q4",
    type: "CUSTOMER",
    customer: "JYSK",
    sales: "Hà",
    rndOwner: "Lan",
    createdByName: "Hà",
    createdAt: "20/08/2026",
    status: "CREATED",
    deadline: "—",
    brief: "Ý tưởng ban đầu cho dòng đèn Q4, chưa chốt brief.",
    isMine: true,
    attachments: [],
  },
  {
    code: "PRJ-2026-003",
    name: "Habitat Kitchen Set",
    type: "CUSTOMER",
    customer: "Habitat",
    sales: "Minh",
    rndOwner: "An",
    createdByName: "Minh",
    createdAt: "10/03/2026",
    status: "COMPLETED",
    deadline: "15/06/2026",
    brief: "Bộ sản phẩm bếp hoàn thiện, đã release toàn bộ.",
    isMine: false,
    attachments: [],
  },
  {
    code: "PRJ-2025-021",
    name: "ADE Decor Refresh",
    type: "CUSTOMER",
    customer: "ADE",
    sales: "Hà",
    rndOwner: "Lan",
    createdByName: "Hà",
    createdAt: "05/11/2025",
    status: "CLOSED",
    deadline: "01/02/2026",
    brief: "Dự án làm mới dòng Decor, đã đóng — RND-00440 vừa được release từ đây.",
    isMine: false,
    attachments: [],
  },
  {
    code: "PRJ-INT-001",
    name: "Vật liệu tái chế 2026",
    type: "INTERNAL",
    rndOwner: "An",
    createdByName: "Minh",
    createdAt: "01/06/2026",
    status: "DEVELOPING",
    deadline: "—",
    brief: "Nghiên cứu kết hợp mây tre với nhựa tái chế cho dòng sản phẩm ngoài trời.",
    isMine: false,
    attachments: [],
  },
  {
    code: "PRJ-MKT-001",
    name: "Bộ sưu tập Xuân 2027",
    type: "MARKETING",
    rndOwner: "Lan",
    createdByName: "Linh",
    createdAt: "15/08/2026",
    status: "CREATED",
    deadline: "01/03/2027",
    brief: "Chuẩn bị bộ sưu tập mới cho triển lãm Xuân 2027 — sẽ xuất Collection để gửi đối tác.",
    isMine: false,
    attachments: [],
  },
];

// A lightweight, un-vetted image dump attached to a Project — distinct
// from a real Product: no category/material, not part of the approval
// pipeline. Lets R&D dump reference/factory photos first and decide
// later (via "Release Library") which ones become real products; a
// released photo keeps its entry here too, tagged with the resulting
// product code so it's never accidentally released twice.
export interface ProjectPhoto {
  id: string;
  projectCode: string;
  fileName: string;
  url: string;
  uploadedAt: string;
  releasedProductCode?: string;
  // A comment thread per photo — same shape/spirit as Product/Project
  // feedback elsewhere, just embedded directly on the photo (like
  // ProjectProductItem.feedback) rather than a separate top-level array,
  // since a photo folder entry is a small, self-contained item.
  comments: FeedbackItem[];
}

export const INITIAL_PROJECT_PHOTOS: ProjectPhoto[] = [];

export const INITIAL_RND_TASKS: RndTask[] = [
  {
    id: "task-1",
    ownerName: "An",
    title: "Hỗ trợ Sales tính giá bộ ghế mây cho khách lẻ",
    category: "Hỗ trợ tính giá",
    priority: "Trung bình",
    requester: "Hà",
    startDate: "08/09/2026",
    deadline: "15/09/2026",
  },
  {
    id: "task-2",
    ownerName: "An",
    title: "Vẽ lại bản vẽ kỹ thuật khung kệ tre theo yêu cầu xưởng",
    category: "Bản vẽ",
    priority: "Cao",
    requester: "Minh",
    startDate: "01/09/2026",
    deadline: "10/09/2026",
  },
];

// PROJECT_PRODUCTS is global (spans every project), keyed by
// (projectCode, productCode) — NOT a per-project copy. This is what lets
// "Used in Projects" on a product page, the Reused count, and a
// project's own "Sản phẩm dạng up" tab all read the same truth
// instead of drifting apart.
export interface ProjectProductItem {
  projectCode: string;
  productCode: string;
  usage: UsageType;
  status: ProjectProductStatus;
  approval: CustomerApproval;
  note: string;
  // The R&D person actually doing this specific piece of work — distinct
  // from the project's overall rndOwner. Feeds a personal task queue.
  assigneeName?: string;
  feedback: FeedbackItem[];
  // Set when sent back to DEVELOPING from either review stage — mirrors
  // Product.lastRejectionReason. Cleared on resubmit.
  lastRejectionReason?: string;
}

export const PROJECT_PRODUCTS: ProjectProductItem[] = [
  {
    projectCode: "PRJ-2025-014",
    productCode: "RND-00125",
    usage: "REUSE",
    status: "CUSTOMER_REVIEW",
    approval: "PENDING",
    note: "",
    assigneeName: "An",
    feedback: [
      { author: "JYSK Buyer", content: "Cho mình xem thêm ảnh mẫu thật của basket size L với.", time: "2 ngày trước", initials: "JY", tint: "green" },
      { author: "Hà (Sales)", content: "Đã gửi ảnh sample qua email, đang chờ khách xác nhận.", time: "Hôm qua", initials: "HA", tint: "amber" },
    ],
  },
  {
    projectCode: "PRJ-2025-014",
    productCode: "RND-00305",
    usage: "REUSE",
    status: "APPROVED",
    approval: "APPROVED",
    note: "",
    assigneeName: "An",
    feedback: [
      { author: "JYSK Buyer", content: "Mẫu này đẹp, đúng ý — chốt luôn không cần chỉnh gì thêm.", time: "3 tuần trước", initials: "JY", tint: "green" },
    ],
  },
  {
    projectCode: "PRJ-2025-014",
    productCode: "RND-00341",
    usage: "NEW",
    status: "DEVELOPING",
    approval: "CHANGE_REQUESTED",
    note: "Thiết kế mới theo yêu cầu riêng — nắp đậy khớp với basket hiện có.",
    assigneeName: "An",
    lastRejectionReason: "Nắp chưa khớp khít với basket hiện có, chỉnh lại dung sai rồi gửi duyệt lại.",
    feedback: [
      { author: "An Nguyễn (R&D)", content: "Đang thử 2 phương án khớp nắp, dự kiến xong bản vẽ trong tuần.", time: "4 ngày trước", initials: "AN", tint: "blue" },
    ],
  },
  {
    projectCode: "PRJ-2026-002",
    productCode: "RND-00305",
    usage: "REUSE",
    status: "CUSTOMER_REVIEW",
    approval: "PENDING",
    note: "",
    assigneeName: "An",
    feedback: [],
  },
  {
    projectCode: "PRJ-2026-006",
    productCode: "RND-00125",
    usage: "REUSE",
    status: "SALES_REVIEW",
    approval: "PENDING",
    note: "",
    assigneeName: "An",
    feedback: [],
  },
  {
    // The one product from this closed project — released and already
    // passed the project's own internal approval before that release.
    projectCode: "PRJ-2025-021",
    productCode: "RND-00440",
    usage: "NEW",
    status: "APPROVED",
    approval: "APPROVED",
    note: "Đèn tường trang trí đan mây, có thể gắn theo cụm.",
    assigneeName: "Lan",
    feedback: [],
  },
];

// "27/08/2026" — matches the dd/mm/yyyy style already used for deadlines
// everywhere else, for stamping a new project's creation date.
export function todayDDMMYYYY(): string {
  return formatDDMMYYYY(new Date());
}

// Same "dd/mm/yyyy" formatting for an arbitrary Date — used by API routes
// turning a real DateTime column back into the display string every mock
// field/component already expects.
export function formatDDMMYYYY(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

// "Vừa xong" / "5 phút trước" / "3 ngày trước", matching the flavor of
// this app's existing seed feedback timestamps — falls back to a plain
// date once it's more than a week old rather than "52 ngày trước".
export function relativeTimeVi(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return formatDDMMYYYY(date);
}

// Parses the "dd/mm/yyyy" format used for createdAt/deadline fields —
// needed for sorting or recency checks (e.g. Dashboard's "recently added"
// stat). Returns null for the free-text "—" some deadlines use.
export function parseDDMMYYYY(value: string): Date | null {
  const [dd, mm, yyyy] = value.split("/").map(Number);
  if (!dd || !mm || !yyyy) return null;
  return new Date(yyyy, mm - 1, dd);
}

// "Ngày còn lại" on the R&D To Do List — deadline minus today, in whole
// days (negative once overdue). Both sides are floored to midnight first
// so it's a clean day count, not skewed by the current time of day.
export function daysUntil(deadline: string): number | null {
  const d = parseDDMMYYYY(deadline);
  if (!d) return null;
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const deadlineMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((deadlineMidnight.getTime() - todayMidnight.getTime()) / 86400000);
}

// Generates the next code for a new project, scoped by type — matches
// the existing PRJ-YYYY-NNN / PRJ-INT-NNN / PRJ-MKT-NNN conventions above.
export function nextProjectCode(type: ProjectType, projects: Project[]): string {
  if (type === "INTERNAL" || type === "MARKETING") {
    const prefix = type === "INTERNAL" ? "PRJ-INT-" : "PRJ-MKT-";
    const nums = projects
      .filter((p) => p.code.startsWith(prefix))
      .map((p) => parseInt(p.code.slice(prefix.length), 10))
      .filter((n) => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${prefix}${String(next).padStart(3, "0")}`;
  }
  const nums = projects
    .filter((p) => p.type === "CUSTOMER")
    .map((p) => parseInt(p.code.split("-").pop() ?? "", 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `PRJ-${new Date().getFullYear()}-${String(next).padStart(3, "0")}`;
}

// Monday-start week boundaries relative to today (both ends inclusive,
// at midnight) — offsetWeeks 0 is this week, -1 is last week. Backs
// Admin's Check-in "Trọng tâm" digest, which buckets work by which week
// a deadline/completion date falls in.
export function weekRange(offsetWeeks: number): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = today.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(today);
  start.setDate(today.getDate() + diffToMonday + offsetWeeks * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

export function isDDMMYYYYInRange(value: string | undefined, range: { start: Date; end: Date }): boolean {
  if (!value) return false;
  const d = parseDDMMYYYY(value);
  if (!d) return false;
  const t = d.getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

export function getProjectProducts(projectCode: string) {
  return PROJECT_PRODUCTS.filter((pp) => pp.projectCode === projectCode);
}

export function getProductUsages(productCode: string) {
  return PROJECT_PRODUCTS.filter((pp) => pp.productCode === productCode);
}

// Reused = number of times picked as usage REUSE across every project.
// (Collection picks will add to this once the Collection feature ships.)
export function getReusedCount(productCode: string) {
  return PROJECT_PRODUCTS.filter((pp) => pp.productCode === productCode && pp.usage === "REUSE").length;
}

// A curated set of released designs assembled to send to a customer or
// partner (export to PDF / online link). DRAFT is freely editable; once
// Sent it's locked as a snapshot of what was actually shared.
export type CollectionStatus = "DRAFT" | "SENT";

// One pitch = one time someone exported this collection (PDF or online
// link) to actually show a specific customer. Logged at export time (not
// a separate optional step) so getting the file requires saying who it's
// for — see CollectionsProvider.logPitch. Append-only, same as
// FeedbackItem elsewhere — a pitch log entry is never edited or removed
// once recorded, so the history stays trustworthy.
export interface CollectionPitch {
  customer: string;
  loggedByName: string;
  date: string;
  note?: string;
}

export interface Collection {
  id: string;
  name: string;
  createdByName: string;
  createdAt: string;
  status: CollectionStatus;
  productCodes: string[];
  pitches: CollectionPitch[];
  // Set when this collection was auto-created via a completed Project's
  // "Xuất Collection" button — lets a repeat click reuse/top up the same
  // collection instead of spawning a duplicate one each time.
  sourceProjectCode?: string;
}

export const COLLECTIONS: Collection[] = [
  {
    id: "col-1",
    name: "JYSK Storage — Q1 Proposal",
    createdByName: "Hà",
    createdAt: "10/08/2026",
    status: "DRAFT",
    productCodes: ["RND-00125", "RND-00305", "RND-00410"],
    pitches: [],
  },
  {
    id: "col-2",
    name: "Bộ sưu tập Xuân 2027",
    createdByName: "Linh",
    createdAt: "01/08/2026",
    status: "SENT",
    productCodes: ["RND-00420", "RND-00425", "RND-00435"],
    pitches: [
      {
        customer: "ADE",
        loggedByName: "Hà",
        date: "15/08/2026",
        note: "Khách thích mẫu ottoman, hỏi thêm về giá sỉ.",
      },
      {
        customer: "SCG",
        loggedByName: "Minh",
        date: "20/08/2026",
      },
    ],
  },
];

export interface ActivityItem {
  actor: string;
  action: string;
  target?: string;
  time: string;
  initials: string;
  tint: "accent" | "blue" | "green" | "amber";
}

export const DASHBOARD_ACTIVITY: ActivityItem[] = [
  { actor: "Designer An", action: "đã upload V03 cho", target: "RND-00142", time: "2 giờ trước", initials: "AN", tint: "blue" },
  { actor: "Sales Hà", action: "đã tạo dự án", target: "JYSK Storage 2025", time: "5 giờ trước", initials: "HA", tint: "amber" },
  { actor: "Customer JYSK", action: "yêu cầu chỉnh sửa", target: "SCG Basket 2026", time: "Hôm qua", initials: "JY", tint: "green" },
  { actor: "R&D Lan", action: "đã release", target: "RND-00440", time: "2 ngày trước", initials: "LA", tint: "accent" },
  { actor: "Customer ADE", action: "đã approve", target: "ADE Storage 2026", time: "3 ngày trước", initials: "AD", tint: "green" },
];

export const PROJECT_ACTIVITY: ActivityItem[] = [
  { actor: "Hà (Sales)", action: "đã tạo dự án JYSK Storage 2025", time: "15/07/2026", initials: "HA", tint: "amber" },
  { actor: "An (R&D)", action: "đã thêm RND-00125 · Reuse", time: "15/07/2026", initials: "AN", tint: "blue" },
  { actor: "An (R&D)", action: "đã thêm RND-00341 · New", time: "18/07/2026", initials: "AN", tint: "blue" },
  { actor: "JYSK Buyer", action: "đã approve RND-00305", time: "01/08/2026", initials: "JY", tint: "green" },
  { actor: "Hà (Sales)", action: "đã gửi RND-00125 cho khách review", time: "10/08/2026", initials: "HA", tint: "amber" },
];

// General discussion about the project as a whole — not about one
// specific product (those threads live on each item in PROJECT_PRODUCTS).
// Keyed by projectCode so each project's thread is independent (a single
// shared array previously made every project show the same comments).
export interface ProjectFeedbackItem extends FeedbackItem {
  projectCode: string;
}

export const PROJECT_FEEDBACK: ProjectFeedbackItem[] = [
  {
    projectCode: "PRJ-2025-014",
    author: "Hà (Sales)",
    content: "Khách xin dời deadline sang 20/09 vì bên họ đổi lịch nhập hàng.",
    time: "1 tuần trước",
    initials: "HA",
    tint: "amber",
  },
];

export function getProjectFeedback(projectCode: string) {
  return PROJECT_FEEDBACK.filter((f) => f.projectCode === projectCode);
}

// Feedback shown on a product's own Library page — general discussion
// about the design across its whole reuse history, distinct from the
// project-scoped threads on each PROJECT_PRODUCTS item. Keyed by
// productCode for the same reason as ProjectFeedbackItem above.
export interface ProductFeedbackItem extends FeedbackItem {
  productCode: string;
}

export const PRODUCT_FEEDBACK: ProductFeedbackItem[] = [
  {
    productCode: "RND-00125",
    author: "JYSK Buyer",
    content: "Kích thước hiện tại hơi lớn so với kệ trưng bày, có thể thu nhỏ 10% không?",
    time: "3 ngày trước",
    initials: "JY",
    tint: "green",
  },
  {
    productCode: "RND-00125",
    author: "An Nguyễn (R&D)",
    content: "Đã cập nhật ở V03 — thu nhỏ 10%, giữ nguyên kiểu đan.",
    time: "2 ngày trước",
    initials: "AN",
    tint: "blue",
  },
  {
    productCode: "RND-00125",
    author: "Hà (Sales)",
    content: "Khách đã xem V03, đang chờ phản hồi chính thức.",
    time: "Hôm qua",
    initials: "HA",
    tint: "amber",
  },
];

export function getProductFeedback(productCode: string) {
  return PRODUCT_FEEDBACK.filter((f) => f.productCode === productCode);
}

// NOTIFICATIONS — a personal inbox (who gets pinged), separate from the
// shared Activity log (what happened). `recipientName` either matches a
// `designer` string above (e.g. "An Nguyễn".startsWith("An")) or is one
// of the short CURRENT_USER_NAME values directly (e.g. "Hà", "JYSK") —
// both work against the same `.startsWith(userName)` check in TopNav.
export type NotificationType =
  | "PRODUCT_REJECTED"
  | "PRODUCT_APPROVED"
  | "PROJECT_ITEM_NEEDS_REVIEW"
  | "PROJECT_ITEM_CHANGE_REQUESTED"
  | "PROJECT_ITEM_APPROVED"
  | "NEW_FEEDBACK"
  | "NEW_PITCH"
  | "PROJECT_REQUESTED_BY_CUSTOMER"
  | "PROJECT_ASSIGNED"
  | "RND_NEEDS_SUPPORT"
  | "ADMIN_IMPORTANT_NOTE";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  recipientName: string;
  isRead: boolean;
  time: string;
}

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];
