/**
 * Map chat "mở …" phrases → app routes.
 */

export const NAV_ROUTES: Array<{ re: RegExp; path: string; label: string }> = [
  { re: /tổng\s*quan|dashboard|^home$|trang\s*chủ/i, path: '/', label: 'Tổng quan' },
  { re: /chi\s*phí|expense/i, path: '/expense', label: 'Chi phí' },
  { re: /doanh\s*thu|đơn\s*hàng|revenue|order/i, path: '/revenue', label: 'Doanh thu' },
  { re: /khách/i, path: '/customers', label: 'Khách hàng' },
  { re: /sản\s*phẩm|product|\bsp\b/i, path: '/products', label: 'Sản phẩm' },
  { re: /kênh|platform|sàn/i, path: '/platforms', label: 'Kênh bán' },
  { re: /báo\s*cáo|report|thống\s*kê/i, path: '/report', label: 'Báo cáo' },
  { re: /cài\s*đặt|setting|api|mật\s*khẩu|đồng\s*bộ|sync/i, path: '/settings', label: 'Cài đặt' },
  { re: /chat|ai|trợ\s*lý/i, path: '/ai', label: 'AI Chat' },
];

export function resolveNavigateTarget(input: {
  route?: string;
  query?: string;
  targetHint?: string;
  description?: string;
}): { path: string; label: string } | null {
  if (input.route && input.route.startsWith('/')) {
    const hit = NAV_ROUTES.find((n) => n.path === input.route);
    return { path: input.route, label: hit?.label ?? input.route };
  }
  const q = (input.query || input.targetHint || input.description || '').trim();
  if (!q) return null;
  for (const n of NAV_ROUTES) {
    if (n.re.test(q)) return { path: n.path, label: n.label };
  }
  return null;
}
