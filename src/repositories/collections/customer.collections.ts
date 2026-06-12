import { getDatabaseForCompany } from "@/config/database";
import type { CustomerDb } from "@/types/customer/customer";
import type { CustomerImage } from "@/types/customer/image/customer_image";
import type { Sale } from "@/types/customer/sale/sale";
import type { CustomerNoteDb } from "@/types/customer/customer_notes/customer_note";
import type { Collection } from "mongodb";
import type {CustomerImageLabel} from "@/types/customer/image/customer_image_label";

export const CUSTOMER_COLLECTIONS = {
  customers: "customers",
  customerImages: "customer_images",
  customerImageLabels: "labels",
  sales: "sales",
  customerNotes: "customer_notes",
}

export function getCustomersCollection(companyId: string): Collection<CustomerDb> {
  return getDatabaseForCompany(companyId)
    .collection<CustomerDb>(CUSTOMER_COLLECTIONS.customers);
}

export function getCustomerImagesCollection(companyId: string): Collection<CustomerImage> {
  return getDatabaseForCompany(companyId)
    .collection<CustomerImage>(CUSTOMER_COLLECTIONS.customerImages);
}

export function getCustomerImageLabelsCollection(companyId:string): Collection<CustomerImageLabel> {
  return getDatabaseForCompany(companyId)
    .collection<CustomerImageLabel>(CUSTOMER_COLLECTIONS.customerImageLabels);
}

export function getSalesCollection(companyId: string): Collection<Sale> {
  return getDatabaseForCompany(companyId)
    .collection<Sale>(CUSTOMER_COLLECTIONS.sales);
}

export function getCustomerNotesCollection(companyId: string): Collection<CustomerNoteDb> {
  return getDatabaseForCompany(companyId)
    .collection<CustomerNoteDb>(CUSTOMER_COLLECTIONS.customerNotes);
}

