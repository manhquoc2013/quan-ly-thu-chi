/** UnpaidReport — công nợ with order date in report dateRange */
import { useMemo } from "react";
import { useRevenueStore } from "@/store/revenueStore";
import { useCustomerStore } from "@/store/customerStore";
import { useReportStore } from "@/store/reportStore";
import { formatCurrency } from "@/utils/currency";
import { isDateInRange } from "@/utils/date";
import {
  getDepositAmount,
  getRemainingBalance,
  isUnpaidReceivable,
  sumUnpaidReceivable,
} from "@/utils/revenueMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS } from "@/models";

export function UnpaidReport() {
  const revenues = useRevenueStore((s) => s.records);
  const customers = useCustomerStore((s) => s.customers);
  const { from, to } = useReportStore((s) => s.dateRange);

  const unpaid = useMemo(
    () =>
      revenues
        .filter((r) => isUnpaidReceivable(r) && isDateInRange(r.date, from, to))
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date)),
    [revenues, from, to],
  );

  const total = useMemo(() => sumUnpaidReceivable(unpaid), [unpaid]);

  return (
    <div className="space-y-[var(--s-lg)]">
      <div className="grid grid-cols-2 gap-[var(--s-md)]">
        <Card className="text-center py-4">
          <CardContent>
            <p className="text-xs text-text-muted">Tổng công nợ</p>
            <p className="text-lg font-bold text-warning-fg">
              {formatCurrency(total)}
            </p>
          </CardContent>
        </Card>
        <Card className="text-center py-4">
          <CardContent>
            <p className="text-xs text-text-muted">Số đơn chưa thu</p>
            <p className="text-lg font-bold text-text-primary">
              {unpaid.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách công nợ</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {unpaid.length === 0 ? (
            <p className="text-xs text-text-muted py-8 text-center">
              Không có đơn chưa thanh toán trong khoảng này
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {unpaid.map((r) => {
                const customer =
                  r.customerId === "walk-in"
                    ? "Khách vãng lai"
                    : customers.find((c) => c.id === r.customerId)?.name ||
                      r.notes?.replace(/^Khách:\s*/i, "") ||
                      "—";
                return (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono font-semibold text-accent-fg">
                        {r.orderCode}
                      </p>
                      <p className="text-xs text-text-primary truncate">
                        {customer}
                      </p>
                      <p className="text-[11px] text-text-muted">
                        {r.date} · {ORDER_STATUS_LABELS[r.orderStatus]}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCurrency(getRemainingBalance(r))}
                      </p>
                      {getDepositAmount(r) > 0 && (
                        <p className="text-[10px] text-text-muted">
                          Đã cọc {formatCurrency(getDepositAmount(r))} /{" "}
                          {formatCurrency(r.finalAmount)}
                        </p>
                      )}
                      <Badge
                        variant="outline"
                        className="bg-warning-bg text-warning-fg border-transparent text-[10px]"
                      >
                        Chưa thanh toán
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
