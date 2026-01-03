import { ObjectId } from "mongodb";

/**
 * Converts MongoDB ObjectId to string for a single object.
 * Keeps the key as '_id'.
 */
export function toResponse<T extends { _id?: ObjectId | string | undefined }>(
  obj: T
): T {
  if (!obj) return obj;

  const newObj: any = { ...obj };

  if (newObj._id && newObj._id instanceof ObjectId) {
    newObj._id = newObj._id.toHexString();
  }

  // Recursively handle nested objects/arrays if needed could stay here, 
  // but for now let's keep it simple (shallow for _id)

  return newObj as T;
}

/**
 * Converts MongoDB ObjectId to string for an array of objects.
 */
export function toResponseArray<T extends { _id?: ObjectId | string | undefined }>(
  arr: T[]
): T[] {
  return arr.map((item) => toResponse(item));
}
