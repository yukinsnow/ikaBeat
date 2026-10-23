import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

// Use the original artwork rather than the padded, rounded desktop icon.
// A small crop removes the original JPEG's baked-in white corner tips.
const source = 'public/assets/icon.jpg';
const target = 'src-tauri/icons/ios';
const { width, height } = await sharp(source).metadata();
if (width !== height || !width) throw new Error('Expected square original artwork');
const border = Math.ceil(width * 0.02);
const artwork = await sharp(source)
  .extract({ left: border, top: border, width: width - border * 2, height: height - border * 2 })
  .removeAlpha().png().toBuffer();
let count = 0;
for (const filename of await readdir(target)) {
  if (!filename.endsWith('.png')) continue;
  const { width: size, height: iconHeight } = await sharp(await readFile(join(target, filename))).metadata();
  if (size !== iconHeight || !size) throw new Error(`Invalid icon: ${filename}`);
  await writeFile(join(target, filename), await sharp(artwork).resize(size, size).removeAlpha().png().toBuffer());
  count++;
}
console.log(`Generated ${count} opaque, full-bleed iOS icons from ${source}`);
