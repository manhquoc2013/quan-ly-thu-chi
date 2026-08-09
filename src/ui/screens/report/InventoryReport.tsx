/** InventoryReport — stock-in cash + FIFO gross margin + remaining lots */
import { useMemo } from "react";
import { useExpenseStore } from "@/store/expenseStore";
import { useRevenueStore } from "@/store/revenueStore";
import { useProductStore } from "@/store/productStore";
import { useReportStore } from "@/store/reportStore";
import { formatCurrency } from "@/utils/currency";
import { buildInventoryReport } from "@/services/fifoCogsService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function InventoryReport() {
  const expenses = useExpenseStore((s) => s.records);
  const revenues = useRevenueStore((s) => s.records);
  const products = useProductStore((s) => s.products);
  const { from, to } = useReportStore((s) => s.dateRange);

  const report = useMemo(
    () =>
      buildInventoryReport({
        expenses,
        revenues,
        products,
        from,
        to,
      }),
    [expenses, revenues, products, from, to],
  );

  const { stockIn, gross, remaining } = report;

  return (
    <div className="space-y-[var(--s-lg)]">
      <p className="text-xs text-text-muted">
        Nhập hàng theo ngày phiếu. Lãi gộp FIFO chỉ trên đơn đã thanh toán (ngày
        TT), dòng chưa gắn sản phẩm bị bỏ qua.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[var(--s-md)] min-w-0">
        {[
          {
            l: "Tiền nhập",
            v: formatCurrency(stockIn.totalAmount),
            c: "text-danger-fg",
          },
          {
            l: "SL nhập",
            v: String(stockIn.totalQty),
            c: "text-text-primary",
          },
          {
            l: "DT hàng bán",
            v: formatCurrency(gross.goodsRevenue),
            c: "text-success-fg",
          },
          {
            l: "Giá vốn FIFO",
            v: formatCurrency(gross.cogs),
            c: "text-text-primary",
          },
          {
            l: "Lãi gộp",
            v: formatCurrency(gross.grossProfit),
            c: gross.grossProfit >= 0 ? "text-success-fg" : "text-danger-fg",
          },
          {
            l: "Biên gộp",
            v: `${gross.marginPct.toFixed(1)}%`,
            c: "text-accent-fg",
          },
          {
            l: "Tồn FIFO (SL)",
            v: String(remaining.totalQty),
            c: "text-text-primary",
          },
          {
            l: "Giá trị tồn",
            v: formatCurrency(remaining.totalValue),
            c: "text-text-primary",
          },
        ].map((c) => (
          <Card key={c.l} className="text-center py-4 min-w-0">
            <CardContent className="min-w-0 px-3">
              <p className="text-xs text-text-muted">{c.l}</p>
              <p className={`text-base sm:text-lg font-bold tabular-nums break-words leading-snug ${c.c}`}>
                {c.v}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {gross.estimatedCogs > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Có {formatCurrency(gross.estimatedCogs)} giá vốn ước tính (thiếu lịch
          sử nhập — dùng đơn giá SP).
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Nhập hàng theo sản phẩm</CardTitle>
        </CardHeader>
        <CardContent>
          {stockIn.byProduct.length === 0 ? (
            <p className="text-xs text-text-muted py-4 text-center">
              Không có phiếu nhập trong khoảng này
            </p>
          ) : (
            <div className="overflow-x-auto overflow-y-hidden">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-muted border-b border-border">
                    <th className="py-2 pr-3 font-medium">Sản phẩm</th>
                    <th className="py-2 pr-3 font-medium text-right">SL</th>
                    <th className="py-2 font-medium text-right">Tiền nhập</th>
                  </tr>
                </thead>
                <tbody>
                  {stockIn.byProduct.map((row) => (
                    <tr
                      key={row.productId}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="py-2 pr-3">{row.productName}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {row.qty}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCurrency(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bán &amp; lãi gộp (FIFO)</CardTitle>
        </CardHeader>
        <CardContent>
          {gross.byProduct.length === 0 ? (
            <p className="text-xs text-text-muted py-4 text-center">
              Không có đơn đã TT (có gắn SP) trong khoảng này
            </p>
          ) : (
            <div className="overflow-x-auto overflow-y-hidden">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-muted border-b border-border">
                    <th className="py-2 pr-3 font-medium">Sản phẩm</th>
                    <th className="py-2 pr-3 font-medium text-right">SL bán</th>
                    <th className="py-2 pr-3 font-medium text-right">DT</th>
                    <th className="py-2 pr-3 font-medium text-right">Giá vốn</th>
                    <th className="py-2 font-medium text-right">Lãi</th>
                  </tr>
                </thead>
                <tbody>
                  {gross.byProduct.map((row) => (
                    <tr
                      key={row.productId}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="py-2 pr-3">
                        {row.productName}
                        {row.hasEstimated && (
                          <span className="ml-1.5 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400">
                            ước tính
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {row.qtySold}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatCurrency(row.goodsRevenue)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatCurrency(row.cogs)}
                      </td>
                      <td
                        className={`py-2 text-right tabular-nums font-medium ${
                          row.grossProfit >= 0
                            ? "text-success-fg"
                            : "text-danger-fg"
                        }`}
                      >
                        {formatCurrency(row.grossProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tồn còn lại (FIFO đến hết kỳ)</CardTitle>
        </CardHeader>
        <CardContent>
          {remaining.byProduct.length === 0 ? (
            <p className="text-xs text-text-muted py-4 text-center">
              Không còn tồn theo hàng đợi FIFO
            </p>
          ) : (
            <div className="overflow-x-auto overflow-y-hidden">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-muted border-b border-border">
                    <th className="py-2 pr-3 font-medium">Sản phẩm</th>
                    <th className="py-2 pr-3 font-medium text-right">SL</th>
                    <th className="py-2 font-medium text-right">Giá trị</th>
                  </tr>
                </thead>
                <tbody>
                  {remaining.byProduct.map((row) => (
                    <tr
                      key={row.productId}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="py-2 pr-3">{row.productName}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {row.qty}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCurrency(row.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
