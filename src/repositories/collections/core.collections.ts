import {getCoreDatabase, getDatabaseForCompany, getGlobalVendorDatabase} from "@/config/database";
import type {Collection} from "mongodb";
import type {Company} from "@/types/company/company";
import type {FIUser} from "@/types/user/fi_user";
import type {Vendor} from "@/types/vendor/vendor";
import type {Product} from "@/types/vendor/product/product";
import type {CompanyInvite} from "@/types/company/company_invite";
import type {Subscription} from "@/types/subscription/subscription";
import type {VendorDocument} from "@/types/vendor/vendor_document";
import type {VendorPermission} from "@/types/vendor/vendor_permission";
import type {VendorPriceRate} from "@/types/vendor/vendor_price_rate";
import type {CompanyNoteDb} from "@/types/company/company_note";

export const CORE_COLLECTIONS = {
  companies: "companies",
  companyInvites: "company_invites",
  users: "users",
  subscriptions: "subscriptions",
  companyNotes: "company_notes",

  vendors: {
    vendors: "vendors",
    documents: "vendor_documents",
    permissions: "vendor_permissions",
    price_rates: "vendor_price_rates",
  },
  products: "products",
};

export function getCompaniesCollection(): Collection<Company> {
  return getCoreDatabase().collection<Company>(CORE_COLLECTIONS.companies)
}

export function getCompanyInvitesCollection(): Collection<CompanyInvite> {
  return getCoreDatabase().collection<CompanyInvite>(CORE_COLLECTIONS.companyInvites);
}

export function getUsersCollection(): Collection<FIUser> {
  return getCoreDatabase().collection<FIUser>(CORE_COLLECTIONS.users);
}

export function getSubscriptionCollection(): Collection<Subscription> {
  return getCoreDatabase().collection<Subscription>(CORE_COLLECTIONS.subscriptions);
}

export function getVendorsCollection(): Collection<Vendor> {
  return getGlobalVendorDatabase().collection(CORE_COLLECTIONS.vendors.vendors);
}

export function getCompanyVendorsCollection(companyId: string): Collection<Vendor> {
  return getDatabaseForCompany(companyId).collection<Vendor>(CORE_COLLECTIONS.vendors.vendors);
}

export function getVendorDocumentsCollection(): Collection<VendorDocument> {
  return getGlobalVendorDatabase().collection<VendorDocument>(CORE_COLLECTIONS.vendors.documents);
}

export function getCompanyVendorDocumentsCollection(companyId: string): Collection<VendorDocument> {
  return getDatabaseForCompany(companyId).collection<VendorDocument>(CORE_COLLECTIONS.vendors.documents);
}

export function getVendorPermissionCollection(): Collection<VendorPermission> {
  return getGlobalVendorDatabase().collection<VendorPermission>(CORE_COLLECTIONS.vendors.permissions);
}

export function getVendorPriceRateCollection(companyId: string): Collection<VendorPriceRate> {
  return getDatabaseForCompany(companyId).collection<VendorPriceRate>(CORE_COLLECTIONS.vendors.price_rates);
}

export function getProductsCollection(): Collection<Product> {
  return getGlobalVendorDatabase().collection(CORE_COLLECTIONS.products);
}

export function getCompanyProductsCollection(companyId: string): Collection<Product> {
  return getDatabaseForCompany(companyId).collection<Product>(CORE_COLLECTIONS.products);
}

export function getCompanyNotesCollection(): Collection<CompanyNoteDb> {
  return getCoreDatabase().collection<CompanyNoteDb>(CORE_COLLECTIONS.companyNotes);
}