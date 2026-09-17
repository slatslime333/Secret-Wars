/**
 * Generates Secret Wars PWA icons (no native deps).
 * Dark ink field + cyan bolt mark matching the game theme.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/icons');

const INK = [7, 10, 18, 255];
const CYAN = [73, 220, 225, 255];
const PAPER = [246, 241, 222, 255];
const RED = [167, 29, 49, 255];

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
};

const encodePng = (size, paint) => {
  const row = size * 4 + 1;
  const raw = Buffer.alloc(row * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * row;
    raw[rowStart] = 0;
    for (let x = 0; x < size; x += 1) {
      const rgba = paint(x, y, size);
      const i = rowStart + 1 + x * 4;
      raw[i] = rgba[0];
      raw[i + 1] = rgba[1];
      raw[i + 2] = rgba[2];
      raw[i + 3] = rgba[3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const inTriangle = (px, py, ax, ay, bx, by, cx, cy) => {
  const area = (x1, y1, x2, y2, x3, y3) =>
    Math.abs((x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)) / 2);
  const a = area(ax, ay, bx, by, cx, cy);
  const a1 = area(px, py, bx, by, cx, cy);
  const a2 = area(ax, ay, px, py, cx, cy);
  const a3 = area(ax, ay, bx, by, px, py);
  return Math.abs(a - (a1 + a2 + a3)) < 0.5;
};

const paintIcon = (x, y, size) => {
  const n = (v) => (v / size) * 100;
  const nx = n(x);
  const ny = n(y);

  // Soft vignette on ink field
  const dx = nx - 50;
  const dy = ny - 50;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 48) {
    return [0, 0, 0, 0];
  }

  // Round mask with ink fill
  let rgba = [...INK];
  if (dist > 46) {
    rgba = [INK[0], INK[1], INK[2], Math.round(255 * (48 - dist) / 2)];
  }

  // Red crown triangles (logo flame tip)
  if (
    inTriangle(nx, ny, 28, 28, 38, 18, 42, 30) ||
    inTriangle(nx, ny, 42, 30, 50, 16, 58, 30) ||
    inTriangle(nx, ny, 58, 30, 62, 18, 72, 28)
  ) {
    rgba = RED;
  }

  // Cyan bolt (left logo mark simplified)
  if (
    inTriangle(nx, ny, 34, 34, 48, 34, 40, 52) ||
    inTriangle(nx, ny, 40, 48, 56, 42, 46, 68) ||
    inTriangle(nx, ny, 38, 58, 52, 54, 42, 78)
  ) {
    rgba = CYAN;
  }

  // Paper "W" bar hint
  if (ny > 70 && ny < 82 && nx > 30 && nx < 70) {
    const edge = Math.min(nx - 30, 70 - nx, ny - 70, 82 - ny);
    if (edge > 0) {
      rgba = PAPER;
    }
  }

  return rgba;
};

mkdirSync(outDir, { recursive: true });

const sizes = {
  'icon-192.png': 192,
  'icon-512.png': 512,
  'apple-touch-icon.png': 180,
};

for (const [name, size] of Object.entries(sizes)) {
  const png = encodePng(size, paintIcon);
  writeFileSync(resolve(outDir, name), png);
  console.log(`Wrote public/icons/${name} (${size}x${size}, ${png.length} bytes)`);
}
