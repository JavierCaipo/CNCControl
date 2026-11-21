/**
 * Generador nativo y autónomo de Códigos QR en SVG (sin dependencias externas).
 * Basado en la especificación ISO/IEC 18004 para QR Code Model 2.
 * Soporta Error Correction Level H (30%) por defecto para permitir logos en el centro.
 */

// Tablas de Galois Field GF(256)
const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);

(function initGaloisField() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = val;
    LOG_TABLE[val] = i;
    val <<= 1;
    if (val & 256) val ^= 0x11d;
  }
  EXP_TABLE[255] = EXP_TABLE[0];
})();

function gMult(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[a] + LOG_TABLE[b]) % 255];
}

function rsGeneratorPoly(degree) {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gMult(poly[j], EXP_TABLE[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsCompute(data, eccLen) {
  const gen = rsGeneratorPoly(eccLen);
  const res = new Uint8Array(eccLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ res[0];
    res.copyWithin(0, 1);
    res[eccLen - 1] = 0;
    for (let j = 0; j < eccLen; j++) {
      res[j] ^= gMult(gen[j], factor);
    }
  }
  return res;
}

// Especificación ISO/IEC 18004 Nivel H (Error Correction ~30%)
const VERSIONS_H = [
  { version: 1, dataCapacity: 9, ecBlocks: 1, ecPerBlock: 17, blockSizes: [9] },
  { version: 2, dataCapacity: 16, ecBlocks: 1, ecPerBlock: 28, blockSizes: [16] },
  { version: 3, dataCapacity: 26, ecBlocks: 2, ecPerBlock: 22, blockSizes: [13, 13] },
  { version: 4, dataCapacity: 36, ecBlocks: 4, ecPerBlock: 16, blockSizes: [9, 9, 9, 9] },
  { version: 5, dataCapacity: 46, ecBlocks: 4, ecPerBlock: 22, blockSizes: [11, 11, 12, 12] },
  { version: 6, dataCapacity: 60, ecBlocks: 4, ecPerBlock: 28, blockSizes: [15, 15, 15, 15] },
  { version: 7, dataCapacity: 66, ecBlocks: 5, ecPerBlock: 26, blockSizes: [13, 13, 13, 13, 14] },
  { version: 8, dataCapacity: 86, ecBlocks: 6, ecPerBlock: 26, blockSizes: [14, 14, 14, 14, 15, 15] },
  { version: 9, dataCapacity: 108, ecBlocks: 8, ecPerBlock: 23, blockSizes: [13, 13, 13, 13, 14, 14, 14, 14] },
  { version: 10, dataCapacity: 130, ecBlocks: 8, ecPerBlock: 27, blockSizes: [16, 16, 16, 16, 16, 16, 17, 17] },
];

// Especificación ISO/IEC 18004 Nivel M (Error Correction ~15%)
const VERSIONS_M = [
  { version: 1, dataCapacity: 14, ecBlocks: 1, ecPerBlock: 10, blockSizes: [14] },
  { version: 2, dataCapacity: 26, ecBlocks: 1, ecPerBlock: 16, blockSizes: [26] },
  { version: 3, dataCapacity: 42, ecBlocks: 1, ecPerBlock: 26, blockSizes: [42] },
  { version: 4, dataCapacity: 62, ecBlocks: 2, ecPerBlock: 18, blockSizes: [31, 31] },
  { version: 5, dataCapacity: 84, ecBlocks: 2, ecPerBlock: 24, blockSizes: [42, 42] },
  { version: 6, dataCapacity: 106, ecBlocks: 4, ecPerBlock: 16, blockSizes: [26, 26, 27, 27] },
  { version: 7, dataCapacity: 122, ecBlocks: 4, ecPerBlock: 18, blockSizes: [30, 30, 31, 31] },
  { version: 8, dataCapacity: 152, ecBlocks: 4, ecPerBlock: 22, blockSizes: [38, 38, 38, 38] },
  { version: 9, dataCapacity: 180, ecBlocks: 5, ecPerBlock: 22, blockSizes: [36, 36, 36, 36, 36] },
  { version: 10, dataCapacity: 213, ecBlocks: 5, ecPerBlock: 26, blockSizes: [42, 42, 43, 43, 43] },
];

function selectVersion(byteLength, level = 'H') {
  const table = level === 'M' ? VERSIONS_M : VERSIONS_H;
  for (const v of table) {
    if (byteLength + 2 <= v.dataCapacity) {
      return v;
    }
  }
  return table[table.length - 1];
}

/**
 * Genera la matriz booleana del código QR.
 * @param {string} text - Contenido a codificar.
 * @param {'H' | 'M'} level - Nivel de corrección de error (por defecto 'H', 30%).
 * @returns {boolean[][]} Matriz de módulos.
 */
export function generateQrMatrix(text, level = 'H') {
  const encoder = new TextEncoder();
  const rawBytes = encoder.encode(text);
  const spec = selectVersion(rawBytes.length, level);
  const version = spec.version;
  const size = version * 4 + 17;

  const matrix = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));

  function setFinder(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          const isBlack =
            (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          matrix[nr][nc] = isBlack;
          reserved[nr][nc] = true;
        }
      }
    }
  }

  setFinder(0, 0);
  setFinder(0, size - 7);
  setFinder(size - 7, 0);

  // Patrones de alineamiento
  if (version >= 2) {
    const alignPos = [6, size - 7];
    for (const r of alignPos) {
      for (const c of alignPos) {
        if (reserved[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBlack = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            matrix[r + dr][c + dc] = isBlack;
            reserved[r + dr][c + dc] = true;
          }
        }
      }
    }
  }

  // Patrones de sincronización (Timing patterns)
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0;
    if (!reserved[6][i]) {
      matrix[6][i] = val;
      reserved[6][i] = true;
    }
    if (!reserved[i][6]) {
      matrix[i][6] = val;
      reserved[i][6] = true;
    }
  }

  // Módulo oscuro fijo
  matrix[size - 8][8] = true;
  reserved[size - 8][8] = true;

  // Reservar áreas de información de formato
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      reserved[8][i] = true;
      reserved[i][8] = true;
    }
  }
  for (let i = size - 8; i < size; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }

  // Codificación de datos
  const bits = [];
  function pushBits(val, len) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  }

  // Modo byte: 0100
  pushBits(0b0100, 4);
  pushBits(rawBytes.length, version < 10 ? 8 : 16);
  for (const b of rawBytes) {
    pushBits(b, 8);
  }

  const maxDataBits = spec.dataCapacity * 8;
  const padLen = Math.min(4, maxDataBits - bits.length);
  pushBits(0, padLen);

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  let padToggle = false;
  while (bits.length < maxDataBits) {
    pushBits(padToggle ? 0x11 : 0xec, 8);
    padToggle = !padToggle;
  }

  const dataBytes = new Uint8Array(spec.dataCapacity);
  for (let i = 0; i < spec.dataCapacity; i++) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | bits[i * 8 + b];
    }
    dataBytes[i] = byteVal;
  }

  // División en bloques y cómputo de Reed-Solomon
  const dataBlocks = [];
  let dataOffset = 0;
  for (const bSize of spec.blockSizes) {
    dataBlocks.push(dataBytes.subarray(dataOffset, dataOffset + bSize));
    dataOffset += bSize;
  }

  const ecBlocks = [];
  for (let b = 0; b < spec.ecBlocks; b++) {
    ecBlocks.push(rsCompute(dataBlocks[b], spec.ecPerBlock));
  }

  // Intercalado (Interleaving) según especificación QR
  const finalBytes = [];
  const maxDataLen = Math.max(...spec.blockSizes);
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < spec.ecBlocks; b++) {
      if (i < dataBlocks[b].length) {
        finalBytes.push(dataBlocks[b][i]);
      }
    }
  }

  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (let b = 0; b < spec.ecBlocks; b++) {
      finalBytes.push(ecBlocks[b][i]);
    }
  }

  const finalBits = [];
  for (const byteVal of finalBytes) {
    for (let k = 7; k >= 0; k--) {
      finalBits.push((byteVal >>> k) & 1);
    }
  }

  // Disposición de módulos con máscara 0: (r + c) % 2 === 0
  let bitIdx = 0;
  let upwards = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--;
    const cols = [right, right - 1];

    for (let step = 0; step < size; step++) {
      const r = upwards ? size - 1 - step : step;
      for (const c of cols) {
        if (!reserved[r][c]) {
          const bit = bitIdx < finalBits.length ? finalBits[bitIdx++] : 0;
          const mask = (r + c) % 2 === 0;
          matrix[r][c] = (bit === 1) !== mask;
        }
      }
    }
    upwards = !upwards;
  }

  // Bits de formato con máscara 0
  // Level H, Mask 0: 001011010001001
  // Level M, Mask 0: 101010000010010
  const formatBits =
    level === 'M'
      ? [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0]
      : [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1];

  for (let i = 0; i <= 5; i++) matrix[8][i] = formatBits[i] === 1;
  matrix[8][7] = formatBits[6] === 1;
  matrix[8][8] = formatBits[7] === 1;
  matrix[7][8] = formatBits[8] === 1;
  for (let i = 9; i <= 14; i++) matrix[14 - i][8] = formatBits[i] === 1;

  for (let i = 0; i <= 7; i++) matrix[size - 1 - i][8] = formatBits[i] === 1;
  for (let i = 8; i <= 14; i++) matrix[8][size - 15 + i] = formatBits[i] === 1;

  return matrix;
}

