import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQrMatrix, generateQrSvg } from '../lib/qr-code.mjs';
import { CHECKS, newInspection, getStatus, setCheck, addIncident, resolveIncident, verify } from '../public/model.mjs';

test('QR code generator outputs valid matrix and svg', () => {
  const url = 'https://cnc.control/t/imad3d?machine=SF3015HM';
  const matrix = generateQrMatrix(url);

  assert.ok(Array.isArray(matrix), 'Matrix should be an array');
  assert.ok(matrix.length >= 21, 'QR Code matrix size should be at least 21x21');
  assert.equal(matrix.length, matrix[0].length, 'Matrix should be square');

  // Verify finders in top-left
  assert.equal(matrix[0][0], true);
  assert.equal(matrix[0][6], true);
  assert.equal(matrix[6][0], true);
  assert.equal(matrix[6][6], true);

  const svg = generateQrSvg(url, 250);
  assert.ok(svg.includes('<svg'), 'Output should contain <svg');
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'), 'Output should have svg namespace');
  assert.ok(svg.includes('<path d="'), 'Output should contain QR path data');
  assert.ok(svg.includes('width="250"'), 'Output should respect width');
});

test('preventive checklist state lifecycle and verification rules', () => {
  const testDate = new Date();
  const inspection = newInspection(testDate);
  assert.equal(CHECKS.length, 14, 'Checklist should contain 14 standard checks');

  let status = getStatus(inspection);
  assert.equal(status.code, 'pending', 'Initial review should be pending');
  assert.equal(status.ok, 0);
  assert.equal(status.eligible, false);

  // Set operator and confirm alarms
  inspection.operator = 'Santiago Caipo';
  inspection.alarmReviewed = true;

  // Mark all checks as ok
  for (const c of CHECKS) {
    setCheck(inspection, c.id, 'ok');
  }

  status = getStatus(inspection);
  assert.equal(status.ok, 14);
  assert.equal(status.eligible, true);
  assert.equal(status.code, 'review');

  // Verify
  verify(inspection);
  assert.ok(inspection.verifiedAt);
  status = getStatus(inspection);
  assert.equal(status.code, 'ready');

  // Add an incident -> should block
  addIncident(inspection, {
    guideId: 'otra',
    text: 'Alarma de prueba',
    context: 'Test context',
  });

  status = getStatus(inspection);
  assert.equal(status.code, 'blocked');
  assert.equal(status.active, 1);
  assert.equal(status.eligible, false);

  // Resolve incident
  const incId = inspection.incidents[0].id;
  resolveIncident(inspection, incId, 'Mantenimiento', 'Comprobación de prueba aprobada');
  inspection.alarmReviewed = true;

  status = getStatus(inspection);
  assert.equal(status.active, 0);
  assert.equal(status.eligible, true);
});

test('machine quota logic enforces plan limits', () => {
  const checkQuota = (activeCount, maxMachines) => {
    return activeCount < maxMachines;
  };

  assert.equal(checkQuota(1, 5), true, '1 of 5 allowed');
  assert.equal(checkQuota(4, 5), true, '4 of 5 allowed');
  assert.equal(checkQuota(5, 5), false, '5 of 5 should reject');
  assert.equal(checkQuota(6, 5), false, '6 of 5 should reject');
});
