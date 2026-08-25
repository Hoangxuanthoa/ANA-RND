export type Role = "ADMIN" | "RND" | "SALES" | "CUSTOMER";

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  RND: "R&D",
  SALES: "Sales",
  CUSTOMER: "Customer",
};

export const ROLE_INITIALS: Record<Role, string> = {
  ADMIN: "MI",
  RND: "AN",
  SALES: "HA",
  CUSTOMER: "JY",
};

// Plain name of "the person currently previewing this role" — matches the
// `sales` / `rndOwner` / `customer` strings in the mock data below, so
// ownership checks (canEditProject, isAssignedRndOwner, ...) have someone
// concrete to compare against.
export const CURRENT_USER_NAME: Record<Role, string> = {
  ADMIN: "Minh",
  RND: "An",
  SALES: "Hà",
  CUSTOMER: "JYSK",
};

export type ProductStatus =
  | "DRAFT"
  | "DEVELOPING"
  // Submitted for Admin review — either uploaded straight to the library,
  // or released from a closed project. Reject sends it back to DRAFT.
  | "PENDING_REVIEW"
  | "RELEASED"
  | "ARCHIVED";
export type ReusePermission = "REUSABLE" | "REFERENCE_ONLY" | "EXCLUSIVE";
export type ProjectStatus =
  | "DRAFT"
  | "DEVELOPING"
  | "CUSTOMER_REVIEW"
  | "APPROVED"
  | "COMPLETED"
  | "CLOSED";
export type UsageType = "NEW" | "REUSE";
export type ProjectProductStatus =
  | "DEVELOPING"
  | "SALES_REVIEW"
  | "CUSTOMER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED";
export type CustomerApproval = "PENDING" | "CHANGE_REQUESTED" | "APPROVED";

export interface Product {
  code: string;
  name: string;
  category: string;
  material: string;
  designer: string;
  originCustomer: string;
  description: string;
  status: ProductStatus;
  reuse: ReusePermission;
  presented: number;
  reused: number;
  approved: number;
  tint: "accent" | "blue" | "green" | "slate";
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
    presented: 5,
    reused: 3,
    approved: 3,
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
    reuse: "REFERENCE_ONLY",
    presented: 1,
    reused: 0,
    approved: 0,
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
    presented: 4,
    reused: 2,
    approved: 2,
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
    presented: 8,
    reused: 5,
    approved: 4,
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
    presented: 0,
    reused: 0,
    approved: 0,
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
    presented: 6,
    reused: 4,
    approved: 3,
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
    reuse: "REFERENCE_ONLY",
    presented: 2,
    reused: 0,
    approved: 1,
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
    presented: 1,
    reused: 0,
    approved: 0,
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
    presented: 3,
    reused: 1,
    approved: 2,
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
    presented: 4,
    reused: 2,
    approved: 2,
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
    reuse: "REFERENCE_ONLY",
    presented: 0,
    reused: 0,
    approved: 0,
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
    presented: 7,
    reused: 4,
    approved: 3,
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
    presented: 2,
    reused: 1,
    approved: 1,
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
    presented: 0,
    reused: 0,
    approved: 0,
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
    presented: 5,
    reused: 3,
    approved: 2,
    tint: "accent",
  },
  {
    code: "RND-00341",
    name: "Storage Lid Insert",
    category: "Storage",
    material: "Rattan",
    designer: "An Nguyễn",
    originCustomer: "JYSK",
    description: "Thiết kế mới theo yêu cầu riêng — nắp đậy khớp với basket hiện có.",
    status: "PENDING_REVIEW",
    reuse: "EXCLUSIVE",
    presented: 1,
    reused: 0,
    approved: 0,
    tint: "blue",
    sourceProjectName: "JYSK Storage 2025",
    submittedAt: "hôm qua",
  },
];

export const CATEGORIES = [
  "Storage",
  "Lighting",
  "Decor",
  "Kitchen & Bath",
  "Planter",
];
export const MATERIALS = ["Rattan", "Bamboo", "Water Hyacinth", "Seagrass", "Jute"];

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

export interface UsedInProject {
  name: string;
  customer: string;
  usage: UsageType;
  status: ProjectProductStatus;
}

export const PRODUCT_USED_IN: UsedInProject[] = [
  { name: "JYSK Storage 2025", customer: "JYSK", usage: "REUSE", status: "APPROVED" },
  { name: "ADE Storage 2026", customer: "ADE", usage: "REUSE", status: "CUSTOMER_REVIEW" },
  { name: "SCG Basket 2026", customer: "SCG", usage: "NEW", status: "DEVELOPING" },
];

export interface FeedbackItem {
  author: string;
  content: string;
  time: string;
  initials: string;
  tint: "accent" | "blue" | "green" | "amber";
}

