import { Client, GatewayIntentBits, ChannelType, Events } from 'discord.js';
import {
  DISCORD_TOKEN,
  DISCORD_CHANNEL_ID,
  POLL_INTERVAL_MS,
  loadStreamers,
  loadExtraLiveChannels,
} from './config.js';
import { loadLiveState, saveLiveState } from './state.js';
import { fetchLiveStreams } from './twitch.js';
import { announceGoLive, announceGoneOffline } from './announce.js';

if (!DISCORD_TOKEN) {
  console.error(
    '[fatal] DISCORD_TOKEN fehlt (process env oder /workspace/hasenbot/.env)',
  );
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/** @type {import('discord.js').TextBasedChannel | null} */
let announceChannel = null;

/** login → cached Discord channels for extra go-live announcements */
/** @type {Map<string, import('discord.js').TextBasedChannel[]>} */
const extraLiveChannelsByLogin = new Map();

let pollTimer = null;
let polling = false;
let started = false;

function channelLabel(channel) {
  const name =
    channel && 'name' in channel && channel.name ? channel.name : channel?.id;
  return name ? `#${name}` : '(unbekannt)';
}

function channelTypeLabel(channel) {
  if (channel.type === ChannelType.GuildText) return 'Text';
  if (channel.type === ChannelType.GuildAnnouncement) return 'Announcement';
  return `Typ ${channel.type}`;
}

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
        const extras = extraLiveChannelsByLogin.get(login) || [];
        for (const extraChannel of extras) {
          try {
            console.log(
              `[announce] Extra-Kanal für ${login}: ${channelLabel(extraChannel)} (${extraChannel.id})`,
            );
            await announceGoLive(extraChannel, stream);
          } catch (err) {
            console.error(
              `[announce] Extra-Kanal-Fehler für ${login} → ${extraChannel.id}:`,
              err.message,
            );
          }
        }
        next[login] = {
          id: stream.id,
          title: stream.title || '',
          game: stream.game_name || '',
          userName: stream.user_name || login,
          announcedAt: new Date().toISOString(),
        };
        dirty = true;
      } else if (!stream && wasLive) {
        console.log(`[poll] OFFLINE: ${login}`);
        if (announceChannel) {
          try {
            await announceGoneOffline(announceChannel, {
              login,
              displayName: prev[login]?.userName || login,
            });
          } catch (err) {
            console.error(`[announce] Offline-Fehler für ${login}:`, err.message);
          }
        }
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

async function fetchAndLogChannel(channelId, label) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.error(`[discord] ${label} ${channelId} nicht gefunden`);
      return null;
    }
    console.log(
      `[discord] ${label} erreichbar: ${channelLabel(channel)} (${channel.id}, ${channelTypeLabel(channel)})`,
    );
    return channel;
  } catch (err) {
    console.error(
      `[discord] ${label} ${channelId} nicht erreichbar:`,
      err.message,
    );
    return null;
  }
}

async function onReady() {
  if (started) return;
  started = true;

  console.log(`[discord] Eingeloggt als ${client.user.tag}`);

  announceChannel = await fetchAndLogChannel(
    DISCORD_CHANNEL_ID,
    'Ankündigungs-Kanal',
  );

  const extraMap = loadExtraLiveChannels();
  extraLiveChannelsByLogin.clear();
  /** @type {Set<string>} */
  const seenIds = new Set([DISCORD_CHANNEL_ID]);
  /** @type {Map<string, import('discord.js').TextBasedChannel>} */
  const channelCache = new Map();

  for (const [login, channelIds] of extraMap.entries()) {
    /** @type {import('discord.js').TextBasedChannel[]} */
    const channels = [];
    for (const id of channelIds) {
      if (id === DISCORD_CHANNEL_ID) {
        console.warn(
          `[discord] Extra-Kanal ${id} für ${login} ist der Default-Kanal – übersprungen`,
        );
        continue;
      }
      let channel = channelCache.get(id);
      if (!channel && !seenIds.has(id)) {
        seenIds.add(id);
        channel = await fetchAndLogChannel(
          id,
          `Extra-Live-Kanal (${login})`,
        );
        if (channel) channelCache.set(id, channel);
      } else if (!channel) {
        channel = channelCache.get(id) || null;
      }
      if (channel) channels.push(channel);
    }
    if (channels.length) {
      extraLiveChannelsByLogin.set(login, channels);
      console.log(
        `[discord] Extra-Live-Kanäle für ${login}: ${channels.map((c) => c.id).join(', ')}`,
      );
    }
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
