import sharp from 'sharp';

const input = 'public/logo-idea-solucoes.png';
const output = 'public/logo-idea-solucoes-transp.png';

const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const pixels = Buffer.alloc(data.length);

for (let i = 0; i < data.length; i += 4) {
  const r = data[i], g = data[i+1], b = data[i+2];
  if (r > 225 && g > 225 && b > 225) {
    pixels[i] = 0;
    pixels[i+1] = 0;
    pixels[i+2] = 0;
    pixels[i+3] = 0;
  } else {
    pixels[i] = r;
    pixels[i+1] = g;
    pixels[i+2] = b;
    pixels[i+3] = 255;
  }
}

await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png()
  .toFile(output);

console.log('Logo transparente salva em:', output);
