/**
 * LucyControlDeck — Interactive floating control hub & financial companion panel.
 * Gives shop owners 1-click access to:
 * - Focus / Pomodoro Mode with countdown & concentration coaching
 * - Speech synthesis & Voice advice (Vietnamese TTS + lip-sync)
 * - Instant Today Financial Snapshot (Revenue, Expense, Profit, Debts)
 * - Desk Companion docking & roaming settings
 * - Petting interaction with purr sound synthesis
 */

import { useState, useEffect } from 'react';
import {
  Sparkles,
  Volume2,
  Target,
  Pause,
  Play,
  TrendingUp,
  MessageSquare,
  Pin,
  Move,
  Heart,
  X,
  Lightbulb,
  Shirt,
  Gamepad2,
  EyeOff,
} from 'lucide-react';
import {
  useMascotStore,
  type MascotActivity,
  VOICE_TONES,
  type VoiceTone,
  OUTFIT_PRESETS,
  type MascotOutfit,
} from '@/store/mascotStore';
import { useUIStore } from '@/store/uiStore';
import { getTodayFinancialSummary, type TodayFinancialSummary } from '@/services/mascotAdvisor';
import { FINANCIAL_TIPS, pickLine } from '@/services/mascotLines';

export function LucyControlDeck({ onClose }: { onClose: () => void }) {
  const {
    outfit,
    autoOutfit,
    setOutfit,
    setAutoOutfit,
    triggerAction,
    isTransforming,
    voiceEnabled,
    soundEnabled,
    voiceTone,
    setVoiceTone,
    announceOrders,
    setAnnounceOrders,
    setVoiceEnabled,
    setSoundEnabled,
    focusMode,
    focusSecondsLeft,
    startFocus,
    stopFocus,
    isDocked,
    setDocked,
    activity,
    setActivity,
    petCount,
    petCat,
    speak,
    setEnabled,
  } = useMascotStore();

  const toggleFab = useUIStore((s) => s.toggleFab);
  const [financialData, setFinancialData] = useState<TodayFinancialSummary | null>(null);
  const [loadingFinance, setLoadingFinance] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(25);

  useEffect(() => {
    let mounted = true;
    setLoadingFinance(true);
    getTodayFinancialSummary()
      .then((data) => {
        if (mounted) setFinancialData(data);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoadingFinance(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const fmtCurrency = (val: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  const handleReadFinancialBrief = () => {
    if (!financialData) return;
    speak(financialData.adviceMessage, financialData.adviceEmotion, { forceVoice: true });
  };

  const handleReadFinancialTip = () => {
    const tip = pickLine(FINANCIAL_TIPS);
    speak(`💡 Lời khuyên cho chủ tiệm: ${tip}`, 'thinking', { forceVoice: true });
  };

  const currentOutfitPreset = OUTFIT_PRESETS[outfit] || OUTFIT_PRESETS.financial;

  return (
    <div
      className="fixed z-[120] bottom-16 right-4 sm:right-6 w-[360px] sm:w-[410px] max-w-[calc(100vw-32px)] bg-surface/95 dark:bg-surface/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 select-none text-text-primary"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-gradient-to-r from-pink-500/10 via-amber-500/10 to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-full bg-gradient-to-tr from-pink-500/20 to-amber-500/20 border border-pink-500/30 text-pink-600 dark:text-pink-400 flex items-center justify-center font-bold text-base shadow-inner">
            {currentOutfitPreset.icon}
          </div>
          <div>
            <h3 className="text-sm font-bold flex items-center gap-1.5 leading-none">
              Mèo Nấm
              <span className="text-[10px] font-medium text-pink-600 dark:text-pink-400 bg-pink-500/15 px-2 py-0.5 rounded-full border border-pink-500/25">
                {currentOutfitPreset.name}
              </span>
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">3D Pixar Chibi Mascot · Trợ lý đa năng</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={petCat}
            title="Xoa đầu mèo lấy may"
            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors font-medium border border-rose-500/20"
          >
            <Heart size={12} className="fill-rose-500 text-rose-500 animate-pulse" />
            <span>{petCount}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-full text-text-muted hover:bg-surface-hover transition-colors"
            aria-label="Đóng bảng điều khiển"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="p-3.5 space-y-3.5 max-h-[75vh] overflow-y-auto">
        {/* Section 0: Wardrobe & Outfits Selector (Three-VRM modular attachment) */}
        <div className="p-3 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Shirt size={15} className="text-pink-500" />
              <span className="text-xs font-semibold">Tủ Đồ & Trang Phục (5 Modules)</span>
            </div>
            <div className="flex items-center gap-1.5">
              {isTransforming ? (
                <span className="flex items-center gap-1 text-[10px] text-pink-500 font-semibold px-2 py-0.5 rounded-full bg-pink-500/10 animate-pulse">
                  <Sparkles size={10} />
                  Đang biến hình...
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setAutoOutfit(!autoOutfit)}
                  title={autoOutfit ? 'Đang bật tự động thay đồ theo trang & ngữ cảnh' : 'Đang tắt tự động thay đồ'}
                  className={[
                    'text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors border',
                    autoOutfit
                      ? 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30 font-semibold'
                      : 'bg-surface text-text-muted border-border-subtle hover:bg-surface-hover',
                  ].join(' ')}
                >
                  {autoOutfit ? '✨ Tự đổi: Bật' : 'Tự đổi: Tắt'}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1.5 mb-2">
            {(Object.keys(OUTFIT_PRESETS) as MascotOutfit[]).map((key) => {
              const item = OUTFIT_PRESETS[key];
              const isSelected = outfit === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOutfit(key)}
                  className={[
                    'flex flex-col items-center justify-center p-2 rounded-xl text-center transition-all',
                    isSelected
                      ? 'bg-pink-500/15 border-2 border-pink-500 text-pink-600 dark:text-pink-400 shadow-xs scale-102 font-bold'
                      : 'bg-surface hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-text-primary',
                  ].join(' ')}
                >
                  <span className="text-xl leading-none mb-1">{item.icon}</span>
                  <span className="text-[10px] leading-tight line-clamp-1">{item.name.replace('Trợ lý ', '')}</span>
                </button>
              );
            })}
          </div>

          <div className="p-2.5 rounded-lg bg-surface border border-border-subtle text-[11px] leading-relaxed flex items-start gap-2">
            <span className="text-base leading-none">{currentOutfitPreset.icon}</span>
            <div className="flex-1">
              <div className="font-semibold text-text-primary text-[11px]">{currentOutfitPreset.name} ({currentOutfitPreset.role})</div>
              <div className="text-text-muted text-[10px] mt-0.5">{currentOutfitPreset.desc}</div>
            </div>
          </div>
        </div>

        {/* Section 0.5: Action Playground (Interactive Motion Control) */}
        <div className="p-3 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Gamepad2 size={15} className="text-indigo-500" />
              <span className="text-xs font-semibold">Tương Tác & Hành Động Của Nấm</span>
            </div>
            <span className="text-[10px] text-text-muted">Nhấn để xem biểu diễn</span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'walk', label: 'Đi dạo', icon: '🚶' },
              { id: 'run', label: 'Chạy nhanh', icon: '🏃' },
              { id: 'jump', label: 'Nhảy cao', icon: '🦘' },
              { id: 'climb', label: 'Leo trèo', icon: '🧗' },
              { id: 'crawl', label: 'Bò luồn', icon: '🐛' },
              { id: 'trip', label: 'Té ngã', icon: '💫' },
              { id: 'peek', label: 'Nấp trốn', icon: '🫣' },
              { id: 'celebrate', label: 'Ăn mừng', icon: '🎉' },
            ].map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={() => triggerAction(act.id)}
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-surface hover:bg-surface-hover border border-border-subtle text-[11px] font-medium text-text-secondary hover:text-text-primary transition-all active:scale-95"
              >
                <span>{act.icon}</span>
                <span>{act.label}</span>
              </button>
            ))}
          </div>
        </div>
        {/* Section 1: Focus Companion (Pomodoro) */}
        <div className="p-3 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Target size={15} className="text-amber-500" />
              <span className="text-xs font-semibold">Chế độ Tập Trung và Không Xao Nhãng</span>
            </div>
            {focusMode && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 animate-pulse">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Đang tập trung
              </span>
            )}
          </div>

          {focusMode ? (
            <div className="flex items-center justify-between bg-surface-hover/70 p-2.5 rounded-lg border border-border-subtle">
              <div className="flex items-center gap-3">
                <div className="text-2xl font-mono font-bold tracking-wider text-amber-500">
                  {formatTime(focusSecondsLeft)}
                </div>
                <div className="text-[11px] text-text-muted leading-tight">
                  Nấm đang canh chừng giúp bạn.<br />Giữ vững kỷ luật nhé!
                </div>
              </div>
              <button
                type="button"
                onClick={stopFocus}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors flex items-center gap-1"
              >
                <Pause size={12} />
                Dừng
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                {[15, 25, 45].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setCustomMinutes(mins)}
                    className={[
                      'flex-1 py-1 text-xs rounded-md border font-medium transition-colors',
                      customMinutes === mins
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 font-semibold'
                        : 'border-border-subtle bg-surface hover:bg-surface-hover text-text-secondary',
                    ].join(' ')}
                  >
                    {mins} phút
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => startFocus(customMinutes)}
                className="w-full py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Play size={13} className="fill-white" />
                Bắt đầu phiên tập trung ({customMinutes}m)
              </button>
            </div>
          )}
        </div>

        {/* Section 2: Financial Intelligence Snapshot */}
        <div className="p-3 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={15} className="text-emerald-500" />
              <span className="text-xs font-semibold">Tình hình tài chính hôm nay</span>
            </div>
            <button
              type="button"
              onClick={handleReadFinancialBrief}
              disabled={loadingFinance || !financialData}
              title="Nấm đọc to tóm tắt tài chính hôm nay"
              className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-medium disabled:opacity-50"
            >
              <Volume2 size={12} />
              Nghe Nấm đọc
            </button>
          </div>

          {loadingFinance ? (
            <div className="text-center py-3 text-xs text-text-muted">Đang phân tích sổ thu chi...</div>
          ) : financialData ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-[10px] text-text-muted">Thu hôm nay</div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate">
                    {fmtCurrency(financialData.revenueToday)}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  <div className="text-[10px] text-text-muted">Chi hôm nay</div>
                  <div className="text-xs font-bold text-rose-600 dark:text-rose-400 truncate">
                    {fmtCurrency(financialData.expenseToday)}
                  </div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-surface border border-border-subtle text-[11px] leading-relaxed flex items-start gap-2">
                <span className="text-base leading-none">💡</span>
                <span className="text-text-secondary flex-1">{financialData.adviceMessage}</span>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleReadFinancialTip}
            className="mt-2 w-full py-1.5 rounded-lg border border-border-subtle hover:bg-surface-hover text-[11px] text-text-secondary font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <Lightbulb size={12} className="text-amber-500" />
            Nhận lời khuyên quản lý dòng tiền
          </button>
        </div>

        {/* Section 3: Voice & Sound Preferences */}
        <div className="p-3 rounded-xl bg-card border border-border shadow-xs space-y-2">
          <div className="text-xs font-semibold text-text-secondary mb-1">Âm thanh & Tương tác giọng nói</div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-text-secondary">
              <Volume2 size={14} className={voiceEnabled ? 'text-amber-500' : 'text-text-muted'} />
              Giọng đọc tiếng Việt (Nấm nói chuyện)
            </span>
            <button
              type="button"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={[
                'w-10 h-5.5 rounded-full p-0.5 transition-colors relative inline-flex items-center',
                voiceEnabled ? 'bg-amber-500' : 'bg-surface-hover border border-border',
              ].join(' ')}
              aria-label="Bật tắt giọng đọc"
            >
              <span
                className={[
                  'size-4.5 rounded-full bg-white shadow-xs transform transition-transform',
                  voiceEnabled ? 'translate-x-4.5' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </div>

          {voiceEnabled && (
            <div className="p-2 rounded-lg bg-surface-hover/50 border border-border-subtle space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-text-muted">Âm sắc giọng đọc:</span>
                <div className="flex items-center gap-1">
                  {(Object.keys(VOICE_TONES) as VoiceTone[]).map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setVoiceTone(tone)}
                      className={[
                        'px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors',
                        voiceTone === tone
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/40'
                          : 'bg-surface hover:bg-surface-hover text-text-muted border border-border-subtle',
                      ].join(' ')}
                    >
                      {VOICE_TONES[tone].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border-subtle">
                <span className="text-text-muted">Đọc khi có đơn mới & hoàn thành:</span>
                <button
                  type="button"
                  onClick={() => setAnnounceOrders(!announceOrders)}
                  className={[
                    'w-8 h-4.5 rounded-full p-0.5 transition-colors relative inline-flex items-center',
                    announceOrders ? 'bg-emerald-500' : 'bg-surface-hover border border-border',
                  ].join(' ')}
                  aria-label="Bật tắt thông báo đơn hàng bằng giọng nói"
                >
                  <span
                    className={[
                      'size-3.5 rounded-full bg-white shadow-xs transform transition-transform',
                      announceOrders ? 'translate-x-3.5' : 'translate-x-0',
                    ].join(' ')}
                  />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-text-secondary">
              <Sparkles size={14} className={soundEnabled ? 'text-amber-500' : 'text-text-muted'} />
              Hiệu ứng âm thanh (Leng keng, tiếng mèo)
            </span>
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={[
                'w-10 h-5.5 rounded-full p-0.5 transition-colors relative inline-flex items-center',
                soundEnabled ? 'bg-amber-500' : 'bg-surface-hover border border-border',
              ].join(' ')}
              aria-label="Bật tắt âm thanh"
            >
              <span
                className={[
                  'size-4.5 rounded-full bg-white shadow-xs transform transition-transform',
                  soundEnabled ? 'translate-x-4.5' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-border-subtle">
            <span className="flex items-center gap-1.5 text-text-secondary">
              {isDocked ? <Pin size={14} className="text-amber-500" /> : <Move size={14} />}
              Vị trí mèo
            </span>
            <button
              type="button"
              onClick={() => setDocked(!isDocked)}
              className="text-[11px] px-2.5 py-1 rounded-md bg-surface-hover hover:bg-surface-hover/80 text-text-primary font-medium transition-colors"
            >
              {isDocked ? '📌 Đang ghim góc bàn' : '🐾 Đang đi dạo tự do'}
            </button>
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-border-subtle">
            <div>
              <span className="text-text-secondary">Mức độ hoạt động:</span>
              <span className="text-[10px] text-text-muted block">Tuân thủ nghiêm ngặt</span>
            </div>
            <div className="flex items-center gap-1">
              {(['low', 'medium', 'high'] as MascotActivity[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setActivity(level)}
                  className={[
                    'text-[10px] px-2 py-0.5 rounded font-medium transition-colors',
                    activity === level
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/40'
                      : 'bg-surface hover:bg-surface-hover text-text-muted border border-border-subtle',
                  ].join(' ')}
                >
                  {level === 'low' ? 'Lười (Ít đi)' : level === 'high' ? 'Nhanh (Năng động)' : 'Vừa phải'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 4: Quick Launch AI Chat */}
        <button
          type="button"
          onClick={() => {
            onClose();
            toggleFab();
          }}
          className="w-full py-2 px-3 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium text-xs transition-colors flex items-center justify-center gap-2"
        >
          <MessageSquare size={13} />
          Mở khung trò chuyện chi tiết với Nấm
        </button>

        {/* Section 5: Quick Hide Mascot */}
        <button
          type="button"
          onClick={() => {
            onClose();
            setEnabled(false);
          }}
          className="w-full py-2 px-3 rounded-xl border border-border-subtle bg-surface hover:bg-surface-hover text-text-muted hover:text-text-primary font-medium text-xs transition-colors flex items-center justify-center gap-2"
        >
          <EyeOff size={13} />
          Ẩn Mèo Nấm (Bật lại bất cứ lúc nào trong Cài đặt)
        </button>
      </div>
    </div>
  );
}
