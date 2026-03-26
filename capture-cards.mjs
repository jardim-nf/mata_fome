import { chromium } from 'playwright';
import sharp from 'sharp';

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 4 });
await page.goto('http://localhost:5173/cartao-visita-ideafood.html', { waitUntil: 'networkidle' });

// Frente
const front = await page.locator('.card.front').boundingBox();
const frontShot = await page.screenshot({
  clip: { x: front.x, y: front.y, width: front.width, height: front.height },
  type: 'png'
});
await sharp(frontShot).jpeg({ quality: 98 }).toFile('public/cartao-frente.jpg');
console.log('✅ cartao-frente.jpg salvo');

// Verso
const back = await page.locator('.card.back').boundingBox();
const backShot = await page.screenshot({
  clip: { x: back.x, y: back.y, width: back.width, height: back.height },
  type: 'png'
});
await sharp(backShot).jpeg({ quality: 98 }).toFile('public/cartao-verso.jpg');
console.log('✅ cartao-verso.jpg salvo');

await browser.close();
