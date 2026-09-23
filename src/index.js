import { Client, GatewayIntentBits, ChannelType, Events } from 'discord.js';
import {
  DISCORD_TOKEN,
  DISCORD_CHANNEL_ID,
  POLL_INTERVAL_MS,
  loadStreamers,
} from './config.js';
import { loadLiveState, saveLiveState } from './state.js';
import { fetchLiveStreams } from './twitch.js';
import { announceGoLive } from './announce.js';

if (!DISCORD_TOKEN) {
  console.error(
    '[fatal] DISCORD_TOKEN fehlt (process env oder /workspace/hasenbot/.env)',
  );
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/** @type {import('discord.js').TextBasedChannel | null} */
let announceChannel = null;
let pollTimer = null;
let polling = false;
let started = false;

async function pollOnce() {
  if (polling) return;
  polling = true;
  try {
    const streamers = loadStreamers();
    if (!streamers.length) {
      console.log('[poll] streamers.json ist leer – nichts zu prüfen');
      return;
    }

    const liveMap = await fetchLiveStreams(streamers);
    const prev = loadLiveState();
    const next = { ...prev };
    let dirty = false;

    for (const login of streamers) {
      const stream = liveMap.get(login);
      const wasLive = Boolean(prev[login]);

      if (stream && !wasLive) {
        console.log(`[poll] GO-LIVE: ${login} – ${stream.title}`);
        if (announceChannel) {
          try {
            await announceGoLive(announceChannel, stream);
          } catch (err) {
            console.error(`[announce] Fehler für ${login}:`, err.message);
          }
        }
        next[login] = {
          id: stream.id,
          title: stream.title || '',
          game: stream.game_name || '',
          announcedAt: new Date().toISOString(),
        };
        dirty = true;
      } else if (!stream && wasLive) {
        console.log(`[poll] OFFLINE: ${login}`);
        delete next[login];
        dirty = true;
      } else if (stream && wasLive) {
        next[login] = {
          ...prev[login],
          title: stream.title || prev[login].title,
          game: stream.game_name || prev[login].game,
        };
      }
    }

    for (const login of Object.keys(next)) {
      if (!streamers.includes(login)) {
        delete next[login];
        dirty = true;
      }
    }

    if (dirty) {
      saveLiveState(next);
    }

    console.log(
      `[poll] ok – ${streamers.length} Streamer, ${liveMap.size} live, ${Object.keys(next).length} im State`,
    );
  } catch (err) {
    console.error('[poll] Fehler:', err.message || err);
  } finally {
    polling = false;
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  console.log(`[poll] Intervall: ${POLL_INTERVAL_MS}ms`);
  pollOnce();
  pollTimer = setInterval(pollOnce, POLL_INTERVAL_MS);
}

async function onReady() {
  if (started) return;
  started = true;

  console.log(`[discord] Eingeloggt als ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
    if (!channel) {
      console.error(`[discord] Kanal ${DISCORD_CHANNEL_ID} nicht gefunden`);
    } else {
      announceChannel = channel;
      const name =
        'name' in channel && channel.name ? channel.name : channel.id;
      const typeLabel =
        channel.type === ChannelType.GuildText
          ? 'Text'
          : channel.type === ChannelType.GuildAnnouncement
            ? 'Announcement'
            : `Typ ${channel.type}`;
      console.log(
        `[discord] Ankündigungs-Kanal erreichbar: #${name} (${channel.id}, ${typeLabel})`,
      );
    }
  } catch (err) {
    console.error(
      `[discord] Kanal ${DISCORD_CHANNEL_ID} nicht erreichbar:`,
      err.message,
    );
  }

  startPolling();
}

// discord.js v14.14+: ClientReady (ready is deprecated)
client.once(Events.ClientReady, onReady);

client.on('error', (err) => {
  console.error('[discord] Client-Fehler:', err.message);
});

function shutdown(signal) {
  console.log(`[shutdown] ${signal}`);
  if (pollTimer) clearInterval(pollTimer);
  client.destroy();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.log('[boot] werstreamt-bot startet…');
client.login(DISCORD_TOKEN).catch((err) => {
  console.error('[fatal] Discord-Login fehlgeschlagen:', err.message);
  process.exit(1);
});
