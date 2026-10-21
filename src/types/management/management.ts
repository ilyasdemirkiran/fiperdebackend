import {z} from "zod";
import type {Company} from "@/types/company/company";
import type {FIUser} from "@/types/user/fi_user";
import type {Vendor} from "@/types/vendor/vendor";
import type {Product} from "@/types/vendor/product/product";
import type {Subscription} from "@/types/subscription/subscription";
import type {CustomerDb} from "@/types/customer/customer";
import type {CustomerImage} from "@/types/customer/image/customer_image";
import type {Sale} from "@/types/customer/sale/sale";
import type {CustomerNoteDb} from "@/types/customer/customer_notes/customer_note";
import type {Quote} from "@/types/quotes/quote";
import type {DayScheduleDb} from "@/types/schedule/schedule";
import type {CompanyNoteDb} from "@/types/company/company_note";

// Company with populated users
export type CompanyWithUsers = Company & {
  users: FIUser[];
  subscription?: Subscription | null;
};

// Daily activity for a company on a given date
export interface CompanyDailyActivity {
  date: string; // YYYY-MM-DD
  customers: CustomerDb[];
  customerImages: Omit<CustomerImage, "fileId">[];
  sales: Sale[];
  customerNotes: CustomerNoteDb[];
  quotes: Quote[];
  daySchedules: DayScheduleDb[];
}

// Full company detail for management panel
export type CompanyDetail = CompanyWithUsers & {
  companyNotes: CompanyNoteDb[];
  dailyActivity: CompanyDailyActivity;
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
