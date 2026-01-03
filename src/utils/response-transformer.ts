/**
 * Response transformer utilities
 * Converts MongoDB ObjectId _id to string id for API responses
 */

import { ObjectId } from "mongodb";

/**
 * Response type: replaces _id (ObjectId) with id (string)
 */
export type ApiResponse<T extends { _id?: ObjectId }> = Omit<T, "_id"> & { id: string };

/**
 * Transform a single object: convert ObjectId _id to string id
 */
export function toResponse<T extends { _id?: ObjectId }>(
  obj: T
): ApiResponse<T> {
  const { _id, ...rest } = obj;
  const id = _id instanceof ObjectId ? _id.toString() : String(_id);
  return { ...rest, id } as ApiResponse<T>;
}

/**
 * Transform an array of objects: convert _id to id in each
 */
export function toResponseArray<T extends { _id?: ObjectId }>(
  arr: T[]
): Array<ApiResponse<T>> {
  return arr.map(toResponse);
}

/**
 * Transform nested objects with _id fields
 * Recursively converts all ObjectId _id fields to string id
 */
export function toResponseDeep<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof ObjectId) {
    return obj.toString() as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(toResponseDeep) as T;
  }

  if (typeof obj === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === "_id") {
        result["id"] = value instanceof ObjectId ? value.toString() : String(value);
      } else {
        result[key] = toResponseDeep(value);
      }
    }
    return result;
  }

  return obj;
}

/**
 * Convert string id to ObjectId for queries
 */
export function toObjectId(id: string): ObjectId {
  return new ObjectId(id);
}
