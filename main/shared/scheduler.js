'use strict';

/**
 * App-wide scheduler using node-cron.
 * Tools register jobs; main.js calls startScheduler(mainWindow) after app.whenReady().
 */

const cron             = require('node-cron');
const path             = require('path');
const { Notification } = require('electron');

const ICON = path.join(__dirname, '../../Anchor-Icon.png');

const _jobs      = [];
let   _mainWindow = null;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Register a scheduled job. Call before startScheduler().
 *
 * opts: {
 *   name:        string,
 *   getEnabled:  async () => boolean,
 *   getSchedule: async () => { type: 'daily'|'weekly', day?: string, time: 'HH:MM' },
 *   getLastRun:  () => string|null,   // ISO timestamp or null
 *   setLastRun:  (iso: string) => void,
 *   run:         async (mainWindow) => void,
 * }
 */
function registerJob(opts) {
  _jobs.push(opts);
}

/** Start all registered jobs. Call once from main.js after createWindow(). */
async function startScheduler(mainWindow) {
  _mainWindow = mainWindow;
  for (const job of _jobs) {
    await _scheduleJob(job);
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function _scheduleJob(job) {
  try {
    const enabled = await job.getEnabled();
    if (!enabled) {
      console.log(`[Scheduler] "${job.name}" is disabled — skipping`);
      return;
    }

    const schedule = await job.getSchedule();
    const lastRun  = job.getLastRun();

    // Run immediately if the scheduled window was missed since last run
    if (_missedRun(schedule, lastRun)) {
      console.log(`[Scheduler] "${job.name}" missed scheduled window — running now`);
      _runJob(job);  // intentionally not awaited — runs in background
    }

    // Schedule future runs
    const expr = _buildCronExpr(schedule);
    if (expr) {
      cron.schedule(expr, () => _runJob(job));
      console.log(`[Scheduler] "${job.name}" scheduled: ${expr}`);
    }
  } catch (e) {
    console.error(`[Scheduler] Failed to schedule "${job.name}":`, e.message);
  }
}

async function _runJob(job) {
  // Jitter: randomise the start time so multiple open instances don't fire in lockstep
  const jitterMs = Math.floor(Math.random() * 90_000);  // 0–90 seconds
  console.log(`[Scheduler] "${job.name}" — waiting ${Math.round(jitterMs / 1000)}s jitter before run`);
  await new Promise(r => setTimeout(r, jitterMs));

  let failed = false;
  try {
    console.log(`[Scheduler] Running "${job.name}"`);
    _notify('Anchor Hub', `Scheduled scan started: ${job.name}`);
    await job.run(_mainWindow);
    console.log(`[Scheduler] "${job.name}" completed`);
    _notify('Anchor Hub', `Scheduled scan complete.`);
  } catch (e) {
    failed = true;
    console.error(`[Scheduler] "${job.name}" failed:`, e.message);
    _notify('Anchor Hub', `Scheduled scan failed: ${e.message}`);
  } finally {
    // Always record the run time — even on failure — so a crash doesn't
    // cause the scan to re-fire on every subsequent app launch.
    try { await job.setLastRun(new Date().toISOString()); } catch {}
  }
}

function _notify(title, body) {
  try {
    if (Notification.isSupported()) new Notification({ title, body, icon: ICON }).show();
  } catch {}
}

/**
 * Returns true if the most recent scheduled occurrence has passed AND the last
 * run was before that occurrence. Never fires on first-ever use (lastRun null).
 */
function _missedRun(schedule, lastRun) {
  // Never-run jobs skip the missed-window check — let the cron schedule fire them at the right time.
  // Without this, every first-ever launch triggers an immediate scan regardless of time of day.
  if (!lastRun) return false;

  const now        = new Date();
  const last       = new Date(lastRun);
  const mostRecent = _mostRecentOccurrence(schedule, now);

  if (!mostRecent) return false;
  return mostRecent > last;
}

/** Find the most recent past occurrence of a schedule relative to `now`. */
function _mostRecentOccurrence(schedule, now) {
  const [h, m] = (schedule.time || '08:00').split(':').map(Number);

  if (schedule.type === 'daily') {
    const t = new Date(now);
    t.setHours(h, m, 0, 0);
    if (t > now) t.setDate(t.getDate() - 1);  // today's slot is in the future — use yesterday's
    return t;
  }

  if (schedule.type === 'weekly') {
    const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const target    = DAY_NAMES.indexOf(schedule.day || 'Monday');
    if (target === -1) return null;

    const t = new Date(now);
    t.setHours(h, m, 0, 0);

    // Walk backwards to find the most recent occurrence of the target weekday
    let daysBack = (t.getDay() - target + 7) % 7;
    if (daysBack === 0 && t > now) daysBack = 7;  // today's slot hasn't arrived yet
    t.setDate(t.getDate() - daysBack);
    return t;
  }

  return null;
}

/** Convert a schedule object to a node-cron expression. */
function _buildCronExpr(schedule) {
  const [h, m] = (schedule.time || '08:00').split(':').map(Number);

  if (schedule.type === 'daily') {
    return `${m} ${h} * * *`;
  }

  if (schedule.type === 'weekly') {
    const DAY_NUMS = { Sunday:0, Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6 };
    const d = DAY_NUMS[schedule.day];
    if (d === undefined) return null;
    return `${m} ${h} * * ${d}`;
  }

  return null;
}

module.exports = { registerJob, startScheduler };
