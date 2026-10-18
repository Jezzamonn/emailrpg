import type { SpriteSheet } from "./surface.ts";

/**
 * Pure TypeScript RFC 1951 Deflate/Inflate implementation.
 * Ensures PNG decoding works in browser, worker, and Node environments without external dependencies.
 */
export function inflate(data: Uint8Array): Uint8Array {
  let pos = 0;
  let bitBuf = 0;
  let bitLen = 0;

  // Check and skip 2-byte zlib header
  if (data.length < 2) throw new Error("Invalid zlib stream: too short");
  const cmf = data[pos++];
  const flg = data[pos++];
  if ((cmf * 256 + flg) % 31 !== 0) {
    throw new Error("Invalid zlib header: checksum mismatch");
  }
  if (flg & 0x20) {
    pos += 4; // Skip preset dictionary ID (FDICT)
  }

  function getBits(n: number): number {
    while (bitLen < n) {
      if (pos >= data.length) throw new Error("Unexpected end of data in inflate");
      bitBuf |= data[pos++] << bitLen;
      bitLen += 8;
    }
    const val = bitBuf & ((1 << n) - 1);
    bitBuf >>>= n;
    bitLen -= n;
    return val;
  }

  function getBit(): number {
    return getBits(1);
  }

  function buildHuffman(lengths: ArrayLike<number>): () => number {
    let maxLen = 0;
    for (let i = 0; i < lengths.length; i++) {
      if (lengths[i] > maxLen) maxLen = lengths[i];
    }
    const blCount = new Uint32Array(maxLen + 1);
    for (let i = 0; i < lengths.length; i++) {
      const len = lengths[i];
      if (len > 0) blCount[len]++;
    }
    const nextCode = new Uint32Array(maxLen + 1);
    let code = 0;
    for (let len = 1; len <= maxLen; len++) {
      code = (code + blCount[len - 1]) << 1;
      nextCode[len] = code;
    }
    const tree = new Map<number, number>();
    for (let i = 0; i < lengths.length; i++) {
      const len = lengths[i];
      if (len > 0) {
        const c = nextCode[len]++;
        let rev = 0;
        for (let j = 0; j < len; j++) {
          rev = (rev << 1) | ((c >>> j) & 1);
        }
        tree.set((len << 16) | rev, i);
      }
    }
    return function decode(): number {
      let c = 0;
      for (let len = 1; len <= maxLen; len++) {
        c = c | (getBit() << (len - 1));
        const sym = tree.get((len << 16) | c);
        if (sym !== undefined) return sym;
      }
      throw new Error("Invalid Huffman code");
    };
  }

  const out: number[] = [];
  let isFinal = 0;

  const lenBase = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const lenExtra = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const distBase = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const distExtra = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

  while (!isFinal) {
    isFinal = getBit();
    const type = getBits(2);

    if (type === 0) {
      // Uncompressed block
      bitBuf = 0;
      bitLen = 0;
      const len = data[pos] | (data[pos + 1] << 8);
      pos += 4; // skip len and nlen
      for (let i = 0; i < len; i++) {
        out.push(data[pos++]);
      }
    } else if (type === 1 || type === 2) {
      let decodeLit: () => number;
      let decodeDist: () => number;

      if (type === 1) {
        // Fixed Huffman codes
        const litLens = new Uint8Array(288);
        for (let i = 0; i <= 143; i++) litLens[i] = 8;
        for (let i = 144; i <= 255; i++) litLens[i] = 9;
        for (let i = 256; i <= 279; i++) litLens[i] = 7;
        for (let i = 280; i <= 287; i++) litLens[i] = 8;
        decodeLit = buildHuffman(litLens);

        const distLens = new Uint8Array(32);
        distLens.fill(5);
        decodeDist = buildHuffman(distLens);
      } else {
        // Dynamic Huffman codes
        const hlit = getBits(5) + 257;
        const hdist = getBits(5) + 1;
        const hclen = getBits(4) + 4;
        const clOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
        const clLens = new Uint8Array(19);
        for (let i = 0; i < hclen; i++) {
          clLens[clOrder[i]] = getBits(3);
        }
        const decodeCL = buildHuffman(clLens);
        const allLens: number[] = [];
        while (allLens.length < hlit + hdist) {
          const sym = decodeCL();
          if (sym < 16) {
            allLens.push(sym);
          } else if (sym === 16) {
            const count = getBits(2) + 3;
            const prev = allLens[allLens.length - 1] ?? 0;
            for (let i = 0; i < count; i++) allLens.push(prev);
          } else if (sym === 17) {
            const count = getBits(3) + 3;
            for (let i = 0; i < count; i++) allLens.push(0);
          } else if (sym === 18) {
            const count = getBits(7) + 11;
            for (let i = 0; i < count; i++) allLens.push(0);
          }
        }
        decodeLit = buildHuffman(allLens.slice(0, hlit));
        decodeDist = buildHuffman(allLens.slice(hlit));
      }

      while (true) {
        const sym = decodeLit();
        if (sym < 256) {
          out.push(sym);
        } else if (sym === 256) {
          break;
        } else {
          const lenIdx = sym - 257;
          const length = lenBase[lenIdx] + getBits(lenExtra[lenIdx]);
          const distIdx = decodeDist();
          const distance = distBase[distIdx] + getBits(distExtra[distIdx]);
          for (let i = 0; i < length; i++) {
            out.push(out[out.length - distance]);
          }
        }
      }
    } else {
      throw new Error(`Unsupported deflate block type: ${type}`);
    }
  }

  return new Uint8Array(out);
}

