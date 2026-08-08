import { describe, expect, it } from 'vitest';
import type { Expense, OrderItem, Product, Revenue } from '@/models';
import {
  buildInventoryReport,
  isStockInExpense,
  stockInCashSummary,
} from './fifoCogsService';

function product(partial: Partial<Product> & Pick<Product, 'id' | 'name'>): Product {
  return {
    defaultUnitPrice: 50_000,
    unit: 'con',
    stockQty: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...partial,
  };
}

function stockIn(
  partial: Partial<Expense> &
    Pick<Expense, 'id' | 'date' | 'amount' | 'stockProductId' | 'stockQtyIn'>,
): Expense {
  return {
    description: 'Nhập hàng',
    category: 'supplies',
    status: 'pending',
    paymentMethod: 'cash',
    tags: ['nhap-hang'],
    stockApplied: true,
    createdAt: `${partial.date}T10:00:00.000Z`,
    updatedAt: `${partial.date}T10:00:00.000Z`,
    ...partial,
  };
}

function paidOrder(
  partial: Partial<Revenue> & {
    items: OrderItem[];
    paidAt: string;
  },
): Revenue {
  const total = partial.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  return {
    id: 'r1',
    date: partial.paidAt,
    orderCode: 'DH-1',
    customerId: 'c1',
    totalAmount: total,
    discount: 0,
    finalAmount: total,
    orderStatus: 'completed',
    deliveryStatus: 'delivered',
    paymentStatus: 'paid',
    paymentMethod: 'cash',
    createdAt: `${partial.paidAt}T12:00:00.000Z`,
    updatedAt: `${partial.paidAt}T12:00:00.000Z`,
    ...partial,
  };
}

