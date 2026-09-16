import { ROLE_LABEL, type Role } from "@/lib/mock-data";

const TINT_BY_ROLE: Record<Role, "accent" | "blue" | "green" | "amber"> = {
  ADMIN: "accent",
  RND: "blue",
  SALES: "amber",
  MARKETING: "accent",
  CUSTOMER: "green",
};

// Real per-person initials (first letter of first + last name word) —
// unlike the mock's ROLE_INITIALS, which is one fixed pair per role and
// would show every real RND person as the same "AN" regardless of who
// they actually are.
function initialsFromName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1][0] ?? first;
  return (first + last).toUpperCase();
}

// Real-data equivalent of feedbackIdentity(role) in mock-data.ts — same
// author/initials/tint shape, built from a real fullName+role instead of
// the per-role mock name.
export function feedbackAuthor(fullName: string, role: Role) {
  return {
    author: `${fullName} (${ROLE_LABEL[role]})`,
    initials: initialsFromName(fullName),
    tint: TINT_BY_ROLE[role],
  };
}
