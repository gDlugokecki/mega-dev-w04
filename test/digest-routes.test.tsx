import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const normalNight = [
  '{"at":"2026-10-28T02:00:00+01:00","job":"backup","status":"ok","owner":"ana"}',
  '{"at":"2026-10-28T03:00:00+01:00","job":"sync","status":"retry","owner":null,"error":"timeout"}',
  '{"at":"2026-10-28T03:10:00+01:00","job":"sync","status":"retry","owner":null,"error":"timeout"}',
  '{"at":"2026-10-28T03:20:00+01:00","job":"sync","status":"retry","owner":null,"error":"timeout"}',
  '{"at":"2026-10-28T04:00:00+01:00","job":"report","status":"fail","owner":"bo","error":"disk full"}',
].join('\n');

const badLineNight = [
  '{"at":"2026-10-30T02:00:00+01:00","job":"backup","status":"ok","owner":"ana"}',
  'this is not json',
].join('\n');

let runsDir: string;
let config: { adapter: string; installed: string; beatEverySeconds: number; runsDir: string };

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  writeFileSync(join(runsDir, '2026-10-28.jsonl'), `${normalNight}\n`);
  writeFileSync(join(runsDir, '2026-10-29.jsonl'), '');
  writeFileSync(join(runsDir, '2026-10-30.jsonl'), `${badLineNight}\n`);
  config = {
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  };
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

// Job names in the order the page renders them (first cell of each body row).
function pageJobs(html: string): string[] {
  const body = html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>'));
  return [...body.matchAll(/<tr><td>([^<]*)<\/td>/g)].map((m) => m[1]!);
}

describe('GET /digest/:night (page)', () => {
  it('renders one row per job with owner, counts and markers', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(pageJobs(html)).toEqual(['backup', 'report', 'sync']);
    // null owner on sync renders as the dash
    expect(html).toContain('<td>—</td><td>3</td>');
    // 3 retries: warn marker
    expect(html).toContain('<td class="warn">! 3</td>');
    // fail: warn marker on the last status
    expect(html).toContain('<td class="warn">! fail</td>');
  });

  it('returns 404 for a night with no file', async () => {
    const res = await createApp(config).request('/digest/2026-10-27');
    const html = await res.text();
    expect(res.status).toBe(404);
    expect(html).toContain('no run log for 2026-10-27');
  });

  it('says "nothing ran" for an empty night', async () => {
    const res = await createApp(config).request('/digest/2026-10-29');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table>');
  });

  it('stays 200 and reports the unreadable line', async () => {
    const res = await createApp(config).request('/digest/2026-10-30');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(pageJobs(html)).toEqual(['backup']);
    expect(html).toContain('1 line could not be read');
  });
});

describe('GET /api/digest/:night (JSON)', () => {
  it('returns rows for a normal night', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      night: string;
      rows: { job: string; owner: string | null; retries: number; lastStatus: string }[];
      badLines: number;
    };
    expect(body.night).toBe('2026-10-28');
    expect(body.rows.map((r) => r.job)).toEqual(['backup', 'report', 'sync']);
    expect(body.rows.find((r) => r.job === 'sync')).toMatchObject({
      owner: null,
      retries: 3,
      lastStatus: 'retry',
    });
    expect(body.rows.find((r) => r.job === 'report')).toMatchObject({ lastStatus: 'fail' });
    expect(body.badLines).toBe(0);
  });

  it('returns 404 for a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-27');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for 2026-10-27' });
  });

  it('returns empty rows for the empty night', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-29');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-10-29', rows: [], badLines: 0 });
  });

  it('returns 200 with badLines 1 for a night with a bad line', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-30');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: { job: string }[]; badLines: number };
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['backup']);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order for the same night', async () => {
    const app = createApp(config);
    const html = await (await app.request('/digest/2026-10-28')).text();
    const json = (await (await app.request('/api/digest/2026-10-28')).json()) as {
      rows: { job: string }[];
    };
    expect(pageJobs(html)).toEqual(json.rows.map((r) => r.job));
  });
});
