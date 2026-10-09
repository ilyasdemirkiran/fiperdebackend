import {describe, expect, it} from "bun:test";
import {localDateSchema, taskMetaSchema, scheduleTaskSchema} from "@/types/schedule/schedule";
import {Timestamp} from "firebase-admin/firestore";

describe("Schedule Validation Tests", () => {
  it("should validate YYYY-MM-DD localDate format properly", () => {
    expect(() => localDateSchema.parse("2026-01-01")).not.toThrow();
    expect(() => localDateSchema.parse("2026-12-31")).not.toThrow();
    expect(() => localDateSchema.parse("2026-02-29")).not.toThrow();

    // Invalid dates
    expect(() => localDateSchema.parse("2026/01/01")).toThrow();
    expect(() => localDateSchema.parse("01-01-2026")).toThrow();
    expect(() => localDateSchema.parse("2026-1-1")).toThrow();
    expect(() => localDateSchema.parse("2026-13-01")).toThrow();
    expect(() => localDateSchema.parse("invalid")).toThrow();
  });

  it("should validate taskMetaSchema", () => {
    expect(() =>
      taskMetaSchema.parse({
        name: "Perde Montajı",
        description: "Salon pencereleri montajı",
      })
    ).not.toThrow();

    expect(() =>
      taskMetaSchema.parse({
        name: "Ölçü Alma",
      })
    ).not.toThrow();

    expect(() =>
      taskMetaSchema.parse({
        name: "",
      })
    ).toThrow();
  });

  it("should validate scheduleTaskSchema default status & order", () => {
    const task = scheduleTaskSchema.parse({
      id: "task-1",
      taskMetaId: "507f1f77bcf86cd799439011",
      meta: {
        name: "Test Task",
      },
      createdAt: Timestamp.now(),
    });

    expect(task.status).toBe("pending");
    expect(task.order).toBe(0);
    expect(task.notes).toEqual([]);
    expect(task.customerId).toBeUndefined();
  });
});
