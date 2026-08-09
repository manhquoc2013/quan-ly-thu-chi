import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
// bust cache
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });

const result = await page.evaluate(() => {
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;padding:24px;';
  root.innerHTML = `
    <div data-slot="card" class="border rounded-lg" style="width:100%;background:#fff;">
      <div id="hs" class="w-full min-w-0 max-w-full overflow-x-auto" data-table-hscroll>
        <div style="width:100%;min-width:1100px;">
          <div role="row" id="row" style="display:grid;grid-template-columns:32px 28px minmax(140px,1.2fr) 88px minmax(120px,1fr) 40px 100px 110px 120px 148px;width:100%;column-gap:0.5rem;padding:0 0.75rem;box-sizing:border-box;height:48px;align-items:center;background:#e8eef2;">
            <div>☐</div><div>★</div><div>DH001</div><div>01/01</div><div>Nguyen Van A</div><div>2</div><div>100.000</div><div>Mới</div><div>Chưa</div>
            <div style="display:flex;gap:6px;justify-content:center;">
              <button data-slot="button" data-variant="outline">Sửa</button>
              <button data-slot="button" data-variant="destructive">Xóa</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(root);
  const hs = document.getElementById('hs');
  const row = document.getElementById('row');
  const btn = root.querySelector('[data-slot="button"]');
  const cs = getComputedStyle(btn);
  const after = getComputedStyle(btn, '::after');
  return {
    clientW: hs.clientWidth,
    scrollW: hs.scrollWidth,
    phantom: hs.scrollWidth - hs.clientWidth,
    rowW: row.getBoundingClientRect().width,
    btnOverflow: cs.overflow,
    afterTransform: after.transform,
    afterOpacity: after.opacity,
    pass: hs.scrollWidth <= hs.clientWidth + 1,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
process.exit(result.pass ? 0 : 1);
