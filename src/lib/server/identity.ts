import { ROLE_LABEL, initialsFromName, type Role } from "@/lib/mock-data";

const TINT_BY_ROLE: Record<Role, "accent" | "blue" | "green" | "amber"> = {
  ADMIN: "accent",
  RND: "blue",
  SALES: "amber",
  MARKETING: "accent",
  CUSTOMER: "green",
};

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
