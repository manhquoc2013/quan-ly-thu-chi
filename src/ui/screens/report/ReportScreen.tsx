/** ReportScreen — expense, revenue, and profit reports. Reads from stores. */
import { useState } from "react";
import { SegmentedControl } from "@components/SegmentedControl";
import { ExpenseReport } from "./ExpenseReport";
import { RevenueReport } from "./RevenueReport";
import { ProfitReport } from "./ProfitReport";
type ReportTab = 'expense' | 'revenue' | 'profit';

const SEGMENTS = [
  { value: "expense", label: "Chi phí" },
  { value: "revenue", label: "Doanh thu" },
  { value: "profit", label: "Lợi nhuận" },
];

export function ReportScreen() {
  const [reportType, setReportTab] = useState<ReportTab>("expense");
  return (
    <div className="flex flex-col gap-[var(--s-md)] p-[var(--s-md)]">
      <h2 className="text-lg font-semibold text-text-primary">Báo cáo</h2>
      <SegmentedControl options={SEGMENTS} value={reportType} onChange={(v) => setReportTab(v as ReportTab)} />
      {reportType === "expense" && <ExpenseReport />}
      {reportType === "revenue" && <RevenueReport />}
      {reportType === "profit" && <ProfitReport />}
    </div>
  );
}