function decompressZlib(data: Uint8Array): Uint8Array {
  // Use node:zlib if available for speed, otherwise fall back to pure TS inflate
  try {
    const zlib = (globalThis as any).process?.getBuiltinModule?.("node:zlib");
    if (zlib?.inflateSync) {
      return new Uint8Array(zlib.inflateSync(data));
    }
  } catch {
    // ignore
  }
  return inflate(data);
}

/**
 * Decodes a PNG image buffer into a SpriteSheet.
 */
export function decodePng(data: Uint8Array): SpriteSheet {
  if (
    data.length < 8 ||
    data[0] !== 0x89 ||
    data[1] !== 0x50 ||
    data[2] !== 0x4e ||
    data[3] !== 0x47 ||
    data[4] !== 0x0d ||
    data[5] !== 0x0a ||
    data[6] !== 0x1a ||
    data[7] !== 0x0a
  ) {
    throw new Error("Invalid PNG signature");
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idatParts: Uint8Array[] = [];

  while (pos < data.length) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(...data.subarray(pos + 4, pos + 8));

    if (type === "IHDR") {
      width = view.getUint32(pos + 8);
      height = view.getUint32(pos + 12);
      colorType = data[pos + 17];
    } else if (type === "IDAT") {
      idatParts.push(data.subarray(pos + 8, pos + 8 + len));
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }

  if (width === 0 || height === 0) {
    throw new Error("Missing or invalid IHDR chunk in PNG");
  }

  let totalCompressedLen = 0;
  for (const part of idatParts) totalCompressedLen += part.length;
  const compressed = new Uint8Array(totalCompressedLen);
  let curOffset = 0;
  for (const part of idatParts) {
    compressed.set(part, curOffset);
    curOffset += part.length;
  }

  const raw = decompressZlib(compressed);
  const bpp = colorType === 4 ? 2 : colorType === 6 ? 4 : colorType === 0 ? 1 : 3;
  const stride = width * bpp;
  const uncompressed = new Uint8Array(width * height * bpp);

  let rawOff = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rawOff++];
    const prevRow = (y - 1) * stride;
    const currRow = y * stride;

    for (let x = 0; x < stride; x++) {
      const val = raw[rawOff++];
      const a = x >= bpp ? uncompressed[currRow + x - bpp] : 0;
      const b = y > 0 ? uncompressed[prevRow + x] : 0;
      const c = y > 0 && x >= bpp ? uncompressed[prevRow + x - bpp] : 0;

      let res = 0;
      if (filter === 0) {
        res = val;
      } else if (filter === 1) {
        res = (val + a) & 0xff;
      } else if (filter === 2) {
        res = (val + b) & 0xff;
      } else if (filter === 3) {
        res = (val + Math.floor((a + b) / 2)) & 0xff;
      } else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        res = (val + pr) & 0xff;
      }
      uncompressed[currRow + x] = res;
    }
  }

  // Convert to 32-bit little-endian RGBA pixels: 0xAABBGGRR
  const pixels = new Uint32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    if (colorType === 4) {
      // Grayscale + Alpha (e.g. banter.png)
      const g = uncompressed[i * 2];
      const a = uncompressed[i * 2 + 1];
      pixels[i] = ((a & 0xff) << 24) | ((g & 0xff) << 16) | ((g & 0xff) << 8) | (g & 0xff);
    } else if (colorType === 6) {
      // RGBA
      const r = uncompressed[i * 4];
      const g = uncompressed[i * 4 + 1];
      const b = uncompressed[i * 4 + 2];
      const a = uncompressed[i * 4 + 3];
      pixels[i] = ((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
    } else if (colorType === 0) {
      // Grayscale
      const g = uncompressed[i];
      pixels[i] = (0xff << 24) | ((g & 0xff) << 16) | ((g & 0xff) << 8) | (g & 0xff);
    } else if (colorType === 2) {
      // RGB
      const r = uncompressed[i * 3];
      const g = uncompressed[i * 3 + 1];
      const b = uncompressed[i * 3 + 2];
      pixels[i] = (0xff << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
    }
  }

  return { width, height, pixels };
}
