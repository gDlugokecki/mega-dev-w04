// Plan morning-digest § 1. The shape every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One job's night. Times keep the offset from the log (styleguide), never UTC.
export type DigestRow = {
  job: string;
  owner: string | null; // null in the log stays null; views render it as —
  runs: number; // lines for this job
  retries: number; // lines with status "retry"
  lastStatus: RunStatus;
  lastError: string | null; // error of the last line that had one
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job, so the page and the JSON agree
  badLines: number; // lines that did not parse; counted, never thrown
};

// null: no file for this night (404). An empty file is a Night with no rows ("nothing ran").
export type ReadNight = (runsDir: string, night: string) => Night | null;
