'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  sources/pgPoller.js - read-only PostgreSQL watcher over CVAccess
//  `acc_transaction`. This is the RELIABLE event-capture path for this ZKBio
//  CVAccess (it stores scans in the local Postgres, database `biosecurity-boot`,
//  port 5442). The CVAccess "Cloud Settings" HTTP push is NOT dependable, so we
//  poll the DB the way the proven access-sync does.
//
//  It polls a configurable query ({{since}} = last log_id cursor), maps each row
//  into a normalized event, and hands it to the runner's onEvent handler so it
//  flows through dedupe + retry + webhook exactly like the push source.
//  NEVER writes to the DB - read-only SELECT only.
// ─────────────────────────────────────────────────────────────────────────────

const { execFile } = require('child_process');

const SEP = '|~|';

class PgPoller {
  constructor({ cfg, sourceCfg, connectorId, log, cursors }) {
    this.cfg = cfg;
    this.sourceCfg = sourceCfg || {};
    this.connectorId = connectorId;
    this.log = log || console;
    this.cursors = cursors;
    this.pollIntervalMs = this.sourceCfg.pollIntervalMs || 3000;
    this.timer = null;
    this.stopped = false;
    this.onEvent = null;
    this.stat = { polls: 0, rows: 0, lastPollAt: null, lastError: null };
  }

  async start(onEvent) {
    this.onEvent = onEvent;
    const run = async () => {
      if (this.stopped) return;
      try {
        await this.poll();
      } catch (e) {
        this.stat.lastError = e.message;
        this.log.warn('cvaccess.pg.poll_error', { error: e.message });
      }
    };
    await run();
    this.timer = setInterval(run, this.pollIntervalMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
    return this;
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  // Build the query with the current cursor in place of {{since}}.
  buildQuery() {
    const c = this.sourceCfg;
    const base = c.query || '';
    const last = this.cursors ? this.cursors.get('cvapi.pg.since') : undefined;
    return base.includes('{{since}}')
      ? base.replace(/\{\{since\}\}/g, last || '0')
      : base;
  }

  async poll() {
    const c = this.sourceCfg;
    if (!c.query) return;

    const psql = c.bin || 'psql';
    const args = ['-h', String(c.host || '127.0.0.1'), '-p', String(c.port || 5442)];
    if (c.user) args.push('-U', String(c.user));
    if (c.database) args.push('-d', String(c.database));
    args.push('-tA', '-F', SEP, '-c', this.buildQuery());

    const env = { ...process.env };
    if (c.password) env.PGPASSWORD = String(c.password);

    const stdout = await runPsql(psql, args, env);
    const rows = parseRows(stdout, SEP);
    this.stat.polls += 1;
    this.stat.rows += rows.length;

    let maxCursor = this.cursors ? Number(this.cursors.get('cvapi.pg.since') || 0) : 0;
    for (const row of rows) {
      const normalized = this.toNormalized(row);
      if (!normalized) continue;
      if (row.log_id !== undefined && Number(row.log_id) > maxCursor) {
        maxCursor = Number(row.log_id);
      }
      if (this.onEvent) {
        await this.onEvent({ source: 'cvaccess-pg', record: row, normalized });
      }
    }
    if (this.cursors && maxCursor > 0) {
      this.cursors.set('cvapi.pg.since', String(maxCursor));
      this.cursors.persist();
    }
    this.stat.lastPollAt = new Date().toISOString();
  }
// Map a raw acc_transaction row into the normalized payload shape.
  toNormalized(row) {
    const userId = String(row.pin || row.user_id || '').trim();
    if (!userId) return null; // no user id => can't validate
    const tsRaw = row.event_time || row.access_time || row.time || '';
    const m = this.sourceCfg.methodMap || { 1: 'fingerprint', 2: 'face', 3: 'rfid', 4: 'qr', 5: 'password' };
    let method = row.verify_mode_name || row.verify_mode || '';
    method = String(method).toLowerCase().trim();
    if (!method || method === '0' || method === 'none') method = 'fingerprint';
    else if (m[method]) method = m[method];
    else if (method.includes('face')) method = 'face';
    else if (method.includes('finger') || method.includes('empreinte')) method = 'fingerprint';
    else if (method.includes('rfid') || method.includes('card') || method.includes('carte')) method = 'rfid';
    else if (method.includes('qr')) method = 'qr';
    else if (method.includes('pass') || method.includes('pin')) method = 'password';

    return {
      connectorId: this.connectorId,
      deviceId: String(row.dev_sn || row.sn || row.device_sn || 'TERMINAL_001').trim(),
      userId,
      method,
      timestamp: normalizeTs(tsRaw),
      eventType: 'ACCESS',
      payloadVersion: 1,
      sourceEventId: row.log_id !== undefined ? String(row.log_id) : undefined,
    };
  }
}

function parseRows(stdout, separator) {
  const lines = String(stdout || '')
    .split(/\r?\n/)
    .filter((l) => l && l.trim().length > 0);
  const rows = [];
  for (const line of lines) {
    const cells = line.split(separator).map((c) => getClean(c));
    if (cells.length === 0) continue;
    rows.push({
      log_id: cells[0],
      pin: cells[1],
      event_time: cells[2],
      dev_sn: cells[3],
      dev_alias: cells[4],
      event_no: cells[5],
      event_name: cells[6],
      verify_mode_no: cells[7],
      verify_mode_name: cells[8],
    });
  }
  return rows;
}

function getClean(v) {
  return v === undefined ? '' : String(v).trim();
}

function normalizeTs(ts) {
  if (!ts) return new Date().toISOString();
  const d = new Date(String(ts).replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function runPsql(bin, args, env) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: 20000, maxBuffer: 4 * 1024 * 1024, env }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`psql failed: ${(stderr || error.message).split('\n')[0]}`));
        return;
      }
      resolve(stdout);
    });
  });
}

module.exports = { PgPoller, parseRows };