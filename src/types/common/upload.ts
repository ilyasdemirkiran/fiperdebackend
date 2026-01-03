import { ObjectId, Binary } from "mongodb";

export interface UploadSession {
  _id?: ObjectId;
  companyId: string;
  customerId: string;
  uploaderId: string;
  filename: string;
  mimeType: string;
  totalSize: number;
  uploadedChunks: number[]; // Set of uploaded chunk indices
  status: "pending" | "completed" | "failed";
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date; // Auto-expire for cleanup
}

export interface UploadChunk {
  _id?: ObjectId;
  uploadId: ObjectId;
  index: number;
  data: Binary;
  size: number;
}

export interface InitUploadInput {
  filename: string;
  mimeType: string;
  totalSize: number;
}
