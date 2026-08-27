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

// Company roster — feeds the R&D-owner / assignee pickers on New Project
// and Admin Settings' User management. At least 5 Sales, 1 Marketing, 2
// R&D, matching the actual team size.
export interface StaffMember {
  id: string;
  name: string;
  role: Exclude<Role, "CUSTOMER">;
}

export const STAFF: StaffMember[] = [
  { id: "usr-1", name: "Minh", role: "ADMIN" },
  { id: "usr-2", name: "Hà", role: "SALES" },
  { id: "usr-3", name: "Hùng", role: "SALES" },
  { id: "usr-4", name: "Trang", role: "SALES" },
  { id: "usr-5", name: "Quân", role: "SALES" },
  { id: "usr-6", name: "Ngọc", role: "SALES" },
  { id: "usr-7", name: "Linh", role: "MARKETING" },
  { id: "usr-8", name: "An", role: "RND" },
  { id: "usr-9", name: "Lan", role: "RND" },
];

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
  favorites: number;
  tint: "accent" | "blue" | "green" | "slate";
  // Real per-product images (object URLs from the browser file picker —
  // there's no upload backend yet, so these only last for the session).
  // Legacy seed products have none and fall back to the tint placeholder.
  mainImage?: string;
  images?: string[];
  sizeVariants?: ProductSizeVariant[];
  color?: string;
  // Set when this product was submitted via "Release to Library" from a
  // closed project, rather than uploaded straight to the library.
  sourceProjectName?: string;
  submittedAt?: string;
  lastRejectionReason?: string;
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
    reuse: "EXCLUSIVE",
    favorites: 0,
    tint: "slate",
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
    reuse: "EXCLUSIVE",
    favorites: 3,
    tint: "blue",
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
    reuse: "EXCLUSIVE",
    favorites: 0,
    tint: "slate",
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
  },
  {
    // Still being designed inside an active (not-yet-closed) project —
    // Sales already flagged it Exclusive for JYSK. Not submitted for
    // review yet: that only happens once the project closes.
    code: "RND-00341",
    name: "Storage Lid Insert",
    category: "Storage",
    material: "Rattan",
    designer: "An Nguyễn",
    originCustomer: "JYSK",
    description: "Thiết kế mới theo yêu cầu riêng — nắp đậy khớp với basket hiện có.",
    status: "DRAFT",
    reuse: "EXCLUSIVE",
    favorites: 0,
    tint: "blue",
  },
  {
    // Released from a project that has actually closed (ADE Decor
    // Refresh) — the valid case for sourceProjectName + PENDING_REVIEW.
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

export interface VersionItem {
  number: string;
  note: string;
  by: string;
  date: string;
}

export const PRODUCT_VERSIONS: VersionItem[] = [
  { number: "V04", note: "Gia cố đáy, đổi kiểu đan viền", by: "An Nguyễn", date: "12/08/2026" },
  { number: "V03", note: "Điều chỉnh theo feedback JYSK — thu nhỏ 10%", by: "An Nguyễn", date: "02/07/2026" },
  { number: "V02", note: "Thêm size M, L", by: "An Nguyễn", date: "18/05/2026" },
  { number: "V01", note: "Bản thiết kế gốc", by: "An Nguyễn", date: "30/03/2026" },
];

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
  status: ProjectStatus;
  deadline: string;
  brief: string;
  isMine: boolean;
  attachments: string[];
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
    status: "DEVELOPING",
    deadline: "20/09/2026",
    brief: "Bộ sưu tập giỏ đựng đồ & kệ lưu trữ mây tre cho dòng Storage Q1 2025 — 4 sản phẩm, ưu tiên tái sử dụng từ Design Library hiện có.",
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
    status: "CREATED",
    deadline: "01/03/2027",
    brief: "Chuẩn bị bộ sưu tập mới cho triển lãm Xuân 2027 — sẽ xuất Collection để gửi đối tác.",
    isMine: false,
    attachments: [],
  },
];

// PROJECT_PRODUCTS is global (spans every project), keyed by
// (projectCode, productCode) — NOT a per-project copy. This is what lets
// "Used in Projects" on a product page, the Reused count, and a
// project's own "Product Development" tab all read the same truth
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
    approval: "PENDING",
    note: "Thiết kế mới theo yêu cầu riêng — nắp đậy khớp với basket hiện có.",
    assigneeName: "An",
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
    status: "DEVELOPING",
    approval: "PENDING",
    note: "",
    assigneeName: "An",
    feedback: [],
  },
];

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

export interface Collection {
  id: string;
  name: string;
  createdByName: string;
  createdAt: string;
  status: CollectionStatus;
  productCodes: string[];
}

export const COLLECTIONS: Collection[] = [
  {
    id: "col-1",
    name: "JYSK Storage — Q1 Proposal",
    createdByName: "Hà",
    createdAt: "10/08/2026",
    status: "DRAFT",
    productCodes: ["RND-00125", "RND-00305", "RND-00410"],
  },
  {
    id: "col-2",
    name: "Bộ sưu tập Xuân 2027",
    createdByName: "Linh",
    createdAt: "01/08/2026",
    status: "SENT",
    productCodes: ["RND-00420", "RND-00425", "RND-00435"],
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
// shared Activity log (what happened). `recipientName` matches a
// `designer` string above, e.g. "An Nguyễn".startsWith("An").
export type NotificationType = "PRODUCT_REJECTED";

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
