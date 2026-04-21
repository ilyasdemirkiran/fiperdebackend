import { QuoteRepository } from "@/repositories/quote.repository";
import { ProductRepository } from "@/repositories/product.repository";
import { CustomerService } from "@/services/customer.service";
import { type Quote, type QuoteStatus, type QuoteItem, type QuoteRoom, quoteSchema } from "@/types/quotes/quote";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import { ObjectId } from "mongodb";
import { Timestamp } from "firebase-admin/firestore";
import type { Currency } from "@/types/currency";

export class QuoteService {
  private repository: QuoteRepository;
  private productRepository: ProductRepository;
  private customerService: CustomerService;

  constructor() {
    this.repository = new QuoteRepository();
    this.productRepository = new ProductRepository();
    this.customerService = new CustomerService();
  }

  async createQuote(companyId: string, creatorId: string, creatorName: string, currency: Currency): Promise<Quote> {
    const quoteNumber = await this.repository.getNextQuoteNumber(companyId);

    const quote: Quote = quoteSchema.parse({
      companyId,
      quoteNumber,
      creatorId,
      creatorName,
      currency,
      rooms: [],
      status: "draft",
    });

    return await this.repository.create(companyId, quote);
  }

  async getQuote(companyId: string, id: string): Promise<Quote> {
    const quote = await this.repository.findById(companyId, id);
    if (!quote) {
      throw new AppError(404, "Quote not found", "QUOTE_NOT_FOUND");
    }
    return quote;
  }

  async updateQuoteCustomer(
    companyId: string,
    id: string,
    input: { customerId?: string; newCustomer?: { name: string; surname: string; phoneNumber?: string } }
  ): Promise<Quote> {
    const quote = await this.getQuote(companyId, id);
    this.ensureEditable(quote);

    let customerId: string | undefined = input.customerId;
    let customerName: string | undefined;

    if (input.newCustomer) {
      const created = await this.customerService.createCustomer(companyId, {
        name: input.newCustomer.name,
        surname: input.newCustomer.surname,
        phoneNumber: input.newCustomer.phoneNumber,
        status: "active"
      } as any);
      customerId = created._id?.toString();
      customerName = `${created.name} ${created.surname}`;
    } else if (customerId) {
      const customer = await this.customerService.getCustomer(companyId, customerId);
      if (!customer) {
        throw new AppError(400, "Customer not found", "CUSTOMER_NOT_FOUND");
      }
      customerName = `${customer.name} ${customer.surname}`;
    }

    const updated = await this.repository.update(companyId, id, {
      customerId: customerId ? new ObjectId(customerId) : undefined,
      customerName,
    });

    return updated!;
  }

  async updateQuoteCurrency(companyId: string, id: string, currency: Currency): Promise<Quote> {
    const quote = await this.getQuote(companyId, id);
    this.ensureEditable(quote);

    // If currency changes, we need to reset conversions or keep only the new base as 1
    const conversions = { [currency]: 1 };

    const updated = await this.repository.update(companyId, id, {
      currency,
      conversions: conversions as any,
    });

    return await this.recalculateQuoteTotal(companyId, id);
  }

  async updateQuoteConversions(companyId: string, id: string, conversions: Record<string, number>): Promise<Quote> {
    const quote = await this.getQuote(companyId, id);
    this.ensureEditable(quote);

    // Ensure base currency rate is 1
    conversions[quote.currency] = 1;

    await this.repository.update(companyId, id, { conversions: conversions as any });

    return await this.recalculateQuoteTotal(companyId, id);
  }

  async addRoom(companyId: string, id: string, name: string): Promise<Quote> {
    const quote = await this.getQuote(companyId, id);
    this.ensureEditable(quote);

    const room: QuoteRoom = {
      id: new ObjectId().toHexString(),
      name,
      items: [],
      total: 0,
    };

    const updated = await this.repository.update(companyId, id, {
      rooms: [...quote.rooms, room],
    });

    return updated!;
  }

  async deleteRoom(companyId: string, id: string, roomId: string): Promise<Quote> {
    const quote = await this.getQuote(companyId, id);
    this.ensureEditable(quote);

    const roomExists = quote.rooms.some(r => r.id === roomId);
    if (!roomExists) {
      throw new AppError(404, "Room not found", "ROOM_NOT_FOUND");
    }

    const updatedRooms = quote.rooms.filter(r => r.id !== roomId);

    await this.repository.update(companyId, id, { rooms: updatedRooms });
    return await this.recalculateQuoteTotal(companyId, id);
  }

  async updateRoomName(companyId: string, id: string, roomId: string, name: string): Promise<Quote> {
    const quote = await this.getQuote(companyId, id);
    this.ensureEditable(quote);

    const room = quote.rooms.find(r => r.id === roomId);
    if (!room) {
      throw new AppError(404, "Room not found", "ROOM_NOT_FOUND");
    }

    room.name = name;

    const updated = await this.repository.update(companyId, id, { rooms: quote.rooms });
    return updated!;
  }

