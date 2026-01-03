import { ObjectId } from "mongodb";

/**
 * Recursively converts MongoDB ObjectId to string.
 * Keeps the key as '_id'.
 */
export function toResponse<T>(obj: T): any {
  if (obj === null || obj === undefined) return obj;

  if (obj instanceof ObjectId) {
    return obj.toHexString();
  }

  if (obj instanceof Date) {
    return obj;
  }

  // Handle Buffer - return as is for JSON serialization (or could be base64)
  // Ideally large buffers shouldn't be passed here
  if (Buffer.isBuffer(obj)) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toResponse(item));
  }

  if (typeof obj === "object") {
    // Check if it has toHexString method (like custom types behaving as ObjectId)
    if (typeof (obj as any).toHexString === 'function') {
      return (obj as any).toHexString();
    }

    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = (obj as any)[key];
        // Special case for _id directly
        if (key === "_id" && val instanceof ObjectId) {
          newObj[key] = val.toHexString();
        } else {
          newObj[key] = toResponse(val);
        }
      }
    }
    return newObj;
  }

  return obj;
}

/**
 * Converts array of objects.
 */
export function toResponseArray<T>(arr: T[]): any[] {
  return arr.map((item) => toResponse(item));
}
