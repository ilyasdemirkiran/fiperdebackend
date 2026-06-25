import {Hono} from "hono";
import type {Env} from "@/types/hono";
import {CustomerNoteService} from "@/services/customer-note.service";
import {successResponse} from "@/utils/response";
import {authMiddleware} from "@/middleware/auth";
import {z} from "zod";
import {toResponse, toResponseArray} from "@/utils/response-transformer";

export const customerNoteRoutes = new Hono<Env>();

let service: CustomerNoteService | null = null;

function getService(): CustomerNoteService {
  if (!service) {
    service = new CustomerNoteService();
  }
  return service;
}

// Apply auth middleware to all customer note routes
customerNoteRoutes.use("*", authMiddleware);

const createNoteBodySchema = z.object({
  note: z.string().min(1, "Not içeriği boş olamaz"),
});

const updateNoteBodySchema = z.object({
  note: z.string().min(1, "Not içeriği boş olamaz"),
});

// GET /api/customers/:customerId/notes - List notes for customer
customerNoteRoutes.get("/:customerId/notes", async (c) => {
  const user = c.get("user");
  const customerId = c.req.param("customerId");

  const notes = await getService().listNotesByCustomer(user.companyId!, customerId);

  return c.json(successResponse(toResponseArray(notes)));
});

// POST /api/customers/:customerId/notes - Create note for customer
customerNoteRoutes.post("/:customerId/notes", async (c) => {
  const user = c.get("user");
  const customerId = c.req.param("customerId");
  const body = await c.req.json();

  const input = createNoteBodySchema.parse(body);

  const note = await getService().createNote(
    user.companyId!,
    customerId,
    user._id!,
    input.note
  );

  return c.json(successResponse(toResponse(note)), 201);
});

// PUT /api/customers/:customerId/notes/:noteId - Update customer note
customerNoteRoutes.put("/:customerId/notes/:noteId", async (c) => {
  const user = c.get("user");
  const noteId = c.req.param("noteId");
  const body = await c.req.json();

  const input = updateNoteBodySchema.parse(body);

  const note = await getService().updateNote(
    user.companyId!,
    noteId,
    input.note
  );

  return c.json(successResponse(toResponse(note)));
});

// DELETE /api/customers/:customerId/notes/:noteId - Delete customer note
customerNoteRoutes.delete("/:customerId/notes/:noteId", async (c) => {
  const user = c.get("user");
  const noteId = c.req.param("noteId");

  await getService().deleteNote(user.companyId!, noteId);

  return c.json(successResponse({message: "Customer note deleted successfully"}));
});