export const PRODUCT_FEEDBACK: FeedbackItem[] = [
  { author: "JYSK Buyer", content: "Kích thước hiện tại hơi lớn so với kệ trưng bày, có thể thu nhỏ 10% không?", time: "3 ngày trước", initials: "JY", tint: "green" },
  { author: "An Nguyễn (R&D)", content: "Đã cập nhật ở V03 — thu nhỏ 10%, giữ nguyên kiểu đan.", time: "2 ngày trước", initials: "AN", tint: "blue" },
  { author: "Hà (Sales)", content: "Khách đã xem V03, đang chờ phản hồi chính thức.", time: "Hôm qua", initials: "HA", tint: "amber" },
];

export interface Project {
  code: string;
  name: string;
  customer: string;
  sales: string;
  rndOwner: string;
  status: ProjectStatus;
  deadline: string;
  productCount: number;
  brief: string;
  isMine: boolean;
}

export const PROJECTS: Project[] = [
  { code: "PRJ-2025-014", name: "JYSK Storage 2025", customer: "JYSK", sales: "Hà", rndOwner: "An", status: "APPROVED", deadline: "20/09/2026", productCount: 4, brief: "Bộ sưu tập giỏ đựng đồ & kệ lưu trữ mây tre cho dòng Storage Q1 2025 — 4 sản phẩm, ưu tiên tái sử dụng từ Design Library hiện có.", isMine: true },
  { code: "PRJ-2026-002", name: "ADE Storage 2026", customer: "ADE", sales: "Hà", rndOwner: "An", status: "CUSTOMER_REVIEW", deadline: "05/10/2026", productCount: 2, brief: "Mở rộng dòng Storage cho ADE, tái sử dụng thiết kế đã release.", isMine: false },
  { code: "PRJ-2026-006", name: "SCG Basket 2026", customer: "SCG", sales: "Minh", rndOwner: "An", status: "DEVELOPING", deadline: "30/10/2026", productCount: 3, brief: "Bộ giỏ mới theo brief riêng của SCG, phối hợp 3 chất liệu.", isMine: false },
  { code: "PRJ-2026-011", name: "JYSK Lighting Q4", customer: "JYSK", sales: "Hà", rndOwner: "Lan", status: "DRAFT", deadline: "—", productCount: 1, brief: "Ý tưởng ban đầu cho dòng đèn Q4, chưa chốt brief.", isMine: true },
  { code: "PRJ-2026-003", name: "Habitat Kitchen Set", customer: "Habitat", sales: "Minh", rndOwner: "An", status: "COMPLETED", deadline: "15/06/2026", productCount: 6, brief: "Bộ sản phẩm bếp hoàn thiện, đã release toàn bộ.", isMine: false },
  { code: "PRJ-2025-021", name: "ADE Decor Refresh", customer: "ADE", sales: "Hà", rndOwner: "Lan", status: "CLOSED", deadline: "01/02/2026", productCount: 5, brief: "Dự án làm mới dòng Decor, đã đóng.", isMine: false },
];

export interface ProjectProductItem {
  code: string;
  name: string;
  usage: UsageType;
  status: ProjectProductStatus;
  approval: CustomerApproval;
  note: string;
  tint: "accent" | "blue";
  // Feedback scoped to this specific product within this project — not
  // mixed with feedback on other products or general project discussion.
  feedback: FeedbackItem[];
}

export const PROJECT_PRODUCTS: ProjectProductItem[] = [
  {
    code: "RND-00125",
    name: "Woven Storage Basket",
    usage: "REUSE",
    status: "CUSTOMER_REVIEW",
    approval: "PENDING",
    note: "",
    tint: "accent",
    feedback: [
      { author: "JYSK Buyer", content: "Cho mình xem thêm ảnh mẫu thật của basket size L với.", time: "2 ngày trước", initials: "JY", tint: "green" },
      { author: "Hà (Sales)", content: "Đã gửi ảnh sample qua email, đang chờ khách xác nhận.", time: "Hôm qua", initials: "HA", tint: "amber" },
    ],
  },
  {
    code: "RND-00305",
    name: "Stacking Cube Shelf",
    usage: "REUSE",
    status: "APPROVED",
    approval: "APPROVED",
    note: "",
    tint: "accent",
    feedback: [
      { author: "JYSK Buyer", content: "Mẫu này đẹp, đúng ý — chốt luôn không cần chỉnh gì thêm.", time: "3 tuần trước", initials: "JY", tint: "green" },
    ],
  },
  {
    code: "RND-00341",
    name: "Storage Lid Insert",
    usage: "NEW",
    status: "DEVELOPING",
    approval: "PENDING",
    note: "Thiết kế mới theo yêu cầu riêng — nắp đậy khớp với basket hiện có.",
    tint: "blue",
    feedback: [
      { author: "An Nguyễn (R&D)", content: "Đang thử 2 phương án khớp nắp, dự kiến xong bản vẽ trong tuần.", time: "4 ngày trước", initials: "AN", tint: "blue" },
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
  { actor: "R&D An", action: "đã release", target: "RND-00098", time: "2 ngày trước", initials: "AN", tint: "accent" },
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
export const PROJECT_FEEDBACK: FeedbackItem[] = [
  { author: "Hà (Sales)", content: "Khách xin dời deadline sang 20/09 vì bên họ đổi lịch nhập hàng.", time: "1 tuần trước", initials: "HA", tint: "amber" },
];

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
