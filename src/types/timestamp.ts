import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

export const timestampSchema = z.custom<Timestamp>((input) => {
  if (input instanceof Timestamp) {
    return true;
  }

  return false;
}).transform((input) => {
  if (input instanceof Timestamp) {
    return input;
  }

  return Timestamp.fromDate(new Date(input));
});