/**
 * Genera el SVG completo del código QR, con soporte para logo centrado.
 * @param {string} text - Contenido a codificar.
 * @param {number} sizePx - Tamaño en píxeles.
 * @param {object} options - Opciones adicionales (level, logoUrl, logoPercent, margin).
 * @returns {string} Código SVG.
 */
export function generateQrSvg(text, sizePx = 220, options = {}) {
  const level = options.level || 'H';
  const margin = options.margin !== undefined ? options.margin : 4;
  const matrix = generateQrMatrix(text, level);
  const moduleCount = matrix.length;
  const viewBoxSize = moduleCount + margin * 2;

  let pathData = '';
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (matrix[r][c]) {
        pathData += `M${c + margin},${r + margin}h1v1h-1z `;
      }
    }
  }

  let centerOverlaySvg = '';
  if (options.logoUrl) {
    const logoPercent = Math.min(Math.max(options.logoPercent || 20, 15), 24);
    const boxSize = (viewBoxSize * logoPercent) / 100;
    const boxPos = (viewBoxSize - boxSize) / 2;
    const rx = boxSize * 0.2;

    centerOverlaySvg = `
      <rect x="${boxPos}" y="${boxPos}" width="${boxSize}" height="${boxSize}" rx="${rx}" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.5"/>
      <image href="${options.logoUrl}" x="${boxPos + boxSize * 0.08}" y="${boxPos + boxSize * 0.08}" width="${boxSize * 0.84}" height="${boxSize * 0.84}" preserveAspectRatio="xMidYMid meet"/>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges">
    <rect width="${viewBoxSize}" height="${viewBoxSize}" fill="#ffffff"/>
    <path d="${pathData}" fill="#000000"/>
    ${centerOverlaySvg}
  </svg>`;
}
