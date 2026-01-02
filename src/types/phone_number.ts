import { isEmpty } from "es-toolkit/compat";
import {
  type CountryCode,
  isValidPhoneNumber,
  parseIncompletePhoneNumber,
  parsePhoneNumberWithError,
} from "libphonenumber-js";
import { z } from "zod";

export const phoneNumberSchema = z
  .string({ message: "Telefon numarası zorunludur" })
  .min(10, "En az 10 karakter olmalı")
  .max(20, "En fazla 20 karakter olmalı")
  .refine((phone: string) => validatePhoneNumber(phone), {
    message: "Geçersiz telefon numarası",
  });

export function validatePhoneNumber(phone: string) {
  if (isEmpty(phone)) {
    return false;
  }

  try {
    const phoneToValidate = getPhoneWithDefaultCountry(phone);

    const parsed = parseIncompletePhoneNumber(phoneToValidate);

    return isValidPhoneNumber(parsed);
  } catch (err) {
    console.error("Phone number validation error:", err);
    return false;
  }
}

export function getPhoneWithDefaultCountry(phone: string): string {
  if (phone.startsWith("0")) {
    return `+90${phone.slice(1)}`;
  }

  return phone.startsWith("+") ? phone : `+90${phone}`;
}

export function getPhoneNumberCountry(phone: string): CountryCode | null {
  if (isEmpty(phone)) {
    return null;
  }

  try {
    const parsedPhone = parsePhoneNumberWithError(
      getPhoneWithDefaultCountry(phone),
    );
    return parsedPhone.country || null;
  } catch (error) {
    console.error("Phone number country error:", error);
  }

  return null;
}
