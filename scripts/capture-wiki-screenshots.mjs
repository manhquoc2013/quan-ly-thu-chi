import { createServer } from 'vite';
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const wikiImagesDir = path.resolve(rootDir, 'wiki', 'images');

if (!fs.existsSync(wikiImagesDir)) {
  fs.mkdirSync(wikiImagesDir, { recursive: true });
}

async function run() {
  console.log('🚀 Starting Vite dev server for screenshot capture...');
  const server = await createServer({
    root: rootDir,
    server: {
      port: 5174,
      host: '127.0.0.1',
    },
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5174;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Vite running at ${baseUrl}`);

  console.log('🌐 Launching Playwright browser...');
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });

  const page = await context.newPage();

  // Inject initial bypass flags before any scripts run
  await page.addInitScript(() => {
    window.localStorage.setItem('e2e_bypass_auth', 'true');
    window.localStorage.setItem('theme', 'dark');
    window.localStorage.setItem(
      'mascot-settings',
      JSON.stringify({
        state: {
          enabled: true,
          soundEnabled: true,
          voiceEnabled: true,
          voiceTone: 'cute',
          voicePitch: 1.25,
          voiceRate: 1.05,
          announceOrders: true,
          activity: 'medium',
          petCount: 42,
          isDocked: false,
          speechBubble: {
            text: 'Chào chủ tiệm! Lucy đã sẵn sàng cùng bạn quản lý thu chi hôm nay nhé! 🐾',
            emotion: 'happy',
          },
        },
        version: 0,
      })
    );
  });

  console.log('📄 Navigating to root to seed demo IndexedDB data...');
  await page.goto(`${baseUrl}/?bypass_auth=1`, { waitUntil: 'networkidle' });

  // Seed demo data into IndexedDB cache
  await page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('quan-ly-thu-chi', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache');
        }
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('cache', 'readwrite');
        const store = tx.objectStore('cache');

        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const yest = new Date(Date.now() - 86400000);
        const yestStr = yest.toISOString().slice(0, 10);
        const twoDaysAgo = new Date(Date.now() - 172800000);
        const twoDaysAgoStr = twoDaysAgo.toISOString().slice(0, 10);

        const customers = [
          { id: 'c1', name: 'Nguyễn Văn An', phone: '0901234567', totalSpent: 4250000, orderCount: 5, createdAt: twoDaysAgoStr, updatedAt: todayStr },
          { id: 'c2', name: 'Trần Thị Mai', phone: '0987654321', totalSpent: 2890000, orderCount: 3, createdAt: twoDaysAgoStr, updatedAt: yestStr },
          { id: 'c3', name: 'Lê Hoàng Nam', phone: '0912349876', totalSpent: 1650000, orderCount: 2, createdAt: yestStr, updatedAt: todayStr },
          { id: 'c4', name: 'Phạm Hương Giang', phone: '0934567890', totalSpent: 850000, orderCount: 1, createdAt: todayStr, updatedAt: todayStr },
        ];

        const products = [
          { id: 'p1', name: 'Cà phê Arabica Cầu Đất', sku: 'CF-ARA-01', price: 150000, costPrice: 90000, stock: 45, unit: 'gói' },
          { id: 'p2', name: 'Trà Oolong Thượng Hạng', sku: 'TEA-OOL-02', price: 220000, costPrice: 130000, stock: 28, unit: 'hộp' },
          { id: 'p3', name: 'Hạt Điều Rang Muối 500g', sku: 'NUT-CAS-03', price: 180000, costPrice: 110000, stock: 60, unit: 'hũ' },
          { id: 'p4', name: 'Bánh Cookie Bơ Pháp', sku: 'CAKE-CK-04', price: 85000, costPrice: 45000, stock: 35, unit: 'gói' },
        ];

        const revenues = [
          {
            id: 'r1',
            orderCode: 'DH-202610-001',
            date: todayStr,
            customerId: 'c1',
            items: [
              { id: 'i1', name: 'Cà phê Arabica Cầu Đất', quantity: 3, unitPrice: 150000, total: 450000 },
              { id: 'i2', name: 'Bánh Cookie Bơ Pháp', quantity: 2, unitPrice: 85000, total: 170000 },
            ],
            discount: 20000,
            shippingFee: 30000,
            shippingPayer: 'customer',
            totalAmount: 620000,
            finalAmount: 630000,
            orderStatus: 'completed',
            paymentStatus: 'paid',
            deliveryStatus: 'delivered',
            paymentMethod: 'bank_transfer',
            paidAmount: 630000,
            paidAt: todayStr,
            createdAt: `${todayStr}T08:30:00.000Z`,
            updatedAt: `${todayStr}T09:15:00.000Z`,
          },
          {
            id: 'r2',
            orderCode: 'DH-202610-002',
            date: todayStr,
            customerId: 'c2',
            items: [
              { id: 'i3', name: 'Trà Oolong Thượng Hạng', quantity: 2, unitPrice: 220000, total: 440000 },
              { id: 'i4', name: 'Hạt Điều Rang Muối 500g', quantity: 2, unitPrice: 180000, total: 360000 },
            ],
            discount: 50000,
            shippingFee: 0,
            shippingPayer: 'shop',
            totalAmount: 800000,
            finalAmount: 750000,
            orderStatus: 'processing',
            paymentStatus: 'paid',
            deliveryStatus: 'shipping',
            paymentMethod: 'credit_card',
            paidAmount: 750000,
            paidAt: todayStr,
            createdAt: `${todayStr}T10:00:00.000Z`,
            updatedAt: `${todayStr}T10:30:00.000Z`,
          },
          {
            id: 'r3',
            orderCode: 'DH-202610-003',
            date: yestStr,
            customerId: 'c3',
            items: [
              { id: 'i5', name: 'Cà phê Arabica Cầu Đất', quantity: 5, unitPrice: 150000, total: 750000 },
            ],
            discount: 0,
            shippingFee: 25000,
            shippingPayer: 'customer',
            totalAmount: 750000,
            finalAmount: 775000,
            orderStatus: 'completed',
            paymentStatus: 'paid',
            deliveryStatus: 'delivered',
            paymentMethod: 'e_wallet',
            paidAmount: 775000,
            paidAt: yestStr,
            createdAt: `${yestStr}T14:20:00.000Z`,
            updatedAt: `${yestStr}T16:00:00.000Z`,
          },
          {
            id: 'r4',
            orderCode: 'DH-202610-004',
            date: twoDaysAgoStr,
            customerId: 'c4',
            items: [
              { id: 'i6', name: 'Hạt Điều Rang Muối 500g', quantity: 4, unitPrice: 180000, total: 720000 },
            ],
            discount: 30000,
            shippingFee: 0,
            shippingPayer: 'shop',
            totalAmount: 720000,
            finalAmount: 690000,
            orderStatus: 'completed',
            paymentStatus: 'paid',
            deliveryStatus: 'delivered',
            paymentMethod: 'cash',
            paidAmount: 690000,
            paidAt: twoDaysAgoStr,
            createdAt: `${twoDaysAgoStr}T11:00:00.000Z`,
            updatedAt: `${twoDaysAgoStr}T12:00:00.000Z`,
          },
        ];

        const expenses = [
          {
            id: 'e1',
            date: todayStr,
            category: 'supplies',
            amount: 1450000,
            description: 'Nhập nguyên liệu hạt cà phê & túi đóng gói',
            status: 'paid',
            paymentMethod: 'bank_transfer',
            supplier: 'Nông trại Cầu Đất',
            createdAt: `${todayStr}T07:15:00.000Z`,
            updatedAt: `${todayStr}T07:15:00.000Z`,
          },
          {
            id: 'e2',
            date: todayStr,
            category: 'utilities',
            amount: 480000,
            description: 'Tiền điện & internet cửa hàng tháng này',
            status: 'paid',
            paymentMethod: 'bank_transfer',
            supplier: 'EVN & Viettel',
            createdAt: `${todayStr}T09:00:00.000Z`,
            updatedAt: `${todayStr}T09:00:00.000Z`,
          },
          {
            id: 'e3',
            date: yestStr,
            category: 'marketing',
            amount: 350000,
            description: 'Chạy quảng cáo bài viết món mới trên Facebook',
            status: 'paid',
            paymentMethod: 'credit_card',
            supplier: 'Meta Ads',
            createdAt: `${yestStr}T10:30:00.000Z`,
            updatedAt: `${yestStr}T10:30:00.000Z`,
          },
          {
            id: 'e4',
            date: twoDaysAgoStr,
            category: 'office',
            amount: 180000,
            description: 'Mua giấy in bill K80 và bút viết hoá đơn',
            status: 'paid',
            paymentMethod: 'cash',
            supplier: 'Nhà sách Fahasa',
            createdAt: `${twoDaysAgoStr}T15:00:00.000Z`,
            updatedAt: `${twoDaysAgoStr}T15:00:00.000Z`,
          },
        ];

        store.put(customers, 'customers');
        store.put(customers, 'customers_e2e-demo-user');
        store.put(products, 'products');
        store.put(products, 'products_e2e-demo-user');
        store.put(revenues, 'revenues');
        store.put(revenues, 'revenues_e2e-demo-user');
        store.put(expenses, 'expenses');
        store.put(expenses, 'expenses_e2e-demo-user');

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });

  console.log('🔄 Reloading page to hydrate with sample data...');
  await page.goto(`${baseUrl}/?bypass_auth=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 1. Dashboard screenshot
  console.log('📸 Capturing 01-dashboard.png...');
  await page.screenshot({
    path: path.join(wikiImagesDir, '01-dashboard.png'),
    fullPage: false,
  });

  // 2. Open Lucy Control Deck
  console.log('📸 Opening Lucy Control Deck & capturing 02-lucy-control-deck.png...');
  // Right-click on the cat or click button
  const cat = await page.$('[title*="Kéo để ném"]');
  if (cat) {
    await cat.click({ button: 'right' });
    await page.waitForTimeout(800);
  }
  await page.screenshot({
    path: path.join(wikiImagesDir, '02-lucy-control-deck.png'),
    fullPage: false,
  });

  // 3. Revenue screen
  console.log('📸 Capturing 03-revenue.png...');
  await page.goto(`${baseUrl}/revenue?bypass_auth=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(wikiImagesDir, '03-revenue.png'),
    fullPage: false,
  });

  // 4. Expense screen
  console.log('📸 Capturing 04-expense.png...');
  await page.goto(`${baseUrl}/expense?bypass_auth=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(wikiImagesDir, '04-expense.png'),
    fullPage: false,
  });

  // 5. Reports screen
  console.log('📸 Capturing 05-reports.png...');
  await page.goto(`${baseUrl}/report?bypass_auth=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: path.join(wikiImagesDir, '05-reports.png'),
    fullPage: false,
  });

  // 6. AI Chat screen
  console.log('📸 Capturing 06-ai-chat.png...');
  await page.goto(`${baseUrl}/ai?bypass_auth=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(wikiImagesDir, '06-ai-chat.png'),
    fullPage: false,
  });

  // 7. Settings - Mascot tab
  console.log('📸 Capturing 07-settings-mascot.png...');
  await page.goto(`${baseUrl}/settings?bypass_auth=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Click on "Mascot" tab in Settings
  const mascotTabBtn = await page.locator('button', { hasText: 'Mascot' }).first();
  if (await mascotTabBtn.isVisible()) {
    await mascotTabBtn.click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({
    path: path.join(wikiImagesDir, '07-settings-mascot.png'),
    fullPage: false,
  });

  // 8. Settings - AI tab
  console.log('📸 Capturing 08-settings-ai.png...');
  const aiTabBtn = await page.locator('button', { hasText: 'AI' }).first();
  if (await aiTabBtn.isVisible()) {
    await aiTabBtn.click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({
    path: path.join(wikiImagesDir, '08-settings-ai.png'),
    fullPage: false,
  });

  console.log('✅ All screenshots captured successfully in wiki/images/!');
  await browser.close();
  await server.close();
  console.log('🎉 Done!');
}

run().catch((err) => {
  console.error('❌ Error capturing screenshots:', err);
  process.exit(1);
});
