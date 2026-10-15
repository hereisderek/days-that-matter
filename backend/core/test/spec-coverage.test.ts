// Every scenario of the specs in CAPABILITIES is either a core test named after it, or listed here
// with the task that covers it (an app task, or a later backend task). A new scenario in one of those
// specs fails this test until it gets one or the other.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repo = (path: string): string => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const SPECS = 'openspec/changes/pluggable-backend-live-sharing/specs';

function scenarios(capability: string): string[] {
  const text = readFileSync(repo(`${SPECS}/${capability}/spec.md`), 'utf8');
  return [...text.matchAll(/^#### Scenario: (.+)$/gm)].map((m) => (m[1] as string).trim());
}

function testNames(...files: string[]): Set<string> {
  const names = new Set<string>();
  for (const f of files) {
    const source = readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8').replace(/\\'/g, "'");
    for (const m of source.matchAll(/\bit\('(.+?)',/g)) names.add(m[1] as string);
  }
  return names;
}

const CAPABILITIES = ['accounts', 'event-sync', 'event-history'];

const CORE_TESTS = testNames(
  './accounts/accounts-scenarios.test.ts',
  './sync/event-sync-scenarios.test.ts',
  './history/event-history-scenarios.test.ts',
);

/** Scenarios the backend core does not serve yet or at all, with the task that covers them. */
const ELSEWHERE: Readonly<Record<string, string>> = {
  'Guest dismisses the first-event prompt': 'app, task 7.2 (prompt only; the backend sees nothing)',
  'Sign-up': 'app, task 7.2 (sign-in screen text and links)',
  'Upload without a prompt': 'app, tasks 7.2 and 7.7 (no rights question)',
  'Subscriber deletes the account': 'app, task 7.2 (store cancellation hint before DELETE /me)',
  'Request an export': 'backend task 3.17',
  'Second request the same day': 'backend task 3.17',
  'Expired export link': 'backend task 3.17',
  'Export of an editor': 'backend task 3.17',
  'Subscriber who never opens the app': 'backend task 3.18',
  'Two notices, then deletion': 'backend task 3.18',
  'Sign in after the first notice': 'backend task 3.18 (markActive already clears the notices)',
  'Edit offline': 'app, task 7.3 (pending patches survive restarts)',
  'Sync while offline': 'app, task 7.3',
};

describe('spec coverage', () => {
  for (const capability of CAPABILITIES) {
    it(`every ${capability} scenario is a core test or assigned to its task`, () => {
      const list = scenarios(capability);
      expect(list.length).toBeGreaterThan(2);
      const missing = list.filter((s) => !CORE_TESTS.has(s) && !(s in ELSEWHERE));
      expect(missing).toEqual([]);
      const both = list.filter((s) => CORE_TESTS.has(s) && s in ELSEWHERE);
      expect(both).toEqual([]);
    });
  }

  it('lists no scenario that the specs do not have', () => {
    const all = new Set([...CAPABILITIES, 'premium'].flatMap(scenarios));
    expect(Object.keys(ELSEWHERE).filter((s) => !all.has(s))).toEqual([]);
    expect([...CORE_TESTS].filter((s) => !all.has(s))).toEqual([]);
  });
});
