/**
 * Twitch live check via public web GQL (no developer app / OAuth).
 * Uses the same Client-ID as twitch.tv web — no TWITCH_CLIENT_* secrets.
 */

const GQL_URL = 'https://gql.twitch.tv/gql';
const WEB_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
const REQUEST_DELAY_MS = 150;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Map GQL user+stream to Helix-like shape expected by announce.js.
 * @param {object} user
 * @param {object} stream
 */
function toHelixShape(user, stream) {
  const login = String(user.login || '').toLowerCase();
  let thumbnail = stream.previewImageURL || '';
  // GQL preview URLs are usually concrete; keep {width}x{height} replacement for Helix templates
  if (thumbnail && !thumbnail.includes('{width}')) {
    // already a concrete URL
  }

  return {
    id: String(stream.id),
    user_id: user.id != null ? String(user.id) : undefined,
    user_login: login,
    user_name: user.displayName || user.login || login,
    title: stream.title || '',
    type: stream.type || 'live',
    viewer_count: stream.viewersCount ?? 0,
    game_name: stream.game?.name || '',
    thumbnail_url: thumbnail,
  };
}

/**
 * Query one login via GQL. Returns Helix-like stream or null if offline / missing.
 * @param {string} login
 */
async function fetchOneLive(login) {
  const query = `query { user(login: "${login.replace(/"/g, '')}") { id login displayName stream { id title type viewersCount game { name } previewImageURL } } }`;

  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: {
      'Client-ID': WEB_CLIENT_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twitch GQL fehlgeschlagen (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (data.errors?.length) {
    const msg = data.errors.map((e) => e.message).join('; ');
    throw new Error(`Twitch GQL errors: ${msg}`);
  }

  const user = data.data?.user;
  if (!user || !user.stream) return null;
  return toHelixShape(user, user.stream);
}

/**
 * Batch streams politely (one-by-one with short delay).
 * @param {string[]} logins
 * @returns {Promise<Map<string, object>>} map login -> Helix-like stream object
 */
export async function fetchLiveStreams(logins) {
  const result = new Map();
  if (!logins.length) return result;

  for (let i = 0; i < logins.length; i++) {
    const login = String(logins[i]).toLowerCase();
    try {
      const stream = await fetchOneLive(login);
      if (stream) result.set(login, stream);
    } catch (err) {
      console.error(`[twitch] GQL für ${login}:`, err.message || err);
    }
    if (i < logins.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return result;
}
