const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:\\\\Users\\\\Matheus\\\\.gemini\\\\antigravity\\\\brain\\\\2b85e483-4ead-4aed-b0d8-dfe703fad4a6\\\\artifacts\\\\real_site_home.png' });
  await page.evaluate(() => window.scrollBy(0, 800));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'C:\\\\Users\\\\Matheus\\\\.gemini\\\\antigravity\\\\brain\\\\2b85e483-4ead-4aed-b0d8-dfe703fad4a6\\\\artifacts\\\\real_site_features.png' });
  await browser.close();
})();
