const { chromium } = await import('playwright');

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  // 1. search UI
  await page.goto('http://localhost:3000/search?q=one+piece', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  const summary = await page.locator('text=/\\d+ results? for/').first().innerText().catch(() => '');
  console.log('search summary:', summary.trim());

  // 2. open detail via the first result card (mirrors a real user click)
  await page.locator('div.cursor-pointer').first().click();
  await page.waitForURL('**/manga/**', { timeout: 20000 });
  await page.waitForTimeout(9000);
  const bodyText = (await page.locator('body').innerText()).slice(0, 300).replace(/\n/g, ' | ');
  const chapters = await page.locator('button:has-text("Ch."), a[href*="/read/"]').count();
  console.log('detail url:', page.url(), 'chapter rows:', chapters);
  console.log('body:', bodyText);

  // 3. open reader via the Start Reading button
  const start = page.locator('button:has-text("Start Reading"), a:has-text("Start Reading")').first();
  if (await start.count()) {
    await start.click();
    await page.waitForURL('**/read/**', { timeout: 20000 });
    await page.waitForTimeout(12000);
    const imgs = await page.locator('img').evaluateAll((els) =>
      els.filter((e) => e.naturalWidth > 0 && e.getBoundingClientRect().height > 100).length,
    );
    console.log('reader url:', page.url(), 'loaded images:', imgs);
  } else {
    console.log('no Start Reading control on detail page');
  }
  console.log('console errors:', errors.slice(0, 5));
  await browser.close();
};
run().catch((e) => { console.error(e); process.exit(1); });
