import { chromium } from 'playwright';
import path from 'path';

(async () => {
    try {
        const browser = await chromium.launch();
        const page = await browser.newPage({ 
            viewport: { width: 1200, height: 1200 },
            deviceScaleFactor: 2 
        });
        
        const filePath = 'file://' + path.resolve('./public/Arte_Cachoeiras.html').replace(/\\\\/g, '/');
        
        await page.goto(filePath, { waitUntil: 'networkidle' });
        
        // Wait an extra second to assure fonts are rendered
        await page.waitForTimeout(1000);

        const arte = await page.locator('#arte').boundingBox();
        
        await page.screenshot({ 
            path: 'public/Arte_Cachoeiras_Macacu.png', 
            type: 'png',
            clip: { x: arte.x, y: arte.y, width: arte.width, height: arte.height }
        });
        
        console.log('ARTE_GERADA_SUCESSO');
        await browser.close();
    } catch (e) {
        console.error("ERRO:", e);
        process.exit(1);
    }
})();