describe('fifoCogsService', () => {
  const p1 = product({ id: 'p1', name: 'Mèo', defaultUnitPrice: 40_000 });

  it('isStockInExpense requires applied stock fields', () => {
    expect(
      isStockInExpense(
        stockIn({
          id: 'e1',
          date: '2026-08-01',
          amount: 100_000,
          stockProductId: 'p1',
          stockQtyIn: 2,
        }),
      ),
    ).toBe(true);
    expect(
      isStockInExpense(
        stockIn({
          id: 'e2',
          date: '2026-08-01',
          amount: 100_000,
          stockProductId: 'p1',
          stockQtyIn: 2,
          stockApplied: false,
        }),
      ),
    ).toBe(false);
    expect(
      isStockInExpense(
        stockIn({
          id: 'e3',
          date: '2026-08-01',
          amount: 100_000,
          stockProductId: 'p1',
          stockQtyIn: 2,
          status: 'cancelled',
        }),
      ),
    ).toBe(false);
  });

  it('stockInCashSummary totals nhập in date range', () => {
    const expenses = [
      stockIn({
        id: 'e1',
        date: '2026-08-01',
        amount: 100_000,
        stockProductId: 'p1',
        stockQtyIn: 5,
      }),
      stockIn({
        id: 'e2',
        date: '2026-08-15',
        amount: 60_000,
        stockProductId: 'p1',
        stockQtyIn: 2,
      }),
      stockIn({
        id: 'e3',
        date: '2026-07-01',
        amount: 999_000,
        stockProductId: 'p1',
        stockQtyIn: 9,
      }),
    ];
    const summary = stockInCashSummary(expenses, [p1], '2026-08-01', '2026-08-31');
    expect(summary.totalAmount).toBe(160_000);
    expect(summary.totalQty).toBe(7);
    expect(summary.byProduct).toHaveLength(1);
    expect(summary.byProduct[0]!.amount).toBe(160_000);
    expect(summary.byProduct[0]!.qty).toBe(7);
  });

  it('FIFO: two lots different cost, partial sale uses oldest first', () => {
    const expenses = [
      stockIn({
        id: 'e1',
        date: '2026-08-01',
        amount: 100_000,
        stockProductId: 'p1',
        stockQtyIn: 5,
        createdAt: '2026-08-01T08:00:00.000Z',
      }), // unit 20k
      stockIn({
        id: 'e2',
        date: '2026-08-05',
        amount: 150_000,
        stockProductId: 'p1',
        stockQtyIn: 5,
        createdAt: '2026-08-05T08:00:00.000Z',
      }), // unit 30k
    ];
    const revenues = [
      paidOrder({
        id: 'r1',
        paidAt: '2026-08-10',
        items: [
          {
            id: 'i1',
            productId: 'p1',
            name: 'Mèo',
            quantity: 3,
            unitPrice: 50_000,
            total: 150_000,
          },
        ],
      }),
    ];

    const report = buildInventoryReport({
      expenses,
      revenues,
      products: [p1],
      from: '2026-08-01',
      to: '2026-08-31',
    });

    expect(report.gross.goodsRevenue).toBe(150_000);
    expect(report.gross.cogs).toBe(60_000); // 3 × 20k
    expect(report.gross.grossProfit).toBe(90_000);
    expect(report.gross.estimatedCogs).toBe(0);
    expect(report.gross.byProduct[0]!.qtySold).toBe(3);
    expect(report.gross.byProduct[0]!.cogs).toBe(60_000);

    // remaining: 2 @ 20k + 5 @ 30k
    expect(report.remaining.totalQty).toBe(7);
    expect(report.remaining.totalValue).toBe(2 * 20_000 + 5 * 30_000);
  });

  it('FIFO: sale spanning two lots', () => {
    const expenses = [
      stockIn({
        id: 'e1',
        date: '2026-08-01',
        amount: 40_000,
        stockProductId: 'p1',
        stockQtyIn: 2,
      }), // 20k
      stockIn({
        id: 'e2',
        date: '2026-08-02',
        amount: 90_000,
        stockProductId: 'p1',
        stockQtyIn: 3,
      }), // 30k
    ];
    const revenues = [
      paidOrder({
        id: 'r1',
        paidAt: '2026-08-10',
        items: [
          {
            id: 'i1',
            productId: 'p1',
            name: 'Mèo',
            quantity: 4,
            unitPrice: 55_000,
            total: 220_000,
          },
        ],
      }),
    ];
    const report = buildInventoryReport({
      expenses,
      revenues,
      products: [p1],
      from: '2026-08-01',
      to: '2026-08-31',
    });
    // 2×20k + 2×30k = 100k
    expect(report.gross.cogs).toBe(100_000);
    expect(report.remaining.totalQty).toBe(1);
    expect(report.remaining.totalValue).toBe(30_000);
  });

  it('ignores unpaid orders for COGS', () => {
    const expenses = [
      stockIn({
        id: 'e1',
        date: '2026-08-01',
        amount: 100_000,
        stockProductId: 'p1',
        stockQtyIn: 5,
      }),
    ];
    const revenues: Revenue[] = [
      {
        id: 'r1',
        date: '2026-08-10',
        orderCode: 'DH-1',
        customerId: 'c1',
        items: [
          {
            id: 'i1',
            productId: 'p1',
            name: 'Mèo',
            quantity: 2,
            unitPrice: 50_000,
            total: 100_000,
          },
        ],
        totalAmount: 100_000,
        discount: 0,
        finalAmount: 100_000,
        orderStatus: 'new',
        deliveryStatus: 'pending',
        paymentStatus: 'unpaid',
        paymentMethod: 'cash',
        createdAt: '2026-08-10T12:00:00.000Z',
        updatedAt: '2026-08-10T12:00:00.000Z',
      },
    ];
    const report = buildInventoryReport({
      expenses,
      revenues,
      products: [p1],
      from: '2026-08-01',
      to: '2026-08-31',
    });
    expect(report.gross.qtySold).toBe(0);
    expect(report.gross.cogs).toBe(0);
    expect(report.remaining.totalQty).toBe(5);
  });

  it('uses defaultUnitPrice with estimated flag when lots run out', () => {
    const expenses = [
      stockIn({
        id: 'e1',
        date: '2026-08-01',
        amount: 20_000,
        stockProductId: 'p1',
        stockQtyIn: 1,
      }), // 20k
    ];
    const revenues = [
      paidOrder({
        id: 'r1',
        paidAt: '2026-08-10',
        items: [
          {
            id: 'i1',
            productId: 'p1',
            name: 'Mèo',
            quantity: 3,
            unitPrice: 50_000,
            total: 150_000,
          },
        ],
      }),
    ];
    const report = buildInventoryReport({
      expenses,
      revenues,
      products: [p1],
      from: '2026-08-01',
      to: '2026-08-31',
    });
    // 1×20k + 2×40k default
    expect(report.gross.cogs).toBe(20_000 + 80_000);
    expect(report.gross.estimatedCogs).toBe(80_000);
    expect(report.gross.byProduct[0]!.hasEstimated).toBe(true);
  });

  it('does not consume a stock-in lot dated after the sale (timeline order)', () => {
    const expenses = [
      stockIn({
        id: 'e-late',
        date: '2026-08-20',
        amount: 100_000,
        stockProductId: 'p1',
        stockQtyIn: 5,
        createdAt: '2026-08-20T08:00:00.000Z',
      }), // 20k — after the sale
    ];
    const revenues = [
      paidOrder({
        id: 'r1',
        paidAt: '2026-08-05',
        createdAt: '2026-08-05T12:00:00.000Z',
        items: [
          {
            id: 'i1',
            productId: 'p1',
            name: 'Mèo',
            quantity: 2,
            unitPrice: 50_000,
            total: 100_000,
          },
        ],
      }),
    ];
    const report = buildInventoryReport({
      expenses,
      revenues,
      products: [p1],
      from: '2026-08-01',
      to: '2026-08-31',
    });
    // Sale before any lot → full estimated at defaultUnitPrice 40k
    expect(report.gross.cogs).toBe(80_000);
    expect(report.gross.estimatedCogs).toBe(80_000);
    expect(report.remaining.totalQty).toBe(5);
    expect(report.remaining.totalValue).toBe(100_000);
  });

  it('same-day: stock-in earlier createdAt is available to later sale', () => {
    const expenses = [
      stockIn({
        id: 'e1',
        date: '2026-08-10',
        amount: 40_000,
        stockProductId: 'p1',
        stockQtyIn: 2,
        createdAt: '2026-08-10T08:00:00.000Z',
      }), // 20k
    ];
    const revenues = [
      paidOrder({
        id: 'r1',
        paidAt: '2026-08-10',
        createdAt: '2026-08-10T18:00:00.000Z',
        items: [
          {
            id: 'i1',
            productId: 'p1',
            name: 'Mèo',
            quantity: 2,
            unitPrice: 50_000,
            total: 100_000,
          },
        ],
      }),
    ];
    const report = buildInventoryReport({
      expenses,
      revenues,
      products: [p1],
      from: '2026-08-01',
      to: '2026-08-31',
    });
    expect(report.gross.cogs).toBe(40_000);
    expect(report.gross.estimatedCogs).toBe(0);
    expect(report.remaining.totalQty).toBe(0);
  });

  it('only attributes COGS for sales in range; prior sales still consume lots', () => {
    const expenses = [
      stockIn({
        id: 'e1',
        date: '2026-07-01',
        amount: 100_000,
        stockProductId: 'p1',
        stockQtyIn: 5,
      }), // 20k
    ];
    const revenues = [
      paidOrder({
        id: 'r0',
        paidAt: '2026-07-15',
        items: [
          {
            id: 'i0',
            productId: 'p1',
            name: 'Mèo',
            quantity: 2,
            unitPrice: 50_000,
            total: 100_000,
          },
        ],
      }),
      paidOrder({
        id: 'r1',
        paidAt: '2026-08-10',
        items: [
          {
            id: 'i1',
            productId: 'p1',
            name: 'Mèo',
            quantity: 2,
            unitPrice: 50_000,
            total: 100_000,
          },
        ],
      }),
    ];
    const report = buildInventoryReport({
      expenses,
      revenues,
      products: [p1],
      from: '2026-08-01',
      to: '2026-08-31',
    });
    expect(report.gross.qtySold).toBe(2);
    expect(report.gross.cogs).toBe(40_000);
    expect(report.stockIn.totalAmount).toBe(0);
    expect(report.remaining.totalQty).toBe(1);
  });
});
