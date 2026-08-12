import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const sizes = [16, 32, 48, 128];
const outputDir = new URL("../assets/icons/", import.meta.url).pathname;

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let current = value;
  for (let bit = 0; bit < 8; bit += 1) {
    current = (current & 1) ? (0xedb88320 ^ (current >>> 1)) : (current >>> 1);
  }
  return current >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type, data = Buffer.alloc(0)) => {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
};

const makeIcon = (size) => {
  const pixels = Buffer.alloc(size * size * 4);
  const setPixel = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const index = ((Math.floor(y) * size) + Math.floor(x)) * 4;
    pixels[index] = color[0];
    pixels[index + 1] = color[1];
    pixels[index + 2] = color[2];
    pixels[index + 3] = color[3] ?? 255;
  };
  const fill = (color) => {
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) setPixel(x, y, color);
  };
  const distanceToSegment = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = (dx * dx) + (dy * dy);
    const t = lengthSq ? Math.max(0, Math.min(1, (((px - x1) * dx) + ((py - y1) * dy)) / lengthSq)) : 0;
    return Math.hypot(px - (x1 + (t * dx)), py - (y1 + (t * dy)));
  };
  const line = (x1, y1, x2, y2, width, color) => {
    const radius = width / 2;
    for (let y = Math.floor(Math.min(y1, y2) - radius); y <= Math.ceil(Math.max(y1, y2) + radius); y += 1) {
      for (let x = Math.floor(Math.min(x1, x2) - radius); x <= Math.ceil(Math.max(x1, x2) + radius); x += 1) {
        if (distanceToSegment(x + 0.5, y + 0.5, x1, y1, x2, y2) <= radius) setPixel(x, y, color);
      }
    }
  };

  const scale = size / 128;
  const navy = [7, 19, 33, 255];
  const coral = [255, 104, 93, 255];
  const muted = [155, 177, 202, 255];
  fill(navy);

  const centerX = size / 2;
  const centerY = 58 * scale;
  const ringRadius = 37 * scale;
  const ringWidth = Math.max(1.2, 6 * scale);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5) - centerX;
      const dy = (y + 0.5) - centerY;
      const radius = Math.hypot(dx, dy);
      const angle = (Math.atan2(dy, dx) + (Math.PI * 2)) % (Math.PI * 2);
      const dash = ((angle / (Math.PI * 2)) * 24) % 2;
      if (Math.abs(radius - ringRadius) <= ringWidth / 2 && dash < 1.15) setPixel(x, y, coral);
    }
  }

  const bars = [
    [42, 61, 42, 53], [53, 70, 53, 44], [64, 76, 64, 38],
    [75, 70, 75, 44], [86, 61, 86, 53],
  ];
  for (const [x1, y1, x2, y2] of bars) {
    line(x1 * scale, y1 * scale, x2 * scale, y2 * scale, Math.max(1.5, 7 * scale), coral);
  }
  line(40 * scale, 99 * scale, 88 * scale, 99 * scale, Math.max(1.4, 6 * scale), muted);

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND"),
  ]);
  writeFileSync(join(outputDir, `icon-${size}.png`), png);
};

for (const size of sizes) makeIcon(size);
