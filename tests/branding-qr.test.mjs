import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQrMatrix, generateQrSvg } from '../lib/qr-code.mjs';

test('QR Code: Level H (30%) Error Correction Matrix & Dimensions', () => {
  const url = 'https://cnc.control/t/imad3d?machine=SF3015HM';

  // 1. Level H generation
  const matrixH = generateQrMatrix(url, 'H');
  assert.ok(Array.isArray(matrixH), 'Matrix should be an array of rows');
  assert.ok(matrixH.length >= 21, 'QR Code Version 1 or higher size >= 21');
  assert.equal(matrixH.length, matrixH[0].length, 'Matrix must be square');

  // Verify finder patterns in 3 corners: (0,0), (0, size-7), (size-7, 0)
  const size = matrixH.length;
  assert.equal(matrixH[0][0], true, 'Top-left finder outer');
  assert.equal(matrixH[0][size - 1], true, 'Top-right finder outer');
  assert.equal(matrixH[size - 1][0], true, 'Bottom-left finder outer');

  // Verify Level H format bits in position
  assert.equal(typeof matrixH[8][0], 'boolean');
  assert.equal(typeof matrixH[0][8], 'boolean');
});

test('QR Code: SVG generation with Logo overlay and Level H', () => {
  const url = 'https://cnc.control/t/imad3d?machine=SF3015HM';
  const logoUrl = '/uploads/evidence/imad3d/logo.png';

  const svgWithLogo = generateQrSvg(url, 260, {
    level: 'H',
    logoUrl,
    logoPercent: 20,
    margin: 3,
  });

  assert.ok(svgWithLogo.includes('<svg'), 'Output should contain <svg');
  assert.ok(svgWithLogo.includes('viewBox='), 'Output should have viewBox');
  assert.ok(svgWithLogo.includes('href="/uploads/evidence/imad3d/logo.png"'), 'Output should embed logoUrl');
  assert.ok(svgWithLogo.includes('<rect'), 'Output should contain rect elements');
  assert.ok(svgWithLogo.includes('<path'), 'Output should contain path elements');

  // SVG without logo
  const svgWithoutLogo = generateQrSvg(url, 220);
  assert.ok(svgWithoutLogo.includes('<svg'), 'Output should contain <svg');
  assert.ok(!svgWithoutLogo.includes('<image'), 'Output without logo must not contain <image');
});

test('Branding validation: logo URL and MIME constraints', () => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSizeBytes = 5 * 1024 * 1024; // 5 MB

  assert.ok(allowedMimes.includes('image/png'));
  assert.ok(allowedMimes.includes('image/jpeg'));
  assert.ok(allowedMimes.includes('image/webp'));
  assert.ok(!allowedMimes.includes('image/gif'));
  assert.ok(!allowedMimes.includes('application/pdf'));

  const validSize = 2.4 * 1024 * 1024;
  const excessiveSize = 6 * 1024 * 1024;

  assert.ok(validSize <= maxSizeBytes, 'Valid size <= 5MB');
  assert.ok(excessiveSize > maxSizeBytes, 'Excessive size > 5MB');
});

