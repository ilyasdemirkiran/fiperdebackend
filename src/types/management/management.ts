import {z} from "zod";
import type {Company} from "@/types/company/company";
import type {FIUser} from "@/types/user/fi_user";
import type {Vendor} from "@/types/vendor/vendor";
import type {Product} from "@/types/vendor/product/product";
import type {Subscription} from "@/types/subscription/subscription";

// Company with populated users
export type CompanyWithUsers = Company & {
  users: FIUser[];
  subscription?: Subscription | null;
};

// Vendor with populated products
export type VendorWithProducts = Vendor & {
  products: Product[];
};

// Request schemas
export const setVendorAccessSchema = z.object({
  companyIds: z.array(z.string()),
});

export const promoteUserSchema = z.object({
  role: z.enum(["admin", "user"]),
});
