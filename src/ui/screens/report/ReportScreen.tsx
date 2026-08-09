import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Receipt,
  TrendingUp,
  LineChart,
  Wallet,
  Users,
  Package,
  Store,
  Boxes,
} from "lucide-react";
import { ExpenseReport } from "./ExpenseReport";
import { RevenueReport } from "./RevenueReport";
import { ProfitReport } from "./ProfitReport";
import { UnpaidReport } from "./UnpaidReport";
import { CustomerReport } from "./CustomerReport";
import { ProductReport } from "./ProductReport";
import { PlatformReport } from "./PlatformReport";
import { InventoryReport } from "./InventoryReport";
import { bootstrapAppData } from "@/services/bootstrap";
import { useReportStore } from "@/store/reportStore";
import { DatePicker } from "@/ui/components/DatePicker";
import {
  getMonthRange,
  getPreviousMonthRange,
  getLast7Days,
  getLast30Days,
  todayISO,
} from "@/utils/date";

type ReportTab =
  | "expense"
  | "revenue"
  | "profit"
  | "inventory"
  | "unpaid"
  | "customer"
  | "product"
  | "platform";

const SEGMENTS = [
  { value: "expense", label: "Chi phí", icon: Receipt },
  { value: "revenue", label: "Doanh thu", icon: TrendingUp },
  { value: "profit", label: "Lợi nhuận", icon: LineChart },
  { value: "inventory", label: "Hàng hóa", icon: Boxes },
  { value: "unpaid", label: "Công nợ", icon: Wallet },
  { value: "customer", label: "Khách hàng", icon: Users },
  { value: "product", label: "Sản phẩm", icon: Package },
  { value: "platform", label: "Kênh bán", icon: Store },
];

const PRESETS = [
  {
    id: "this-month",
    label: "Tháng này",
    range: () => {
      const r = getMonthRange();
      return { from: r.start, to: r.end };
    },
  },
  {
    id: "last-month",
    label: "Tháng trước",
    range: () => {
      const r = getPreviousMonthRange();
      return { from: r.start, to: r.end };
    },
  },
  {
    id: "7d",
    label: "7 ngày",
    range: () => {
      const r = getLast7Days();
      return { from: r.start, to: r.end };
    },
  },
  {
    id: "30d",
    label: "30 ngày",
    range: () => {
      const r = getLast30Days();
      return { from: r.start, to: r.end };
    },
  },
  {
    id: "all",
    label: "Tất cả",
    range: () => ({ from: "2000-01-01", to: todayISO() }),
  },
] as const;

export function ReportScreen() {
  const [reportType, setReportTab] = useState<ReportTab>("expense");
  const dateRange = useReportStore((s) => s.dateRange);
  const setDateRange = useReportStore((s) => s.setDateRange);
  const [activePreset, setActivePreset] = useState<string>("this-month");

  useEffect(() => {
    void bootstrapAppData();
  }, []);

  const applyPreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setDateRange(preset.range());
    setActivePreset(id);
  };

  return (
    <div className="flex flex-col gap-[var(--s-md)] min-w-0 w-full">
      <div className="flex flex-col gap-2 min-w-0">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-text-primary">Báo cáo</h2>
          <p className="text-xs text-text-muted">Phân tích thu chi theo thời gian thực</p>
        </div>
        <div className="flex flex-wrap items-center gap-0.5 bg-surface-hover rounded-lg p-0.5 w-full sm:w-fit max-w-full">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`h-7 px-2.5 text-[11px] rounded-md font-medium transition-all shrink-0 ${
                activePreset === p.id
                  ? 'bg-white dark:bg-surface text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
              onClick={() => applyPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <DatePicker
          value={dateRange.from}
          onChange={(from) => {
            setActivePreset("");
            setDateRange({
              from,
              to: dateRange.to && dateRange.to < from ? from : dateRange.to,
            });
          }}
          placeholder="Từ ngày"
          className="w-[min(140px,100%)] h-8"
          aria-label="Từ ngày"
        />
        <span className="text-xs text-text-muted shrink-0">→</span>
        <DatePicker
          value={dateRange.to}
          onChange={(to) => {
            setActivePreset("");
            setDateRange({
              from: dateRange.from && dateRange.from > to ? to : dateRange.from,
              to,
            });
          }}
          placeholder="Đến ngày"
          className="w-[min(140px,100%)] h-8"
          aria-label="Đến ngày"
        />
        <span className="hidden sm:inline text-[11px] text-text-muted truncate min-w-0">
          {dateRange.from} → {dateRange.to}
        </span>
      </div>

      <Tabs
        value={reportType}
        onValueChange={(v) => setReportTab(v as ReportTab)}
        className="min-w-0 w-full"
      >
        <div className="w-full max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain pb-0.5 -mx-0.5 px-0.5">
          <TabsList className="inline-flex w-max min-w-full h-auto flex-nowrap justify-start gap-0.5">
            {SEGMENTS.map((s) => (
              <TabsTrigger
                key={s.value}
                value={s.value}
                className="flex flex-none shrink-0 items-center gap-1.5 px-2.5"
              >
                <s.icon size={14} className="shrink-0" />
                <span className="whitespace-nowrap">{s.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      <div className="min-w-0 w-full">
        {reportType === "expense" && <ExpenseReport />}
        {reportType === "revenue" && <RevenueReport />}
        {reportType === "profit" && <ProfitReport />}
        {reportType === "inventory" && <InventoryReport />}
        {reportType === "unpaid" && <UnpaidReport />}
        {reportType === "customer" && <CustomerReport />}
        {reportType === "product" && <ProductReport />}
        {reportType === "platform" && <PlatformReport />}
      </div>
    </div>
  );
}
