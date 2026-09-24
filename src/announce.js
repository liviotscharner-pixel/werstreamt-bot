import { EmbedBuilder } from 'discord.js';

/**
 * German go-live embed for a Twitch stream.
 * @param {object} stream Helix stream object
 */
export function buildLiveEmbed(stream) {
  const login = stream.user_login;
  const display = stream.user_name || login;
  const title = stream.title || '(kein Titel)';
  const game = stream.game_name || 'Unbekannt';
  const viewers = stream.viewer_count;
  const url = `https://twitch.tv/${login}`;

  // Helix thumbnail template uses {width}x{height}
  let thumb = stream.thumbnail_url || '';
  if (thumb) {
    thumb = thumb.replace('{width}', '1280').replace('{height}', '720');
    // cache-bust so Discord shows a fresh frame
    thumb += (thumb.includes('?') ? '&' : '?') + `t=${Date.now()}`;
  }

  const embed = new EmbedBuilder()
    .setColor(0x9146ff)
    .setTitle(`${display} ist jetzt live!`)
    .setURL(url)
    .setDescription(`**${title}**`)
    .addFields(
      { name: 'Spiel', value: game, inline: true },
      {
        name: 'Zuschauer',
        value: viewers != null ? String(viewers) : '—',
        inline: true,
      },
      { name: 'Link', value: `[twitch.tv/${login}](${url})`, inline: false },
    )
    .setTimestamp(new Date());

  if (thumb) {
    embed.setImage(thumb);
  }

  return embed;
}

/**
 * @param {import('discord.js').TextChannel} channel
 * @param {object} stream
 */
export async function announceGoLive(channel, stream) {
  const embed = buildLiveEmbed(stream);
  await channel.send({ embeds: [embed] });
}

/**
 * Short plain offline notice.
 * @param {import('discord.js').TextChannel} channel
 * @param {{ login: string, displayName?: string }} info
 */
export async function announceGoneOffline(channel, info) {
  const login = info.login;
  const display = info.displayName || login;
  await channel.send(`**${display}** ist offline gegangen.`);
}

