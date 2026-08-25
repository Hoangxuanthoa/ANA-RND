import type { Role } from "@/lib/mock-data";

export const canViewLibrary = (role: Role) => role !== "CUSTOMER";
export const canCreateProduct = (role: Role) => role === "RND" || role === "ADMIN";
export const canManageProduct = (role: Role) => role === "RND" || role === "ADMIN";
export const canCreateProject = (role: Role) => role !== "CUSTOMER";
export const canPickProduct = (role: Role) => role !== "CUSTOMER";
export const isCustomer = (role: Role) => role === "CUSTOMER";
