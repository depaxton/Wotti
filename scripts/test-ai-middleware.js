/**
 * Test script for AI Command Middleware
 * Run from project root: node scripts/test-ai-middleware.js
 *
 * Verifies that processAiResponse:
 * 1. Reads AI text before sending to client
 * 2. Detects commands in square brackets
 * 3. Executes the matching logic and replaces command with result
 */

import { processAiResponse } from '../services/aiCommandMiddleware.js';

const tests = [
  {
    name: 'No command – text unchanged',
    input: 'שלום, איך אוכל לעזור?',
    expect: (out) => out === 'שלום, איך אוכל לעזור?',
  },
  {
    name: 'ABORT_BOOKING – replaced with short Hebrew',
    input: 'ביטלתי את התהליך. [ABORT_BOOKING]',
    expect: (out) => (out.includes('בוטל') || out.includes('SUCCESS')) && !out.includes('[ABORT_BOOKING]'),
  },
  {
    name: 'QUERY_AVAILABILITY – replaced with slots or no-availability or missing-category',
    input: 'בדקתי עבורך. [QUERY_AVAILABILITY: date=2026-03-15] תהיה זמין.',
    expect: (out) =>
      (out.includes('09:00') ||
        out.includes('אין זמינות') ||
        out.includes('אין שעות פנויות') ||
        out.includes('לא נבחר שירות')) &&
      !out.includes('[QUERY_AVAILABILITY'),
  },
  {
    name: 'LIST_APPOINTMENTS (no user) – friendly message, no future list',
    input: 'התורים שלך: [LIST_APPOINTMENTS: user_id=]',
    expect: (out) =>
      (out.includes('לא ניתן') || out.includes('אין לך תורים')) &&
      !out.includes('[LIST_APPOINTMENTS'),
  },
  {
    name: 'LIST_APPOINTMENTS with user_id – replaced',
    input: 'הנה: [LIST_APPOINTMENTS: user_id=972501234567]',
    expect: (out) =>
      (out.includes('אין לך תורים') || out.includes('יום ') || out.includes('202')) &&
      !out.includes('[LIST_APPOINTMENTS'),
  },
  {
    name: 'CANCEL_APPOINTMENT invalid id – friendly not-found message',
    input: 'מבטל: [CANCEL_APPOINTMENT: appointment_id=no_such_id_123]',
    expect: (out) =>
      (out.includes('לא נמצא') || out.includes('בוטל')) &&
      !out.includes('[CANCEL_APPOINTMENT'),
  },
  {
    name: 'BOOK_APPOINTMENT no user – friendly message',
    input: 'משבץ: [BOOK_APPOINTMENT: date=2026-03-15, time=10:00]',
    context: {},
    expect: (out) => (out.includes('לא ניתן') || out.includes('משתמש')) && !out.includes('[BOOK_APPOINTMENT'),
  },
  {
    name: 'Multiple commands – both replaced',
    input: 'ראשון: [ABORT_BOOKING] שני: [QUERY_AVAILABILITY: date=2026-02-20]',
    expect: (out) =>
      (out.includes('בוטל') || out.includes('SUCCESS')) &&
      (out.includes('09:00') ||
        out.includes('אין זמינות') ||
        out.includes('אין שעות פנויות') ||
        out.includes('לא נבחר שירות')) &&
      !out.includes('[ABORT_BOOKING]') &&
      !out.includes('[QUERY_AVAILABILITY'),
  },
];

async function run() {
  console.log('=== AI Command Middleware – Verification ===\n');
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      const context = t.context || { userId: '972500000000@c.us' };
      const output = await processAiResponse(t.input, context);
      const ok = t.expect(output);
      if (ok) {
        console.log(`  OK: ${t.name}`);
        passed++;
      } else {
        console.log(`  FAIL: ${t.name}`);
        console.log(`    Input:  ${t.input.slice(0, 60)}...`);
        console.log(`    Output: ${output.slice(0, 80)}...`);
        failed++;
      }
    } catch (err) {
      console.log(`  ERROR: ${t.name} – ${err.message}`);
      failed++;
    }
  }

  console.log(`\n--- Result: ${passed} passed, ${failed} failed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
