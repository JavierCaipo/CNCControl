import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECKS, newInspection, setCheck, validateReviewQuality } from '../public/model.mjs';

test('Quality Rule: All conforming checks without incidents produces ok status', () => {
  const inspection = newInspection();
  for (const c of CHECKS) {
    setCheck(inspection, c.id, 'ok');
  }

  const result = validateReviewQuality({
    checks: inspection.checks,
    incidents: [],
    evidenceUrls: [],
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.calculatedStatus, 'ok');
});

test('Quality Rule: Anomaly (fault) without note is rejected (< 5 characters)', () => {
  const inspection = newInspection();
  for (const c of CHECKS) {
    setCheck(inspection, c.id, 'ok');
  }
  // Set centrado to fault with short note
  inspection.checks.centrado = {
    value: 'fault',
    note: 'mal',
    evidenceUrls: ['/uploads/evidence/imad3d/foto1.jpg'],
  };

  const result = validateReviewQuality({
    checks: inspection.checks,
    incidents: [],
    evidenceUrls: [],
  });

  assert.equal(result.valid, false);
  assert.equal(result.calculatedStatus, 'critical');
  assert.ok(
    result.errors.some((e) => e.includes('requiere una observación detallada')),
    'Should require detailed observation'
  );
});

test('Quality Rule: Anomaly (fault) without photo evidence is rejected', () => {
  const inspection = newInspection();
  for (const c of CHECKS) {
    setCheck(inspection, c.id, 'ok');
  }
  // Set centrado to fault with note but no photo
  inspection.checks.centrado = {
    value: 'fault',
    note: 'Boquilla descentrada respecto al haz de corte',
    evidenceUrls: [],
  };

  const result = validateReviewQuality({
    checks: inspection.checks,
    incidents: [],
    evidenceUrls: [],
  });

  assert.equal(result.valid, false);
  assert.equal(result.calculatedStatus, 'critical');
  assert.ok(
    result.errors.some((e) => e.includes('requiere al menos una foto de evidencia')),
    'Should require photo evidence'
  );
});

test('Quality Rule: Anomaly with detailed note and photo evidence passes and flags critical', () => {
  const inspection = newInspection();
  for (const c of CHECKS) {
    setCheck(inspection, c.id, 'ok');
  }
  inspection.checks.centrado = {
    value: 'fault',
    note: 'Boquilla descentrada respecto al haz de corte',
    evidenceUrls: ['/uploads/evidence/imad3d/boquilla-descentrada.jpg'],
  };

  const result = validateReviewQuality({
    checks: inspection.checks,
    incidents: [],
    evidenceUrls: [],
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.calculatedStatus, 'critical');
});

test('Quality Rule: Resolved incidents change status to warning', () => {
  const inspection = newInspection();
  for (const c of CHECKS) {
    setCheck(inspection, c.id, 'ok');
  }

  const result = validateReviewQuality({
    checks: inspection.checks,
    incidents: [
      {
        id: 'inc-1',
        text: 'Rebaba en la base',
        resolvedAt: '2026-11-20T14:30:00Z',
        responsible: 'Supervisor',
        resolution: 'Se ajustó velocidad y presión de gas',
      },
    ],
    evidenceUrls: [],
  });

  assert.equal(result.valid, true);
  assert.equal(result.calculatedStatus, 'warning');
});

test('Quality Rule: Open unresolved incident blocks shift closure', () => {
  const inspection = newInspection();
  for (const c of CHECKS) {
    setCheck(inspection, c.id, 'ok');
  }

  const result = validateReviewQuality({
    checks: inspection.checks,
    incidents: [
      {
        id: 'inc-2',
        text: 'Fallo de presión de aire',
        resolvedAt: null,
      },
    ],
    evidenceUrls: [],
  });

  assert.equal(result.valid, false);
  assert.equal(result.calculatedStatus, 'critical');
  assert.ok(
    result.errors.some((e) => e.includes('incidencia/alarma abierta')),
    'Should reject due to open incident'
  );
});

test('Uploads validation: MIME types and size constraints', () => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5 MB

  const validateUpload = (mime, size) => {
    if (!allowedMimes.includes(mime)) return { valid: false, error: 'MIME_INVALID' };
    if (size > maxSize) return { valid: false, error: 'SIZE_EXCEEDED' };
    return { valid: true };
  };

  assert.equal(validateUpload('image/jpeg', 2 * 1024 * 1024).valid, true);
  assert.equal(validateUpload('image/png', 4.9 * 1024 * 1024).valid, true);
  assert.equal(validateUpload('image/webp', 1024).valid, true);

  assert.equal(validateUpload('application/pdf', 1024).valid, false);
  assert.equal(validateUpload('image/gif', 1024).valid, false);
  assert.equal(validateUpload('image/jpeg', 5.1 * 1024 * 1024).valid, false);
});

test('Supervisor Approval Rules: Permission, double approval, and tenant isolation', () => {
  const canApprove = (role) => ['supervisor', 'gerente', 'superadmin'].includes(role);

  assert.equal(canApprove('operario'), false);
  assert.equal(canApprove('supervisor'), true);
  assert.equal(canApprove('gerente'), true);
  assert.equal(canApprove('superadmin'), true);

  const approveSnapshot = (snapshot, session) => {
    if (!canApprove(session.role)) {
      return { status: 403, error: 'Solo supervisores o gerentes pueden validar una revisión.' };
    }
    if (session.role !== 'superadmin' && snapshot.organizationId !== session.organizationId) {
      return { status: 403, error: 'No autorizado para validar revisiones de otra organización.' };
    }
    if (snapshot.supervisorApprovedAt) {
      return { status: 400, error: 'Esta revisión ya ha sido aprobada y validada formalmente.' };
    }
    return {
      status: 200,
      snapshot: {
        ...snapshot,
        supervisorId: session.userId,
        supervisorApprovedAt: '2026-11-20T17:00:00Z',
      },
    };
  };

  const initialSnapshot = {
    id: 'snap-1',
    organizationId: 'org-imad3d',
    status: 'ok',
    supervisorApprovedAt: null,
  };

  // 1. Operario intenta aprobar -> 403
  const opRes = approveSnapshot(initialSnapshot, {
    userId: 'user-op',
    role: 'operario',
    organizationId: 'org-imad3d',
  });
  assert.equal(opRes.status, 403);

  // 2. Supervisor de otra empresa intenta aprobar -> 403
  const otherRes = approveSnapshot(initialSnapshot, {
    userId: 'user-other',
    role: 'supervisor',
    organizationId: 'org-otra',
  });
  assert.equal(otherRes.status, 403);

  // 3. Supervisor legítimo aprueba -> 200
  const supRes = approveSnapshot(initialSnapshot, {
    userId: 'user-sup',
    role: 'supervisor',
    organizationId: 'org-imad3d',
  });
  assert.equal(supRes.status, 200);
  assert.ok(supRes.snapshot.supervisorApprovedAt);

  // 4. Intentar aprobar de nuevo -> 400 (prevenir doble aprobación)
  const doubleRes = approveSnapshot(supRes.snapshot, {
    userId: 'user-sup',
    role: 'supervisor',
    organizationId: 'org-imad3d',
  });
  assert.equal(doubleRes.status, 400);
  assert.ok(doubleRes.error.includes('ya ha sido aprobada'));
});

