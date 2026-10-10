import { describe, it, expect } from "vitest";
import { isDateInRange } from "@/utils/date";
import { formatCurrency } from "@/utils/currency";
import {
  getTopCustomersByRevenue,
  getTopCustomersByOrderCount,
} from "./reportService";
import type { Revenue } from "@/models/revenue";
import type { Customer } from "@/models/customer";

describe("date and report utils for customer reports", () => {
  describe("isDateInRange", () => {
    it("handles ISO timestamps properly", () => {
      expect(isDateInRange("2026-10-10T14:30:00.000Z", "2026-10-01", "2026-10-31")).toBe(true);
      expect(isDateInRange("2026-10-10 18:00:00", "2026-10-01", "2026-10-31")).toBe(true);
      expect(isDateInRange("2026-09-30T23:59:59.000Z", "2026-10-01", "2026-10-31")).toBe(false);
    });

    it("handles edge cases gracefully without crashing", () => {
      expect(isDateInRange("", "2026-10-01", "2026-10-31")).toBe(false);
      expect(isDateInRange(undefined as unknown as string, "2026-10-01", "2026-10-31")).toBe(false);
      expect(isDateInRange("2026-10-10", "", "")).toBe(true);
    });
  });

  describe("formatCurrency", () => {
    it("formats safely with null, undefined, or NaN", () => {
      expect(formatCurrency(0)).toContain("0");
      expect(formatCurrency(undefined as unknown as number)).toContain("0");
      expect(formatCurrency(null as unknown as number)).toContain("0");
      expect(formatCurrency(NaN)).toContain("0");
      expect(formatCurrency(150000)).toContain("150.000");
    });
  });

  describe("Customer report aggregation", () => {
    const mockCustomers: Customer[] = [
      { id: "c1", name: "Nguyễn Văn A", phone: "0901234567", address: "", createdAt: "2026-01-01" },
    ];

    const mockRevenues: Revenue[] = [
      {
        id: "r1",
        date: "2026-10-10T10:00:00.000Z",
        customerId: "c1",
        finalAmount: 500000,
        orderStatus: "completed",
        paymentStatus: "paid",
        items: [],
      } as unknown as Revenue,
      {
        id: "r2",
        date: "2026-10-10T11:00:00.000Z",
        customerId: "walk-in",
        finalAmount: 200000,
        orderStatus: "completed",
        paymentStatus: "paid",
        items: [],
      } as unknown as Revenue,
      {
        id: "r3",
        date: "2026-10-10T12:00:00.000Z",
        customerId: "unknown-id",
        customerName: "Khách Đặt Web",
        finalAmount: 300000,
        orderStatus: "completed",
        paymentStatus: "paid",
        items: [],
      } as unknown as Revenue,
    ];

    it("aggregates top customers by revenue including walk-in and fallback names", () => {
      const top = getTopCustomersByRevenue(mockRevenues, mockCustomers, 5);
      expect(top).toHaveLength(3);
      expect(top[0]?.customerName).toBe("Nguyễn Văn A");
      expect(top[0]?.totalRevenue).toBe(500000);
      expect(top[1]?.customerName).toBe("Khách Đặt Web");
      expect(top[1]?.totalRevenue).toBe(300000);
      expect(top[2]?.customerName).toBe("Khách vãng lai");
      expect(top[2]?.totalRevenue).toBe(200000);
    });

    it("aggregates top customers by order count", () => {
      const top = getTopCustomersByOrderCount(mockRevenues, mockCustomers, 5);
      expect(top).toHaveLength(3);
      expect(top.every((item) => item.orderCount === 1)).toBe(true);
    });
  });
});
