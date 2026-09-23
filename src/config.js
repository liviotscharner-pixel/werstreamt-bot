import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

function looksLikeDiscordToken(value) {
  const v = (value || '').trim();
  // Real bot tokens are typically 50–100+ chars (three base64url segments)
  return v.length >= 50;
}

// Load project .env without clobbering a good process env
dotenv.config({ path: path.join(ROOT, '.env') });

function applyTokenFromFile(filePath, label) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const parsed = dotenv.parse(fs.readFileSync(filePath));
    if (looksLikeDiscordToken(parsed.DISCORD_TOKEN)) {
      process.env.DISCORD_TOKEN = parsed.DISCORD_TOKEN.trim();
      console.log(`[config] DISCORD_TOKEN aus ${label} geladen`);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

if (!looksLikeDiscordToken(process.env.DISCORD_TOKEN)) {
  if (process.env.DISCORD_TOKEN) {
    console.warn(
      `[config] process env DISCORD_TOKEN sieht ungültig aus (len=${process.env.DISCORD_TOKEN.length}) – lade Fallback`,
    );
  }
  const ok =
    applyTokenFromFile(path.join(ROOT, '.env'), '.env') ||
    applyTokenFromFile('/workspace/hasenbot/.env', '/workspace/hasenbot/.env');
  if (!ok) {
    console.warn('[config] Kein gültiger DISCORD_TOKEN gefunden');
  }
}

export const DISCORD_TOKEN = (process.env.DISCORD_TOKEN || '').trim();
export const DISCORD_CHANNEL_ID =
  process.env.DISCORD_CHANNEL_ID || '1552036391167336458';
export const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 60_000);

export const STREAMERS_PATH = path.join(ROOT, 'streamers.json');
export const LIVE_STATE_PATH = path.join(ROOT, 'data', 'live-state.json');

export function loadStreamers() {
  try {
    const raw = fs.readFileSync(STREAMERS_PATH, 'utf8');
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) {
      console.warn('[config] streamers.json ist kein Array – verwende []');
      return [];
    }
    return list
      .map((s) => String(s).trim().toLowerCase())
      .filter(Boolean);
  } catch (err) {
    console.warn('[config] streamers.json nicht lesbar:', err.message);
    return [];
  }
}