  async addItemsToRoom(
    companyId: string,
    id: string,
    roomId: string,
    itemsInput: { productId: string; quantity: number; customPrice?: number }[]
  ): Promise<Quote> {
    const quote = await this.getQuote(companyId, id);
    this.ensureEditable(quote);

    if (!quote.conversions || Object.keys(quote.conversions).length <= 1 && !quote.conversions[quote.currency]) {
      // Technically we initialized it with base=1, but let's check if others are needed
    }

    const room = quote.rooms.find(r => r.id === roomId);
    if (!room) {
      throw new AppError(404, "Room not found", "ROOM_NOT_FOUND");
    }

    const newItems: QuoteItem[] = [];

    for (const input of itemsInput) {
      const product = await this.productRepository.findById(input.productId);
      if (!product) {
        throw new AppError(400, `Product not found: ${input.productId}`, "PRODUCT_NOT_FOUND");
      }

      const conversionRate = quote.conversions[product.currency];
      if (!conversionRate) {
        throw new AppError(400, `Conversion rate for ${product.currency} is not defined in this quote.`, "CONVERSION_MISSING");
      }

      const unitPrice = input.customPrice ?? product.price;
      const convertedUnitPrice = unitPrice * conversionRate;
      const totalPrice = input.quantity * convertedUnitPrice;

      newItems.push({
        id: new ObjectId().toHexString(),
        productId: product._id!,
        name: product.name,
        quantity: input.quantity,
        unitPrice,
        originalCurrency: product.currency,
        convertedUnitPrice,
        totalPrice,
      });
    }

    room.items.push(...newItems);

    await this.repository.update(companyId, id, { rooms: quote.rooms });
    return await this.recalculateQuoteTotal(companyId, id);
  }

  async updateItem(
    companyId: string,
    id: string,
    roomId: string,
    itemId: string,
    updates: { quantity?: number; customPrice?: number }
  ): Promise<Quote> {
    const quote = await this.getQuote(companyId, id);
    this.ensureEditable(quote);

    const room = quote.rooms.find(r => r.id === roomId);
    if (!room) throw new AppError(404, "Room not found", "ROOM_NOT_FOUND");

    const item = room.items.find(i => i.id === itemId);
    if (!item) throw new AppError(404, "Item not found", "ITEM_NOT_FOUND");

    if (updates.quantity !== undefined) item.quantity = updates.quantity;
    if (updates.customPrice !== undefined) item.unitPrice = updates.customPrice;

    // Recalculate item prices
    const conversionRate = quote.conversions[item.originalCurrency];
    item.convertedUnitPrice = item.unitPrice * conversionRate;
    item.totalPrice = item.quantity * item.convertedUnitPrice;

    await this.repository.update(companyId, id, { rooms: quote.rooms });
    return await this.recalculateQuoteTotal(companyId, id);
  }

  async removeItem(companyId: string, id: string, roomId: string, itemId: string): Promise<Quote> {
    const quote = await this.getQuote(companyId, id);
    this.ensureEditable(quote);

    const room = quote.rooms.find(r => r.id === roomId);
    if (!room) throw new AppError(404, "Room not found", "ROOM_NOT_FOUND");

    room.items = room.items.filter(i => i.id !== itemId);

    await this.repository.update(companyId, id, { rooms: quote.rooms });
    return await this.recalculateQuoteTotal(companyId, id);
  }

  async submitForApproval(companyId: string, id: string): Promise<Quote> {
    const quote = await this.getQuote(companyId, id);
    this.ensureEditable(quote);

    // Validation
    if (!quote.customerId) {
      throw new AppError(400, "Customer must be selected before submitting for approval.", "VALIDATION_ERROR");
    }

    if (quote.rooms.length === 0 || !quote.rooms.some(r => r.items.length > 0)) {
      throw new AppError(400, "Quote must have at least one room with at least one product.", "VALIDATION_ERROR");
    }

    if (quote.total <= 0) {
      throw new AppError(400, "Quote total must be greater than 0.", "VALIDATION_ERROR");
    }

    const updated = await this.repository.update(companyId, id, { status: "sent_for_approval" });
    return updated!;
  }

  async approveQuote(companyId: string, id: string): Promise<Quote> {
    const quote = await this.getQuote(companyId, id);
    if (quote.status !== "sent_for_approval") {
      throw new AppError(400, "Only quotes sent for approval can be approved.", "INVALID_STATUS");
    }

    const updated = await this.repository.update(companyId, id, { status: "approved" });
    return updated!;
  }

  async denyQuote(companyId: string, id: string): Promise<Quote> {
    const quote = await this.getQuote(companyId, id);
    if (quote.status !== "sent_for_approval") {
      throw new AppError(400, "Only quotes sent for approval can be denied.", "INVALID_STATUS");
    }

    const updated = await this.repository.update(companyId, id, { status: "denied" });
    return updated!;
  }

  async listQuotes(companyId: string, userId: string, role: string): Promise<Quote[]> {
    const isAdmin = role === "admin" || role === "sudo";
    return await this.repository.findAll(companyId, isAdmin ? {} : { creatorId: userId });
  }

  private async recalculateQuoteTotal(companyId: string, id: string): Promise<Quote> {
    const quote = await this.repository.findById(companyId, id);
    if (!quote) return null as any;

    let grandTotal = 0;

    for (const room of quote.rooms) {
      let roomTotal = 0;
      for (const item of room.items) {
        // Re-apply conversion in case rates changed
        const rate = quote.conversions[item.originalCurrency] || 1;
        item.convertedUnitPrice = item.unitPrice * rate;
        item.totalPrice = item.quantity * item.convertedUnitPrice;
        roomTotal += item.totalPrice;
      }
      room.total = roomTotal;
      grandTotal += roomTotal;
    }

    const updated = await this.repository.update(companyId, id, {
      rooms: quote.rooms,
      total: grandTotal,
    });

    return updated!;
  }

  private ensureEditable(quote: Quote) {
    if (quote.status === "approved" || quote.status === "denied") {
      throw new AppError(400, "Approved or Denied quotes cannot be edited.", "READ_ONLY_ERROR");
    }
  }
}
