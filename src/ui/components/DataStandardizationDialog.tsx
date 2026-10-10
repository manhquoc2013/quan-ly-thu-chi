/**
 * DataStandardizationDialog — Interactive AI & Heuristic Data Normalization Modal.
 *
 * Scans, detects, and fixes unstandardized records across Expenses, Customers,
 * Products, and Revenues using LLM (Kilo / Groq / Gemini / Local WebLLM) or Heuristics.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Sparkles,
  RefreshCw,
  ArrowRight,
  CheckCheck,
  Search,
  Check,
  Loader2,
  Receipt,
  Users,
  Package,
  Coins,
  ShieldCheck,
} from 'lucide-react';
import { useUIStore, type StandardizationTargetKind } from '@/store/uiStore';
import {
  scanForStandardization,
  standardizeCandidatesWithAI,
  applyCandidateChanges,
  applyMultipleCandidates,
  type StandardizationCandidate,
  type StandardizeEntityType,
} from '@/services/dataStandardizer';
import { toast } from 'sonner';
import { llmSourceLabel } from '@/services/llmCall';

const ENTITY_ICONS: Record<StandardizeEntityType, React.ReactNode> = {
  expense: <Receipt size={14} className="text-amber-500" />,
  customer: <Users size={14} className="text-blue-500" />,
  product: <Package size={14} className="text-purple-500" />,
  revenue: <Coins size={14} className="text-emerald-500" />,
};

const ENTITY_LABELS: Record<StandardizeEntityType, string> = {
  expense: 'Chi phí',
  customer: 'Khách hàng',
  product: 'Sản phẩm',
  revenue: 'Đơn hàng',
};

export function DataStandardizationDialog() {
  const open = useUIStore((s) => s.standardizationOpen);
  const closeDialog = useUIStore((s) => s.closeStandardization);
  const targetKind = useUIStore((s) => s.standardizationTargetKind);

  const [activeTab, setActiveTab] = useState<StandardizationTargetKind>('all');
  const [candidates, setCandidates] = useState<StandardizationCandidate[]>([]);
  const [scanning, setScanning] = useState(false);
  const [standardizing, setStandardizing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [applying, setApplying] = useState(false);
  const [search, setSearch] = useState('');
  const [totalScanned, setTotalScanned] = useState(0);

  const runScan = useCallback(async (kind: StandardizationTargetKind) => {
    setScanning(true);
    try {
      const summary = await scanForStandardization(kind === 'all' ? 'all' : kind);
      setCandidates(summary.candidates);
      setTotalScanned(summary.totalScanned);
    } catch (err) {
      console.error('[StandardizationDialog] Scan error:', err);
      toast.error('Lỗi khi quét dữ liệu hệ thống');
    } finally {
      setScanning(false);
    }
  }, []);

  // Sync activeTab when targetKind changes on open
  useEffect(() => {
    if (open) {
      const initialKind = targetKind || 'all';
      setActiveTab(initialKind);
      void runScan(initialKind);
    }
  }, [open, targetKind, runScan]);

  const handleStandardizeWithAI = async () => {
    if (candidates.length === 0) return;
    setStandardizing(true);
    setProgress({ current: 0, total: candidates.length });

    try {
      const pendingItems = candidates.filter((c) => c.status === 'pending');
      const itemsToProcess = pendingItems.length > 0 ? pendingItems : candidates;

      const processed = await standardizeCandidatesWithAI(itemsToProcess, (current, total) => {
        setProgress({ current, total });
      });

      // Merge back
      setCandidates((prev) =>
        prev.map((item) => {
          const match = processed.find((p) => p.id === item.id);
          return match || item;
        }),
      );

      const readyCount = processed.filter((p) => p.status === 'ready').length;
      toast.success(`Đã chuẩn hoá thành công ${readyCount} bản ghi với AI!`);
    } catch (err) {
      console.error('[StandardizationDialog] Standardize error:', err);
      toast.error('Có lỗi xảy ra trong quá trình chuẩn hoá');
    } finally {
      setStandardizing(false);
    }
  };

  const handleApplySingle = async (candidate: StandardizationCandidate) => {
    const ok = await applyCandidateChanges(candidate);
    if (ok) {
      toast.success(`Đã cập nhật ${candidate.title}`);
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidate.id ? { ...c, status: 'applied' } : c)),
      );
    } else {
      toast.error(`Lỗi cập nhật: ${candidate.errorMessage || 'Không thể lưu'}`);
    }
  };

  const handleApplySelected = async () => {
    const readyItems = candidates.filter((c) => c.selected && c.status === 'ready');
    if (readyItems.length === 0) {
      toast.info('Vui lòng chọn các bản ghi đã sẵn sàng chuẩn hoá');
      return;
    }

    setApplying(true);
    try {
      const { success, failed } = await applyMultipleCandidates(readyItems);
      if (success > 0) {
        toast.success(`Đã chuẩn hoá và lưu thành công ${success} bản ghi!`);
        setCandidates((prev) =>
          prev.map((c) =>
            c.selected && c.status === 'ready' ? { ...c, status: 'applied' } : c,
          ),
        );
      }
      if (failed > 0) {
        toast.error(`Có ${failed} bản ghi không thể cập nhật`);
      }
    } finally {
      setApplying(false);
    }
  };

  const toggleSelect = (id: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)),
    );
  };

  const toggleSelectAll = (select: boolean) => {
    setCandidates((prev) => prev.map((c) => ({ ...c, selected: select })));
  };

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (activeTab !== 'all' && c.entityType !== activeTab) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const inTitle = c.title.toLowerCase().includes(q);
        const inIssues = c.issues.some((i) => i.toLowerCase().includes(q));
        const inChanges = c.changes?.some((ch) =>
          `${ch.oldValue} ${ch.newValue} ${ch.reason}`.toLowerCase().includes(q),
        );
        return inTitle || inIssues || inChanges;
      }
      return true;
    });
  }, [candidates, activeTab, search]);

  const stats = useMemo(() => {
    const total = candidates.length;
    const ready = candidates.filter((c) => c.status === 'ready').length;
    const applied = candidates.filter((c) => c.status === 'applied').length;
    const selected = candidates.filter((c) => c.selected && c.status === 'ready').length;
    return { total, ready, applied, selected };
  }, [candidates]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && closeDialog()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-surface border border-border/80 shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-border/60 bg-surface-raised/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-accent-fg to-indigo-500 text-white flex items-center justify-center shadow-sm">
                <Sparkles size={18} />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-text-primary flex items-center gap-2">
                  <span>Chuẩn hoá dữ liệu nhập liệu với AI</span>
                  <Badge variant="outline" className="text-[10px] font-normal py-0 border-accent-fg/30 text-accent-fg">
                    Local AI & LLM
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-text-muted mt-0.5">
                  Tự động phát hiện lỗi chính tả, thiếu dấu tiếng Việt, SĐT chưa chuẩn, sai danh mục và đồng bộ đơn vị tính.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => runScan(activeTab)}
                disabled={scanning || standardizing}
                className="text-xs h-8 gap-1.5"
              >
                <RefreshCw size={13} className={scanning ? 'animate-spin' : ''} />
                Quét lại
              </Button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            <div className="bg-surface p-2.5 rounded-lg border border-border/60">
              <div className="text-[11px] text-text-muted">Đã quét</div>
              <div className="text-sm font-semibold text-text-primary mt-0.5">{totalScanned} bản ghi</div>
            </div>
            <div className="bg-surface p-2.5 rounded-lg border border-border/60">
              <div className="text-[11px] text-text-muted">Cần chuẩn hoá</div>
              <div className="text-sm font-semibold text-amber-500 mt-0.5">{stats.total} mục</div>
            </div>
            <div className="bg-surface p-2.5 rounded-lg border border-border/60">
              <div className="text-[11px] text-text-muted">Đã đề xuất (AI)</div>
              <div className="text-sm font-semibold text-accent-fg mt-0.5">{stats.ready} mục</div>
            </div>
            <div className="bg-surface p-2.5 rounded-lg border border-border/60">
              <div className="text-[11px] text-text-muted">Đã cập nhật</div>
              <div className="text-sm font-semibold text-emerald-500 mt-0.5">{stats.applied} mục</div>
            </div>
          </div>
        </DialogHeader>

        {/* Filters & Actions Bar */}
        <div className="px-5 py-3 border-b border-border/60 bg-surface/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(['all', 'expense', 'customer', 'product', 'revenue'] as StandardizationTargetKind[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'bg-accent-fg text-white shadow-xs'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-raised'
                }`}
              >
                {tab === 'all'
                  ? 'Tất cả'
                  : tab === 'expense'
                  ? 'Chi phí'
                  : tab === 'customer'
                  ? 'Khách hàng'
                  : tab === 'product'
                  ? 'Sản phẩm'
                  : 'Đơn hàng'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-44">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                placeholder="Tìm kiếm..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-xs h-7 pl-8 py-0"
              />
            </div>

            <Button
              size="sm"
              variant="default"
              onClick={handleStandardizeWithAI}
              disabled={standardizing || candidates.length === 0}
              className="text-xs h-8 gap-1.5 bg-gradient-to-r from-accent-fg to-indigo-600 hover:opacity-90 text-white"
            >
              {standardizing ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Đang xử lý ({progress.current}/{progress.total})...
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  Chuẩn hoá với AI
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleApplySelected}
              disabled={applying || stats.selected === 0}
              className="text-xs h-8 gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            >
              {applying ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />}
              Áp dụng đã chọn ({stats.selected})
            </Button>
          </div>
        </div>

        {/* Candidate List Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {filteredCandidates.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-border/80 rounded-xl bg-surface-raised/20">
              <ShieldCheck size={40} className="mx-auto text-emerald-500 mb-2.5 opacity-80" />
              <div className="text-sm font-semibold text-text-primary">
                {candidates.length === 0
                  ? 'Dữ liệu đã đạt chuẩn hoàn hảo!'
                  : 'Không tìm thấy kết quả phù hợp'}
              </div>
              <div className="text-xs text-text-muted max-w-md mx-auto mt-1">
                {candidates.length === 0
                  ? 'Hệ thống không phát hiện lỗi chính tả, sai lệch số điện thoại hoặc đơn vị tính nào cần chuẩn hoá.'
                  : 'Thử chuyển qua tab khác hoặc tìm kiếm với từ khoá khác.'}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-[11px] text-text-muted px-1">
                <span>Hiển thị {filteredCandidates.length} bản ghi</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(true)}
                    className="hover:text-accent-fg cursor-pointer"
                  >
                    Chọn tất cả
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(false)}
                    className="hover:text-accent-fg cursor-pointer"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              {filteredCandidates.map((candidate) => (
                <div
                  key={`${candidate.entityType}-${candidate.id}`}
                  className={`rounded-xl border transition-all p-4 ${
                    candidate.status === 'applied'
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : candidate.status === 'ready'
                      ? 'border-accent-fg/40 bg-surface shadow-xs'
                      : 'border-border/80 bg-surface'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={!!candidate.selected}
                        onChange={() => toggleSelect(candidate.id)}
                        disabled={candidate.status === 'applied'}
                        className="mt-1 h-3.5 w-3.5 rounded border-border text-accent-fg focus:ring-accent-fg"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-xs font-semibold text-text-primary">
                            {ENTITY_ICONS[candidate.entityType]}
                            {candidate.title}
                          </span>
                          <Badge variant="outline" className="text-[10px] py-0">
                            {ENTITY_LABELS[candidate.entityType]}
                          </Badge>
                          {candidate.source && (
                            <Badge variant="secondary" className="text-[10px] py-0 font-mono">
                              {llmSourceLabel(candidate.source)}
                            </Badge>
                          )}
                        </div>

                        {/* Issues badges */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {candidate.issues.map((issue, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            >
                              ⚠️ {issue}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      {candidate.status === 'applied' ? (
                        <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
                          <Check size={12} className="mr-1" /> Đã cập nhật
                        </Badge>
                      ) : candidate.status === 'ready' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApplySingle(candidate)}
                          className="text-xs h-7 border-accent-fg/40 text-accent-fg hover:bg-accent-bg"
                        >
                          Áp dụng mục này
                        </Button>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Chờ chuẩn hoá
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Changes Diff Table */}
                  {candidate.changes && candidate.changes.length > 0 && (
                    <div className="mt-3.5 pt-3 border-t border-border/50 space-y-2">
                      <div className="text-[11px] font-semibold text-text-secondary flex items-center gap-1">
                        <Sparkles size={12} className="text-accent-fg" />
                        Đề xuất chuẩn hoá từ AI:
                      </div>

                      <div className="grid gap-2">
                        {candidate.changes.map((diff, dIdx) => (
                          <div
                            key={dIdx}
                            className="text-xs p-2.5 rounded-lg bg-surface-raised/40 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-medium text-text-primary">{diff.fieldLabel}:</span>
                            </div>

                            <div className="flex-1 flex flex-wrap items-center gap-2">
                              <span className="line-through text-destructive/80 text-[11px] bg-destructive/10 px-1.5 py-0.5 rounded font-mono">
                                {String(diff.oldValue || '(trống)')}
                              </span>
                              <ArrowRight size={12} className="text-text-muted" />
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[11px] bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono">
                                {String(diff.newValue)}
                              </span>
                            </div>

                            <span className="text-[10px] text-text-muted sm:text-right shrink-0 italic">
                              {diff.reason}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
