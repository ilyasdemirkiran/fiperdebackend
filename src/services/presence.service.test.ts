import { describe, expect, it, mock, beforeEach, spyOn } from "bun:test";
import { PresenceService } from "./presence.service";
import * as customerCollections from "@/repositories/collections/customer.collections";
import { logger } from "@/utils/logger";

describe("PresenceService Unit Tests", () => {
  let presenceService: PresenceService;
  let mockInsertOne: ReturnType<typeof mock>;
  let mockCollection: any;

  beforeEach(() => {
    spyOn(logger, "info").mockImplementation(() => {});
    spyOn(logger, "error").mockImplementation(() => {});
    spyOn(logger, "warn").mockImplementation(() => {});

    mockInsertOne = mock(() => Promise.resolve({ insertedId: "test-id" }));
    mockCollection = {
      insertOne: mockInsertOne,
    };

    spyOn(customerCollections, "getPageVisitsCollection").mockReturnValue(
      mockCollection as any
    );

    presenceService = new PresenceService();
  });

  describe("recordPageVisit", () => {
    it("should insert a page visit document with date and timestamp", async () => {
      await presenceService.recordPageVisit({
        userId: "user-1",
        userName: "Ahmet Yılmaz",
        userRole: "admin",
        phoneNumber: "+905551234567",
        companyId: "comp-1",
        path: "/customers",
        platform: "web",
      });

      expect(mockInsertOne).toHaveBeenCalledTimes(1);
      const insertedDoc = mockInsertOne.mock.calls[0][0];
      expect(insertedDoc.userId).toBe("user-1");
      expect(insertedDoc.userName).toBe("Ahmet Yılmaz");
      expect(insertedDoc.userRole).toBe("admin");
      expect(insertedDoc.phoneNumber).toBe("+905551234567");
      expect(insertedDoc.path).toBe("/customers");
      expect(insertedDoc.platform).toBe("web");
      expect(insertedDoc.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(insertedDoc.createdAt).toBeDefined();
    });

    it("should not insert if companyId or path is missing", async () => {
      await presenceService.recordPageVisit({
        userId: "user-1",
        userName: "Ahmet Yılmaz",
        companyId: "",
        path: "/customers",
        platform: "web",
      });

      expect(mockInsertOne).toHaveBeenCalledTimes(0);
    });
  });

  describe("recordHeartbeat", () => {
    it("should automatically call recordPageVisit when path changes", async () => {
      // First heartbeat on /dashboard
      await presenceService.recordHeartbeat({
        userId: "user-1",
        userName: "Ahmet Yılmaz",
        companyId: "comp-1",
        currentPath: "/dashboard",
        platform: "web",
        role: "admin",
      });

      expect(mockInsertOne).toHaveBeenCalledTimes(1);
      expect(mockInsertOne.mock.calls[0][0].path).toBe("/dashboard");

      // Second heartbeat on same path - should NOT call recordPageVisit again
      await presenceService.recordHeartbeat({
        userId: "user-1",
        userName: "Ahmet Yılmaz",
        companyId: "comp-1",
        currentPath: "/dashboard",
        platform: "web",
        role: "admin",
      });

      expect(mockInsertOne).toHaveBeenCalledTimes(1);

      // Third heartbeat on different path - should trigger recordPageVisit
      await presenceService.recordHeartbeat({
        userId: "user-1",
        userName: "Ahmet Yılmaz",
        companyId: "comp-1",
        currentPath: "/sales",
        platform: "web",
        role: "admin",
      });

      expect(mockInsertOne).toHaveBeenCalledTimes(2);
      expect(mockInsertOne.mock.calls[1][0].path).toBe("/sales");
    });
  });

  describe("getActivePresences and setUserOffline", () => {
    it("should track active presences and handle offline", async () => {
      await presenceService.recordHeartbeat({
        userId: "user-1",
        userName: "Ahmet Yılmaz",
        companyId: "comp-1",
        currentPath: "/dashboard",
        platform: "web",
        role: "admin",
      });

      const active = presenceService.getActivePresences();
      expect(active.length).toBe(1);
      expect(active[0].userId).toBe("user-1");

      presenceService.setUserOffline("user-1");
      expect(presenceService.getActivePresences().length).toBe(0);
    });
  });
});

