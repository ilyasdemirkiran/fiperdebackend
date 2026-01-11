import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

// Flexible timestamp schema that accepts:
// - Firebase Timestamp instances
// - ISO date strings
// - Date objects
// - Objects with _seconds and _nanoseconds (MongoDB/Firestore serialized)
export const timestampSchema = z.union([
  // Firebase Timestamp instance
  z.custom<Timestamp>((input) => input instanceof Timestamp),
  // ISO date string
  z.string().datetime().transform((str) => Timestamp.fromDate(new Date(str))),
  // Regular date string
  z.string().transform((str) => Timestamp.fromDate(new Date(str))),
  // Date object
  z.date().transform((date) => Timestamp.fromDate(date)),
  // Serialized timestamp object (from MongoDB/backend)
  z.object({
    _seconds: z.number(),
    _nanoseconds: z.number(),
  }).transform((obj) => new Timestamp(obj._seconds, obj._nanoseconds)),
  // Alternate serialized format
  z.object({
    seconds: z.number(),
    nanoseconds: z.number(),
  }).transform((obj) => new Timestamp(obj.seconds, obj.nanoseconds)),
]).catch(() => Timestamp.now());

// Helper type for any timestamp-like object
export type TimestampLike =
  | Timestamp
  | Date
  | string
  | { _seconds: number; _nanoseconds: number }
  | { seconds: number; nanoseconds: number };