import { Hono } from "hono";
import { Env } from "@/types/hono";
import { CustomerService } from "@/services/customer.service";
import { successResponse, paginatedResponse } from "@/utils/response";
import { listCustomersQuerySchema } from "@/types/customer/customer";
import { authMiddleware } from "@/middleware/auth";
import { toResponse, toResponseArray } from "@/utils/response-transformer";

export const customerRoutes = new Hono<Env>();

// Lazy initialization of service
let customerService: CustomerService | null = null;

function getCustomerService(): CustomerService {
  if (!customerService) {
    customerService = new CustomerService();
  }
  return customerService;
}

// Apply auth middleware to all customer routes
customerRoutes.use("*", authMiddleware);

// GET /api/customers - List all customers
customerRoutes.get("/", async (c) => {
  const user = c.get("user");
  const query = listCustomersQuerySchema.parse(
    Object.fromEntries(new URL(c.req.url).searchParams)
  );

  const { customers, total } = await getCustomerService().listCustomers(
    user.companyId!,
    {
      page: query.page,
      limit: query.limit,
      status: query.status,
      search: query.search,
    }
  );

  return c.json(paginatedResponse(toResponseArray(customers), query.page, query.limit, total));
});

// GET /api/customers/all - List all customers (without pagination)
customerRoutes.get("/all", async (c) => {
  const user = c.get("user");
  const customers = await getCustomerService().getAllCustomers(user.companyId!);
  return c.json(successResponse(toResponseArray(customers)));
});

// GET /api/customers/:id - Get single customer
customerRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const customer = await getCustomerService().getCustomer(user.companyId!, id);

  return c.json(successResponse(toResponse(customer)));
});

// POST /api/customers - Create new customer
customerRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();

  const customer = await getCustomerService().createCustomer(user.companyId!, body);

  return c.json(successResponse(toResponse(customer)), 201);
});

// PUT /api/customers/:id - Update customer
customerRoutes.put("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();

  const customer = await getCustomerService().updateCustomer(user.companyId!, id, body);

  return c.json(successResponse(toResponse(customer)));
});

// DELETE /api/customers/:id - Delete customer
customerRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  await getCustomerService().deleteCustomer(user.companyId!, id, user.role);

  return c.json(successResponse({ message: "Customer deleted successfully" }));
});
