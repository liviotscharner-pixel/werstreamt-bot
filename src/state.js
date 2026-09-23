import fs from 'node:fs';
import path from 'node:path';
import { LIVE_STATE_PATH } from './config.js';

/**
 * Persisted shape: { [login: string]: { id: string, title: string, game: string, announcedAt: string } }
 */
export function loadLiveState() {
  try {
    if (!fs.existsSync(LIVE_STATE_PATH)) return {};
    const raw = fs.readFileSync(LIVE_STATE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch (err) {
    console.warn('[state] Konnte live-state nicht lesen:', err.message);
    return {};
  }
}

export function saveLiveState(state) {
  const dir = path.dirname(LIVE_STATE_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = LIVE_STATE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, LIVE_STATE_PATH);
}
