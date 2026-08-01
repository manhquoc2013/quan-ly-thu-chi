import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, TrendingUp, LineChart } from "lucide-react";
import { ExpenseReport } from "./ExpenseReport";
import { RevenueReport } from "./RevenueReport";
import { ProfitReport } from "./ProfitReport";
import { bootstrapAppData } from "@/services/bootstrap";
type ReportTab = 'expense' | 'revenue' | 'profit';

const SEGMENTS = [
  { value: "expense", label: "Chi phí", icon: Receipt },
  { value: "revenue", label: "Doanh thu", icon: TrendingUp },
  { value: "profit", label: "Lợi nhuận", icon: LineChart },
];

export function ReportScreen() {
  const [reportType, setReportTab] = useState<ReportTab>("expense");
  useEffect(() => {
    void bootstrapAppData();
  }, []);
  return (
    <div className="flex flex-col gap-[var(--s-md)] p-[var(--s-md)]">
      <h2 className="text-lg font-semibold text-text-primary">Báo cáo</h2>
      <Tabs value={reportType} onValueChange={(v) => setReportTab(v as ReportTab)}>
        <TabsList>
          {SEGMENTS.map(s => <TabsTrigger key={s.value} value={s.value} className="flex items-center gap-1.5"><s.icon size={14} />{s.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      {reportType === "expense" && <ExpenseReport />}
      {reportType === "revenue" && <RevenueReport />}
      {reportType === "profit" && <ProfitReport />}
    </div>
  );
}
