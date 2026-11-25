import { describe, expect, it, mock, spyOn, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import type { Env } from "@/types/hono";
import { QuoteService } from "@/services/quote.service";
import * as firebaseConfig from "@/config/firebase";
import { UserRepository } from "@/repositories/user.repository";
import { quoteRoutes } from "./quote.routes";

describe("Quote Routes - Item Description & VAT Endpoints", () => {
  let app: Hono<Env>;
  let mockUser: any;
  let activeSpies: Array<{ mockRestore: () => void }> = [];

  beforeEach(() => {
    mockUser = {
      _id: "user-1",
      name: "Ahmet",
      surname: "Yılmaz",
      companyId: "comp-1",
      role: "admin",
      phoneNumber: "+905551234567",
    };

    activeSpies.push(
      spyOn(firebaseConfig, "verifyFirebaseToken").mockResolvedValue({ uid: "user-1" } as any)
    );
    activeSpies.push(
      spyOn(UserRepository.prototype, "findById").mockResolvedValue(mockUser)
    );

    app = new Hono<Env>();
    app.route("/api/quotes", quoteRoutes);
  });

  afterEach(() => {
    activeSpies.forEach(s => s.mockRestore());
    activeSpies = [];
  });

  describe("Description Routes", () => {
    it("PATCH /api/quotes/:id/rooms/:roomId/items/:itemId/description - should update description", async () => {
      const mockQuote = {
        _id: "quote-1",
        rooms: [
          {
            id: "room-1",
            items: [
              {
                id: "item-1",
                description: "Özel pileli dikim",
              },
            ],
          },
        ],
      };

      activeSpies.push(
        spyOn(QuoteService.prototype, "updateItemDescription").mockResolvedValue(mockQuote as any)
      );

      const res = await app.request(
        "/api/quotes/quote-1/rooms/room-1/items/item-1/description",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token",
          },
          body: JSON.stringify({ description: "Özel pileli dikim" }),
        }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.rooms[0].items[0].description).toBe("Özel pileli dikim");
    });

    it("GET /api/quotes/:id/rooms/:roomId/items/:itemId/description - should return description", async () => {
      activeSpies.push(
        spyOn(QuoteService.prototype, "getItemDescription").mockResolvedValue({
          description: "Mevcut kumaş açıklaması",
        })
      );

      const res = await app.request(
        "/api/quotes/quote-1/rooms/room-1/items/item-1/description",
        {
          method: "GET",
          headers: {
            Authorization: "Bearer mock-token",
          },
        }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.description).toBe("Mevcut kumaş açıklaması");
    });

    it("DELETE /api/quotes/:id/rooms/:roomId/items/:itemId/description - should delete description", async () => {
      const mockQuote = {
        _id: "quote-1",
        rooms: [
          {
            id: "room-1",
            items: [{ id: "item-1", description: undefined }],
          },
        ],
      };

      activeSpies.push(
        spyOn(QuoteService.prototype, "deleteItemDescription").mockResolvedValue(mockQuote as any)
      );

      const res = await app.request(
        "/api/quotes/quote-1/rooms/room-1/items/item-1/description",
        {
          method: "DELETE",
          headers: {
            Authorization: "Bearer mock-token",
          },
        }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
    });
  });

  describe("VAT / KDV Routes", () => {
    it("PATCH /api/quotes/:id/rooms/:roomId/items/:itemId/vat - should update vatRate (e.g. 20)", async () => {
      const mockQuote = {
        _id: "quote-1",
        totalVat: 200,
        totalWithVat: 1200,
        rooms: [
          {
            id: "room-1",
            items: [
              {
                id: "item-1",
                vatRate: 20,
                vatAmount: 200,
                totalPriceWithVat: 1200,
              },
            ],
          },
        ],
      };

      activeSpies.push(
        spyOn(QuoteService.prototype, "updateItemVat").mockResolvedValue(mockQuote as any)
      );

      const res = await app.request(
        "/api/quotes/quote-1/rooms/room-1/items/item-1/vat",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token",
          },
          body: JSON.stringify({ vatRate: 20 }),
        }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.rooms[0].items[0].vatRate).toBe(20);
      expect(json.data.rooms[0].items[0].vatAmount).toBe(200);
    });

    it("PATCH /api/quotes/:id/rooms/:roomId/items/:itemId/vat - should accept vatRate = 0 (KDV 0)", async () => {
      const mockQuote = {
        _id: "quote-1",
        totalVat: 0,
        totalWithVat: 1000,
        rooms: [
          {
            id: "room-1",
            items: [
              {
                id: "item-1",
                vatRate: 0,
                vatAmount: 0,
                totalPriceWithVat: 1000,
              },
            ],
          },
        ],
      };

      activeSpies.push(
        spyOn(QuoteService.prototype, "updateItemVat").mockResolvedValue(mockQuote as any)
      );

      const res = await app.request(
        "/api/quotes/quote-1/rooms/room-1/items/item-1/vat",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token",
          },
          body: JSON.stringify({ vatRate: 0 }),
        }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.rooms[0].items[0].vatRate).toBe(0);
      expect(json.data.rooms[0].items[0].vatAmount).toBe(0);
    });

    it("GET /api/quotes/:id/rooms/:roomId/items/:itemId/vat - should return VAT details", async () => {
      activeSpies.push(
        spyOn(QuoteService.prototype, "getItemVat").mockResolvedValue({
          vatRate: 20,
          vatAmount: 200,
          totalPriceWithVat: 1200,
        })
      );

      const res = await app.request(
        "/api/quotes/quote-1/rooms/room-1/items/item-1/vat",
        {
          method: "GET",
          headers: {
            Authorization: "Bearer mock-token",
          },
        }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.vatRate).toBe(20);
      expect(json.data.vatAmount).toBe(200);
      expect(json.data.totalPriceWithVat).toBe(1200);
    });

    it("DELETE /api/quotes/:id/rooms/:roomId/items/:itemId/vat - should reset VAT", async () => {
      const mockQuote = {
        _id: "quote-1",
        totalVat: 0,
        rooms: [
          {
            id: "room-1",
            items: [{ id: "item-1", vatRate: undefined, vatAmount: 0 }],
          },
        ],
      };

      activeSpies.push(
        spyOn(QuoteService.prototype, "deleteItemVat").mockResolvedValue(mockQuote as any)
      );

      const res = await app.request(
        "/api/quotes/quote-1/rooms/room-1/items/item-1/vat",
        {
          method: "DELETE",
          headers: {
            Authorization: "Bearer mock-token",
          },
        }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
    });
  });
});
