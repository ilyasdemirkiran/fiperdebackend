import {describe, expect, it} from "bun:test";
import {createCustomerSchema, updateCustomerSchema} from "@/types/customer/customer";

describe("Customer Schema Tests", () => {
  it("should succeed with only name and surname when creating customer", () => {
    const result = createCustomerSchema.parse({
      name: "Ahmet",
      surname: "Yılmaz",
    });

    expect(result.name).toBe("Ahmet");
    expect(result.surname).toBe("Yılmaz");
    expect(result.status).toBe("active");
    expect(result.phone).toBeUndefined();
    expect(result.city).toBeUndefined();
  });

  it("should accept full optional fields when creating customer", () => {
    const result = createCustomerSchema.parse({
      name: "Mehmet",
      surname: "Kaya",
      phone: "+905551234567",
      city: "İstanbul",
      district: "Kadıköy",
      address: "Moda Cad. No:5",
      status: "inactive",
    });

    expect(result.name).toBe("Mehmet");
    expect(result.surname).toBe("Kaya");
    expect(result.phone).toBe("+905551234567");
    expect(result.city).toBe("İstanbul");
    expect(result.district).toBe("Kadıköy");
    expect(result.address).toBe("Moda Cad. No:5");
    expect(result.status).toBe("inactive");
  });

  it("should fail when name or surname is missing", () => {
    expect(() => createCustomerSchema.parse({ name: "Ahmet" })).toThrow();
    expect(() => createCustomerSchema.parse({ surname: "Yılmaz" })).toThrow();
  });

  it("should validate update customer with partial fields", () => {
    const result = updateCustomerSchema.parse({
      phone: "+905559876543",
      city: "Ankara",
      district: "Çankaya",
    });

    expect(result.phone).toBe("+905559876543");
    expect(result.city).toBe("Ankara");
    expect(result.district).toBe("Çankaya");
  });
});
