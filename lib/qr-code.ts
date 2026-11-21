export interface QrSvgOptions {
  level?: 'H' | 'M';
  sizePx?: number;
  margin?: number;
  logoUrl?: string | null;
  logoPercent?: number;
}

export { generateQrMatrix, generateQrSvg } from './qr-code.mjs';
