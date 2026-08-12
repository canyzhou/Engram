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
  const supersampling = 4;
  const renderSize = size * supersampling;
  const pixels = Buffer.alloc(renderSize * renderSize * 4);
  const setPixel = (x, y, color) => {
    if (x < 0 || y < 0 || x >= renderSize || y >= renderSize) return;
    const index = ((Math.floor(y) * renderSize) + Math.floor(x)) * 4;
    pixels[index] = color[0];
    pixels[index + 1] = color[1];
    pixels[index + 2] = color[2];
    pixels[index + 3] = color[3] ?? 255;
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
  const fillCircle = (centerX, centerY, radius, color) => {
    for (let y = Math.floor(centerY - radius); y <= Math.ceil(centerY + radius); y += 1) {
      for (let x = Math.floor(centerX - radius); x <= Math.ceil(centerX + radius); x += 1) {
        if (Math.hypot((x + 0.5) - centerX, (y + 0.5) - centerY) <= radius) setPixel(x, y, color);
      }
    }
  };
  const fillTriangle = (points, color) => {
    const [a, b, c] = points;
    const edge = (p1, p2, x, y) => ((x - p1[0]) * (p2[1] - p1[1])) - ((y - p1[1]) * (p2[0] - p1[0]));
    const minX = Math.floor(Math.min(a[0], b[0], c[0]));
    const maxX = Math.ceil(Math.max(a[0], b[0], c[0]));
    const minY = Math.floor(Math.min(a[1], b[1], c[1]));
    const maxY = Math.ceil(Math.max(a[1], b[1], c[1]));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const signs = [edge(a, b, x + 0.5, y + 0.5), edge(b, c, x + 0.5, y + 0.5), edge(c, a, x + 0.5, y + 0.5)];
        if (signs.every((value) => value >= 0) || signs.every((value) => value <= 0)) setPixel(x, y, color);
      }
    }
  };

  const scale = renderSize / 128;
  const navy = [7, 19, 33, 255];
  const navyLight = [11, 31, 51, 255];
  const white = [245, 248, 252, 255];
  const coral = [255, 104, 93, 255];
  const gold = [255, 199, 111, 255];

  for (let y = 0; y < renderSize; y += 1) {
    for (let x = 0; x < renderSize; x += 1) {
      const px = (x + 0.5) / scale;
      const py = (y + 0.5) / scale;
      const nearestX = Math.max(32, Math.min(px, 96));
      const nearestY = Math.max(32, Math.min(py, 96));
      if (Math.hypot(px - nearestX, py - nearestY) <= 28) {
        const glow = Math.max(0, 1 - (Math.hypot(px - 102, py - 20) / 110));
        setPixel(x, y, navy.map((value, index) => index < 3 ? Math.round(value + ((navyLight[index] - value) * glow)) : 255));
      }
    }
  }

  const letterStrokes = [
    [37, 32, 37, 96],
    [38, 34, 84, 34],
    [38, 64, 70, 64],
    [38, 94, 84, 94],
  ];
  for (const [x1, y1, x2, y2] of letterStrokes) {
    line(x1 * scale, y1 * scale, x2 * scale, y2 * scale, 10 * scale, white);
  }
  fillTriangle([[76, 48], [102, 64], [76, 80]].map(([x, y]) => [x * scale, y * scale]), coral);
  fillCircle(96 * scale, 34 * scale, 6 * scale, gold);

  const outputPixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let alphaSum = 0;
      const colorSum = [0, 0, 0];
      for (let sampleY = 0; sampleY < supersampling; sampleY += 1) {
        for (let sampleX = 0; sampleX < supersampling; sampleX += 1) {
          const index = ((((y * supersampling) + sampleY) * renderSize) + (x * supersampling) + sampleX) * 4;
          const alpha = pixels[index + 3];
          alphaSum += alpha;
          for (let channel = 0; channel < 3; channel += 1) colorSum[channel] += pixels[index + channel] * alpha;
        }
      }
      const outputIndex = ((y * size) + x) * 4;
      const samples = supersampling * supersampling;
      outputPixels[outputIndex + 3] = Math.round(alphaSum / samples);
      for (let channel = 0; channel < 3; channel += 1) {
        outputPixels[outputIndex + channel] = alphaSum ? Math.round(colorSum[channel] / alphaSum) : 0;
      }
    }
  }

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    outputPixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
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
