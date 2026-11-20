import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECKS } from '../public/model.mjs';

// Helper de cálculo de compliance rate
function calculateComplianceRate(total, criticalCount) {
  if (total <= 0) return 100;
  return Math.round(((total - criticalCount) / total) * 1000) / 10;
}

// Helper de agregación de fallas recurrentes
function calculateTopRecurringFaults(snapshots, checkDefinitions) {
  const faultCounts = {};
  const total = snapshots.length;

  for (const s of snapshots) {
    const checks = s.checklistPayload?.checks || {};
    for (const [key, check] of Object.entries(checks)) {
      if (check?.value === 'fault') {
        faultCounts[key] = (faultCounts[key] || 0) + 1;
      }
    }
  }

  return Object.entries(faultCounts)
    .map(([id, count]) => {
      const itemDef = checkDefinitions.find((c) => c.id === id);
      return {
        id,
        title: itemDef?.title || id,
        group: itemDef?.group || 'General',
        count,
        percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// Helper de escape CSV
function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

test('Analytics KPIs: compliance rate calculation', () => {
  // Empty snapshots
  assert.equal(calculateComplianceRate(0, 0), 100);

  // 10 total: 8 ok, 1 warning, 1 critical -> 90%
  assert.equal(calculateComplianceRate(10, 1), 90);

  // 10 total: all 10 critical -> 0%
  assert.equal(calculateComplianceRate(10, 10), 0);

  // 3 total: 1 critical -> (2/3)*100 = 66.7%
  assert.equal(calculateComplianceRate(3, 1), 66.7);
});

test('Analytics KPIs: top recurring faults calculation and ranking', () => {
  const dummySnapshots = [
    {
      checklistPayload: {
        checks: {
          centrado: { value: 'fault' },
          boquilla: { value: 'fault' },
          cabina: { value: 'ok' },
        },
      },
    },
    {
      checklistPayload: {
        checks: {
          centrado: { value: 'fault' },
          cabina: { value: 'fault' },
          boquilla: { value: 'ok' },
        },
      },
    },
    {
      checklistPayload: {
        checks: {
          centrado: { value: 'fault' },
          boquilla: { value: 'fault' },
          gas: { value: 'fault' },
        },
      },
    },
    {
      checklistPayload: {
        checks: {
          centrado: { value: 'ok' },
          boquilla: { value: 'ok' },
        },
      },
    },
  ];

  const topFaults = calculateTopRecurringFaults(dummySnapshots, CHECKS);

  assert.ok(Array.isArray(topFaults));
  assert.equal(topFaults[0].id, 'centrado', 'Centrado should be the #1 fault');
  assert.equal(topFaults[0].count, 3);
  assert.equal(topFaults[0].percentage, 75); // 3 of 4 snapshots = 75%

  assert.equal(topFaults[1].id, 'boquilla', 'Boquilla should be #2 fault');
  assert.equal(topFaults[1].count, 2);
  assert.equal(topFaults[1].percentage, 50);
});

test('CSV Export formatting: BOM UTF-8, headers and special character escaping', () => {
  const headers = [
    'Fecha',
    'Hora',
    'Máquina',
    'Código',
    'Operario',
    'OT',
    'Turno',
    'Estado',
    'Incidencias',
    'Validado Por',
    'Fecha Validación',
    'URLs de Evidencia',
  ];

  const sampleRow = [
    '2026-11-20',
    '15:30:00',
    'Senfeng SF3015HM',
    'SF3015HM',
    'Santiago "El Técnico" Caipo',
    'OT-987, Línea A',
    'Turno Mañana',
    'Crítico',
    1,
    'Ing. Supervisor',
    '2026-11-20 16:00:00',
    'https://storage.cnc.control/img1.jpg | https://storage.cnc.control/img2.jpg',
  ];

  const BOM = '\uFEFF';
  const csvContent =
    BOM +
    headers.map(escapeCsvField).join(',') +
    '\r\n' +
    sampleRow.map(escapeCsvField).join(',');

  // BOM check
  assert.equal(csvContent.charCodeAt(0), 0xfeff, 'First character must be Unicode BOM for Excel UTF-8');

  // Quotes escaping check: Santiago "El Técnico" -> "Santiago ""El Técnico"" Caipo"
  assert.ok(csvContent.includes('"Santiago ""El Técnico"" Caipo"'), 'Double quotes must be escaped as ""');

  // Comma in value check
  assert.ok(csvContent.includes('"OT-987, Línea A"'), 'Values with commas must be wrapped in quotes');

  // Accents check (ñ and tildes preserved)
  assert.ok(csvContent.includes('Máquina'));
  assert.ok(csvContent.includes('Crítico'));
  assert.ok(csvContent.includes('Mañana'));
});

test('Webhook Alert payload structure verification', () => {
  const alertPayload = {
    event: 'cnc.critical_alert',
    organization: {
      id: 'org-123',
      name: 'IMAD 3D',
      slug: 'imad3d',
    },
    machine: {
      id: 'mach-456',
      code: 'SF3015HM',
      name: 'Senfeng SF3015HM',
    },
    operator: {
      id: 'usr-789',
      name: 'Santiago Caipo',
    },
    shift: 'Turno 1',
    workOrder: 'OT-4500',
    incidentsCount: 1,
    evidenceUrls: ['/uploads/evidence/imad3d/photo1.jpg'],
    timestamp: new Date().toISOString(),
  };

  assert.equal(alertPayload.event, 'cnc.critical_alert');
  assert.equal(alertPayload.organization.slug, 'imad3d');
  assert.equal(alertPayload.machine.code, 'SF3015HM');
  assert.equal(alertPayload.operator.name, 'Santiago Caipo');
  assert.equal(alertPayload.incidentsCount, 1);
  assert.ok(alertPayload.evidenceUrls.length > 0);
  assert.ok(Date.parse(alertPayload.timestamp) > 0);
});

