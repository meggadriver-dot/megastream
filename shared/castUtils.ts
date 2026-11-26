export function toAbsoluteStreamUrl(streamUrl: string, origin?: string): string {
  const clean = (streamUrl || '').trim();
  if (!clean) return '';
  if (/^https?:\/\//i.test(clean)) {
    return clean;
  }
  const baseOrigin = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');
  if (!baseOrigin) return clean;
  if (clean.startsWith('/')) {
    return `${baseOrigin}${clean}`;
  }
  return `${baseOrigin}/${clean}`;
}

export function buildM3uPlaylistContent(params: {
  title: string;
  streamUrl: string;
  posterUrl?: string | null;
  groupTitle?: string;
  origin?: string;
}): string {
  const absoluteUrl = toAbsoluteStreamUrl(params.streamUrl, params.origin);
  const safeTitle = (params.title || 'MegaStream Video')
    .replace(/[\r\n,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const safeGroup = (params.groupTitle || 'MegaStream')
    .replace(/[\r\n"]+/g, ' ')
    .trim();
  const safeLogo = (params.posterUrl || '')
    .replace(/[\r\n"]+/g, '')
    .trim();

  const attrs = [
    `tvg-name="${safeTitle.replace(/"/g, "'")}"`,
    safeLogo ? `tvg-logo="${safeLogo}"` : '',
    `group-title="${safeGroup}"`,
  ]
    .filter(Boolean)
    .join(' ');

  return `#EXTM3U\n#EXTINF:-1 ${attrs},${safeTitle}\n${absoluteUrl}\n`;
}

export function buildAndroidIntentUrl(streamUrl: string, title?: string, origin?: string): string {
  const absoluteUrl = toAbsoluteStreamUrl(streamUrl, origin);
  if (!absoluteUrl) return '';
  try {
    const parsed = new URL(absoluteUrl);
    const scheme = parsed.protocol.replace(':', '').toLowerCase() || 'https';
    const hostAndPath = `${parsed.host}${parsed.pathname}${parsed.search}`;
    const safeTitle = encodeURIComponent((title || 'MegaStream').trim().slice(0, 80));
    return `intent://${hostAndPath}#Intent;scheme=${scheme};type=video/*;action=android.intent.action.VIEW;S.title=${safeTitle};end`;
  } catch {
    return '';
  }
}

export function buildVlcStreamUrl(streamUrl: string, origin?: string): string {
  const absoluteUrl = toAbsoluteStreamUrl(streamUrl, origin);
  if (!absoluteUrl) return '';
  return `vlc://${absoluteUrl}`;
}

export function sanitizeM3uFileName(title: string): string {
  const slug = (title || 'megastream-video')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'megastream-video'}.m3u`;
}

export function isLocalhostOrigin(urlOrHost?: string | null): boolean {
  const raw = (urlOrHost || '').trim();
  if (!raw) return false;
  try {
    const host = raw.includes('://') ? new URL(raw).hostname.toLowerCase() : raw.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
  } catch {
    return false;
  }
}

export function resolveLanShareUrl(rawUrl: string, preferredLanOrigin?: string | null): string {
  const clean = (rawUrl || '').trim();
  const lanOrigin = (preferredLanOrigin || '').trim().replace(/\/+$/, '');
  if (!clean) return lanOrigin;
  if (!lanOrigin) return clean;
  try {
    const parsed = new URL(clean);
    if (isLocalhostOrigin(parsed.hostname)) {
      const target = new URL(lanOrigin);
      parsed.protocol = target.protocol;
      parsed.host = target.host;
      return parsed.toString();
    }
    return parsed.toString();
  } catch {
    if (clean.startsWith('/')) {
      return `${lanOrigin}${clean}`;
    }
    return clean;
  }
}
