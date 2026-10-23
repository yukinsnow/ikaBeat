import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import pngjs from 'pngjs';

const { PNG } = pngjs;
const check = process.argv.includes('--check');
const source = resolve('src-tauri/icons/ios');
const target = resolve('src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset');
const contentsPath = join(target, 'Contents.json');
const contents = JSON.parse(await readFile(contentsPath, 'utf8').catch(() => {
  throw new Error('iOS AppIcon catalog is missing. Run tauri ios init before installing icons.');
}));
if (!Array.isArray(contents.images) || contents.images.length === 0) {
  throw new Error('iOS AppIcon catalog has no image entries.');
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const report = [];
for (const entry of contents.images) {
  const { filename, size, scale } = entry;
  if (typeof filename !== 'string' || basename(filename) !== filename) {
    throw new Error('Every iOS AppIcon entry must reference a local PNG filename.');
  }
  const dimensions = String(size).split('x').map(Number);
  const multiplier = Number(String(scale).replace(/x$/, ''));
  if (dimensions.length !== 2 || dimensions.some(n => !Number.isFinite(n) || n <= 0) || ![1, 2, 3].includes(multiplier)) {
    throw new Error(`Invalid icon dimensions: ${filename}`);
  }
  const original = await readFile(join(source, filename));
  const image = PNG.sync.read(original);
  if (image.width !== dimensions[0] * multiplier || image.height !== dimensions[1] * multiplier) {
    throw new Error(`Icon dimensions do not match the Xcode catalog: ${filename}`);
  }
  // iOS requires opaque icons. Keep the existing artwork and composite only its
  // alpha onto white, then encode RGB without an alpha channel.
  for (let i = 0; i < image.data.length; i += 4) {
    const alpha = image.data[i + 3];
    for (let c = 0; c < 3; c++) image.data[i + c] = Math.round((image.data[i + c] * alpha + 255 * (255 - alpha)) / 255);
    image.data[i + 3] = 255;
  }
  const expected = PNG.sync.write(image, { colorType: 2, inputColorType: 6, inputHasAlpha: true });
  const path = join(target, filename);
  if (check) {
    if (!(await readFile(path)).equals(expected)) throw new Error(`Xcode AppIcon does not match ika artwork: ${filename}`);
  } else await writeFile(path, expected);
  if (expected[25] !== 2) throw new Error(`iOS icon still contains an alpha channel: ${filename}`);
  report.push({ filename, width: image.width, height: image.height, colorType: 2, sourceSha256: digest(original), installedSha256: digest(expected) });
}
if (!report.some(icon => icon.width === 1024 && icon.height === 1024)) {
  throw new Error('The iOS 1024px marketing icon is missing.');
}
if (!check) await writeFile(resolve('src-tauri/gen/apple/ikabeat-icon-verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ mode: check ? 'check' : 'install', verifiedIcons: report.length, target }));
