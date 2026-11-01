import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lastBeat, type Beat } from './heartbeat.js';

// null counts: the night's file could not be read (rendered as —).
export type NightSummary = {
  night: string;
  ok: number | null; // jobs whose last status is ok
  retry: number | null; // total retries across jobs
  fail: number | null; // jobs whose last status is fail
  badLines: number;
};

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function summarizeNight(runsDir: string, night: string): NightSummary {
  const n = readNight(runsDir, night);
  if (n === null) return { night, ok: null, retry: null, fail: null, badLines: 0 };
  return {
    night,
    ok: n.rows.filter((r) => r.lastStatus === 'ok').length,
    retry: n.rows.reduce((sum, r) => sum + r.retries, 0),
    fail: n.rows.filter((r) => r.lastStatus === 'fail').length,
    badLines: n.badLines,
  };
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((n) => summarizeNight(config.runsDir, n)),
  };
}
