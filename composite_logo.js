const Jimp = require('jimp');
const work_dir = 'C:\\Users\\Matheus\\.gemini\\antigravity\\brain\\df31ddff-2b48-469d-8871-1ace1c88971b';
const logo_path = work_dir + '\\media__1775230308453.png';
const bg_path = work_dir + '\\ideafood_good_friday_flyer_1775230270854.png';
const out_path = work_dir + '\\ideafood_flyer_final_com_sua_foto.png';

async function main() {
    const bg = await Jimp.read(bg_path);
    const logo = await Jimp.read(logo_path);

    // make white pixels of logo transparent
    logo.scan(0, 0, logo.bitmap.width, logo.bitmap.height, function(x, y, idx) {
        var red   = this.bitmap.data[idx + 0];
        var green = this.bitmap.data[idx + 1];
        var blue  = this.bitmap.data[idx + 2];
        
        // Remove white and very light background pixels
        if (red > 230 && green > 230 && blue > 230) {
            this.bitmap.data[idx + 3] = 0; // alpha
        }
    });

    // blur slightly to soften the edge artifacts of the basic transparency
    // logo.blur(1); 

    // resize logo to 30% of background width
    const target_width = Math.floor(bg.bitmap.width * 0.3);
    logo.resize(target_width, Jimp.AUTO);

    // center logo
    const x = Math.floor((bg.bitmap.width - logo.bitmap.width) / 2);
    const y = Math.floor(bg.bitmap.height * 0.05); // 5% from top

    bg.composite(logo, x, y);
    
    await bg.writeAsync(out_path);
    console.log('Success! Path: ' + out_path);
}
main().catch(console.error);
