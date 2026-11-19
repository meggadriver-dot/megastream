// server/env.ts
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
var envPath = path.resolve(process.cwd(), ".env");
if (!process.env.VERCEL && fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
}

// server/app.ts
import express from "express";

// shared/playerUrl.ts
var ALLOWED_MEGAEMBED_DOMAINS = [
  "mgeb.lat",
  "mgeb.space"
];
var ALLOWED_MEGAEMBED_PLAYERS = [
  "vidstack",
  "megaplay",
  "megatube",
  "clappr"
];
var ALLOWED_PLAYER_ASPECT_MODES = [
  "contain",
  "cover",
  "fill",
  "cinema"
];
var ALLOWED_SUBTITLE_SIZES = ["sm", "md", "lg"];
var ALLOWED_SUBTITLE_COLORS = [
  "white",
  "yellow",
  "cyan"
];
var ALLOWED_SUBTITLE_BGS = [
  "box",
  "shadow",
  "none"
];
var ALLOWED_WATERMARK_POSITIONS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right"
];
var ALLOWED_WATERMARK_SIZES = ["sm", "md", "lg"];
var DEFAULT_MYEMBED_BASE_URL = "https://myembed.biz";
var DEFAULT_WATCHAFLIX_BASE_URL = "https://api.watcha.one";
var DEFAULT_PLAYER_CONFIG = {
  sourceMode: "megastream_watcha",
  defaultDomain: "mgeb.lat",
  fallbackDomain: "mgeb.space",
  autoFallback: true,
  availableDomains: ["mgeb.lat", "mgeb.space"],
  defaultPlayer: "vidstack",
  availablePlayers: ["vidstack", "megaplay", "megatube", "clappr"],
  defaultColorHex: "00a8ff",
  myembedBaseUrl: DEFAULT_MYEMBED_BASE_URL,
  antiAdSandbox: true,
  preferImdbForMovies: false,
  watchaflixBaseUrl: DEFAULT_WATCHAFLIX_BASE_URL,
  watchaflixLang: "pt",
  customEmbedMovieTemplate: "",
  customEmbedTvTemplate: "",
  customSources: [],
  embedTimeoutSeconds: 12,
  defaultAspectMode: "contain",
  autoEnableSubtitles: false,
  defaultSubtitleSize: "md",
  defaultSubtitleColor: "white",
  defaultSubtitleBg: "box",
  allowTvCast: true,
  allowPipMode: true,
  allowTheaterMode: true,
  watermarkEnabled: false,
  watermarkText: "",
  watermarkLogoUrl: "",
  watermarkPosition: "top-right",
  watermarkOpacity: 0.9,
  watermarkSize: "md",
  autoNextEpisode: true,
  autoNextCountdownSeconds: 8,
  seriesSeasonEpisodeDocumented: true,
  seriesLimitationNote: "S\xE9ries carregam diretamente por temporada e epis\xF3dio sem etapas extras de verifica\xE7\xE3o.",
  updatedAt: "2026-01-01T00:00:00.000Z"
};
function sanitizeHexColor(input, fallback = "00a8ff") {
  if (!input) return fallback;
  const cleaned = input.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{6}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^[0-9a-f]{3}$/.test(cleaned)) {
    return cleaned.split("").map((c) => c + c).join("");
  }
  return fallback;
}
function sanitizeEmbedTemplate(input) {
  if (!input || typeof input !== "string") return "";
  const trimmed = input.trim().slice(0, 500);
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) return "";
  return trimmed;
}
var CUSTOM_SOURCE_LANG_OPTIONS = [
  { value: "pt", label: "Dublado (PT-BR)", shortTag: "PT-BR", langCode: "pt-br" },
  { value: "sub", label: "Legendado (PT-BR)", shortTag: "LEG", langCode: "pt-sub" },
  { value: "en", label: "Ingl\xEAs / Original", shortTag: "EN", langCode: "en-us" },
  { value: "es", label: "Espanhol", shortTag: "ES", langCode: "es-es" },
  { value: "auto", label: "Autom\xE1tico", shortTag: "AUTO", langCode: "auto" }
];
function sanitizeCustomVideoSourceLang(input) {
  if (input === "pt" || input === "sub" || input === "en" || input === "es" || input === "auto") {
    return input;
  }
  return "auto";
}
function hasUrlTemplatePlaceholder(template) {
  if (!template || typeof template !== "string") return false;
  return /\{(?:tmdbId|tmdb_id|TMDB_ID|id|imdbId|imdb_id|IMDB_ID)\}/.test(template);
}
var EXTENDED_LANG_META = {
  fr: { label: "Franc\xEAs", shortTag: "FR", langCode: "fr" },
  fre: { label: "Franc\xEAs", shortTag: "FR", langCode: "fr" },
  fra: { label: "Franc\xEAs", shortTag: "FR", langCode: "fr" },
  french: { label: "Franc\xEAs", shortTag: "FR", langCode: "fr" },
  de: { label: "Alem\xE3o", shortTag: "DE", langCode: "de" },
  ger: { label: "Alem\xE3o", shortTag: "DE", langCode: "de" },
  deu: { label: "Alem\xE3o", shortTag: "DE", langCode: "de" },
  german: { label: "Alem\xE3o", shortTag: "DE", langCode: "de" },
  it: { label: "Italiano", shortTag: "IT", langCode: "it" },
  ita: { label: "Italiano", shortTag: "IT", langCode: "it" },
  italian: { label: "Italiano", shortTag: "IT", langCode: "it" },
  ja: { label: "Japon\xEAs", shortTag: "JA", langCode: "ja" },
  jpn: { label: "Japon\xEAs", shortTag: "JA", langCode: "ja" },
  japanese: { label: "Japon\xEAs", shortTag: "JA", langCode: "ja" },
  ko: { label: "Coreano", shortTag: "KO", langCode: "ko" },
  kor: { label: "Coreano", shortTag: "KO", langCode: "ko" },
  korean: { label: "Coreano", shortTag: "KO", langCode: "ko" },
  hi: { label: "Hindi", shortTag: "HI", langCode: "hi" },
  hin: { label: "Hindi", shortTag: "HI", langCode: "hi" },
  hindi: { label: "Hindi", shortTag: "HI", langCode: "hi" }
};
function getCustomSourceLangMeta(lang) {
  const normalized = (lang || "").trim().toLowerCase();
  if (normalized === "sub" || normalized === "pt-sub" || normalized === "legendado") {
    return CUSTOM_SOURCE_LANG_OPTIONS[1];
  }
  if (normalized === "pt" || normalized === "pt-br" || normalized === "dublado" || normalized === "portuguese") {
    return CUSTOM_SOURCE_LANG_OPTIONS[0];
  }
  if (normalized === "en" || normalized === "en-us" || normalized === "original" || normalized === "english") {
    return CUSTOM_SOURCE_LANG_OPTIONS[2];
  }
  if (normalized === "es" || normalized === "es-es" || normalized === "espanhol" || normalized === "spanish") {
    return CUSTOM_SOURCE_LANG_OPTIONS[3];
  }
  const extended = EXTENDED_LANG_META[normalized];
  if (extended) {
    return {
      value: "auto",
      label: extended.label,
      shortTag: extended.shortTag,
      langCode: extended.langCode
    };
  }
  return CUSTOM_SOURCE_LANG_OPTIONS[4];
}
function formatSourceLanguageOptionLabel(sourceName, lang) {
  const cleanName = (sourceName || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  const meta = getCustomSourceLangMeta(lang);
  if (!cleanName) {
    return {
      label: meta.label,
      languageLabel: meta.label,
      sourceName: "",
      langCode: meta.langCode
    };
  }
  const label = meta.value === "auto" && meta.langCode === "auto" ? `${cleanName} (Auto)` : `${meta.label} \xB7 ${cleanName}`;
  return {
    label,
    languageLabel: meta.label,
    sourceName: cleanName,
    langCode: meta.langCode
  };
}
function consolidateAudioOptionsByLanguage(options) {
  if (!Array.isArray(options) || options.length === 0) return [];
  const hasDirectStream = options.some(
    (opt) => opt.streamKind === "hls" || opt.streamKind === "video"
  );
  const filtered = hasDirectStream ? options.filter((opt) => opt.streamKind === "hls" || opt.streamKind === "video") : options;
  const ordered = [...filtered].sort((a, b) => {
    const aDirect = a.streamKind === "iframe" ? 1 : 0;
    const bDirect = b.streamKind === "iframe" ? 1 : 0;
    return aDirect - bDirect;
  });
  const grouped = /* @__PURE__ */ new Map();
  const seenUrlsByGroup = /* @__PURE__ */ new Map();
  for (const opt of ordered) {
    const meta = getCustomSourceLangMeta(opt.lang);
    const hasSpecificLang = meta.langCode !== "auto";
    const isUnknownAuto = !hasSpecificLang && (!opt.languageLabel || opt.languageLabel === "Autom\xE1tico");
    const cleanLanguageLabel = isUnknownAuto ? "\xC1udio Original" : hasSpecificLang ? meta.label : opt.languageLabel;
    const groupKey = hasSpecificLang ? meta.langCode : "auto";
    const canonicalLang = hasSpecificLang ? meta.langCode : "auto";
    const existing = grouped.get(groupKey);
    const candidateBackups = [
      { streamUrl: opt.streamUrl, streamKind: opt.streamKind },
      ...Array.isArray(opt.backupStreams) ? opt.backupStreams : []
    ];
    if (!existing) {
      const seenUrls = /* @__PURE__ */ new Set([opt.streamUrl]);
      const dedupedBackups = [];
      for (const b of candidateBackups.slice(1)) {
        if (!b?.streamUrl || seenUrls.has(b.streamUrl)) continue;
        seenUrls.add(b.streamUrl);
        dedupedBackups.push({ streamUrl: b.streamUrl, streamKind: b.streamKind });
      }
      seenUrlsByGroup.set(groupKey, seenUrls);
      grouped.set(groupKey, {
        id: opt.id,
        label: cleanLanguageLabel,
        languageLabel: cleanLanguageLabel,
        lang: canonicalLang,
        streamUrl: opt.streamUrl,
        streamKind: opt.streamKind,
        ...dedupedBackups.length > 0 ? { backupStreams: dedupedBackups } : {},
        isCustomSource: opt.isCustomSource
      });
    } else {
      const seenUrls = seenUrlsByGroup.get(groupKey);
      const backups = existing.backupStreams ? [...existing.backupStreams] : [];
      for (const b of candidateBackups) {
        if (!b?.streamUrl || seenUrls.has(b.streamUrl)) continue;
        seenUrls.add(b.streamUrl);
        backups.push({ streamUrl: b.streamUrl, streamKind: b.streamKind });
      }
      if (backups.length > 0) {
        existing.backupStreams = backups;
      }
    }
  }
  return Array.from(grouped.values());
}
function sanitizeCustomVideoSources(input) {
  if (!Array.isArray(input)) return [];
  const result = [];
  const seenIds = /* @__PURE__ */ new Set();
  for (let i = 0; i < input.length && result.length < 50; i++) {
    const raw = input[i];
    if (!raw || typeof raw !== "object") continue;
    const obj = raw;
    const rawId = typeof obj.id === "string" ? obj.id.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) : "";
    const id = rawId || `src_${i + 1}`;
    if (seenIds.has(id)) continue;
    const name = typeof obj.name === "string" ? obj.name.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 60) : "";
    if (!name) continue;
    const kind = obj.kind === "api" || obj.kind === "embed" || obj.kind === "direct" ? obj.kind : "api";
    const lang = sanitizeCustomVideoSourceLang(obj.lang);
    const movieTemplate = sanitizeEmbedTemplate(typeof obj.movieTemplate === "string" ? obj.movieTemplate : "");
    const tvTemplate = sanitizeEmbedTemplate(typeof obj.tvTemplate === "string" ? obj.tvTemplate : "");
    if (!movieTemplate && !tvTemplate) continue;
    const rawPriority = typeof obj.priority === "number" ? obj.priority : Number(obj.priority);
    const priority = Number.isFinite(rawPriority) ? Math.max(1, Math.min(999, Math.round(rawPriority))) : i + 1;
    const active = typeof obj.active === "boolean" ? obj.active : true;
    seenIds.add(id);
    result.push({
      id,
      name,
      kind,
      movieTemplate,
      tvTemplate,
      lang,
      priority,
      active
    });
  }
  return result.sort((a, b) => a.priority - b.priority);
}
function sanitizeWatermarkText(input) {
  if (!input || typeof input !== "string") return "";
  return input.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
}
function sanitizeWatermarkLogoUrl(input) {
  if (!input || typeof input !== "string") return "";
  const trimmed = input.trim().slice(0, 500);
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/src/") || trimmed.startsWith("/assets/")) {
    return trimmed;
  }
  return "";
}
function validateWatermarkPosition(pos, fallback = DEFAULT_PLAYER_CONFIG.watermarkPosition) {
  if (pos && ALLOWED_WATERMARK_POSITIONS.includes(pos)) {
    return pos;
  }
  return fallback;
}
function validateWatermarkSize(size, fallback = DEFAULT_PLAYER_CONFIG.watermarkSize) {
  if (size && ALLOWED_WATERMARK_SIZES.includes(size)) {
    return size;
  }
  return fallback;
}
function sanitizeWatermarkOpacity(value, fallback = DEFAULT_PLAYER_CONFIG.watermarkOpacity) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.max(0.15, Math.min(1, n)) * 100) / 100;
}
function sanitizeAutoNextCountdownSeconds(value, fallback = DEFAULT_PLAYER_CONFIG.autoNextCountdownSeconds) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(3, Math.min(30, Math.round(n)));
}
function validatePlayerAspectMode(mode, fallback = DEFAULT_PLAYER_CONFIG.defaultAspectMode) {
  if (mode && ALLOWED_PLAYER_ASPECT_MODES.includes(mode)) {
    return mode;
  }
  return fallback;
}
function validateSubtitleSize(size, fallback = DEFAULT_PLAYER_CONFIG.defaultSubtitleSize) {
  if (size && ALLOWED_SUBTITLE_SIZES.includes(size)) {
    return size;
  }
  return fallback;
}
function validateSubtitleColor(color, fallback = DEFAULT_PLAYER_CONFIG.defaultSubtitleColor) {
  if (color && ALLOWED_SUBTITLE_COLORS.includes(color)) {
    return color;
  }
  return fallback;
}
function validateSubtitleBg(bg, fallback = DEFAULT_PLAYER_CONFIG.defaultSubtitleBg) {
  if (bg && ALLOWED_SUBTITLE_BGS.includes(bg)) {
    return bg;
  }
  return fallback;
}
function extractPlayerBranding(cfg) {
  return {
    colorHex: sanitizeHexColor(cfg?.defaultColorHex, DEFAULT_PLAYER_CONFIG.defaultColorHex),
    preferredLang: validateWatchaFlixLang(
      cfg?.watchaflixLang,
      DEFAULT_PLAYER_CONFIG.watchaflixLang
    ),
    defaultAspectMode: validatePlayerAspectMode(
      cfg?.defaultAspectMode,
      DEFAULT_PLAYER_CONFIG.defaultAspectMode
    ),
    autoEnableSubtitles: typeof cfg?.autoEnableSubtitles === "boolean" ? cfg.autoEnableSubtitles : DEFAULT_PLAYER_CONFIG.autoEnableSubtitles,
    defaultSubtitleSize: validateSubtitleSize(
      cfg?.defaultSubtitleSize,
      DEFAULT_PLAYER_CONFIG.defaultSubtitleSize
    ),
    defaultSubtitleColor: validateSubtitleColor(
      cfg?.defaultSubtitleColor,
      DEFAULT_PLAYER_CONFIG.defaultSubtitleColor
    ),
    defaultSubtitleBg: validateSubtitleBg(
      cfg?.defaultSubtitleBg,
      DEFAULT_PLAYER_CONFIG.defaultSubtitleBg
    ),
    allowTvCast: typeof cfg?.allowTvCast === "boolean" ? cfg.allowTvCast : DEFAULT_PLAYER_CONFIG.allowTvCast,
    allowPipMode: typeof cfg?.allowPipMode === "boolean" ? cfg.allowPipMode : DEFAULT_PLAYER_CONFIG.allowPipMode,
    allowTheaterMode: typeof cfg?.allowTheaterMode === "boolean" ? cfg.allowTheaterMode : DEFAULT_PLAYER_CONFIG.allowTheaterMode,
    watermarkEnabled: typeof cfg?.watermarkEnabled === "boolean" ? cfg.watermarkEnabled : DEFAULT_PLAYER_CONFIG.watermarkEnabled,
    watermarkText: cfg?.watermarkText !== void 0 ? sanitizeWatermarkText(cfg.watermarkText) : DEFAULT_PLAYER_CONFIG.watermarkText,
    watermarkLogoUrl: cfg?.watermarkLogoUrl !== void 0 ? sanitizeWatermarkLogoUrl(cfg.watermarkLogoUrl) : DEFAULT_PLAYER_CONFIG.watermarkLogoUrl,
    watermarkPosition: validateWatermarkPosition(
      cfg?.watermarkPosition,
      DEFAULT_PLAYER_CONFIG.watermarkPosition
    ),
    watermarkOpacity: sanitizeWatermarkOpacity(
      cfg?.watermarkOpacity,
      DEFAULT_PLAYER_CONFIG.watermarkOpacity
    ),
    watermarkSize: validateWatermarkSize(
      cfg?.watermarkSize,
      DEFAULT_PLAYER_CONFIG.watermarkSize
    ),
    autoNextEpisode: typeof cfg?.autoNextEpisode === "boolean" ? cfg.autoNextEpisode : DEFAULT_PLAYER_CONFIG.autoNextEpisode,
    autoNextCountdownSeconds: sanitizeAutoNextCountdownSeconds(
      cfg?.autoNextCountdownSeconds,
      DEFAULT_PLAYER_CONFIG.autoNextCountdownSeconds
    )
  };
}
function sanitizeImdbId(input) {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  if (/^tt\d{5,12}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}
function sanitizeEmbedTimeoutSeconds(value, fallback = 12) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(5, Math.min(30, Math.round(n)));
}
function validateMegaEmbedDomain(domain, fallback = "mgeb.lat") {
  if (domain && ALLOWED_MEGAEMBED_DOMAINS.includes(domain)) {
    return domain;
  }
  return fallback;
}
function validateMegaEmbedPlayer(player, fallback = "vidstack") {
  if (player && ALLOWED_MEGAEMBED_PLAYERS.includes(player)) {
    return player;
  }
  return fallback;
}
function normalizeTmdbId(value) {
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 999999999) {
    return null;
  }
  return parsed;
}
function normalizeSeasonNumber(value, fallback = 1) {
  if (value === void 0 || value === null || value === "") {
    return fallback;
  }
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 999) {
    return fallback;
  }
  return parsed;
}
function normalizeEpisodeNumber(value, fallback = 1) {
  if (value === void 0 || value === null || value === "") {
    return fallback;
  }
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 9999) {
    return fallback;
  }
  return parsed;
}
function validatePlayerSourceMode(mode, fallback = DEFAULT_PLAYER_CONFIG.sourceMode) {
  if (mode === "megastream_watcha" || mode === "myembed" || mode === "watchaflix" || mode === "custom_template" || mode === "megaembed") {
    return mode;
  }
  return fallback;
}
function resolveHydratedSourceMode(params) {
  const validRemote = validatePlayerSourceMode(params.remoteSourceMode, params.fallback);
  if (validRemote === "megastream_watcha") {
    return "megastream_watcha";
  }
  const hasExplicitPostUpgradeSave = typeof params.remoteAntiAdSandbox === "boolean";
  if (!hasExplicitPostUpgradeSave && (validRemote === "watchaflix" || validRemote === "megaembed")) {
    return params.fallback;
  }
  if (params.remoteHasPrincipalFields === false && validRemote !== "custom_template") {
    return "megastream_watcha";
  }
  return validRemote;
}
function normalizeMyEmbedBaseUrl(input) {
  if (!input || typeof input !== "string") return DEFAULT_MYEMBED_BASE_URL;
  const trimmed = input.trim().slice(0, 300);
  if (!trimmed) return DEFAULT_MYEMBED_BASE_URL;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return DEFAULT_MYEMBED_BASE_URL;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "embedmovies.org" || hostname === "www.embedmovies.org") {
      return DEFAULT_MYEMBED_BASE_URL;
    }
    const cleanPath = parsed.pathname.replace(/\/(filme|serie)\/.*$/i, "").replace(/\/+$/, "");
    return `${parsed.protocol}//${parsed.host}${cleanPath}`.slice(0, 300);
  } catch {
    return DEFAULT_MYEMBED_BASE_URL;
  }
}
function buildMyEmbedUrl(params) {
  const validId = normalizeTmdbId(params.tmdbId);
  if (!validId) {
    throw new Error("ID TMDB inv\xE1lido para incorpora\xE7\xE3o do player.");
  }
  const base = normalizeMyEmbedBaseUrl(params.baseUrl);
  if (params.mediaType === "tv") {
    const season = normalizeSeasonNumber(params.seasonNumber, 1);
    const episode = normalizeEpisodeNumber(params.episodeNumber, 1);
    return `${base}/serie/${validId}/${season}/${episode}`;
  }
  const validImdb = params.preferImdbForMovies ? sanitizeImdbId(params.imdbId) : null;
  return `${base}/filme/${validImdb || validId}`;
}
function detectStreamKind(url) {
  if (!url || typeof url !== "string") return "iframe";
  const raw = url.trim().split("#")[0];
  const [beforeQuery, query = ""] = raw.split("?");
  const clean = beforeQuery.toLowerCase();
  if (clean.endsWith(".m3u8") || /format=m3u8|type=hls/i.test(query)) {
    return "hls";
  }
  if (clean.endsWith(".mp4") || clean.endsWith(".webm") || clean.endsWith(".ogg") || clean.endsWith(".ogv") || clean.endsWith(".mov") || clean.endsWith(".m4v")) {
    return "video";
  }
  return "iframe";
}
function resolveSandboxPolicy(params) {
  if (params.streamKind !== "iframe") {
    return "none";
  }
  return params.antiAdSandbox !== false ? "strict_no_ads" : "none";
}
function validateWatchaFlixLang(lang, fallback = "pt") {
  if (lang === "pt" || lang === "en") {
    return lang;
  }
  return fallback;
}
function normalizeWatchaFlixBaseUrl(input) {
  if (!input || typeof input !== "string") return DEFAULT_WATCHAFLIX_BASE_URL;
  const trimmed = input.trim().slice(0, 300);
  if (!trimmed) return DEFAULT_WATCHAFLIX_BASE_URL;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return DEFAULT_WATCHAFLIX_BASE_URL;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "watchaflixapi.watcha.one" || hostname === "watcha.one" || hostname === "www.watcha.one") {
      return DEFAULT_WATCHAFLIX_BASE_URL;
    }
    const cleanPath = parsed.pathname.replace(/\/embed\/.*$/i, "").replace(/\/+$/, "");
    return `${parsed.protocol}//${parsed.host}${cleanPath}`.slice(0, 300);
  } catch {
    return DEFAULT_WATCHAFLIX_BASE_URL;
  }
}
function buildWatchaFlixEmbedUrl(params) {
  const validId = normalizeTmdbId(params.tmdbId);
  if (!validId) {
    throw new Error("ID TMDB inv\xE1lido para WatchaFlix.");
  }
  const base = normalizeWatchaFlixBaseUrl(params.baseUrl);
  const color = sanitizeHexColor(params.colorHex, DEFAULT_PLAYER_CONFIG.defaultColorHex);
  const lang = validateWatchaFlixLang(params.lang, DEFAULT_PLAYER_CONFIG.watchaflixLang);
  const query = `?color=${encodeURIComponent(color)}&lang=${encodeURIComponent(lang)}`;
  if (params.mediaType === "tv") {
    const season = normalizeSeasonNumber(params.seasonNumber, 1);
    const episode = normalizeEpisodeNumber(params.episodeNumber, 1);
    return `${base}/embed/tv/${validId}/${season}/${episode}${query}`;
  }
  return `${base}/embed/movie/${validId}${query}`;
}
function buildMegaEmbedUrl(params) {
  const validId = normalizeTmdbId(params.tmdbId);
  if (!validId) {
    throw new Error("ID TMDB inv\xE1lido para incorpora\xE7\xE3o do player.");
  }
  const domain = validateMegaEmbedDomain(params.domain, DEFAULT_PLAYER_CONFIG.defaultDomain);
  const player = validateMegaEmbedPlayer(params.player, DEFAULT_PLAYER_CONFIG.defaultPlayer);
  const color = sanitizeHexColor(params.colorHex, DEFAULT_PLAYER_CONFIG.defaultColorHex);
  if (params.mediaType === "tv") {
    const season = normalizeSeasonNumber(params.seasonNumber, 1);
    const episode = normalizeEpisodeNumber(params.episodeNumber, 1);
    return `https://${domain}/embed/${validId}/${season}/${episode}?player=${encodeURIComponent(player)}#color:${color}`;
  }
  return `https://${domain}/embed/${validId}?player=${encodeURIComponent(player)}#color:${color}`;
}
function buildCustomEmbedUrl(params) {
  const cleanTemplate = sanitizeEmbedTemplate(params.template);
  const validId = normalizeTmdbId(params.tmdbId);
  if (!cleanTemplate || !validId) return null;
  const season = normalizeSeasonNumber(params.seasonNumber, 1);
  const episode = normalizeEpisodeNumber(params.episodeNumber, 1);
  const player = validateMegaEmbedPlayer(params.player, DEFAULT_PLAYER_CONFIG.defaultPlayer);
  const color = sanitizeHexColor(params.colorHex, DEFAULT_PLAYER_CONFIG.defaultColorHex);
  const imdb = sanitizeImdbId(params.imdbId) || String(validId);
  return cleanTemplate.replace(/\{tmdbId\}|\{tmdb_id\}|\{TMDB_ID\}|\{id\}/g, String(validId)).replace(/\{imdbId\}|\{imdb_id\}|\{IMDB_ID\}/g, imdb).replace(/\{season\}|\{SEASON\}|\{temporada\}/g, String(season)).replace(/\{episode\}|\{EPISODE\}|\{episodio\}|\{episódio\}/g, String(episode)).replace(/\{player\}/g, encodeURIComponent(player)).replace(/\{color\}/g, color).replace(/\{type\}/g, params.mediaType === "tv" ? "tv" : "movie");
}
function buildTmdbImageUrl(path5, size = "w500", baseUrl = "https://image.tmdb.org/t/p/") {
  if (!path5) return null;
  if (path5.startsWith("http://") || path5.startsWith("https://") || path5.startsWith("/src/") || path5.startsWith("/assets/")) {
    return path5;
  }
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path5.startsWith("/") ? path5 : `/${path5}`;
  return `${normalizedBase}${size}${normalizedPath}`;
}
function buildOrderedSourceCascade(cfg, params) {
  const validId = normalizeTmdbId(params.tmdbId);
  if (!validId) return [];
  const season = params.mediaType === "tv" ? normalizeSeasonNumber(params.seasonNumber, 1) : void 0;
  const episode = params.mediaType === "tv" ? normalizeEpisodeNumber(params.episodeNumber, 1) : void 0;
  const customSources = sanitizeCustomVideoSources(cfg.customSources).filter((s) => s.active);
  const customTemplateRaw = params.mediaType === "tv" ? cfg.customEmbedTvTemplate : cfg.customEmbedMovieTemplate;
  const customTemplateUrl = customTemplateRaw ? buildCustomEmbedUrl({
    template: customTemplateRaw,
    tmdbId: validId,
    imdbId: params.imdbId,
    mediaType: params.mediaType,
    seasonNumber: season,
    episodeNumber: episode,
    player: cfg.defaultPlayer,
    colorHex: cfg.defaultColorHex
  }) : null;
  const watchaflixUrl = buildWatchaFlixEmbedUrl({
    tmdbId: validId,
    mediaType: params.mediaType,
    seasonNumber: season,
    episodeNumber: episode,
    baseUrl: cfg.watchaflixBaseUrl,
    colorHex: cfg.defaultColorHex,
    lang: cfg.watchaflixLang
  });
  const myembedUrl = buildMyEmbedUrl({
    tmdbId: validId,
    imdbId: params.imdbId,
    preferImdbForMovies: cfg.preferImdbForMovies,
    mediaType: params.mediaType,
    seasonNumber: season,
    episodeNumber: episode,
    baseUrl: cfg.myembedBaseUrl
  });
  const megaPrimaryUrl = buildMegaEmbedUrl({
    tmdbId: validId,
    domain: cfg.defaultDomain,
    player: cfg.defaultPlayer,
    colorHex: cfg.defaultColorHex,
    mediaType: params.mediaType,
    seasonNumber: season,
    episodeNumber: episode
  });
  const megaFallbackUrl = cfg.fallbackDomain && cfg.fallbackDomain !== cfg.defaultDomain ? buildMegaEmbedUrl({
    tmdbId: validId,
    domain: cfg.fallbackDomain,
    player: cfg.defaultPlayer,
    colorHex: cfg.defaultColorHex,
    mediaType: params.mediaType,
    seasonNumber: season,
    episodeNumber: episode
  }) : null;
  const hasCustomWatchaflix = normalizeWatchaFlixBaseUrl(cfg.watchaflixBaseUrl) !== DEFAULT_WATCHAFLIX_BASE_URL;
  const hasCustomMyembed = normalizeMyEmbedBaseUrl(cfg.myembedBaseUrl) !== DEFAULT_MYEMBED_BASE_URL;
  const rawList = [];
  const pushCustomSources = () => {
    for (const src of customSources) {
      const template = params.mediaType === "tv" ? src.tvTemplate || src.movieTemplate : src.movieTemplate || src.tvTemplate;
      if (!template) continue;
      const builtUrl = buildCustomEmbedUrl({
        template,
        tmdbId: validId,
        imdbId: params.imdbId,
        mediaType: params.mediaType,
        seasonNumber: season,
        episodeNumber: episode,
        player: cfg.defaultPlayer,
        colorHex: cfg.defaultColorHex
      });
      if (!builtUrl) continue;
      rawList.push({
        sourceId: "custom_source",
        customSourceId: src.id,
        label: src.name,
        url: builtUrl,
        isCustomConfigured: true,
        sourceKindHint: src.kind,
        preferredLang: src.lang
      });
    }
  };
  const pushCustomTemplate = () => {
    if (customTemplateUrl) {
      rawList.push({
        sourceId: "custom_template",
        label: "Template Customizado",
        url: customTemplateUrl,
        isCustomConfigured: true
      });
    }
  };
  const pushWatchaflix = () => {
    rawList.push({
      sourceId: "watchaflix",
      label: hasCustomWatchaflix ? "WatchaFlix Custom" : "WatchaFlix API",
      url: watchaflixUrl,
      isCustomConfigured: hasCustomWatchaflix
    });
  };
  const pushMyembed = () => {
    rawList.push({
      sourceId: "myembed",
      label: hasCustomMyembed ? "MyEmbed Custom" : "MyEmbed / EmbedMovies",
      url: myembedUrl,
      isCustomConfigured: hasCustomMyembed
    });
  };
  const pushMegaembed = () => {
    rawList.push({
      sourceId: "megaembed",
      label: `MegaEmbed (${cfg.defaultDomain})`,
      url: megaPrimaryUrl,
      isCustomConfigured: false
    });
    if (megaFallbackUrl) {
      rawList.push({
        sourceId: "megaembed",
        label: `MegaEmbed (${cfg.fallbackDomain})`,
        url: megaFallbackUrl,
        isCustomConfigured: false
      });
    }
  };
  const pushNative = () => {
    rawList.push({
      sourceId: "native_watcha",
      label: "MegaStream Nativo (WatchPlay / VidSrc / EmbedPlayer)",
      isCustomConfigured: false
    });
  };
  if (cfg.sourceMode === "custom_template") {
    pushCustomSources();
    pushCustomTemplate();
    pushNative();
    if (hasCustomWatchaflix) pushWatchaflix();
    if (hasCustomMyembed) pushMyembed();
    if (!hasCustomMyembed) pushMyembed();
    if (!hasCustomWatchaflix) pushWatchaflix();
    pushMegaembed();
  } else if (cfg.sourceMode === "watchaflix") {
    pushWatchaflix();
    pushCustomSources();
    pushNative();
    pushCustomTemplate();
    pushMyembed();
    pushMegaembed();
  } else if (cfg.sourceMode === "myembed") {
    pushMyembed();
    pushCustomSources();
    pushNative();
    pushCustomTemplate();
    pushWatchaflix();
    pushMegaembed();
  } else if (cfg.sourceMode === "megaembed") {
    pushMegaembed();
    pushCustomSources();
    pushNative();
    pushCustomTemplate();
    pushMyembed();
    pushWatchaflix();
  } else {
    pushNative();
    pushCustomSources();
    pushCustomTemplate();
    if (hasCustomWatchaflix) pushWatchaflix();
    if (hasCustomMyembed) pushMyembed();
    if (!hasCustomMyembed) pushMyembed();
    if (!hasCustomWatchaflix) pushWatchaflix();
    pushMegaembed();
  }
  const seen = /* @__PURE__ */ new Set();
  const deduped = [];
  for (const item of rawList) {
    const key = `${item.sourceId}:${item.customSourceId || ""}:${item.url || "native"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

// server/services/AuthenticationService.ts
import fs4 from "node:fs";
import path4 from "node:path";

// server/services/FirestoreRestService.ts
import fs2 from "node:fs";
import path2 from "node:path";
function loadConfig() {
  try {
    const cfgPath = path2.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs2.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs2.readFileSync(cfgPath, "utf-8"));
      if (parsed.projectId && parsed.firestoreDatabaseId) {
        return {
          projectId: parsed.projectId,
          firestoreDatabaseId: parsed.firestoreDatabaseId
        };
      }
    }
  } catch {
  }
  return {
    projectId: "gen-lang-client-0094430568",
    firestoreDatabaseId: "ai-studio-7a3f426f-e541-4ad6-aab7-8258b241a13c"
  };
}
function decodeValue(val) {
  if ("stringValue" in val) return val.stringValue;
  if ("booleanValue" in val) return val.booleanValue;
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return val.doubleValue;
  if ("timestampValue" in val) return val.timestampValue;
  if ("nullValue" in val) return null;
  if ("arrayValue" in val) {
    return (val.arrayValue.values ?? []).map(decodeValue);
  }
  if ("mapValue" in val) {
    return decodeFields(val.mapValue.fields ?? {});
  }
  return null;
}
function decodeFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = decodeValue(v);
  }
  return out;
}
var FirestoreRestServiceImpl = class {
  constructor() {
    this.cfg = loadConfig();
  }
  get baseDocumentsUrl() {
    return `https://firestore.googleapis.com/v1/projects/${this.cfg.projectId}/databases/${this.cfg.firestoreDatabaseId}/documents`;
  }
  buildHeaders(bearerToken, jsonBody = false) {
    const headers = { Accept: "application/json" };
    if (jsonBody) headers["Content-Type"] = "application/json";
    const clean = bearerToken?.replace(/^Bearer\s+/i, "").trim();
    if (clean) {
      headers.Authorization = `Bearer ${clean}`;
    }
    return headers;
  }
  async getDocument(docPath, bearerToken) {
    try {
      const res = await fetch(`${this.baseDocumentsUrl}/${docPath}`, {
        headers: this.buildHeaders(bearerToken, false),
        signal: AbortSignal.timeout(5e3)
      });
      if (!res.ok) return null;
      const doc = await res.json();
      if (!doc.fields) return null;
      return decodeFields(doc.fields);
    } catch {
      return null;
    }
  }
  async queryActiveCollectionChecked(collectionId, bearerToken) {
    try {
      const res = await fetch(`${this.baseDocumentsUrl}:runQuery`, {
        method: "POST",
        headers: this.buildHeaders(bearerToken, true),
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId }],
            where: {
              fieldFilter: {
                field: { fieldPath: "active" },
                op: "EQUAL",
                value: { booleanValue: true }
              }
            }
          }
        }),
        signal: AbortSignal.timeout(5e3)
      });
      if (!res.ok) return { ok: false, items: [] };
      const rows = await res.json();
      const items = [];
      for (const row of rows) {
        if (row.document?.fields) {
          items.push(decodeFields(row.document.fields));
        }
      }
      return { ok: true, items };
    } catch {
      return { ok: false, items: [] };
    }
  }
  async queryActiveCollection(collectionId, bearerToken) {
    const res = await this.queryActiveCollectionChecked(collectionId, bearerToken);
    return res.items;
  }
};
var FirestoreRestService = new FirestoreRestServiceImpl();

// server/repositories/interfaces.ts
import fs3 from "node:fs";
import path3 from "node:path";

// shared/catalogUtils.ts
var SUBSCRIPTION_PLANS = [
  {
    id: "monthly",
    name: "Mensal",
    subtitle: "Flexibilidade total para come\xE7ar",
    priceBrl: 29.9,
    billingLabel: "R$ 29,90 / m\xEAs",
    periodDays: 30,
    benefits: [
      "Acesso completo ao cat\xE1logo de filmes e s\xE9ries",
      "IA Inteligente com recomenda\xE7\xF5es personalizadas",
      "Sincroniza\xE7\xE3o de Minha Lista e Hist\xF3rico na nuvem",
      "Sem fidelidade \u2014 cancele quando desejar"
    ]
  },
  {
    id: "quarterly",
    name: "Trimestral",
    subtitle: "Mais popular \xB7 Melhor custo-benef\xEDcio",
    priceBrl: 59.9,
    billingLabel: "R$ 59,90 / 3 meses",
    periodDays: 90,
    popular: true,
    benefits: [
      "Economize 33% comparado ao plano mensal",
      "Acesso completo em smartphones, tablets e TVs",
      "Listas personalizadas ilimitadas com IA",
      "Prioridade nos novos recursos da plataforma"
    ]
  },
  {
    id: "annual",
    name: "Anual",
    subtitle: "Experi\xEAncia definitiva o ano inteiro",
    priceBrl: 199.9,
    billingLabel: "R$ 199,90 / ano",
    periodDays: 365,
    benefits: [
      "Equivalente a mais de 2 meses gr\xE1tis no ano",
      "Todos os 5 temas exclusivos desbloqueados",
      "Suporte priorit\xE1rio e canais autorizados ao vivo",
      "Controle parental e m\xFAltiplos perfis de acesso"
    ]
  }
];
function getPlanById(planId) {
  return SUBSCRIPTION_PLANS.find((p) => p.id === planId) ?? null;
}
function sanitizePlainText(value, maxLength = 200) {
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function isValidStreamUrl(url) {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
function filterAndSortMedia(items, filters) {
  const query = (filters.query ?? "").trim().toLowerCase();
  const pageSize = Math.max(1, Math.min(40, filters.pageSize ?? 20));
  const requestedPage = Math.max(1, filters.page ?? 1);
  const filtered = items.filter((item) => {
    if (filters.mediaType && filters.mediaType !== "all" && item.mediaType !== filters.mediaType) {
      return false;
    }
    if (filters.genreId && !item.genreIds.includes(filters.genreId)) {
      return false;
    }
    if (filters.year && Number(item.releaseYear) !== filters.year) {
      return false;
    }
    if (typeof filters.minRating === "number" && filters.minRating > 0 && item.voteAverage < filters.minRating) {
      return false;
    }
    if (filters.language && filters.language !== "all" && item.originalLanguage !== filters.language) {
      return false;
    }
    if (filters.country && filters.country !== "all" && !(item.originCountry ?? []).includes(filters.country)) {
      return false;
    }
    if (query) {
      const hay = `${item.title} ${item.originalTitle} ${item.overview}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    if (filters.sortBy === "rating") {
      return b.voteAverage - a.voteAverage;
    }
    if (filters.sortBy === "release_date") {
      return (b.releaseDate || "").localeCompare(a.releaseDate || "");
    }
    return b.popularity - a.popularity;
  });
  const totalResults = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;
  return {
    items: sorted.slice(start, start + pageSize),
    totalResults,
    totalPages,
    page
  };
}
function deduplicateMediaByTmdbId(items) {
  const seen = /* @__PURE__ */ new Map();
  for (const item of items) {
    const key = `${item.mediaType}:${item.tmdbId}`;
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}

// shared/siteConfigUtils.ts
var VALID_THEMES = [
  "cinematografico",
  "neon-roxo",
  "minimalista",
  "gold-premium",
  "3d-glass"
];
var DEFAULT_SITE_CONFIG = {
  siteName: "MegaStream",
  siteSlogan: "Sua divers\xE3o em um s\xF3 lugar!",
  logoUrl: "",
  defaultTheme: "cinematografico",
  accentColorHex: "",
  announcementEnabled: false,
  announcementText: "",
  enableChannels: true,
  enableAiPage: true,
  enablePlansPage: true,
  maintenanceMode: false,
  footerText: "MegaStream \xB7 Sua divers\xE3o em um s\xF3 lugar!",
  updatedAt: "2026-01-01T00:00:00.000Z"
};
function sanitizeOptionalUrl(url, maxLength = 500) {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) {
    return trimmed.slice(0, maxLength);
  }
  return isValidStreamUrl(trimmed) ? trimmed.slice(0, maxLength) : "";
}
function toIsoTimestamp(value, fallback = "") {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
    return fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (value && typeof value === "object") {
    const maybe = value;
    if (typeof maybe.toDate === "function") {
      try {
        return maybe.toDate().toISOString();
      } catch {
        return fallback;
      }
    }
    if (typeof maybe.seconds === "number") {
      return new Date(maybe.seconds * 1e3).toISOString();
    }
  }
  return fallback;
}
function sanitizeSiteConfig(input, current = DEFAULT_SITE_CONFIG, preserveUpdatedAt = false) {
  const siteName = typeof input.siteName === "string" ? sanitizePlainText(input.siteName, 40) || current.siteName : current.siteName;
  const siteSlogan = typeof input.siteSlogan === "string" ? sanitizePlainText(input.siteSlogan, 100) || current.siteSlogan : current.siteSlogan;
  const logoUrl = input.logoUrl !== void 0 ? sanitizeOptionalUrl(input.logoUrl, 500) : current.logoUrl;
  const defaultTheme = input.defaultTheme && VALID_THEMES.includes(input.defaultTheme) ? input.defaultTheme : current.defaultTheme;
  let accentColorHex = current.accentColorHex;
  if (input.accentColorHex !== void 0) {
    const raw = input.accentColorHex.trim();
    accentColorHex = raw === "" ? "" : sanitizeHexColor(raw, "");
  }
  const announcementText = typeof input.announcementText === "string" ? sanitizePlainText(input.announcementText, 180) : current.announcementText;
  const footerText = typeof input.footerText === "string" ? sanitizePlainText(input.footerText, 120) || current.footerText : current.footerText;
  const preservedIso = preserveUpdatedAt ? toIsoTimestamp(input.updatedAt, "") : "";
  return {
    siteName,
    siteSlogan,
    logoUrl,
    defaultTheme,
    accentColorHex,
    announcementEnabled: typeof input.announcementEnabled === "boolean" ? input.announcementEnabled : current.announcementEnabled,
    announcementText,
    enableChannels: typeof input.enableChannels === "boolean" ? input.enableChannels : current.enableChannels,
    enableAiPage: typeof input.enableAiPage === "boolean" ? input.enableAiPage : current.enableAiPage,
    enablePlansPage: typeof input.enablePlansPage === "boolean" ? input.enablePlansPage : current.enablePlansPage,
    maintenanceMode: typeof input.maintenanceMode === "boolean" ? input.maintenanceMode : current.maintenanceMode,
    footerText,
    updatedAt: preservedIso || (/* @__PURE__ */ new Date()).toISOString()
  };
}
function sanitizeCustomMediaInput(input, existing) {
  const mediaType = input.mediaType === "tv" ? "tv" : input.mediaType === "movie" ? "movie" : existing?.mediaType ?? "movie";
  const title = sanitizePlainText(input.title ?? existing?.title ?? "", 160);
  if (!title) {
    throw new Error("T\xEDtulo do filme ou s\xE9rie \xE9 obrigat\xF3rio.");
  }
  const rawTmdb = Number(input.tmdbId ?? existing?.tmdbId);
  const tmdbId = Number.isInteger(rawTmdb) && rawTmdb > 0 ? rawTmdb : Math.floor(9e6 + Date.now() % 9e5);
  const id = existing?.id || (input.id && /^[a-zA-Z0-9_-]{1,64}$/.test(input.id.trim()) ? input.id.trim() : `custom_${mediaType}_${tmdbId}`);
  const overview = typeof input.overview === "string" ? sanitizePlainText(input.overview, 1e3) || "Conte\xFAdo adicionado pela administra\xE7\xE3o." : existing?.overview ?? "Conte\xFAdo adicionado pela administra\xE7\xE3o.";
  const posterRaw = input.posterPath !== void 0 ? sanitizeOptionalUrl(input.posterPath, 500) : existing?.posterPath ?? null;
  const backdropRaw = input.backdropPath !== void 0 ? sanitizeOptionalUrl(input.backdropPath, 500) : existing?.backdropPath ?? null;
  const customStreamUrl = input.customStreamUrl !== void 0 ? sanitizeOptionalUrl(input.customStreamUrl, 500) || void 0 : existing?.customStreamUrl;
  const rawYear = typeof input.releaseYear === "string" ? input.releaseYear.replace(/[^0-9]/g, "").slice(0, 4) : existing?.releaseYear ?? String((/* @__PURE__ */ new Date()).getFullYear());
  const rawVote = Number(input.voteAverage ?? existing?.voteAverage ?? 8.5);
  const voteAverage = Number.isFinite(rawVote) ? Math.max(0, Math.min(10, Number(rawVote.toFixed(1)))) : 8.5;
  const genreIds = Array.isArray(input.genreIds) ? input.genreIds.map((g) => Number(g)).filter((g) => Number.isInteger(g) && g > 0) : existing?.genreIds ?? [];
  return {
    id,
    tmdbId,
    mediaType,
    title,
    originalTitle: sanitizePlainText(input.originalTitle ?? existing?.originalTitle ?? title, 160) || title,
    overview,
    posterPath: posterRaw || null,
    backdropPath: backdropRaw || null,
    releaseYear: rawYear || String((/* @__PURE__ */ new Date()).getFullYear()),
    voteAverage,
    genreIds,
    customStreamUrl,
    featured: typeof input.featured === "boolean" ? input.featured : existing?.featured ?? false,
    active: typeof input.active === "boolean" ? input.active : existing?.active ?? true,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function customMediaToMediaItem(item) {
  return {
    id: item.tmdbId,
    tmdbId: item.tmdbId,
    mediaType: item.mediaType,
    title: item.title,
    originalTitle: item.originalTitle || item.title,
    overview: item.overview,
    posterPath: item.posterPath,
    backdropPath: item.backdropPath,
    releaseDate: item.releaseYear ? `${item.releaseYear}-01-01` : "",
    releaseYear: item.releaseYear,
    voteAverage: item.voteAverage,
    voteCount: 100,
    popularity: item.featured ? 9999 : 500,
    genreIds: item.genreIds,
    originalLanguage: "pt",
    originCountry: ["BR"],
    source: "tmdb"
  };
}
function mergeCustomCatalogIntoList(baseItems, customItems, mediaTypeFilter) {
  const activeCustom = customItems.filter(
    (c) => c.active && (!mediaTypeFilter || c.mediaType === mediaTypeFilter)
  );
  if (activeCustom.length === 0) return baseItems;
  const overrideMap = /* @__PURE__ */ new Map();
  for (const c of activeCustom) {
    overrideMap.set(`${c.mediaType}:${c.tmdbId}`, customMediaToMediaItem(c));
  }
  const replaced = baseItems.map((m) => overrideMap.get(`${m.mediaType}:${m.tmdbId}`) ?? m);
  const existingKeys = new Set(replaced.map((m) => `${m.mediaType}:${m.tmdbId}`));
  const newCustoms = activeCustom.filter((c) => !existingKeys.has(`${c.mediaType}:${c.tmdbId}`)).map(customMediaToMediaItem);
  return [...newCustoms, ...replaced];
}

// shared/systemSettingsUtils.ts
var VALID_CATALOG_SOURCES = [
  "auto",
  "tmdb",
  "demo",
  "custom_only"
];
var VALID_AI_MODES = [
  "auto",
  "gemini",
  "catalog_smart",
  "disabled"
];
var VALID_TMDB_LANGUAGES = [
  "pt-BR",
  "en-US",
  "es-ES"
];
var VALID_TMDB_QUALITIES = [
  "w342",
  "w500",
  "w780"
];
var VALID_PLANS = ["free", "monthly", "quarterly", "annual"];
var DEFAULT_SYSTEM_SETTINGS = {
  catalogSource: "auto",
  tmdbBaseUrl: "https://api.themoviedb.org/3",
  tmdbImageBaseUrl: "https://image.tmdb.org/t/p/",
  tmdbLanguage: "pt-BR",
  tmdbImageQuality: "w500",
  includeAdult: false,
  cacheTtlMinutes: 10,
  aiMode: "auto",
  aiMaxRecommendations: 12,
  allowRegistration: true,
  requireAuthForPlayer: false,
  allowGuestFavorites: true,
  maxProfilesPerAccount: 5,
  defaultUserPlan: "free",
  maintenanceMessage: "Plataforma em manuten\xE7\xE3o programada. Alguns recursos podem ficar temporariamente indispon\xEDveis.",
  updatedAt: "2026-01-01T00:00:00.000Z"
};
function sanitizeHttpsApiUrl(raw, fallback, ensureTrailingSlash = false) {
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed || !isValidStreamUrl(trimmed)) return fallback;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return fallback;
    }
    const clean = trimmed.replace(/\/+$/, "");
    return ensureTrailingSlash ? `${clean}/` : clean;
  } catch {
    return fallback;
  }
}
function clampInt(value, min, max, fallback) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  const rounded = Math.round(num);
  return Math.max(min, Math.min(max, rounded));
}
function sanitizeSystemSettings(input, current = DEFAULT_SYSTEM_SETTINGS, preserveUpdatedAt = false) {
  const catalogSource = input.catalogSource && VALID_CATALOG_SOURCES.includes(input.catalogSource) ? input.catalogSource : current.catalogSource;
  const tmdbBaseUrl = input.tmdbBaseUrl !== void 0 ? sanitizeHttpsApiUrl(input.tmdbBaseUrl, current.tmdbBaseUrl, false) : current.tmdbBaseUrl;
  const tmdbImageBaseUrl = input.tmdbImageBaseUrl !== void 0 ? sanitizeHttpsApiUrl(input.tmdbImageBaseUrl, current.tmdbImageBaseUrl, true) : current.tmdbImageBaseUrl;
  const tmdbLanguage = input.tmdbLanguage && VALID_TMDB_LANGUAGES.includes(input.tmdbLanguage) ? input.tmdbLanguage : current.tmdbLanguage;
  const tmdbImageQuality = input.tmdbImageQuality && VALID_TMDB_QUALITIES.includes(input.tmdbImageQuality) ? input.tmdbImageQuality : current.tmdbImageQuality;
  const aiMode = input.aiMode && VALID_AI_MODES.includes(input.aiMode) ? input.aiMode : current.aiMode;
  const defaultUserPlan = input.defaultUserPlan && VALID_PLANS.includes(input.defaultUserPlan) ? input.defaultUserPlan : current.defaultUserPlan;
  const maintenanceMessage = typeof input.maintenanceMessage === "string" ? sanitizePlainText(input.maintenanceMessage, 240) || current.maintenanceMessage : current.maintenanceMessage;
  const preservedIso = preserveUpdatedAt ? toIsoTimestamp(input.updatedAt, "") : "";
  return {
    catalogSource,
    tmdbBaseUrl,
    tmdbImageBaseUrl,
    tmdbLanguage,
    tmdbImageQuality,
    includeAdult: typeof input.includeAdult === "boolean" ? input.includeAdult : current.includeAdult,
    cacheTtlMinutes: input.cacheTtlMinutes !== void 0 ? clampInt(input.cacheTtlMinutes, 1, 1440, current.cacheTtlMinutes) : current.cacheTtlMinutes,
    aiMode,
    aiMaxRecommendations: input.aiMaxRecommendations !== void 0 ? clampInt(input.aiMaxRecommendations, 4, 24, current.aiMaxRecommendations) : current.aiMaxRecommendations,
    allowRegistration: typeof input.allowRegistration === "boolean" ? input.allowRegistration : current.allowRegistration,
    requireAuthForPlayer: typeof input.requireAuthForPlayer === "boolean" ? input.requireAuthForPlayer : current.requireAuthForPlayer,
    allowGuestFavorites: typeof input.allowGuestFavorites === "boolean" ? input.allowGuestFavorites : current.allowGuestFavorites,
    maxProfilesPerAccount: input.maxProfilesPerAccount !== void 0 ? clampInt(input.maxProfilesPerAccount, 1, 8, current.maxProfilesPerAccount) : current.maxProfilesPerAccount,
    defaultUserPlan,
    maintenanceMessage,
    updatedAt: preservedIso || (/* @__PURE__ */ new Date()).toISOString()
  };
}
function extractPublicRuntimeSettings(settings, embedTimeoutSeconds = 12, playerBranding) {
  return {
    allowRegistration: settings.allowRegistration,
    requireAuthForPlayer: settings.requireAuthForPlayer,
    allowGuestFavorites: settings.allowGuestFavorites,
    maxProfilesPerAccount: settings.maxProfilesPerAccount,
    maintenanceMessage: settings.maintenanceMessage,
    aiEnabled: settings.aiMode !== "disabled",
    embedTimeoutSeconds: clampInt(embedTimeoutSeconds, 5, 30, 12),
    ...playerBranding ? { playerBranding } : {},
    updatedAt: settings.updatedAt
  };
}
function maskSecretValue(secret) {
  const trimmed = typeof secret === "string" ? secret.trim() : "";
  if (!trimmed) return "";
  if (trimmed.length <= 8) return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
  return `${trimmed.slice(0, 4)}\u2022\u2022\u2022\u2022${trimmed.slice(-4)}`;
}
function sanitizeSecretToken(raw, maxLength = 500) {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\r\n\t\s]+/g, "").slice(0, maxLength);
}

// server/repositories/interfaces.ts
var DATA_FILE = process.env.VERCEL ? "/tmp/.megastream-store.json" : path3.resolve(process.cwd(), ".megastream-store.json");
var JsonRepositoryStore = class {
  constructor() {
    this.state = this.load();
  }
  load() {
    try {
      if (fs3.existsSync(DATA_FILE)) {
        const raw = fs3.readFileSync(DATA_FILE, "utf-8");
        return JSON.parse(raw);
      }
    } catch {
    }
    return {
      users: {},
      profiles: {},
      favorites: {},
      history: {},
      channels: {},
      subscriptions: {},
      siteConfig: { ...DEFAULT_SITE_CONFIG },
      systemSettings: { ...DEFAULT_SYSTEM_SETTINGS },
      adminSecrets: {},
      customCatalog: {},
      logs: [
        {
          id: "boot-1",
          level: "info",
          service: "System",
          message: "MegaStream API inicializada com arquitetura modular pronta para Firestore e PostgreSQL.",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      ],
      totalPlaybacks: 0,
      lastSyncAt: null
    };
  }
  save() {
    try {
      fs3.writeFileSync(DATA_FILE, JSON.stringify(this.state, null, 2), "utf-8");
    } catch {
    }
  }
  getUsers() {
    return Object.values(this.state.users);
  }
  getUser(uid) {
    return this.state.users[uid] ?? null;
  }
  upsertUser(user) {
    this.state.users[user.uid] = user;
    this.save();
    return user;
  }
  getProfiles(userId) {
    return (this.state.profiles ?? {})[userId] ?? [];
  }
  upsertProfile(profile) {
    if (!this.state.profiles) this.state.profiles = {};
    const list = this.state.profiles[profile.userId] ?? [];
    const idx = list.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      const next = [...list];
      next[idx] = profile;
      this.state.profiles[profile.userId] = next;
    } else {
      this.state.profiles[profile.userId] = [...list, profile];
    }
    this.save();
    return profile;
  }
  deleteProfile(userId, profileId) {
    if (!this.state.profiles) return false;
    const list = this.state.profiles[userId] ?? [];
    const next = list.filter((p) => p.id !== profileId);
    const removed = next.length !== list.length;
    this.state.profiles[userId] = next;
    this.save();
    return removed;
  }
  getFavorites(userId) {
    return this.state.favorites[userId] ?? [];
  }
  addFavorite(item) {
    const list = this.state.favorites[item.userId] ?? [];
    const filtered = list.filter(
      (f) => !(f.tmdbId === item.tmdbId && f.mediaType === item.mediaType)
    );
    this.state.favorites[item.userId] = [item, ...filtered];
    this.save();
    return item;
  }
  removeFavorite(userId, tmdbId, mediaType) {
    const list = this.state.favorites[userId] ?? [];
    const next = list.filter((f) => !(f.tmdbId === tmdbId && f.mediaType === mediaType));
    const removed = next.length !== list.length;
    this.state.favorites[userId] = next;
    this.save();
    return removed;
  }
  getHistory(userId) {
    return this.state.history[userId] ?? [];
  }
  upsertHistory(item) {
    const list = this.state.history[item.userId] ?? [];
    const filtered = list.filter(
      (h) => !(h.tmdbId === item.tmdbId && h.mediaType === item.mediaType)
    );
    this.state.history[item.userId] = [item, ...filtered].slice(0, 100);
    this.save();
    return item;
  }
  removeHistory(userId, tmdbId, mediaType) {
    const list = this.state.history[userId] ?? [];
    const next = list.filter((h) => !(h.tmdbId === tmdbId && h.mediaType === mediaType));
    const removed = next.length !== list.length;
    this.state.history[userId] = next;
    this.save();
    return removed;
  }
  getChannels() {
    return Object.values(this.state.channels).sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt)
    );
  }
  upsertChannel(channel) {
    this.state.channels[channel.id] = channel;
    this.save();
    return channel;
  }
  deleteChannel(id) {
    if (!this.state.channels[id]) return false;
    delete this.state.channels[id];
    this.save();
    return true;
  }
  getSubscription(userId) {
    return this.state.subscriptions[userId] ?? null;
  }
  upsertSubscription(sub) {
    this.state.subscriptions[sub.userId] = sub;
    this.save();
    return sub;
  }
  getAllSubscriptions() {
    return Object.values(this.state.subscriptions);
  }
  getSiteConfig() {
    return this.state.siteConfig ?? { ...DEFAULT_SITE_CONFIG };
  }
  saveSiteConfig(config) {
    this.state.siteConfig = config;
    this.save();
    return config;
  }
  getPlayerSettings() {
    return this.state.playerSettings ?? null;
  }
  savePlayerSettings(settings) {
    this.state.playerSettings = settings;
    this.save();
    return settings;
  }
  getSystemSettings() {
    return this.state.systemSettings ?? { ...DEFAULT_SYSTEM_SETTINGS };
  }
  saveSystemSettings(settings) {
    this.state.systemSettings = settings;
    this.save();
    return settings;
  }
  getAdminSecrets() {
    return this.state.adminSecrets ?? {};
  }
  saveAdminSecrets(secrets) {
    this.state.adminSecrets = secrets;
    this.save();
    return secrets;
  }
  getCustomCatalog() {
    return Object.values(this.state.customCatalog ?? {}).sort(
      (a, b) => b.updatedAt.localeCompare(a.updatedAt)
    );
  }
  upsertCustomMedia(item) {
    if (!this.state.customCatalog) this.state.customCatalog = {};
    this.state.customCatalog[item.id] = item;
    this.save();
    return item;
  }
  deleteCustomMedia(id) {
    if (!this.state.customCatalog?.[id]) return false;
    delete this.state.customCatalog[id];
    this.save();
    return true;
  }
  addLog(entry) {
    const log = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      ...entry
    };
    this.state.logs = [log, ...this.state.logs].slice(0, 250);
    this.save();
    return log;
  }
  getLogs(limit = 100) {
    return this.state.logs.slice(0, limit);
  }
  getTotalPlaybacks() {
    return this.state.totalPlaybacks;
  }
  incrementPlaybackCounter() {
    this.state.totalPlaybacks += 1;
    this.save();
  }
  getLastSyncAt() {
    return this.state.lastSyncAt;
  }
  setLastSyncAt(iso) {
    this.state.lastSyncAt = iso;
    this.save();
  }
};
var repositoryStore = new JsonRepositoryStore();

// server/config/playerConfig.ts
var PlayerConfigStore = class {
  getPersisted() {
    const stored = repositoryStore.getPlayerSettings();
    if (!stored) {
      return { ...DEFAULT_PLAYER_CONFIG };
    }
    const sourceMode = validatePlayerSourceMode(
      stored.sourceMode,
      DEFAULT_PLAYER_CONFIG.sourceMode
    );
    return {
      ...DEFAULT_PLAYER_CONFIG,
      sourceMode,
      defaultDomain: validateMegaEmbedDomain(
        stored.defaultDomain,
        DEFAULT_PLAYER_CONFIG.defaultDomain
      ),
      fallbackDomain: validateMegaEmbedDomain(
        stored.fallbackDomain,
        DEFAULT_PLAYER_CONFIG.fallbackDomain
      ),
      autoFallback: typeof stored.autoFallback === "boolean" ? stored.autoFallback : DEFAULT_PLAYER_CONFIG.autoFallback,
      defaultPlayer: validateMegaEmbedPlayer(
        stored.defaultPlayer,
        DEFAULT_PLAYER_CONFIG.defaultPlayer
      ),
      defaultColorHex: sanitizeHexColor(
        stored.defaultColorHex,
        DEFAULT_PLAYER_CONFIG.defaultColorHex
      ),
      myembedBaseUrl: normalizeMyEmbedBaseUrl(stored.myembedBaseUrl),
      antiAdSandbox: typeof stored.antiAdSandbox === "boolean" ? stored.antiAdSandbox : DEFAULT_PLAYER_CONFIG.antiAdSandbox,
      preferImdbForMovies: typeof stored.preferImdbForMovies === "boolean" ? stored.preferImdbForMovies : DEFAULT_PLAYER_CONFIG.preferImdbForMovies,
      watchaflixBaseUrl: normalizeWatchaFlixBaseUrl(stored.watchaflixBaseUrl),
      watchaflixLang: validateWatchaFlixLang(
        stored.watchaflixLang,
        DEFAULT_PLAYER_CONFIG.watchaflixLang
      ),
      customEmbedMovieTemplate: sanitizeEmbedTemplate(stored.customEmbedMovieTemplate),
      customEmbedTvTemplate: sanitizeEmbedTemplate(stored.customEmbedTvTemplate),
      customSources: sanitizeCustomVideoSources(stored.customSources),
      embedTimeoutSeconds: sanitizeEmbedTimeoutSeconds(
        stored.embedTimeoutSeconds,
        DEFAULT_PLAYER_CONFIG.embedTimeoutSeconds
      ),
      defaultAspectMode: validatePlayerAspectMode(
        stored.defaultAspectMode,
        DEFAULT_PLAYER_CONFIG.defaultAspectMode
      ),
      autoEnableSubtitles: typeof stored.autoEnableSubtitles === "boolean" ? stored.autoEnableSubtitles : DEFAULT_PLAYER_CONFIG.autoEnableSubtitles,
      defaultSubtitleSize: validateSubtitleSize(
        stored.defaultSubtitleSize,
        DEFAULT_PLAYER_CONFIG.defaultSubtitleSize
      ),
      defaultSubtitleColor: validateSubtitleColor(
        stored.defaultSubtitleColor,
        DEFAULT_PLAYER_CONFIG.defaultSubtitleColor
      ),
      defaultSubtitleBg: validateSubtitleBg(
        stored.defaultSubtitleBg,
        DEFAULT_PLAYER_CONFIG.defaultSubtitleBg
      ),
      allowTvCast: typeof stored.allowTvCast === "boolean" ? stored.allowTvCast : DEFAULT_PLAYER_CONFIG.allowTvCast,
      allowPipMode: typeof stored.allowPipMode === "boolean" ? stored.allowPipMode : DEFAULT_PLAYER_CONFIG.allowPipMode,
      allowTheaterMode: typeof stored.allowTheaterMode === "boolean" ? stored.allowTheaterMode : DEFAULT_PLAYER_CONFIG.allowTheaterMode,
      watermarkEnabled: typeof stored.watermarkEnabled === "boolean" ? stored.watermarkEnabled : DEFAULT_PLAYER_CONFIG.watermarkEnabled,
      watermarkText: stored.watermarkText !== void 0 ? sanitizeWatermarkText(stored.watermarkText) : DEFAULT_PLAYER_CONFIG.watermarkText,
      watermarkLogoUrl: stored.watermarkLogoUrl !== void 0 ? sanitizeWatermarkLogoUrl(stored.watermarkLogoUrl) : DEFAULT_PLAYER_CONFIG.watermarkLogoUrl,
      watermarkPosition: validateWatermarkPosition(
        stored.watermarkPosition,
        DEFAULT_PLAYER_CONFIG.watermarkPosition
      ),
      watermarkOpacity: sanitizeWatermarkOpacity(
        stored.watermarkOpacity,
        DEFAULT_PLAYER_CONFIG.watermarkOpacity
      ),
      watermarkSize: validateWatermarkSize(
        stored.watermarkSize,
        DEFAULT_PLAYER_CONFIG.watermarkSize
      ),
      autoNextEpisode: typeof stored.autoNextEpisode === "boolean" ? stored.autoNextEpisode : DEFAULT_PLAYER_CONFIG.autoNextEpisode,
      autoNextCountdownSeconds: sanitizeAutoNextCountdownSeconds(
        stored.autoNextCountdownSeconds,
        DEFAULT_PLAYER_CONFIG.autoNextCountdownSeconds
      ),
      updatedAt: stored.updatedAt ?? DEFAULT_PLAYER_CONFIG.updatedAt
    };
  }
  getConfig() {
    return this.getPersisted();
  }
  updateConfig(partial, preserveUpdatedAt = false) {
    const current = this.getPersisted();
    const nextSourceMode = validatePlayerSourceMode(
      partial.sourceMode,
      current.sourceMode
    );
    const nextDomain = partial.defaultDomain ? validateMegaEmbedDomain(partial.defaultDomain, current.defaultDomain) : current.defaultDomain;
    const nextFallback = partial.fallbackDomain ? validateMegaEmbedDomain(partial.fallbackDomain, current.fallbackDomain) : current.fallbackDomain;
    const nextAutoFallback = typeof partial.autoFallback === "boolean" ? partial.autoFallback : current.autoFallback;
    const nextPlayer = partial.defaultPlayer ? validateMegaEmbedPlayer(partial.defaultPlayer, current.defaultPlayer) : current.defaultPlayer;
    const nextColor = partial.defaultColorHex ? sanitizeHexColor(partial.defaultColorHex, current.defaultColorHex) : current.defaultColorHex;
    const nextMyEmbedBaseUrl = partial.myembedBaseUrl !== void 0 ? normalizeMyEmbedBaseUrl(partial.myembedBaseUrl) : current.myembedBaseUrl;
    const nextAntiAdSandbox = typeof partial.antiAdSandbox === "boolean" ? partial.antiAdSandbox : current.antiAdSandbox;
    const nextPreferImdb = typeof partial.preferImdbForMovies === "boolean" ? partial.preferImdbForMovies : current.preferImdbForMovies;
    const nextWatchaflixBaseUrl = partial.watchaflixBaseUrl !== void 0 ? normalizeWatchaFlixBaseUrl(partial.watchaflixBaseUrl) : current.watchaflixBaseUrl;
    const nextWatchaflixLang = partial.watchaflixLang !== void 0 ? validateWatchaFlixLang(partial.watchaflixLang, current.watchaflixLang) : current.watchaflixLang;
    const nextMovieTpl = partial.customEmbedMovieTemplate !== void 0 ? sanitizeEmbedTemplate(partial.customEmbedMovieTemplate) : current.customEmbedMovieTemplate;
    const nextTvTpl = partial.customEmbedTvTemplate !== void 0 ? sanitizeEmbedTemplate(partial.customEmbedTvTemplate) : current.customEmbedTvTemplate;
    const nextCustomSources = partial.customSources !== void 0 ? sanitizeCustomVideoSources(partial.customSources) : current.customSources ?? [];
    const nextTimeout = partial.embedTimeoutSeconds !== void 0 ? sanitizeEmbedTimeoutSeconds(partial.embedTimeoutSeconds, current.embedTimeoutSeconds) : current.embedTimeoutSeconds;
    const nextAspectMode = partial.defaultAspectMode !== void 0 ? validatePlayerAspectMode(partial.defaultAspectMode, current.defaultAspectMode) : current.defaultAspectMode;
    const nextAutoEnableSubtitles = typeof partial.autoEnableSubtitles === "boolean" ? partial.autoEnableSubtitles : current.autoEnableSubtitles;
    const nextSubtitleSize = partial.defaultSubtitleSize !== void 0 ? validateSubtitleSize(partial.defaultSubtitleSize, current.defaultSubtitleSize) : current.defaultSubtitleSize;
    const nextSubtitleColor = partial.defaultSubtitleColor !== void 0 ? validateSubtitleColor(partial.defaultSubtitleColor, current.defaultSubtitleColor) : current.defaultSubtitleColor;
    const nextSubtitleBg = partial.defaultSubtitleBg !== void 0 ? validateSubtitleBg(partial.defaultSubtitleBg, current.defaultSubtitleBg) : current.defaultSubtitleBg;
    const nextAllowTvCast = typeof partial.allowTvCast === "boolean" ? partial.allowTvCast : current.allowTvCast;
    const nextAllowPipMode = typeof partial.allowPipMode === "boolean" ? partial.allowPipMode : current.allowPipMode;
    const nextAllowTheaterMode = typeof partial.allowTheaterMode === "boolean" ? partial.allowTheaterMode : current.allowTheaterMode;
    const nextWatermarkEnabled = typeof partial.watermarkEnabled === "boolean" ? partial.watermarkEnabled : current.watermarkEnabled;
    const nextWatermarkText = partial.watermarkText !== void 0 ? sanitizeWatermarkText(partial.watermarkText) : current.watermarkText;
    const nextWatermarkLogoUrl = partial.watermarkLogoUrl !== void 0 ? sanitizeWatermarkLogoUrl(partial.watermarkLogoUrl) : current.watermarkLogoUrl;
    const nextWatermarkPosition = partial.watermarkPosition !== void 0 ? validateWatermarkPosition(partial.watermarkPosition, current.watermarkPosition) : current.watermarkPosition;
    const nextWatermarkOpacity = partial.watermarkOpacity !== void 0 ? sanitizeWatermarkOpacity(partial.watermarkOpacity, current.watermarkOpacity) : current.watermarkOpacity;
    const nextWatermarkSize = partial.watermarkSize !== void 0 ? validateWatermarkSize(partial.watermarkSize, current.watermarkSize) : current.watermarkSize;
    const nextAutoNextEpisode = typeof partial.autoNextEpisode === "boolean" ? partial.autoNextEpisode : current.autoNextEpisode;
    const nextAutoNextCountdown = partial.autoNextCountdownSeconds !== void 0 ? sanitizeAutoNextCountdownSeconds(
      partial.autoNextCountdownSeconds,
      current.autoNextCountdownSeconds
    ) : current.autoNextCountdownSeconds;
    const updatedAt = preserveUpdatedAt && partial.updatedAt ? partial.updatedAt : (/* @__PURE__ */ new Date()).toISOString();
    repositoryStore.savePlayerSettings({
      sourceMode: nextSourceMode,
      defaultDomain: nextDomain,
      fallbackDomain: nextFallback,
      autoFallback: nextAutoFallback,
      defaultPlayer: nextPlayer,
      defaultColorHex: nextColor,
      myembedBaseUrl: nextMyEmbedBaseUrl,
      antiAdSandbox: nextAntiAdSandbox,
      preferImdbForMovies: nextPreferImdb,
      watchaflixBaseUrl: nextWatchaflixBaseUrl,
      watchaflixLang: nextWatchaflixLang,
      customEmbedMovieTemplate: nextMovieTpl,
      customEmbedTvTemplate: nextTvTpl,
      customSources: nextCustomSources,
      embedTimeoutSeconds: nextTimeout,
      defaultAspectMode: nextAspectMode,
      autoEnableSubtitles: nextAutoEnableSubtitles,
      defaultSubtitleSize: nextSubtitleSize,
      defaultSubtitleColor: nextSubtitleColor,
      defaultSubtitleBg: nextSubtitleBg,
      allowTvCast: nextAllowTvCast,
      allowPipMode: nextAllowPipMode,
      allowTheaterMode: nextAllowTheaterMode,
      watermarkEnabled: nextWatermarkEnabled,
      watermarkText: nextWatermarkText,
      watermarkLogoUrl: nextWatermarkLogoUrl,
      watermarkPosition: nextWatermarkPosition,
      watermarkOpacity: nextWatermarkOpacity,
      watermarkSize: nextWatermarkSize,
      autoNextEpisode: nextAutoNextEpisode,
      autoNextCountdownSeconds: nextAutoNextCountdown,
      updatedAt
    });
    return this.getPersisted();
  }
};
var playerConfigStore = new PlayerConfigStore();

// server/services/CacheService.ts
var CacheServiceImpl = class {
  constructor() {
    this.store = /* @__PURE__ */ new Map();
  }
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }
  set(key, value, ttlMs = 5 * 60 * 1e3) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }
  clear(prefix) {
    if (!prefix) {
      const size = this.store.size;
      this.store.clear();
      return size;
    }
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }
  size() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
    return this.store.size;
  }
};
var CacheService = new CacheServiceImpl();

// server/services/MegaEmbedService.ts
var MegaEmbedServiceImpl = class {
  getEmbedPayload(params) {
    const validId = normalizeTmdbId(params.tmdbId);
    if (!validId) {
      throw new Error("Identificador TMDB inv\xE1lido.");
    }
    const cfg = playerConfigStore.getConfig();
    const domain = validateMegaEmbedDomain(params.domain, cfg.defaultDomain);
    const player = validateMegaEmbedPlayer(params.player, cfg.defaultPlayer);
    const colorHex = sanitizeHexColor(params.colorHex, cfg.defaultColorHex);
    const seasonNumber = params.mediaType === "tv" ? normalizeSeasonNumber(params.seasonNumber, 1) : void 0;
    const episodeNumber = params.mediaType === "tv" ? normalizeEpisodeNumber(params.episodeNumber, 1) : void 0;
    let embedUrl = null;
    let referrerPolicy = "strict-origin";
    if (cfg.sourceMode === "myembed") {
      embedUrl = buildMyEmbedUrl({
        tmdbId: validId,
        imdbId: params.imdbId,
        preferImdbForMovies: cfg.preferImdbForMovies,
        mediaType: params.mediaType,
        seasonNumber,
        episodeNumber,
        baseUrl: cfg.myembedBaseUrl
      });
      referrerPolicy = "strict-origin";
    } else if (cfg.sourceMode === "watchaflix") {
      embedUrl = buildWatchaFlixEmbedUrl({
        tmdbId: validId,
        mediaType: params.mediaType,
        seasonNumber,
        episodeNumber,
        baseUrl: cfg.watchaflixBaseUrl,
        colorHex,
        lang: cfg.watchaflixLang
      });
      referrerPolicy = "strict-origin";
    } else if (cfg.sourceMode === "custom_template") {
      const tpl = params.mediaType === "tv" ? cfg.customEmbedTvTemplate : cfg.customEmbedMovieTemplate;
      if (tpl) {
        embedUrl = buildCustomEmbedUrl({
          template: tpl,
          tmdbId: validId,
          imdbId: params.imdbId,
          mediaType: params.mediaType,
          seasonNumber,
          episodeNumber,
          player,
          colorHex
        });
        referrerPolicy = "strict-origin";
      }
    }
    if (!embedUrl) {
      if (cfg.sourceMode === "megaembed") {
        embedUrl = buildMegaEmbedUrl({
          tmdbId: validId,
          domain,
          player,
          colorHex,
          mediaType: params.mediaType,
          seasonNumber,
          episodeNumber
        });
        referrerPolicy = "no-referrer";
      } else {
        embedUrl = buildMyEmbedUrl({
          tmdbId: validId,
          imdbId: params.imdbId,
          preferImdbForMovies: cfg.preferImdbForMovies,
          mediaType: params.mediaType,
          seasonNumber,
          episodeNumber,
          baseUrl: cfg.myembedBaseUrl
        });
        referrerPolicy = "strict-origin";
      }
    }
    const streamKind = detectStreamKind(embedUrl);
    const sandboxPolicy = resolveSandboxPolicy({
      streamKind,
      antiAdSandbox: cfg.antiAdSandbox
    });
    return {
      tmdbId: validId,
      mediaType: params.mediaType,
      embedUrl,
      domain,
      player,
      colorHex,
      streamKind,
      sandboxPolicy,
      referrerPolicy,
      seasonNumber,
      episodeNumber,
      branding: extractPlayerBranding(cfg),
      ...params.mediaType === "tv" && !cfg.seriesSeasonEpisodeDocumented ? {
        seriesSupportNote: cfg.seriesLimitationNote
      } : {}
    };
  }
};
var MegaEmbedService = new MegaEmbedServiceImpl();

// server/services/SiteConfigService.ts
var SiteConfigServiceImpl = class {
  constructor() {
    this.lastHydratedAt = 0;
    this.hydrationTtlMs = 2500;
    this.hydrationPromise = null;
  }
  async ensureHydrated(force = false) {
    if (!force && Date.now() - this.lastHydratedAt < this.hydrationTtlMs) {
      return;
    }
    if (!force && this.hydrationPromise) {
      return this.hydrationPromise;
    }
    const run = (async () => {
      const [remoteSite, remoteCustomRes] = await Promise.all([
        FirestoreRestService.getDocument("siteConfig/global"),
        FirestoreRestService.queryActiveCollectionChecked("customCatalog")
      ]);
      if (remoteSite) {
        const local = repositoryStore.getSiteConfig();
        const localTs = Date.parse(local.updatedAt || DEFAULT_SITE_CONFIG.updatedAt) || 0;
        const remoteIso = toIsoTimestamp(remoteSite.updatedAt, "");
        const remoteTs = remoteIso ? Date.parse(remoteIso) : 0;
        const isLocalDefault = local.updatedAt === DEFAULT_SITE_CONFIG.updatedAt;
        const changedRemote = remoteIso && remoteIso !== local.updatedAt;
        if (isLocalDefault || localTs === 0 || changedRemote && remoteTs >= localTs) {
          const merged = sanitizeSiteConfig(remoteSite, local, true);
          repositoryStore.saveSiteConfig(merged);
        }
      }
      if (remoteCustomRes.ok) {
        let changed = false;
        const localList = repositoryStore.getCustomCatalog();
        const remoteIds = /* @__PURE__ */ new Set();
        for (const raw of remoteCustomRes.items) {
          try {
            if (!raw.title) continue;
            const existing = raw.id ? localList.find((c) => c.id === raw.id) : void 0;
            const sanitized = sanitizeCustomMediaInput(raw, existing);
            const remoteItemIso = toIsoTimestamp(raw.updatedAt, "");
            if (remoteItemIso) {
              sanitized.updatedAt = remoteItemIso;
            }
            remoteIds.add(sanitized.id);
            if (!existing || existing.updatedAt !== sanitized.updatedAt) {
              repositoryStore.upsertCustomMedia(sanitized);
              changed = true;
            }
          } catch {
          }
        }
        for (const localItem of localList) {
          if (!remoteIds.has(localItem.id)) {
            if (repositoryStore.deleteCustomMedia(localItem.id)) {
              changed = true;
            }
          }
        }
        if (changed) {
          CacheService.clear("catalog:");
        }
      }
      this.lastHydratedAt = Date.now();
    })().finally(() => {
      if (this.hydrationPromise === run) {
        this.hydrationPromise = null;
      }
    });
    this.hydrationPromise = run;
    return run;
  }
  getConfig() {
    return repositoryStore.getSiteConfig();
  }
  async getConfigAsync(force = false) {
    await this.ensureHydrated(force);
    return repositoryStore.getSiteConfig();
  }
  updateConfig(input) {
    const current = repositoryStore.getSiteConfig();
    const next = sanitizeSiteConfig(input, current, false);
    repositoryStore.saveSiteConfig(next);
    this.lastHydratedAt = Date.now();
    repositoryStore.addLog({
      level: "info",
      service: "SiteConfigService",
      message: `Configura\xE7\xF5es do site atualizadas pelo administrador (${next.siteName}).`
    });
    return next;
  }
  listCustomCatalog() {
    return repositoryStore.getCustomCatalog();
  }
  async listCustomCatalogAsync(force = false) {
    await this.ensureHydrated(force);
    return repositoryStore.getCustomCatalog();
  }
  getCustomMatch(tmdbId, mediaType) {
    return repositoryStore.getCustomCatalog().find((c) => c.active && c.tmdbId === tmdbId && c.mediaType === mediaType) ?? null;
  }
  async getCustomMatchAsync(tmdbId, mediaType) {
    await this.ensureHydrated();
    return this.getCustomMatch(tmdbId, mediaType);
  }
  upsertCustomMedia(input) {
    const existing = input.id ? repositoryStore.getCustomCatalog().find((c) => c.id === input.id) : void 0;
    const sanitized = sanitizeCustomMediaInput(input, existing);
    const saved = repositoryStore.upsertCustomMedia(sanitized);
    this.lastHydratedAt = Date.now();
    CacheService.clear("catalog:");
    repositoryStore.addLog({
      level: "info",
      service: "CatalogAdminService",
      message: `M\xEDdia personalizada salva: ${saved.title} (${saved.mediaType} #${saved.tmdbId}).`
    });
    return saved;
  }
  deleteCustomMedia(id) {
    const ok = repositoryStore.deleteCustomMedia(id);
    this.lastHydratedAt = Date.now();
    if (ok) {
      CacheService.clear("catalog:");
      repositoryStore.addLog({
        level: "warn",
        service: "CatalogAdminService",
        message: `M\xEDdia personalizada removida: ${id}.`
      });
    }
    return ok;
  }
};
var SiteConfigService = new SiteConfigServiceImpl();

// server/services/StreamResolverService.ts
import crypto from "node:crypto";
import { Readable } from "node:stream";

// shared/subtitleUtils.ts
var SUBTITLE_LANG_LABELS = {
  pob: "Portugu\xEAs (BR)",
  "pt-br": "Portugu\xEAs (BR)",
  por: "Portugu\xEAs (PT)",
  pt: "Portugu\xEAs",
  eng: "Ingl\xEAs",
  en: "Ingl\xEAs",
  spa: "Espanhol",
  es: "Espanhol",
  fre: "Franc\xEAs",
  fra: "Franc\xEAs",
  ger: "Alem\xE3o",
  deu: "Alem\xE3o",
  ita: "Italiano",
  jpn: "Japon\xEAs",
  kor: "Coreano"
};
function formatSubtitleLangLabel(lang) {
  const clean = (lang || "").trim().toLowerCase();
  return SUBTITLE_LANG_LABELS[clean] || (clean ? clean.toUpperCase() : "Outro");
}
function isAllowedSubtitleHost(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === "https:" && /^subs\d*\.strem\.io$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}
function parseVttTimestampToSeconds(raw) {
  const clean = raw.trim().replace(",", ".");
  const parts = clean.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  const secParts = parts[parts.length - 1].split(".");
  const secs = Number(secParts[0]);
  const ms = Number((secParts[1] || "0").padEnd(3, "0").slice(0, 3));
  const mins = Number(parts[parts.length - 2]);
  const hrs = parts.length === 3 ? Number(parts[0]) : 0;
  if ([hrs, mins, secs, ms].some((n) => !Number.isFinite(n) || n < 0)) {
    return null;
  }
  return hrs * 3600 + mins * 60 + secs + ms / 1e3;
}
function formatSecondsToVttTimestamp(totalSec) {
  const clamped = Math.max(0, totalSec);
  const hrs = Math.floor(clamped / 3600);
  const mins = Math.floor(clamped % 3600 / 60);
  const secs = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1e3);
  const adjustedSecs = ms >= 1e3 ? secs + 1 : secs;
  const adjustedMs = ms >= 1e3 ? 0 : ms;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(adjustedSecs).padStart(2, "0")}.${String(adjustedMs).padStart(3, "0")}`;
}
function decodeSubtitleBuffer(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder("windows-1252").decode(bytes);
    } catch {
      return new TextDecoder("utf-8").decode(bytes);
    }
  }
}
function convertSrtToVtt(rawText, offsetSeconds = 0) {
  const normalized = (rawText || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) {
    return "WEBVTT\n\n";
  }
  const timeLineRe = /^(\d{1,2}:)?\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*(\d{1,2}:)?\d{2}:\d{2}[,.]\d{1,3}(.*)$/;
  const lines = normalized.split("\n");
  const out = ["WEBVTT", ""];
  let i = 0;
  if (lines[0].toUpperCase().startsWith("WEBVTT")) {
    i = 1;
  }
  for (; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^\d+$/.test(trimmed) && i + 1 < lines.length && timeLineRe.test(lines[i + 1].trim())) {
      continue;
    }
    const match = trimmed.match(timeLineRe);
    if (match) {
      const [timesPart, ...restTokens] = trimmed.split(/\s+/);
      const arrowIdx = trimmed.indexOf("-->");
      const startRaw = trimmed.slice(0, arrowIdx).trim();
      const afterArrow = trimmed.slice(arrowIdx + 3).trim();
      const endMatch = afterArrow.match(/^((?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{1,3})(.*)$/);
      if (endMatch) {
        const startSec = parseVttTimestampToSeconds(startRaw);
        const endSec = parseVttTimestampToSeconds(endMatch[1]);
        const tailSettings = (endMatch[2] || "").trim();
        if (startSec !== null && endSec !== null) {
          const shiftedStart = formatSecondsToVttTimestamp(startSec + offsetSeconds);
          const shiftedEnd = formatSecondsToVttTimestamp(Math.max(startSec + offsetSeconds + 0.1, endSec + offsetSeconds));
          out.push(
            tailSettings ? `${shiftedStart} --> ${shiftedEnd} ${tailSettings}` : `${shiftedStart} --> ${shiftedEnd}`
          );
          continue;
        }
      }
      void timesPart;
      void restTokens;
    }
    const cleanedLine = line.replace(/\{\\[^}]+\}/g, "").replace(/<\/?font[^>]*>/gi, "");
    out.push(cleanedLine);
  }
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trim()}
`;
}
function buildHlsProxyPlaylist(manifestText, upstreamUrl, proxyBasePrefix, signUrl) {
  const toProxyUrl = (rawRef) => {
    const trimmed = rawRef.trim();
    if (!trimmed) return trimmed;
    const resolved = new URL(trimmed, upstreamUrl).toString();
    const sigParam = signUrl ? `&s=${encodeURIComponent(signUrl(resolved))}` : "";
    return `${proxyBasePrefix}?u=${encodeURIComponent(resolved)}${sigParam}`;
  };
  return (manifestText || "").replace(/\r\n/g, "\n").split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith("#")) {
      return line.replace(/URI="([^"]+)"/g, (_full, uri) => `URI="${toProxyUrl(uri)}"`);
    }
    return toProxyUrl(trimmed);
  }).join("\n");
}
function isSafePublicHost(hostname) {
  const host = (hostname || "").trim().toLowerCase().replace(/\.$/, "");
  if (!host || host.length > 253) return false;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost") || host === "metadata.google.internal") {
    return false;
  }
  if (host.includes(":") || host.startsWith("[")) {
    return false;
  }
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a >= 224) return false;
  }
  return host.includes(".");
}
function extractPlaylistHosts(manifestText, upstreamUrl) {
  const hosts = /* @__PURE__ */ new Set();
  const collectRef = (rawRef) => {
    const trimmed = rawRef.trim();
    if (!trimmed) return;
    try {
      const parsed = new URL(trimmed, upstreamUrl);
      if (parsed.protocol === "https:") {
        hosts.add(parsed.hostname.toLowerCase());
      }
    } catch {
    }
  };
  for (const rawLine of (manifestText || "").replace(/\r\n/g, "\n").split("\n")) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) {
      for (const match of trimmed.matchAll(/URI="([^"]+)"/g)) {
        if (match[1]) collectRef(match[1]);
      }
    } else {
      collectRef(trimmed);
    }
  }
  return Array.from(hosts);
}
function resolveSegmentMimeType(targetUrl, upstreamContentType) {
  const cleanPath = (targetUrl || "").split("?")[0].split("#")[0].toLowerCase();
  if (cleanPath.endsWith(".mp4") || cleanPath.endsWith(".m4s") || cleanPath.endsWith(".m4v")) {
    return "video/mp4";
  }
  if (cleanPath.endsWith(".webm")) {
    return "video/webm";
  }
  if (cleanPath.endsWith(".mov")) {
    return "video/quicktime";
  }
  if (cleanPath.endsWith(".ogg") || cleanPath.endsWith(".ogv")) {
    return "video/ogg";
  }
  if (cleanPath.endsWith(".ts")) {
    return "video/mp2t";
  }
  const normalizedUpstream = (upstreamContentType || "").split(";")[0].trim().toLowerCase();
  if (normalizedUpstream.startsWith("video/")) {
    return normalizedUpstream;
  }
  return "application/octet-stream";
}
function detectMediaKindFromBytesOrHeaders(params) {
  const ct = (params.contentType || "").split(";")[0].trim().toLowerCase();
  const disp = (params.contentDisposition || "").toLowerCase();
  const bytes = params.sniffBytes;
  if (bytes && bytes.length >= 4) {
    const textSample = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, Math.min(bytes.length, 512))).replace(/^\uFEFF/, "").trimStart();
    if (/^#EXTM3U\b/i.test(textSample)) {
      return "hls";
    }
    if (bytes.length >= 8 && bytes[4] === 102 && bytes[5] === 116 && bytes[6] === 121 && bytes[7] === 112) {
      return "video";
    }
    if (bytes[0] === 26 && bytes[1] === 69 && bytes[2] === 223 && bytes[3] === 163) {
      return "video";
    }
    if (bytes[0] === 79 && bytes[1] === 103 && bytes[2] === 103 && bytes[3] === 83) {
      return "video";
    }
    if (/^<(?:!doctype|html|head|body|script)\b/i.test(textSample)) {
      return null;
    }
  }
  if (ct.includes("mpegurl") || ct === "application/x-mpegurl" || ct === "audio/mpegurl") {
    return "hls";
  }
  if (ct.startsWith("video/")) {
    return "video";
  }
  if (/filename\*?=(?:UTF-8'')?["']?[^"';\s]+\.m3u8(?:["';\s]|$)/i.test(disp)) {
    return "hls";
  }
  if (/filename\*?=(?:UTF-8'')?["']?[^"';\s]+\.(?:mp4|webm|ogg|ogv|mov|m4v)(?:["';\s]|$)/i.test(
    disp
  )) {
    return "video";
  }
  try {
    const parsed = new URL(params.url);
    const cleanPath = parsed.pathname.toLowerCase();
    if (cleanPath.endsWith(".m3u8") || /format=m3u8|type=hls/i.test(parsed.search)) {
      return "hls";
    }
    if (/\.(?:mp4|webm|ogg|ogv|mov|m4v)$/i.test(cleanPath)) {
      return "video";
    }
  } catch {
    const clean = (params.url || "").split("#")[0].split("?")[0].toLowerCase();
    if (clean.endsWith(".m3u8")) return "hls";
    if (/\.(?:mp4|webm|ogg|ogv|mov|m4v)$/i.test(clean)) return "video";
  }
  return null;
}
function extractEmbedPlayerHash(embedUrl) {
  try {
    const parsed = new URL((embedUrl || "").trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (!/^([a-z0-9-]+\.)?embedplayer\d*\.xyz$/i.test(parsed.hostname)) {
      return null;
    }
    const match = parsed.pathname.match(/\/video\/([a-z0-9_-]{8,128})/i);
    if (!match || !match[1]) return null;
    return {
      origin: parsed.origin,
      hash: match[1]
    };
  } catch {
    return null;
  }
}
function isCloudflareChallengeHtml(body, statusCode) {
  const sample = (body || "").slice(0, 12e3);
  if (/challenges\.cloudflare\.com|cf-turnstile|window\._cf_chl_opt|cf-challenge-running/i.test(sample) || /<title>\s*(?:Just a moment|Attention Required!?\s*\|\s*Cloudflare)/i.test(sample)) {
    return true;
  }
  if ((statusCode === 403 || statusCode === 429 || statusCode === 503) && (/cloudflare/i.test(sample) || /\/cdn-cgi\/challenge-platform\//i.test(sample))) {
    return true;
  }
  return false;
}
var AD_OR_TRACKER_HOST_RE = /(?:^|\.)(mypopads|bataraanimals|sinonneurism|waust\.at|doubleclick\.net|googlesyndication|googletagmanager|google-analytics|popads\.net|popcash|exoclick|juicyads|adsterra|propellerads|yandex\.ru)\b/i;
function isAdOrTrackerHost(hostname) {
  return AD_OR_TRACKER_HOST_RE.test((hostname || "").trim().toLowerCase());
}
function classifyPlayableMediaUrl(rawCandidate, baseUrl, allowOpaqueStreamKey = false) {
  const unescaped = (rawCandidate || "").replace(/\\\//g, "/").replace(/&amp;/g, "&").trim();
  if (!unescaped || unescaped.startsWith("data:") || unescaped.startsWith("javascript:")) {
    return null;
  }
  try {
    const resolved = new URL(unescaped, baseUrl);
    if (resolved.protocol !== "https:" && resolved.protocol !== "http:") return null;
    if (!isSafePublicHost(resolved.hostname) || isAdOrTrackerHost(resolved.hostname)) return null;
    const cleanPath = resolved.pathname.toLowerCase();
    if (/\.(?:jpg|jpeg|png|gif|webp|svg|ico|css|woff2?|ttf|srt|vtt)$/i.test(cleanPath) || cleanPath.endsWith(".js") && !resolved.search.includes(".m3u8")) {
      return null;
    }
    if (cleanPath.endsWith(".m3u8") || /format=m3u8|type=hls/i.test(resolved.search)) {
      return { streamUrl: resolved.toString(), streamKind: "hls" };
    }
    if (/\.(?:mp4|webm|ogg|ogv|mov|m4v)$/i.test(cleanPath)) {
      return { streamUrl: resolved.toString(), streamKind: "video" };
    }
    if (allowOpaqueStreamKey && !/\.(?:html?|php|asp|aspx|jsp)$/i.test(cleanPath)) {
      return { streamUrl: resolved.toString(), streamKind: "hls" };
    }
    return null;
  } catch {
    return null;
  }
}
function normalizeExtractedLangHint(raw) {
  if (typeof raw !== "string") return void 0;
  const s = raw.trim().toLowerCase();
  if (!s) return void 0;
  if (/(?:legend|pt-sub|\bsub\b|\bleg\b)/i.test(s)) return "sub";
  if (/(?:dublad|portugu|\bpt-br\b|\bpt\b|\bpor\b|\bpob\b|\bdub\b)/i.test(s)) return "pt";
  if (/(?:ingl[eê]s|english|\ben-us\b|\ben\b|\beng\b|\boriginal\b)/i.test(s)) return "en";
  if (/(?:espan|spanish|\bes-es\b|\bes\b|\bspa\b|latino|castellano)/i.test(s)) return "es";
  if (/(?:fran[cç]|french|\bfr\b|\bfre\b|\bfra\b)/i.test(s)) return "fr";
  if (/(?:alem[aã]|german|\bde\b|\bger\b|\bdeu\b)/i.test(s)) return "de";
  if (/(?:italian|\bit\b|\bita\b)/i.test(s)) return "it";
  if (/(?:japon|japanese|\bja\b|\bjpn\b)/i.test(s)) return "ja";
  if (/(?:corean|korean|\bko\b|\bkor\b)/i.test(s)) return "ko";
  if (/(?:\bhindi\b|\bhi\b|\bhin\b)/i.test(s)) return "hi";
  return void 0;
}
function extractPlayableStreamsFromBody(body, baseUrl) {
  const raw = (body || "").trim();
  if (!raw) return [];
  const results = [];
  const seenUrls = /* @__PURE__ */ new Set();
  const pushUnique = (item) => {
    if (!item.streamUrl || seenUrls.has(item.streamUrl)) return;
    seenUrls.add(item.streamUrl);
    results.push(item);
  };
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      const visit = (node, depth = 0, inheritedPoster = null) => {
        if (!node || depth > 5 || results.length >= 12) return;
        if (Array.isArray(node)) {
          for (const item of node) {
            visit(item, depth + 1, inheritedPoster);
          }
          return;
        }
        if (typeof node === "object") {
          const obj = node;
          const posterRaw = typeof obj.poster === "string" ? obj.poster : typeof obj.videoImage === "string" ? obj.videoImage : typeof obj.bgImage === "string" ? obj.bgImage : inheritedPoster;
          const itemLangHint = normalizeExtractedLangHint(obj.lang) || normalizeExtractedLangHint(obj.language) || normalizeExtractedLangHint(obj.idioma) || normalizeExtractedLangHint(obj.audio) || normalizeExtractedLangHint(obj.label) || normalizeExtractedLangHint(obj.title) || normalizeExtractedLangHint(obj.name);
          const explicitKeys = [
            "securedLink",
            "videoSource",
            "streamUrl",
            "hlsUrl",
            "hls",
            "mp4",
            "file",
            "url",
            "src"
          ];
          for (const key of explicitKeys) {
            const val = obj[key];
            if (typeof val === "string") {
              const strictOpaque = key === "securedLink" || key === "videoSource" || key === "streamUrl" || key === "hlsUrl" || key === "url" && (obj.type === "hls" || obj.type === "mp4" || obj.type === "video" || obj.hls === true);
              const classified = classifyPlayableMediaUrl(val, baseUrl, strictOpaque);
              if (classified) {
                const isExplicitMp4 = key === "mp4" || obj.type === "mp4" || obj.type === "video" || classified.streamKind === "video";
                pushUnique({
                  streamUrl: classified.streamUrl,
                  streamKind: isExplicitMp4 && obj.hls !== true && obj.type !== "hls" ? "video" : "hls",
                  posterUrl: posterRaw,
                  ...itemLangHint ? { detectedLang: itemLangHint } : {}
                });
                break;
              }
            }
          }
          for (const nestedKey of [
            "sources",
            "streams",
            "files",
            "playlist",
            "links",
            "servers",
            "data",
            "result",
            "stream"
          ]) {
            if (nestedKey in obj) {
              visit(obj[nestedKey], depth + 1, posterRaw);
            }
          }
        }
      };
      visit(parsed);
      if (results.length > 0) return results;
    } catch {
    }
  }
  const normalizedHtml = raw.replace(/\\\//g, "/");
  const posterMatch = normalizedHtml.match(/data-poster=["']([^"']+)["']/i) || normalizedHtml.match(/poster\s*[:=]\s*["']([^"']+)["']/i);
  const posterUrl = posterMatch?.[1]?.trim() || null;
  for (const tagMatch of normalizedHtml.matchAll(/<source\b([^>]+)>/gi)) {
    const attrs = tagMatch[1] || "";
    const src = attrs.match(/src=["']([^"']+)["']/i)?.[1];
    if (!src) continue;
    const classified = classifyPlayableMediaUrl(src, baseUrl, false);
    if (!classified) continue;
    const labelHint = normalizeExtractedLangHint(attrs.match(/(?:label|title|data-lang|srclang)=["']([^"']+)["']/i)?.[1]);
    pushUnique({
      ...classified,
      posterUrl,
      ...labelHint ? { detectedLang: labelHint } : {}
    });
  }
  const patterns = [
    { regex: /hls\.loadSource\(\s*["']([^"']+)["']\s*\)/gi, allowOpaque: true },
    { regex: /(?:securedLink|videoSource|streamUrl|hlsUrl)\s*[:=]\s*["']([^"']+)["']/gi, allowOpaque: true },
    { regex: /(?:file|url|src|source)\s*:\s*["']([^"']+\.(?:m3u8|mp4|webm|mov|m4v)(?:\?[^"']*)?)["']/gi, allowOpaque: false },
    { regex: /<video[^>]+src=["']([^"']+)["']/gi, allowOpaque: false },
    { regex: /https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mp4|m4v|webm)(?:\?[^\s"'<>\\]*)?/gi, allowOpaque: false }
  ];
  for (const { regex, allowOpaque } of patterns) {
    for (const match of normalizedHtml.matchAll(regex)) {
      const candidate = match[1] || match[0];
      const classified = classifyPlayableMediaUrl(candidate, baseUrl, allowOpaque);
      if (classified) {
        pushUnique({
          ...classified,
          posterUrl
        });
        if (results.length >= 8) break;
      }
    }
    if (results.length >= 8) break;
  }
  return results;
}
function extractNestedEmbedUrls(html, baseUrl) {
  const normalized = (html || "").replace(/\\\//g, "/");
  const urls = [];
  const seen = /* @__PURE__ */ new Set();
  const pushCandidate = (raw) => {
    const clean = (raw || "").trim();
    if (!clean || clean === "about:blank" || clean.startsWith("javascript:")) return;
    try {
      const resolved = new URL(clean, baseUrl);
      if (resolved.protocol !== "https:" && resolved.protocol !== "http:") return;
      if (!isSafePublicHost(resolved.hostname) || isAdOrTrackerHost(resolved.hostname)) return;
      if (/\.(?:css|js|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|json)(?:$|\?)/i.test(resolved.pathname)) {
        return;
      }
      const finalStr = resolved.toString();
      if (!seen.has(finalStr)) {
        seen.add(finalStr);
        urls.push(finalStr);
      }
    } catch {
    }
  };
  for (const match of normalized.matchAll(/<iframe[^>]+(?:src|data-src)=["']([^"']+)["']/gi)) {
    pushCandidate(match[1]);
  }
  for (const match of normalized.matchAll(/(?:data-embed|data-url|data-player)=["'](https?:\/\/[^"']+)["']/gi)) {
    pushCandidate(match[1]);
  }
  for (const match of normalized.matchAll(/\b(?:go|loadPlayer|setEmbed|changeServer)\(\s*["'](https?:\/\/[^"']+)["']/gi)) {
    pushCandidate(match[1]);
  }
  return urls;
}
function hasAdOrAntiSandboxTraps(html) {
  const sample = (html || "").slice(0, 8e4);
  return /frameElement\.hasAttribute\(\s*["']sandbox["']\s*\)|\/asb\.html\b|cst-captcha|jw-gate-cst/i.test(
    sample
  ) || /mypopads\.com|popads\.net|popcash|exoclick|adsterra|waust\.at\/d\.js/i.test(sample);
}
function parsePlayerFlixStyleUrl(urlStr) {
  try {
    const parsed = new URL((urlStr || "").trim());
    const host = parsed.hostname.toLowerCase();
    if (!/^(?:[a-z0-9-]+\.)?(?:myembed\.biz|playerflix\.ink|embedmovies\.org)$/i.test(host)) {
      return null;
    }
    const tvMatch = parsed.pathname.match(
      /^\/(?:serie|tv|tvshow)\/(\d+|tt\d+)\/(\d+)\/(\d+)/i
    );
    if (tvMatch) {
      return {
        origin: host.includes("playerflix.ink") ? parsed.origin : "https://playerflix.ink",
        mediaType: "tv",
        id: tvMatch[1],
        season: Number(tvMatch[2]) || 1,
        episode: Number(tvMatch[3]) || 1
      };
    }
    const movieMatch = parsed.pathname.match(/^\/(?:filme|movie)\/(\d+|tt\d+)/i);
    if (movieMatch) {
      return {
        origin: host.includes("playerflix.ink") ? parsed.origin : "https://playerflix.ink",
        mediaType: "movie",
        id: movieMatch[1],
        season: null,
        episode: null
      };
    }
    return null;
  } catch {
    return null;
  }
}
function extractBalancedJsonAfterVarQ(html) {
  const match = /\bvar\s+Q\s*=\s*\{/.exec(html);
  if (!match) return null;
  const start = match.index + match[0].length - 1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  const limit = Math.min(html.length, start + 12e4);
  for (let i = start; i < limit; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return html.slice(start, i + 1);
      }
    }
  }
  return null;
}
function parseBuzzQPayload(html, pageUrl) {
  if (!html || !pageUrl) return null;
  let parsedUrl;
  try {
    parsedUrl = new URL(pageUrl);
  } catch {
    return null;
  }
  const rawJson = extractBalancedJsonAfterVarQ(html);
  if (!rawJson) return null;
  let qObj;
  try {
    qObj = JSON.parse(rawJson);
  } catch {
    return null;
  }
  const token = typeof qObj.t === "string" ? qObj.t.trim() : "";
  const rawServers = Array.isArray(qObj.ssr?.servers) ? qObj.ssr.servers : [];
  if (!token || rawServers.length === 0) return null;
  const servers = [];
  for (const s of rawServers) {
    if (!s || typeof s.ref !== "string" || !s.ref.trim()) continue;
    servers.push({
      ref: s.ref.trim(),
      name: typeof s.name === "string" ? s.name.trim() : "",
      lang: typeof s.lang === "string" && s.lang.trim() ? s.lang.trim() : null
    });
  }
  if (servers.length === 0) return null;
  const baseHrefMatch = html.match(/<base[^>]+href=["']([^"']+)["']/i);
  let resolvedBaseUrl = `${parsedUrl.origin}/`;
  if (baseHrefMatch?.[1]) {
    try {
      resolvedBaseUrl = new URL(baseHrefMatch[1].trim(), parsedUrl.origin).toString();
    } catch {
      resolvedBaseUrl = `${parsedUrl.origin}/`;
    }
  }
  const candidates = [];
  const pushBase = (urlCandidate) => {
    try {
      const u = new URL(urlCandidate, resolvedBaseUrl).toString();
      if (!candidates.includes(u)) {
        candidates.push(u);
      }
    } catch {
    }
  };
  const usesPlPrefix = /pl\/api\.php/i.test(html) || /vidsrc\.buzz/i.test(parsedUrl.hostname);
  if (usesPlPrefix) {
    pushBase(`${parsedUrl.origin}/pl/api.php`);
    pushBase(new URL("api.php", resolvedBaseUrl).toString());
    pushBase(`${parsedUrl.origin}/api.php`);
  } else {
    pushBase(new URL("api.php", resolvedBaseUrl).toString());
    pushBase(`${parsedUrl.origin}/api.php`);
    pushBase(`${parsedUrl.origin}/pl/api.php`);
  }
  return {
    token,
    playApiBases: candidates,
    servers
  };
}

// server/utils/proxyToken.ts
import { createHmac, timingSafeEqual } from "node:crypto";
var cachedSecret = null;
function resolveSecret() {
  if (cachedSecret) return cachedSecret;
  const envSecret = process.env.STREAM_TOKEN_SECRET?.trim() || process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    cachedSecret = envSecret;
    return cachedSecret;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || process.env.VITE_FIREBASE_PROJECT_ID?.trim() || "gen-lang-client-0094430568";
  const apiKey = process.env.FIREBASE_API_KEY?.trim() || process.env.VITE_FIREBASE_API_KEY?.trim() || "megastream-stateless-proxy-key";
  cachedSecret = `ms-v1:${projectId}:${apiKey}`;
  return cachedSecret;
}
function toBase64Url(input) {
  return Buffer.from(input).toString("base64url");
}
function fromBase64Url(input) {
  return Buffer.from(input, "base64url");
}
function hmacSign(data, secret = resolveSecret()) {
  return createHmac("sha256", secret).update(data).digest("base64url");
}
function safeEqualStrings(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
function signStreamSessionToken(payload, ttlSeconds = 6 * 3600, secretOverride) {
  const compact = {
    u: payload.u,
    ...payload.r ? { r: payload.r } : {},
    ...payload.o ? { o: payload.o } : {},
    sr: payload.sr,
    k: payload.k,
    exp: Math.floor(Date.now() / 1e3) + Math.max(60, ttlSeconds)
  };
  const body = toBase64Url(JSON.stringify(compact));
  const sig = hmacSign(`st:${body}`, secretOverride);
  return `v1.${body}.${sig}`;
}
function verifyStreamSessionToken(token, secretOverride) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, body, sig] = parts;
  if (!body || !sig) return null;
  const expectedSig = hmacSign(`st:${body}`, secretOverride);
  if (!safeEqualStrings(sig, expectedSig)) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(body).toString("utf8"));
    if (!parsed || typeof parsed.u !== "string" || typeof parsed.exp !== "number") {
      return null;
    }
    if (parsed.exp < Math.floor(Date.now() / 1e3)) {
      return null;
    }
    if (parsed.k !== "hls" && parsed.k !== "video" && parsed.k !== "iframe") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
function signSubtitleToken(payload, ttlSeconds = 12 * 3600, secretOverride) {
  const compact = {
    u: payload.u,
    l: payload.l,
    ...payload.e ? { e: payload.e } : {},
    exp: Math.floor(Date.now() / 1e3) + Math.max(60, ttlSeconds)
  };
  const body = toBase64Url(JSON.stringify(compact));
  const sig = hmacSign(`sub:${body}`, secretOverride);
  return `sv1.${body}.${sig}`;
}
function verifySubtitleToken(token, secretOverride) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "sv1") return null;
  const [, body, sig] = parts;
  if (!body || !sig) return null;
  const expectedSig = hmacSign(`sub:${body}`, secretOverride);
  if (!safeEqualStrings(sig, expectedSig)) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(body).toString("utf8"));
    if (!parsed || typeof parsed.u !== "string" || typeof parsed.exp !== "number") {
      return null;
    }
    if (parsed.exp < Math.floor(Date.now() / 1e3)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
function signSegmentUrl(sessionToken, segmentUrl, secretOverride) {
  return hmacSign(`seg:${sessionToken}:${segmentUrl}`, secretOverride).slice(0, 24);
}
function verifySegmentUrl(sessionToken, segmentUrl, providedSig, secretOverride) {
  if (!sessionToken || !segmentUrl || !providedSig) return false;
  const expected = signSegmentUrl(sessionToken, segmentUrl, secretOverride);
  return safeEqualStrings(providedSig, expected);
}

// server/services/StreamResolverService.ts
var DESKTOP_CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
var StreamResolverServiceImpl = class {
  constructor() {
    this.hlsSessions = /* @__PURE__ */ new Map();
    this.subtitleRegistry = /* @__PURE__ */ new Map();
    this.streamCache = /* @__PURE__ */ new Map();
    this.subtitleCache = /* @__PURE__ */ new Map();
  }
  clearCache() {
    this.streamCache.clear();
  }
  registerHlsSession(params) {
    const parsed = new URL(params.upstreamUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:" || !isSafePublicHost(parsed.hostname)) {
      throw new Error("Origem de stream n\xE3o permitida.");
    }
    const streamKind = params.streamKind === "video" ? "video" : "hls";
    const sendReferer = params.sendReferer !== false;
    const token = signStreamSessionToken({
      u: params.upstreamUrl,
      r: params.referer || void 0,
      o: params.origin || void 0,
      sr: sendReferer,
      k: streamKind
    });
    if (this.hlsSessions.size > 400) {
      const oldestKey = this.hlsSessions.keys().next().value;
      if (oldestKey) this.hlsSessions.delete(oldestKey);
    }
    const primaryHost = parsed.hostname.toLowerCase();
    this.hlsSessions.set(token, {
      id: token,
      upstreamUrl: params.upstreamUrl,
      allowedHost: primaryHost,
      allowedHosts: /* @__PURE__ */ new Set([primaryHost]),
      referer: params.referer,
      origin: params.origin,
      sendReferer,
      streamKind,
      userAgent: DESKTOP_CHROME_UA,
      createdAt: Date.now()
    });
    return token;
  }
  resolveHlsSession(token) {
    const cached = this.hlsSessions.get(token);
    if (cached) return cached;
    const decoded = verifyStreamSessionToken(token);
    if (!decoded) return null;
    let primaryHost = "";
    try {
      const parsed = new URL(decoded.u);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:" || !isSafePublicHost(parsed.hostname)) {
        return null;
      }
      primaryHost = parsed.hostname.toLowerCase();
    } catch {
      return null;
    }
    const session = {
      id: token,
      upstreamUrl: decoded.u,
      allowedHost: primaryHost,
      allowedHosts: /* @__PURE__ */ new Set([primaryHost]),
      referer: decoded.r || "",
      origin: decoded.o || "",
      sendReferer: decoded.sr,
      streamKind: decoded.k === "video" ? "video" : "hls",
      userAgent: DESKTOP_CHROME_UA,
      createdAt: Date.now()
    };
    if (this.hlsSessions.size > 400) {
      const oldestKey = this.hlsSessions.keys().next().value;
      if (oldestKey) this.hlsSessions.delete(oldestKey);
    }
    this.hlsSessions.set(token, session);
    return session;
  }
  buildProxyPlaybackUrl(sessionId, streamKind) {
    return streamKind === "video" ? `/api/player/video/${sessionId}` : `/api/player/hls/${sessionId}/playlist.m3u8`;
  }
  async readHeadBytes(res, maxBytes = 65536) {
    if (!res.body) return new Uint8Array(0);
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (total < maxBytes) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        const remaining = maxBytes - total;
        const slice = value.length > remaining ? value.subarray(0, remaining) : value;
        chunks.push(slice);
        total += slice.length;
        if (total >= maxBytes) break;
      }
    } catch {
    } finally {
      reader.cancel().catch(() => {
      });
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  }
  registerSubtitleEntry(entry) {
    const token = signSubtitleToken({
      u: entry.url,
      l: entry.lang,
      e: entry.encoding
    });
    if (!this.subtitleRegistry.has(token)) {
      if (this.subtitleRegistry.size > 800) {
        const oldestKey = this.subtitleRegistry.keys().next().value;
        if (oldestKey) this.subtitleRegistry.delete(oldestKey);
      }
      this.subtitleRegistry.set(token, {
        id: token,
        url: entry.url,
        lang: entry.lang,
        encoding: entry.encoding,
        createdAt: Date.now()
      });
    }
    return token;
  }
  resolveSubtitleEntry(subId) {
    const cached = this.subtitleRegistry.get(subId);
    if (cached) return cached;
    const verified = verifySubtitleToken(subId);
    if (!verified) return null;
    const entry = {
      id: subId,
      url: verified.u,
      lang: verified.l,
      encoding: verified.e,
      createdAt: Date.now()
    };
    this.subtitleRegistry.set(subId, entry);
    return entry;
  }
  async probeDirectMediaUrl(params) {
    let parsed;
    try {
      parsed = new URL(params.url);
    } catch {
      return { ok: false, kind: params.expectedKind, sendReferer: true };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:" || !isSafePublicHost(parsed.hostname) || isAdOrTrackerHost(parsed.hostname)) {
      return { ok: false, kind: params.expectedKind, sendReferer: true };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5e3);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener("abort", onParentAbort, { once: true });
    const runAttempt = async (withReferer) => {
      const headers = {
        "User-Agent": DESKTOP_CHROME_UA,
        Range: "bytes=0-65535"
      };
      if (withReferer && params.referer) {
        headers.Referer = params.referer;
        if (params.origin) headers.Origin = params.origin;
      }
      return fetch(params.url, {
        redirect: "follow",
        signal: controller.signal,
        headers
      });
    };
    try {
      let sendReferer = Boolean(params.referer);
      let res = await runAttempt(sendReferer);
      if ((res.status === 401 || res.status === 403) && sendReferer) {
        const errBytes = await this.readHeadBytes(res, 16384);
        const errSample = new TextDecoder("utf-8", { fatal: false }).decode(errBytes);
        if (isCloudflareChallengeHtml(errSample, res.status)) {
          return {
            ok: false,
            kind: params.expectedKind,
            sendReferer,
            cloudflareBlocked: true
          };
        }
        sendReferer = false;
        res = await runAttempt(false);
      }
      if (!res.ok && res.status !== 206) {
        const errBytes = await this.readHeadBytes(res, 16384);
        const errSample = new TextDecoder("utf-8", { fatal: false }).decode(errBytes);
        return {
          ok: false,
          kind: params.expectedKind,
          sendReferer,
          cloudflareBlocked: isCloudflareChallengeHtml(errSample, res.status)
        };
      }
      const finalUrl = res.url || params.url;
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      const disp = res.headers.get("content-disposition");
      const headBytes = await this.readHeadBytes(res, 65536);
      if (ct.includes("text/html")) {
        const htmlSample = new TextDecoder("utf-8", { fatal: false }).decode(headBytes);
        if (isCloudflareChallengeHtml(htmlSample, res.status)) {
          return {
            ok: false,
            kind: params.expectedKind,
            finalUrl,
            sendReferer,
            cloudflareBlocked: true
          };
        }
        if (/^\s*#EXTM3U/i.test(htmlSample)) {
          return { ok: true, kind: "hls", finalUrl, sendReferer };
        }
        return { ok: false, kind: params.expectedKind, finalUrl, sendReferer };
      }
      const detected = detectMediaKindFromBytesOrHeaders({
        url: finalUrl,
        contentType: ct,
        contentDisposition: disp,
        sniffBytes: headBytes
      });
      if (detected) {
        return { ok: true, kind: detected, finalUrl, sendReferer };
      }
      if (params.expectedKind === "video" && (!ct || ct.includes("octet-stream")) && headBytes.length > 0) {
        return { ok: true, kind: "video", finalUrl, sendReferer };
      }
      return { ok: false, kind: params.expectedKind, finalUrl, sendReferer };
    } catch {
      return { ok: false, kind: params.expectedKind, sendReferer: false };
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener("abort", onParentAbort);
    }
  }
  async extractWatchPlayStream(embedUrl, signal) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    const onParentAbort = () => controller.abort();
    signal?.addEventListener("abort", onParentAbort, { once: true });
    try {
      const res = await fetch(embedUrl, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": DESKTOP_CHROME_UA,
          Referer: "https://playerflix.ink/"
        }
      });
      if (!res.ok) return null;
      const finalUrl = res.url || embedUrl;
      const finalOrigin = new URL(finalUrl).origin;
      const html = await res.text();
      if (isCloudflareChallengeHtml(html, res.status)) return null;
      const urlMatch = html.match(/url\s*:\s*["']([^"']+)["']/);
      let rawStreamUrl = urlMatch?.[1]?.replace(/\\\//g, "/").trim() || "";
      let fallbackPoster = null;
      let fallbackKind = null;
      if (!rawStreamUrl || !/^https?:\/\//i.test(rawStreamUrl)) {
        const fallback = extractPlayableStreamsFromBody(html, finalUrl)[0];
        if (!fallback) return null;
        rawStreamUrl = fallback.streamUrl;
        fallbackPoster = fallback.posterUrl;
        fallbackKind = fallback.streamKind;
      }
      const isMp4 = fallbackKind === "video" || /\.(?:mp4|webm|mov|m4v)(?:$|[?#])/i.test(rawStreamUrl);
      const probe = await this.probeDirectMediaUrl({
        url: rawStreamUrl,
        referer: finalUrl,
        origin: finalOrigin,
        expectedKind: isMp4 ? "video" : "hls",
        signal: controller.signal
      });
      if (!probe.ok) {
        return null;
      }
      const audioMatch = html.match(/MyPlayerAudio\s*=\s*["']([^"']+)["']/);
      const posterMatch = html.match(/data-poster=["']([^"']+)["']/);
      return {
        streamUrl: probe.finalUrl || rawStreamUrl,
        streamKind: probe.kind,
        audioLabel: audioMatch?.[1]?.trim() || "Dublado",
        posterUrl: posterMatch?.[1]?.trim() || fallbackPoster,
        referer: probe.sendReferer ? finalUrl : "",
        origin: probe.sendReferer ? finalOrigin : "",
        sendReferer: probe.sendReferer,
        sourceKind: "watchplay"
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onParentAbort);
    }
  }
  async extractEmbedPlayerStream(embedUrl, langHint, signal) {
    const parsed = extractEmbedPlayerHash(embedUrl);
    if (!parsed) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    const onParentAbort = () => controller.abort();
    signal?.addEventListener("abort", onParentAbort, { once: true });
    try {
      const endpoint = `${parsed.origin}/player/index.php?data=${encodeURIComponent(parsed.hash)}&do=getVideo`;
      const body = `hash=${encodeURIComponent(parsed.hash)}&r=${encodeURIComponent("https://playerflix.ink/")}`;
      const res = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "User-Agent": DESKTOP_CHROME_UA,
          Origin: parsed.origin,
          Referer: embedUrl,
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      });
      if (!res.ok) return null;
      const payload = await res.json();
      const rawUrl = (payload.securedLink || payload.videoSource || "").trim();
      if (!/^https?:\/\//i.test(rawUrl)) return null;
      const isMp4 = /\.mp4(?:$|[?#])/i.test(rawUrl) && payload.hls !== true;
      const probe = await this.probeDirectMediaUrl({
        url: rawUrl,
        referer: `${parsed.origin}/`,
        origin: parsed.origin,
        expectedKind: isMp4 ? "video" : "hls",
        signal: controller.signal
      });
      if (!probe.ok) {
        return null;
      }
      const isPt = (langHint || "").toLowerCase().startsWith("pt");
      return {
        streamUrl: probe.finalUrl || rawUrl,
        streamKind: probe.kind,
        audioLabel: isPt ? "Dublado" : "Legendado",
        posterUrl: payload.videoImage || null,
        referer: probe.sendReferer ? `${parsed.origin}/` : "",
        origin: probe.sendReferer ? parsed.origin : "",
        sendReferer: probe.sendReferer,
        sourceKind: "embedplayer"
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onParentAbort);
    }
  }
  async resolveBuzzQServersFromHtml(params) {
    const parsedQ = parseBuzzQPayload(params.html, params.finalPageUrl);
    if (!parsedQ) return [];
    const pageOrigin = new URL(params.finalPageUrl).origin;
    const scoreServerLang = (lang) => {
      const l = (lang || "").trim().toLowerCase();
      if (!l) return 2;
      if (/^(?:pt|portugu)/i.test(l)) return 0;
      if (/^(?:en|eng)/i.test(l)) return 0;
      if (/^(?:es|span|espa|fr|french|de|germ|it|ital|ja|jap|ko|kor)/i.test(l)) return 1;
      return 4;
    };
    const servers = [...parsedQ.servers].sort(
      (a, b) => scoreServerLang(a.lang) - scoreServerLang(b.lang)
    );
    const hasPrimaryWesternServer = servers.some(
      (s) => /^(?:pt|portugu|en|eng|es|span|espa)/i.test((s.lang || "").trim())
    );
    const results = await Promise.all(
      servers.slice(0, 6).map(async (srv) => {
        if (!srv.ref) return null;
        const rawLangClean = (srv.lang || "").trim().toLowerCase();
        if (hasPrimaryWesternServer && /^(?:hindi|tamil|telugu|kannada|malayalam|bengali|marathi|punjabi)$/i.test(rawLangClean)) {
          return null;
        }
        try {
          let playJson = null;
          for (const baseEndpoint of parsedQ.playApiBases) {
            const apiUrl = `${baseEndpoint}?a=play&ref=${encodeURIComponent(srv.ref)}&t=${encodeURIComponent(parsedQ.token)}`;
            const apiRes = await fetch(apiUrl, {
              signal: params.signal,
              headers: {
                "User-Agent": DESKTOP_CHROME_UA,
                Referer: params.finalPageUrl,
                "X-Requested-With": "XMLHttpRequest",
                Accept: "application/json, text/javascript, */*; q=0.01"
              }
            });
            if (!apiRes.ok) continue;
            const json = await apiRes.json().catch(() => null);
            if (json?.url) {
              playJson = json;
              break;
            }
          }
          if (!playJson?.url) return null;
          const resolvedStreamUrl = new URL(playJson.url, params.finalPageUrl).toString();
          const expectedKind = playJson.type === "mp4" || playJson.type === "video" ? "video" : "hls";
          const probe = await this.probeDirectMediaUrl({
            url: resolvedStreamUrl,
            referer: `${pageOrigin}/`,
            origin: pageOrigin,
            expectedKind,
            signal: params.signal
          });
          if (!probe.ok) return null;
          const srvLangRaw = (srv.lang || params.langHint || "").trim().toLowerCase();
          let langCode = "en-us";
          let languageLabel = "Ingl\xEAs / Original";
          if (/^(?:pt|portugu)/i.test(srvLangRaw)) {
            langCode = "pt-br";
            languageLabel = "Dublado (PT-BR)";
          } else if (/^(?:es|span|espa)/i.test(srvLangRaw)) {
            langCode = "es-es";
            languageLabel = "Espanhol";
          } else if (/^(?:fr|french|fran)/i.test(srvLangRaw)) {
            langCode = "fr";
            languageLabel = "Franc\xEAs";
          } else if (/^(?:de|germ|alem)/i.test(srvLangRaw)) {
            langCode = "de";
            languageLabel = "Alem\xE3o";
          } else if (/^(?:it|ital)/i.test(srvLangRaw)) {
            langCode = "it";
            languageLabel = "Italiano";
          } else if (/^(?:ja|jap)/i.test(srvLangRaw)) {
            langCode = "ja";
            languageLabel = "Japon\xEAs";
          } else if (/^(?:ko|kor)/i.test(srvLangRaw)) {
            langCode = "ko";
            languageLabel = "Coreano";
          } else if (/^(?:hi|hin)/i.test(srvLangRaw)) {
            langCode = "hi";
            languageLabel = "Hindi";
          }
          return {
            streamUrl: probe.finalUrl || resolvedStreamUrl,
            streamKind: probe.kind,
            audioLabel: languageLabel,
            languageLabel,
            langCode,
            posterUrl: null,
            referer: probe.sendReferer ? `${pageOrigin}/` : "",
            origin: probe.sendReferer ? pageOrigin : "",
            sendReferer: probe.sendReferer,
            sourceKind: "vidsrcbuzz"
          };
        } catch {
          return null;
        }
      })
    );
    return results.filter((r) => r !== null);
  }
  async extractVidSrcBuzzFromEmbedUrl(embedUrl, opts = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const onParentAbort = () => controller.abort();
    opts.signal?.addEventListener("abort", onParentAbort, { once: true });
    try {
      const pageRes = await fetch(embedUrl, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": DESKTOP_CHROME_UA,
          Referer: "https://www.2embed.cc/"
        }
      });
      if (!pageRes.ok) return [];
      const finalPageUrl = pageRes.url || embedUrl;
      const html = await pageRes.text();
      if (isCloudflareChallengeHtml(html, pageRes.status)) return [];
      return await this.resolveBuzzQServersFromHtml({
        html,
        finalPageUrl,
        langHint: opts.langHint,
        signal: controller.signal
      });
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onParentAbort);
    }
  }
  async extractVidSrcBuzzStreams(params) {
    const buildBuzzMirrorUrls = (id) => {
      const path5 = params.mediaType === "tv" ? `/embed/tv/${id}/${params.season ?? 1}/${params.episode ?? 1}` : `/embed/movie/${id}`;
      return [
        `https://vidsrc.buzz${path5}`,
        `https://videm.buzz${path5}`,
        `https://videm.cc${path5}`
      ];
    };
    const [vidsrcUrl, videmBuzzUrl, videmCcUrl] = buildBuzzMirrorUrls(params.tmdbId);
    const [vidsrcRes, videmRes] = await Promise.all([
      this.extractVidSrcBuzzFromEmbedUrl(vidsrcUrl, {
        langHint: "en",
        signal: params.signal
      }),
      this.extractVidSrcBuzzFromEmbedUrl(videmBuzzUrl, {
        langHint: "en",
        signal: params.signal
      })
    ]);
    const combined = [...vidsrcRes, ...videmRes];
    if (combined.length > 0) return combined;
    const ccRes = await this.extractVidSrcBuzzFromEmbedUrl(videmCcUrl, {
      langHint: "en",
      signal: params.signal
    });
    if (ccRes.length > 0) return ccRes;
    if (params.imdbId && /^tt\d{5,12}$/i.test(params.imdbId)) {
      const imdbMirrors = buildBuzzMirrorUrls(params.imdbId);
      const imdbResults = await Promise.all(
        imdbMirrors.slice(0, 2).map(
          (u) => this.extractVidSrcBuzzFromEmbedUrl(u, {
            langHint: "en",
            signal: params.signal
          })
        )
      );
      return imdbResults.flat();
    }
    return [];
  }
  async extractFromConfiguredUrl(targetUrl, opts = {}) {
    const depth = opts.depth ?? 0;
    let parsed;
    try {
      parsed = new URL((targetUrl || "").trim());
    } catch {
      return { candidate: null, cloudflareBlocked: false };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:" || !isSafePublicHost(parsed.hostname) || isAdOrTrackerHost(parsed.hostname)) {
      return { candidate: null, cloudflareBlocked: false };
    }
    const resolveCustomMeta = (detectedLangCode) => {
      const effectiveLang = opts.hasExplicitLang && opts.langHint && opts.langHint !== "auto" ? opts.langHint : detectedLangCode || opts.langHint || "auto";
      return formatSourceLanguageOptionLabel(opts.sourceName, effectiveLang);
    };
    const initialMeta = resolveCustomMeta();
    const defaultLabel = initialMeta.languageLabel;
    const pfParsed = parsePlayerFlixStyleUrl(targetUrl);
    if (pfParsed) {
      const numericTmdb = /^\d+$/.test(pfParsed.id) ? Number(pfParsed.id) : 0;
      const imdbStr = /^tt\d{5,12}$/i.test(pfParsed.id) ? pfParsed.id : null;
      const pfController = new AbortController();
      const pfTimer = setTimeout(() => pfController.abort(), 7e3);
      const onParentAbort2 = () => pfController.abort();
      opts.signal?.addEventListener("abort", onParentAbort2, { once: true });
      try {
        const pfRes = await this.resolvePlayerFlixAndWatchPlay({
          tmdbId: numericTmdb,
          imdbId: imdbStr,
          mediaType: pfParsed.mediaType,
          season: pfParsed.season,
          episode: pfParsed.episode,
          signal: pfController.signal
        });
        if (pfRes.candidates.length > 0) {
          const picked = pfRes.candidates.map((item) => {
            const detLang = item.langCode.startsWith("pt") ? "pt" : item.langCode.startsWith("en") ? "sub" : "auto";
            const meta = resolveCustomMeta(detLang);
            return {
              ...item.extracted,
              audioLabel: meta.languageLabel,
              langCode: meta.langCode,
              languageLabel: meta.languageLabel,
              posterUrl: item.extracted.posterUrl || pfRes.bgImage,
              isCustomSource: opts.isCustomSource
            };
          });
          return {
            candidate: picked[0],
            extraCandidates: picked.slice(1),
            cloudflareBlocked: false
          };
        }
        return {
          candidate: null,
          cloudflareBlocked: pfRes.cloudflareOnly
        };
      } finally {
        clearTimeout(pfTimer);
        opts.signal?.removeEventListener("abort", onParentAbort2);
      }
    }
    if (/(?:vidsrc\.buzz|videm\.buzz|videm\.cc)/i.test(parsed.hostname)) {
      const buzzList = await this.extractVidSrcBuzzFromEmbedUrl(targetUrl, {
        langHint: opts.langHint,
        signal: opts.signal
      });
      if (buzzList.length > 0) {
        const mapped = buzzList.map((item) => {
          const meta = resolveCustomMeta(item.langCode);
          return {
            ...item,
            audioLabel: meta.languageLabel,
            langCode: meta.langCode,
            languageLabel: meta.languageLabel,
            isCustomSource: opts.isCustomSource
          };
        });
        return {
          candidate: mapped[0],
          extraCandidates: mapped.slice(1),
          cloudflareBlocked: false
        };
      }
      return { candidate: null, cloudflareBlocked: false };
    }
    if (extractEmbedPlayerHash(targetUrl)) {
      const candidate = await this.extractEmbedPlayerStream(targetUrl, opts.langHint, opts.signal);
      if (candidate) {
        const meta = resolveCustomMeta(candidate.langCode);
        if (opts.sourceName) {
          candidate.audioLabel = meta.label;
          candidate.sourceName = meta.sourceName;
        }
        candidate.langCode = meta.langCode;
        candidate.languageLabel = meta.languageLabel;
        candidate.isCustomSource = opts.isCustomSource;
      }
      return { candidate, cloudflareBlocked: false };
    }
    if (/watchplay\.shop/i.test(parsed.hostname)) {
      const candidate = await this.extractWatchPlayStream(targetUrl, opts.signal);
      if (candidate) {
        const detectedLang = /leg|en/i.test(candidate.audioLabel) ? "sub" : "pt";
        const meta = resolveCustomMeta(candidate.langCode || detectedLang);
        if (opts.sourceName) {
          candidate.audioLabel = meta.label;
          candidate.sourceName = meta.sourceName;
        }
        candidate.langCode = meta.langCode;
        candidate.languageLabel = meta.languageLabel;
        candidate.isCustomSource = opts.isCustomSource;
      }
      return { candidate, cloudflareBlocked: false };
    }
    const cleanPath = parsed.pathname.toLowerCase();
    const looksDirectHls = cleanPath.endsWith(".m3u8") || /format=m3u8|type=hls/i.test(parsed.search);
    const looksDirectVideo = /\.(?:mp4|webm|ogg|ogv|mov|m4v)$/i.test(cleanPath);
    if (looksDirectHls || looksDirectVideo) {
      const probe = await this.probeDirectMediaUrl({
        url: targetUrl,
        referer: `${parsed.origin}/`,
        origin: parsed.origin,
        expectedKind: looksDirectVideo ? "video" : "hls",
        signal: opts.signal
      });
      if (!probe.ok) {
        if (probe.cloudflareBlocked) {
          return { candidate: null, cloudflareBlocked: true };
        }
        return {
          candidate: null,
          cloudflareBlocked: false,
          directBrowserFallback: {
            streamUrl: targetUrl,
            streamKind: looksDirectVideo ? "video" : "hls",
            audioLabel: defaultLabel,
            langCode: initialMeta.langCode,
            sourceName: initialMeta.sourceName,
            languageLabel: initialMeta.languageLabel,
            isCustomSource: opts.isCustomSource,
            posterUrl: null,
            referer: "",
            origin: "",
            sendReferer: false,
            useDirectClientUrl: true,
            sourceKind: "custom"
          }
        };
      }
      return {
        cloudflareBlocked: false,
        candidate: {
          streamUrl: probe.finalUrl || targetUrl,
          streamKind: probe.kind,
          audioLabel: defaultLabel,
          langCode: initialMeta.langCode,
          sourceName: initialMeta.sourceName,
          languageLabel: initialMeta.languageLabel,
          isCustomSource: opts.isCustomSource,
          posterUrl: null,
          referer: probe.sendReferer ? `${parsed.origin}/` : "",
          origin: probe.sendReferer ? parsed.origin : "",
          sendReferer: probe.sendReferer,
          sourceKind: "custom"
        }
      };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);
    const onParentAbort = () => controller.abort();
    opts.signal?.addEventListener("abort", onParentAbort, { once: true });
    const fetchPage = async (withReferer) => {
      const headers = {
        "User-Agent": DESKTOP_CHROME_UA,
        Accept: "application/json, text/html, */*",
        Range: "bytes=0-131071"
      };
      if (withReferer) {
        headers.Referer = `${parsed.origin}/`;
      }
      return fetch(targetUrl, {
        redirect: "follow",
        signal: controller.signal,
        headers
      });
    };
    try {
      let sendReferer = true;
      let res = await fetchPage(true);
      const cfHeaderMitigated = (res.headers.get("cf-mitigated") || "").toLowerCase() === "challenge";
      if (res.status === 401 || res.status === 403) {
        const errBytes = await this.readHeadBytes(res, 16384);
        const errSample = new TextDecoder("utf-8", { fatal: false }).decode(errBytes);
        if (cfHeaderMitigated || isCloudflareChallengeHtml(errSample, res.status)) {
          return { candidate: null, cloudflareBlocked: true };
        }
        sendReferer = false;
        res = await fetchPage(false);
      }
      const finalUrl = res.url || targetUrl;
      const finalOrigin = new URL(finalUrl).origin;
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      const disp = res.headers.get("content-disposition");
      const finalCfMitigated = (res.headers.get("cf-mitigated") || "").toLowerCase() === "challenge";
      if (!res.ok && res.status !== 206) {
        const errBytes = await this.readHeadBytes(res, 16384);
        const errSample = new TextDecoder("utf-8", { fatal: false }).decode(errBytes);
        return {
          candidate: null,
          cloudflareBlocked: finalCfMitigated || isCloudflareChallengeHtml(errSample, res.status)
        };
      }
      const headBytes = await this.readHeadBytes(res, 131072);
      const sniffedKind = detectMediaKindFromBytesOrHeaders({
        url: finalUrl,
        contentType: ct,
        contentDisposition: disp,
        sniffBytes: headBytes
      });
      if (sniffedKind) {
        return {
          cloudflareBlocked: false,
          candidate: {
            streamUrl: finalUrl,
            streamKind: sniffedKind,
            audioLabel: defaultLabel,
            langCode: initialMeta.langCode,
            sourceName: initialMeta.sourceName,
            languageLabel: initialMeta.languageLabel,
            isCustomSource: opts.isCustomSource,
            posterUrl: null,
            referer: sendReferer ? `${finalOrigin}/` : "",
            origin: sendReferer ? finalOrigin : "",
            sendReferer,
            sourceKind: "custom"
          }
        };
      }
      if (ct.includes("octet-stream")) {
        return { candidate: null, cloudflareBlocked: false };
      }
      const body = new TextDecoder("utf-8", { fatal: false }).decode(headBytes);
      if (finalCfMitigated || isCloudflareChallengeHtml(body, res.status)) {
        return { candidate: null, cloudflareBlocked: true };
      }
      const extractedList = extractPlayableStreamsFromBody(body, finalUrl);
      if (extractedList.length > 0) {
        const probedList = await Promise.all(
          extractedList.slice(0, 4).map(async (item) => {
            const meta = resolveCustomMeta(item.detectedLang);
            const probe = await this.probeDirectMediaUrl({
              url: item.streamUrl,
              referer: finalUrl,
              origin: finalOrigin,
              expectedKind: item.streamKind,
              signal: opts.signal
            });
            return { item, meta, probe };
          })
        );
        const verifiedCandidates = [];
        let firstFallback;
        let sawCfInStreams = false;
        for (const { item, meta, probe } of probedList) {
          if (probe.ok) {
            verifiedCandidates.push({
              streamUrl: probe.finalUrl || item.streamUrl,
              streamKind: probe.kind,
              audioLabel: meta.languageLabel,
              langCode: meta.langCode,
              sourceName: meta.sourceName,
              languageLabel: meta.languageLabel,
              isCustomSource: opts.isCustomSource,
              posterUrl: item.posterUrl,
              referer: probe.sendReferer ? finalUrl : "",
              origin: probe.sendReferer ? finalOrigin : "",
              sendReferer: probe.sendReferer,
              sourceKind: "custom"
            });
          } else if (probe.cloudflareBlocked) {
            sawCfInStreams = true;
          } else if (!firstFallback) {
            firstFallback = {
              streamUrl: item.streamUrl,
              streamKind: item.streamKind,
              audioLabel: meta.languageLabel,
              langCode: meta.langCode,
              sourceName: meta.sourceName,
              languageLabel: meta.languageLabel,
              isCustomSource: opts.isCustomSource,
              posterUrl: item.posterUrl,
              referer: "",
              origin: "",
              sendReferer: false,
              useDirectClientUrl: true,
              sourceKind: "custom"
            };
          }
        }
        if (verifiedCandidates.length > 0) {
          return {
            cloudflareBlocked: false,
            candidate: verifiedCandidates[0],
            extraCandidates: verifiedCandidates.slice(1)
          };
        }
        if (!sawCfInStreams && firstFallback) {
          return {
            candidate: null,
            cloudflareBlocked: false,
            directBrowserFallback: firstFallback
          };
        }
      }
      const buzzMirrorList = await this.resolveBuzzQServersFromHtml({
        html: body,
        finalPageUrl: finalUrl,
        langHint: opts.langHint,
        signal: controller.signal
      });
      if (buzzMirrorList.length > 0) {
        const mapped = buzzMirrorList.map((item) => {
          const meta = resolveCustomMeta(item.langCode);
          return {
            ...item,
            audioLabel: meta.languageLabel,
            langCode: meta.langCode,
            languageLabel: meta.languageLabel,
            isCustomSource: opts.isCustomSource
          };
        });
        return {
          candidate: mapped[0],
          extraCandidates: mapped.slice(1),
          cloudflareBlocked: false
        };
      }
      if (depth < 2) {
        const nestedUrls = extractNestedEmbedUrls(body, finalUrl).filter((u) => !/(?:superflixapi|embedplayabyss)/i.test(u)).sort((a, b) => {
          const score = (urlItem) => /(?:vidsrc\.buzz|videm\.buzz|videm\.cc|watchplay\.shop|embedplayer\d*\.xyz|playerflix\.ink|myembed\.biz)/i.test(
            urlItem
          ) ? 0 : 1;
          return score(a) - score(b);
        });
        for (const nestedUrl of nestedUrls.slice(0, 5)) {
          const nested = await this.extractFromConfiguredUrl(nestedUrl, {
            langHint: opts.langHint,
            hasExplicitLang: opts.hasExplicitLang,
            sourceName: opts.sourceName,
            isCustomSource: opts.isCustomSource,
            allowIframeFallback: false,
            depth: depth + 1,
            signal: opts.signal
          });
          if (nested.candidate || nested.directBrowserFallback) {
            return nested;
          }
        }
      }
      const adBlocked = hasAdOrAntiSandboxTraps(body);
      if (adBlocked) {
        return { candidate: null, cloudflareBlocked: false, blockedByAds: true };
      }
      if (opts.allowIframeFallback && res.ok && ct.includes("text/html")) {
        return {
          candidate: null,
          cloudflareBlocked: false,
          iframeFallback: {
            streamUrl: finalUrl,
            streamKind: "iframe",
            audioLabel: defaultLabel,
            langCode: initialMeta.langCode,
            languageLabel: initialMeta.languageLabel,
            isCustomSource: opts.isCustomSource,
            posterUrl: null,
            referer: "",
            origin: "",
            sendReferer: false,
            useDirectClientUrl: true,
            sourceKind: "custom"
          }
        };
      }
      return { candidate: null, cloudflareBlocked: false };
    } catch {
      return { candidate: null, cloudflareBlocked: false };
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onParentAbort);
    }
  }
  async extractCandidateOption(opt, signal) {
    if (!opt.embed) return null;
    if (opt.id === "embedplayer" || /embedplayer\d*\.xyz/i.test(opt.embed)) {
      return this.extractEmbedPlayerStream(opt.embed, opt.lang, signal);
    }
    return this.extractWatchPlayStream(opt.embed, signal);
  }
  async fetchAjaxStreamOptions(params) {
    const qs = new URLSearchParams({
      type: params.mediaType,
      id: params.id,
      season: params.season === null ? "null" : String(params.season),
      episode: params.episode === null ? "null" : String(params.episode)
    });
    const refererPath = params.mediaType === "tv" ? `https://playerflix.ink/serie/${params.id}/${params.season ?? 1}/${params.episode ?? 1}` : `https://playerflix.ink/filme/${params.id}`;
    const ajaxRes = await fetch(`https://playerflix.ink/inc/Ajax.php?${qs.toString()}`, {
      signal: params.signal,
      headers: {
        "User-Agent": DESKTOP_CHROME_UA,
        Referer: refererPath,
        Origin: "https://playerflix.ink",
        "X-Requested-With": "XMLHttpRequest",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
        Accept: "application/json, text/javascript, */*; q=0.01"
      }
    });
    if (!ajaxRes.ok) {
      return { bgImage: null, options: [], cloudflareOnly: false };
    }
    const payload = await ajaxRes.json();
    if (!payload?.status || !Array.isArray(payload.data?.options)) {
      return { bgImage: null, options: [], cloudflareOnly: false };
    }
    const bgImage = payload.data?.bgImage || null;
    const rawOptions = payload.data.options;
    const cleanOptions = rawOptions.filter((opt) => {
      if (!opt.embed) return false;
      const isWatchPlay = opt.id === "watchplay" || /watchplay\.shop/i.test(opt.embed);
      const isEmbedPlayer = opt.id === "embedplayer" || /embedplayer\d*\.xyz/i.test(opt.embed);
      return isWatchPlay || isEmbedPlayer;
    });
    cleanOptions.sort((a, b) => {
      const aRank = a.id === "watchplay" || /watchplay\.shop/i.test(a.embed || "") ? 0 : 1;
      const bRank = b.id === "watchplay" || /watchplay\.shop/i.test(b.embed || "") ? 0 : 1;
      return aRank - bRank;
    });
    const cloudflareOnly = cleanOptions.length === 0 && rawOptions.length > 0 && rawOptions.every(
      (opt) => opt.id === "superflixapi" || /superflixapi/i.test(opt.embed || "")
    );
    return { bgImage, options: cleanOptions, cloudflareOnly };
  }
  async resolvePlayerFlixAndWatchPlay(params) {
    const primary = await this.fetchAjaxStreamOptions({
      id: String(params.tmdbId),
      mediaType: params.mediaType,
      season: params.season,
      episode: params.episode,
      signal: params.signal
    }).catch(() => ({
      bgImage: null,
      options: [],
      cloudflareOnly: false
    }));
    let bgImage = primary.bgImage;
    let candidateOptions = primary.options;
    let cloudflareOnly = primary.cloudflareOnly;
    const resolvedImdb = params.imdbId;
    if (candidateOptions.length === 0 && resolvedImdb && /^tt\d{5,12}$/i.test(resolvedImdb)) {
      const imdbAjax = await this.fetchAjaxStreamOptions({
        id: resolvedImdb,
        mediaType: params.mediaType,
        season: params.season,
        episode: params.episode,
        signal: params.signal
      }).catch(() => ({
        bgImage: null,
        options: [],
        cloudflareOnly: false
      }));
      if (!bgImage) bgImage = imdbAjax.bgImage;
      if (imdbAjax.options.length > 0) {
        candidateOptions = imdbAjax.options;
        cloudflareOnly = false;
      } else {
        cloudflareOnly = cloudflareOnly || imdbAjax.cloudflareOnly;
      }
    }
    if (candidateOptions.length === 0) {
      const suffix = params.mediaType === "tv" ? `/tvshow/${params.tmdbId}/${params.season ?? 1}/${params.episode ?? 1}` : `/movie/${params.tmdbId}`;
      candidateOptions = [
        { id: "watchplay_v1", embed: `https://v1.watchplay.shop${suffix}`, lang: "pt-br" },
        { id: "watchplay_v2", embed: `https://v2.watchplay.shop${suffix}`, lang: "pt-br" }
      ];
      if (resolvedImdb && /^tt\d{5,12}$/i.test(resolvedImdb)) {
        const imdbSuffix = params.mediaType === "tv" ? `/tvshow/${resolvedImdb}/${params.season ?? 1}/${params.episode ?? 1}` : `/movie/${resolvedImdb}`;
        candidateOptions.push(
          {
            id: "watchplay_imdb_v1",
            embed: `https://v1.watchplay.shop${imdbSuffix}`,
            lang: "pt-br"
          },
          {
            id: "watchplay_imdb_v2",
            embed: `https://v2.watchplay.shop${imdbSuffix}`,
            lang: "pt-br"
          }
        );
      }
    }
    const extractedResults = await Promise.all(
      candidateOptions.slice(0, 6).map(async (opt) => {
        const extracted = await this.extractCandidateOption(opt, params.signal);
        if (!extracted) return null;
        const langCode = (opt.lang || "pt-br").toLowerCase();
        return { langCode, extracted };
      })
    );
    return {
      bgImage,
      cloudflareOnly,
      candidates: extractedResults.filter(
        (item) => item !== null
      )
    };
  }
  async resolveBuiltInWatchaPipeline(params) {
    const [flixRes, buzzList] = await Promise.all([
      this.resolvePlayerFlixAndWatchPlay(params),
      this.extractVidSrcBuzzStreams(params)
    ]);
    const options = [];
    const upstreamById = /* @__PURE__ */ new Map();
    const seenUrls = /* @__PURE__ */ new Set();
    let posterUrl = flixRes.bgImage;
    const byLangGroup = /* @__PURE__ */ new Map();
    for (const item of flixRes.candidates) {
      const langGroup = item.langCode.startsWith("pt") ? "pt" : item.langCode.startsWith("en") ? "en" : item.langCode;
      const existing = byLangGroup.get(langGroup);
      if (existing && (existing.extracted.sourceKind === "watchplay" || item.extracted.sourceKind !== "watchplay")) {
        continue;
      }
      byLangGroup.set(langGroup, item);
    }
    let idx = 0;
    for (const { langCode, extracted } of byLangGroup.values()) {
      if (seenUrls.has(extracted.streamUrl)) continue;
      seenUrls.add(extracted.streamUrl);
      if (!posterUrl && extracted.posterUrl) posterUrl = extracted.posterUrl;
      const sessionId = this.registerHlsSession({
        upstreamUrl: extracted.streamUrl,
        referer: extracted.referer,
        origin: extracted.origin,
        sendReferer: extracted.sendReferer,
        streamKind: extracted.streamKind === "video" ? "video" : "hls"
      });
      const isPt = extracted.audioLabel === "Dublado" || langCode.startsWith("pt");
      const isSub = extracted.audioLabel === "Legendado" || langCode.startsWith("en");
      const languageLabel = isPt ? "Dublado (PT-BR)" : isSub ? "Legendado (PT-BR)" : extracted.audioLabel;
      const optId = `audio_native_${idx}_${isPt ? "pt-br" : isSub ? "pt-sub" : langCode}`;
      const playbackKind = extracted.streamKind === "video" ? "video" : "hls";
      upstreamById.set(optId, extracted.streamUrl);
      options.push({
        id: optId,
        label: languageLabel,
        languageLabel,
        lang: isPt ? "pt-br" : isSub ? "pt-sub" : langCode,
        streamUrl: this.buildProxyPlaybackUrl(sessionId, playbackKind),
        streamKind: playbackKind,
        isCustomSource: false
      });
      idx += 1;
    }
    for (const extracted of buzzList) {
      if (seenUrls.has(extracted.streamUrl)) continue;
      seenUrls.add(extracted.streamUrl);
      const sessionId = this.registerHlsSession({
        upstreamUrl: extracted.streamUrl,
        referer: extracted.referer,
        origin: extracted.origin,
        sendReferer: extracted.sendReferer,
        streamKind: extracted.streamKind === "video" ? "video" : "hls"
      });
      const langCode = extracted.langCode || "en-us";
      const languageLabel = extracted.languageLabel || (langCode.startsWith("pt") ? "Dublado (PT-BR)" : langCode.startsWith("es") ? "Espanhol" : "Ingl\xEAs / Original");
      const optId = `audio_buzz_${idx}_${langCode}`;
      const playbackKind = extracted.streamKind === "video" ? "video" : "hls";
      upstreamById.set(optId, extracted.streamUrl);
      options.push({
        id: optId,
        label: languageLabel,
        languageLabel,
        lang: langCode,
        streamUrl: this.buildProxyPlaybackUrl(sessionId, playbackKind),
        streamKind: playbackKind,
        isCustomSource: false
      });
      idx += 1;
    }
    if (params.preferredLang === "en") {
      options.sort((a, b) => (a.lang.startsWith("en") ? 0 : 1) - (b.lang.startsWith("en") ? 0 : 1));
    } else {
      options.sort((a, b) => (a.lang.startsWith("pt") ? 0 : 1) - (b.lang.startsWith("pt") ? 0 : 1));
    }
    return {
      audioOptions: options,
      upstreamById,
      posterUrl,
      cloudflareOnly: options.length === 0 && flixRes.cloudflareOnly
    };
  }
  buildCandidateOption(id, c, preferredLang) {
    const meta = getCustomSourceLangMeta(c.langCode || preferredLang);
    const lang = c.langCode || meta.langCode;
    const cleanLanguageLabel = c.languageLabel || meta.label;
    const baseOption = {
      id,
      label: cleanLanguageLabel,
      languageLabel: cleanLanguageLabel,
      lang,
      streamKind: c.streamKind,
      isCustomSource: c.isCustomSource
    };
    if (c.useDirectClientUrl || c.streamKind === "iframe") {
      return {
        ...baseOption,
        streamUrl: c.streamUrl
      };
    }
    const proxyKind = c.streamKind === "video" ? "video" : "hls";
    const sessionId = this.registerHlsSession({
      upstreamUrl: c.streamUrl,
      referer: c.referer,
      origin: c.origin,
      sendReferer: c.sendReferer,
      streamKind: proxyKind
    });
    return {
      ...baseOption,
      streamUrl: this.buildProxyPlaybackUrl(sessionId, proxyKind)
    };
  }
  async resolvePlayableStreams(params) {
    const cfg = params.playerConfig ?? DEFAULT_PLAYER_CONFIG;
    const preferredLang = params.preferredLang ?? cfg.watchaflixLang ?? "pt";
    const season = params.mediaType === "tv" ? params.seasonNumber ?? 1 : null;
    const episode = params.mediaType === "tv" ? params.episodeNumber ?? 1 : null;
    const activeCustomSources = sanitizeCustomVideoSources(cfg.customSources).filter((s) => s.active);
    const configFingerprint = crypto.createHash("sha1").update(
      JSON.stringify({
        sourceMode: cfg.sourceMode,
        defaultDomain: cfg.defaultDomain,
        fallbackDomain: cfg.fallbackDomain,
        myembedBaseUrl: cfg.myembedBaseUrl,
        watchaflixBaseUrl: cfg.watchaflixBaseUrl,
        customEmbedMovieTemplate: cfg.customEmbedMovieTemplate,
        customEmbedTvTemplate: cfg.customEmbedTvTemplate,
        customSources: activeCustomSources,
        preferImdbForMovies: cfg.preferImdbForMovies,
        customStreamUrl: params.customStreamUrl || "",
        updatedAt: cfg.updatedAt || ""
      })
    ).digest("hex").slice(0, 12);
    const cacheKey = `${params.mediaType}:${params.tmdbId}:${season ?? 0}:${episode ?? 0}:${configFingerprint}`;
    const cached = this.streamCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() && cached.audioOptions.length > 0) {
      return {
        audioOptions: [...cached.audioOptions],
        posterUrl: cached.posterUrl,
        cloudflareOnly: cached.cloudflareOnly,
        resolvedSource: cached.resolvedSource
      };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14e3);
    try {
      let resolvedImdb = params.imdbId ?? null;
      if (!resolvedImdb && params.imdbIdPromise) {
        resolvedImdb = await params.imdbIdPromise.catch(() => null);
      }
      let sawCloudflare = false;
      let fallbackPoster = null;
      const upstreamById = /* @__PURE__ */ new Map();
      const collectedOptions = [];
      const resolvedCustomDirectOptions = [];
      const resolvedCustomIframeOptions = [];
      const directFallbacks = [];
      if (params.customStreamUrl) {
        const customRes = await this.extractFromConfiguredUrl(params.customStreamUrl, {
          langHint: preferredLang,
          hasExplicitLang: false,
          sourceName: "Fonte do Cat\xE1logo",
          isCustomSource: true,
          allowIframeFallback: true,
          signal: controller.signal
        });
        if (customRes.cloudflareBlocked) sawCloudflare = true;
        if (customRes.candidate) {
          const opt = this.buildCandidateOption(
            `custom_item_${preferredLang}`,
            customRes.candidate,
            preferredLang
          );
          upstreamById.set(opt.id, customRes.candidate.streamUrl);
          const result = {
            audioOptions: [opt],
            posterUrl: customRes.candidate.posterUrl,
            cloudflareOnly: false,
            resolvedSource: "custom_catalog_item"
          };
          this.saveCache(cacheKey, result);
          return result;
        }
        const catalogFb = customRes.directBrowserFallback || customRes.iframeFallback;
        if (catalogFb) {
          const opt = this.buildCandidateOption(
            `custom_item_${preferredLang}`,
            catalogFb,
            preferredLang
          );
          upstreamById.set(opt.id, catalogFb.streamUrl);
          directFallbacks.push({
            option: opt,
            posterUrl: catalogFb.posterUrl,
            source: "custom_catalog_item_direct",
            upstreamUrl: catalogFb.streamUrl
          });
          if (catalogFb.posterUrl) {
            fallbackPoster = catalogFb.posterUrl;
          }
        }
      }
      const cascade = buildOrderedSourceCascade(cfg, {
        tmdbId: params.tmdbId,
        imdbId: resolvedImdb,
        mediaType: params.mediaType,
        seasonNumber: params.seasonNumber,
        episodeNumber: params.episodeNumber
      });
      const customSourceStages = cascade.filter((s) => s.sourceId === "custom_source" && Boolean(s.url));
      const nonCustomStages = cascade.filter((s) => s.sourceId !== "custom_source");
      const hasNativeStage = nonCustomStages.some((s) => s.sourceId === "native_watcha");
      const [customBatchResults, nativeParallelRes] = await Promise.all([
        customSourceStages.length > 0 ? Promise.all(
          customSourceStages.slice(0, 20).map(async (stage, idx) => {
            const hasExplicitLang = Boolean(stage.preferredLang && stage.preferredLang !== "auto");
            const langHint = hasExplicitLang ? stage.preferredLang : "auto";
            const extractedRes = await this.extractFromConfiguredUrl(stage.url, {
              langHint,
              hasExplicitLang,
              sourceName: stage.label,
              isCustomSource: true,
              allowIframeFallback: stage.sourceKindHint === "embed",
              signal: controller.signal
            });
            if (extractedRes.cloudflareBlocked) sawCloudflare = true;
            if (extractedRes.candidate) {
              const allCandidates = [
                extractedRes.candidate,
                ...extractedRes.extraCandidates || []
              ];
              const built = allCandidates.map((cand, subIdx) => {
                if (!fallbackPoster && cand.posterUrl) {
                  fallbackPoster = cand.posterUrl;
                }
                const opt = this.buildCandidateOption(
                  `custom_src_${stage.customSourceId || idx}_${subIdx}_${cand.langCode || langHint}`,
                  cand,
                  langHint
                );
                upstreamById.set(opt.id, cand.streamUrl);
                return opt;
              });
              return { kind: "direct", opts: built };
            }
            if (extractedRes.directBrowserFallback) {
              const fb = extractedRes.directBrowserFallback;
              const opt = this.buildCandidateOption(
                `custom_src_direct_${stage.customSourceId || idx}_${langHint}`,
                fb,
                langHint
              );
              upstreamById.set(opt.id, fb.streamUrl);
              return { kind: "direct", opts: [opt] };
            }
            if (extractedRes.iframeFallback) {
              const ifb = extractedRes.iframeFallback;
              const opt = this.buildCandidateOption(
                `custom_src_embed_${stage.customSourceId || idx}_${langHint}`,
                ifb,
                langHint
              );
              upstreamById.set(opt.id, ifb.streamUrl);
              return { kind: "iframe", opts: [opt] };
            }
            return null;
          })
        ) : Promise.resolve([]),
        hasNativeStage ? this.resolveBuiltInWatchaPipeline({
          tmdbId: params.tmdbId,
          imdbId: resolvedImdb,
          mediaType: params.mediaType,
          season,
          episode,
          preferredLang,
          signal: controller.signal
        }) : Promise.resolve(null)
      ]);
      for (const item of customBatchResults) {
        if (!item) continue;
        if (item.kind === "iframe") {
          resolvedCustomIframeOptions.push(...item.opts);
        } else {
          resolvedCustomDirectOptions.push(...item.opts);
        }
      }
      let resolvedSourceTag;
      if (resolvedCustomDirectOptions.length > 0) {
        collectedOptions.push(...resolvedCustomDirectOptions);
        resolvedSourceTag = "custom_source";
      }
      for (const stage of nonCustomStages) {
        if (controller.signal.aborted) break;
        if (stage.sourceId === "native_watcha") {
          if (nativeParallelRes) {
            if (nativeParallelRes.posterUrl && !fallbackPoster) {
              fallbackPoster = nativeParallelRes.posterUrl;
            }
            if (nativeParallelRes.cloudflareOnly) sawCloudflare = true;
            for (const [k, v] of nativeParallelRes.upstreamById.entries()) {
              upstreamById.set(k, v);
            }
            if (nativeParallelRes.audioOptions.length > 0) {
              collectedOptions.push(...nativeParallelRes.audioOptions);
              if (!resolvedSourceTag) resolvedSourceTag = stage.sourceId;
              break;
            }
          }
          continue;
        }
        if (!stage.url) continue;
        const isDefaultWrapperOnly = !stage.isCustomConfigured && (stage.sourceId === "myembed" || stage.sourceId === "watchaflix" || stage.sourceId === "megaembed");
        if (isDefaultWrapperOnly && stage.sourceId !== cfg.sourceMode) {
          continue;
        }
        const extractedRes = await this.extractFromConfiguredUrl(stage.url, {
          langHint: preferredLang,
          hasExplicitLang: true,
          sourceName: stage.label,
          isCustomSource: stage.isCustomConfigured,
          allowIframeFallback: stage.sourceId === "custom_template",
          signal: controller.signal
        });
        if (extractedRes.cloudflareBlocked) sawCloudflare = true;
        if (extractedRes.candidate) {
          const allCandidates = [
            extractedRes.candidate,
            ...extractedRes.extraCandidates || []
          ];
          for (let subIdx = 0; subIdx < allCandidates.length; subIdx++) {
            const cand = allCandidates[subIdx];
            const opt = this.buildCandidateOption(
              `${stage.sourceId}_${subIdx}_${cand.langCode || preferredLang}`,
              cand,
              preferredLang
            );
            upstreamById.set(opt.id, cand.streamUrl);
            if (!fallbackPoster && cand.posterUrl) {
              fallbackPoster = cand.posterUrl;
            }
            collectedOptions.push(opt);
          }
          if (!resolvedSourceTag) resolvedSourceTag = stage.sourceId;
          break;
        }
        if (extractedRes.directBrowserFallback) {
          const fb = extractedRes.directBrowserFallback;
          const opt = this.buildCandidateOption(
            `${stage.sourceId}_${preferredLang}`,
            fb,
            preferredLang
          );
          upstreamById.set(opt.id, fb.streamUrl);
          directFallbacks.push({
            option: opt,
            posterUrl: fb.posterUrl,
            source: `${stage.sourceId}_direct`,
            upstreamUrl: fb.streamUrl
          });
        }
      }
      if (resolvedCustomIframeOptions.length > 0) {
        collectedOptions.push(...resolvedCustomIframeOptions);
        if (!resolvedSourceTag) resolvedSourceTag = "custom_source";
      }
      for (const fb of directFallbacks) {
        collectedOptions.push(fb.option);
        if (!fallbackPoster && fb.posterUrl) fallbackPoster = fb.posterUrl;
        if (!resolvedSourceTag) resolvedSourceTag = fb.source;
      }
      if (collectedOptions.length > 0) {
        const deduped = [];
        const seenKeys = /* @__PURE__ */ new Set();
        const seenNativeUpstreams = /* @__PURE__ */ new Set();
        const customUpstreams = /* @__PURE__ */ new Set();
        for (const opt of collectedOptions) {
          if (opt.isCustomSource) {
            const up = upstreamById.get(opt.id);
            if (up) customUpstreams.add(up);
          }
        }
        for (const opt of collectedOptions) {
          const upstream = upstreamById.get(opt.id) || opt.streamUrl;
          if (!opt.isCustomSource) {
            if (customUpstreams.has(upstream) || seenNativeUpstreams.has(upstream)) continue;
            seenNativeUpstreams.add(upstream);
          } else {
            const customKey = `${opt.id}:${upstream}`;
            if (seenKeys.has(customKey)) continue;
            seenKeys.add(customKey);
          }
          deduped.push(opt);
        }
        const consolidated = consolidateAudioOptionsByLanguage(deduped);
        const result = {
          audioOptions: consolidated,
          posterUrl: fallbackPoster,
          cloudflareOnly: false,
          resolvedSource: resolvedSourceTag
        };
        this.saveCache(cacheKey, result);
        return result;
      }
      return {
        audioOptions: [],
        posterUrl: fallbackPoster,
        cloudflareOnly: sawCloudflare
      };
    } catch {
      return { audioOptions: [], posterUrl: null, cloudflareOnly: false };
    } finally {
      clearTimeout(timer);
    }
  }
  saveCache(cacheKey, result) {
    if (this.streamCache.size > 200) {
      const firstKey = this.streamCache.keys().next().value;
      if (firstKey) this.streamCache.delete(firstKey);
    }
    this.streamCache.set(cacheKey, {
      ...result,
      expiresAt: Date.now() + 5 * 6e4
    });
  }
  async testCustomSources(sources) {
    const cleanSources = sanitizeCustomVideoSources(sources);
    if (cleanSources.length === 0) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 11e3);
    try {
      return await Promise.all(
        cleanSources.slice(0, 20).map(async (src) => {
          const started = Date.now();
          const mediaType = src.movieTemplate ? "movie" : "tv";
          const template = mediaType === "movie" ? src.movieTemplate : src.tvTemplate;
          const testedUrl = buildCustomEmbedUrl({
            template,
            tmdbId: mediaType === "movie" ? 693134 : 1396,
            imdbId: mediaType === "movie" ? "tt15239678" : "tt0903747",
            mediaType,
            seasonNumber: 1,
            episodeNumber: 1
          }) || template;
          if (src.kind !== "direct" && !hasUrlTemplatePlaceholder(template)) {
            return {
              id: src.id,
              name: src.name,
              status: "missing_placeholders",
              detectedLanguages: [],
              testedUrl,
              message: "Template sem vari\xE1vel ({tmdbId}, {id} ou {imdbId}). Esta fonte sempre carregar\xE1 o mesmo t\xEDtulo fixo.",
              latencyMs: Date.now() - started
            };
          }
          const hasExplicitLang = Boolean(src.lang && src.lang !== "auto");
          const langHint = hasExplicitLang ? src.lang : "auto";
          const res = await this.extractFromConfiguredUrl(testedUrl, {
            langHint,
            hasExplicitLang,
            sourceName: src.name,
            isCustomSource: true,
            allowIframeFallback: src.kind === "embed",
            signal: controller.signal
          });
          const latencyMs = Date.now() - started;
          if (res.candidate) {
            const allCands = [res.candidate, ...res.extraCandidates || []];
            const langs = Array.from(
              new Set(
                allCands.map((c) => getCustomSourceLangMeta(c.langCode).label).filter((l) => l && l !== "Autom\xE1tico")
              )
            );
            return {
              id: src.id,
              name: src.name,
              status: "ok_direct",
              detectedLanguages: langs.length > 0 ? langs : [getCustomSourceLangMeta(src.lang).label],
              streamKind: res.candidate.streamKind,
              testedUrl,
              message: `Reprodu\xE7\xE3o direta pronta no player nativo (${res.candidate.streamKind.toUpperCase()}) \xB7 Idiomas: ${langs.join(", ") || getCustomSourceLangMeta(src.lang).label}`,
              latencyMs
            };
          }
          if (res.cloudflareBlocked) {
            return {
              id: src.id,
              name: src.name,
              status: "blocked_cloudflare",
              detectedLanguages: [],
              testedUrl,
              message: "Bloqueada pelo Cloudflare (HTTP 403 / Verifica\xE7\xE3o humana). Provedores com desafio Cloudflare ou X-Frame-Options bloqueiam a extra\xE7\xE3o direta para o player sem an\xFAncios.",
              latencyMs
            };
          }
          if (res.blockedByAds) {
            return {
              id: src.id,
              name: src.name,
              status: "blocked_ads",
              detectedLanguages: [],
              testedUrl,
              message: "Bloqueada automaticamente: esta fonte injeta popups, captchas ou scripts anti-sandbox.",
              latencyMs
            };
          }
          if (res.directBrowserFallback) {
            const label = getCustomSourceLangMeta(res.directBrowserFallback.langCode).label;
            return {
              id: src.id,
              name: src.name,
              status: "ok_direct",
              detectedLanguages: [label],
              streamKind: res.directBrowserFallback.streamKind,
              testedUrl,
              message: `Fluxo direto detectado (${res.directBrowserFallback.streamKind.toUpperCase()}) \xB7 Idioma: ${label}`,
              latencyMs
            };
          }
          return {
            id: src.id,
            name: src.name,
            status: "unavailable",
            detectedLanguages: [],
            testedUrl,
            message: "Nenhum stream direto (.m3u8/.mp4) encontrado para o t\xEDtulo de teste (HTTP 404, timeout ou p\xE1gina protegida).",
            latencyMs
          };
        })
      );
    } finally {
      clearTimeout(timer);
    }
  }
  async resolveNativeStreams(params) {
    const res = await this.resolvePlayableStreams(params);
    return {
      audioOptions: res.audioOptions,
      posterUrl: res.posterUrl,
      cloudflareOnly: res.cloudflareOnly
    };
  }
  async resolveSubtitles(params) {
    const cleanImdb = (params.imdbId || "").trim().toLowerCase();
    if (!/^tt\d{5,12}$/.test(cleanImdb)) {
      return [];
    }
    const season = params.mediaType === "tv" ? params.seasonNumber ?? 1 : 0;
    const episode = params.mediaType === "tv" ? params.episodeNumber ?? 1 : 0;
    const cacheKey = `${cleanImdb}:${params.mediaType}:${season}:${episode}`;
    const cached = this.subtitleCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.subtitles;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5e3);
    try {
      const endpoint = params.mediaType === "tv" ? `https://opensubtitles-v3.strem.io/subtitles/series/${cleanImdb}:${season}:${episode}.json` : `https://opensubtitles-v3.strem.io/subtitles/movie/${cleanImdb}.json`;
      const res = await fetch(endpoint, {
        signal: controller.signal,
        headers: { "User-Agent": DESKTOP_CHROME_UA }
      });
      if (!res.ok) return [];
      const json = await res.json();
      const rawSubs = Array.isArray(json.subtitles) ? json.subtitles : [];
      const priorityLangs = ["pob", "por", "eng", "spa", "fre", "ita", "ger", "jpn"];
      const perLangCount = /* @__PURE__ */ new Map();
      const selected = [];
      const ordered = [...rawSubs].sort((a, b) => {
        const ai = priorityLangs.indexOf((a.lang || "").toLowerCase());
        const bi = priorityLangs.indexOf((b.lang || "").toLowerCase());
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      for (const item of ordered) {
        if (!item.url || !isAllowedSubtitleHost(item.url)) continue;
        const lang = (item.lang || "und").toLowerCase();
        if (!priorityLangs.includes(lang)) continue;
        const count = perLangCount.get(lang) ?? 0;
        if (count >= 2) continue;
        perLangCount.set(lang, count + 1);
        const subId = this.registerSubtitleEntry({
          url: item.url,
          lang,
          encoding: item.SubEncoding
        });
        const baseLabel = formatSubtitleLangLabel(lang);
        const suffix = count > 0 ? ` #${count + 1}` : "";
        selected.push({
          id: subId,
          lang,
          label: `${baseLabel}${suffix}`,
          url: `/api/player/subtitle/${subId}.vtt`,
          isDefault: lang === "pob" && count === 0
        });
        if (selected.length >= 10) break;
      }
      if (this.subtitleCache.size > 300) {
        const firstKey = this.subtitleCache.keys().next().value;
        if (firstKey) this.subtitleCache.delete(firstKey);
      }
      this.subtitleCache.set(cacheKey, {
        subtitles: selected,
        expiresAt: Date.now() + 30 * 6e4
      });
      return selected;
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
  async handleHlsManifestRequest(token, req, res) {
    const session = this.resolveHlsSession(token);
    if (!session) {
      res.status(404).json({ error: "Sess\xE3o de stream expirada. Recarregue o player." });
      return;
    }
    const range = typeof req.headers.range === "string" ? req.headers.range : void 0;
    await this.proxyHlsResource(session, session.upstreamUrl, range, res);
  }
  async handleHlsSegmentRequest(token, targetUrl, sig, req, res) {
    const session = this.resolveHlsSession(token);
    if (!session) {
      res.status(404).json({ error: "Sess\xE3o de stream expirada. Recarregue o player." });
      return;
    }
    let parsedTarget;
    try {
      parsedTarget = new URL(targetUrl);
    } catch {
      res.status(400).json({ error: "URL de segmento inv\xE1lida." });
      return;
    }
    const targetHost = parsedTarget.hostname.toLowerCase();
    const sessionRoot = session.allowedHost.split(".").slice(-2).join(".");
    const hasValidSig = Boolean(sig && verifySegmentUrl(token, parsedTarget.toString(), sig));
    const isAllowed = (parsedTarget.protocol === "https:" || parsedTarget.protocol === "http:") && isSafePublicHost(targetHost) && (hasValidSig || session.allowedHosts.has(targetHost) || targetHost === session.allowedHost || targetHost.endsWith(`.${sessionRoot}`));
    if (!isAllowed) {
      res.status(403).json({ error: "Origem de segmento n\xE3o autorizada." });
      return;
    }
    const range = typeof req.headers.range === "string" ? req.headers.range : void 0;
    await this.proxyHlsResource(session, parsedTarget.toString(), range, res);
  }
  async proxyHlsResource(session, targetUrl, rangeHeader, res) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18e3);
    let activeStream = null;
    const onClientClose = () => {
      controller.abort();
      activeStream?.destroy();
    };
    res.on("close", onClientClose);
    const runFetch = async (withReferer) => {
      const headers = {
        "User-Agent": session.userAgent
      };
      if (withReferer && session.referer) {
        headers.Referer = session.referer;
        if (session.origin) headers.Origin = session.origin;
      }
      if (rangeHeader) {
        headers.Range = rangeHeader;
      }
      return fetch(targetUrl, {
        redirect: "follow",
        signal: controller.signal,
        headers
      });
    };
    try {
      let upstreamRes = await runFetch(session.sendReferer);
      if ((upstreamRes.status === 401 || upstreamRes.status === 403) && session.sendReferer) {
        const retryRes = await runFetch(false);
        if (retryRes.ok || retryRes.status === 206) {
          await upstreamRes.body?.cancel().catch(() => {
          });
          session.sendReferer = false;
          upstreamRes = retryRes;
        } else {
          await retryRes.body?.cancel().catch(() => {
          });
        }
      }
      if (!upstreamRes.ok && upstreamRes.status !== 206) {
        await upstreamRes.body?.cancel().catch(() => {
        });
        res.status(upstreamRes.status).end();
        return;
      }
      const effectiveUrl = upstreamRes.url || targetUrl;
      try {
        const effectiveHost = new URL(effectiveUrl).hostname.toLowerCase();
        if (isSafePublicHost(effectiveHost)) {
          session.allowedHosts.add(effectiveHost);
        }
      } catch {
      }
      const upstreamContentType = (upstreamRes.headers.get("content-type") || "").toLowerCase();
      const isPlaylist = upstreamContentType.includes("mpegurl") || /\.m3u8(?:$|\?)/i.test(effectiveUrl);
      if (isPlaylist) {
        const rawManifest = await upstreamRes.text();
        for (const host of extractPlaylistHosts(rawManifest, effectiveUrl)) {
          if (isSafePublicHost(host)) {
            session.allowedHosts.add(host);
          }
        }
        const rewritten = buildHlsProxyPlaylist(
          rawManifest,
          effectiveUrl,
          `/api/player/hls/${session.id}/seg`,
          (resolvedUrl) => signSegmentUrl(session.id, resolvedUrl)
        );
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.status(200).send(rewritten);
        return;
      }
      let resolvedMime = resolveSegmentMimeType(effectiveUrl, upstreamContentType);
      if (session.streamKind === "video" && resolvedMime === "application/octet-stream") {
        resolvedMime = "video/mp4";
      }
      res.setHeader("Content-Type", resolvedMime);
      res.setHeader("Cache-Control", "public, max-age=3600");
      const acceptRanges = upstreamRes.headers.get("accept-ranges");
      const contentRange = upstreamRes.headers.get("content-range");
      const contentLength = upstreamRes.headers.get("content-length");
      if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);
      if (contentRange) res.setHeader("Content-Range", contentRange);
      if (contentLength) res.setHeader("Content-Length", contentLength);
      res.status(upstreamRes.status);
      if (upstreamRes.body) {
        const nodeStream = Readable.fromWeb(
          upstreamRes.body
        );
        activeStream = nodeStream;
        nodeStream.on("error", () => {
          if (!res.headersSent) res.status(502).end();
          else res.end();
        });
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch {
      if (!res.headersSent) {
        res.status(502).json({ error: "Falha ao transmitir segmento de v\xEDdeo." });
      }
    } finally {
      clearTimeout(timer);
      res.off("close", onClientClose);
    }
  }
  async handleSubtitleVttRequest(subId, res) {
    const entry = this.resolveSubtitleEntry(subId);
    if (!entry || !isAllowedSubtitleHost(entry.url)) {
      res.status(404).send("WEBVTT\n\n");
      return;
    }
    if (entry.vttCache) {
      res.setHeader("Content-Type", "text/vtt; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(entry.vttCache);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8e3);
    try {
      const upstream = await fetch(entry.url, {
        signal: controller.signal,
        headers: { "User-Agent": DESKTOP_CHROME_UA }
      });
      if (!upstream.ok) {
        res.status(404).send("WEBVTT\n\n");
        return;
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      const rawText = decodeSubtitleBuffer(buf);
      const vtt = convertSrtToVtt(rawText);
      entry.vttCache = vtt;
      res.setHeader("Content-Type", "text/vtt; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(vtt);
    } catch {
      res.status(502).send("WEBVTT\n\n");
    } finally {
      clearTimeout(timer);
    }
  }
};
var StreamResolverService = new StreamResolverServiceImpl();

// server/data/demoCatalog.ts
var DEMO_MOVIE_GENRES = [
  { id: 28, name: "A\xE7\xE3o" },
  { id: 12, name: "Aventura" },
  { id: 16, name: "Anima\xE7\xF5es" },
  { id: 35, name: "Com\xE9dia" },
  { id: 99, name: "Document\xE1rios" },
  { id: 18, name: "Drama" },
  { id: 878, name: "Fic\xE7\xE3o Cient\xEDfica" },
  { id: 10749, name: "Romance" },
  { id: 53, name: "Suspense" },
  { id: 27, name: "Terror" }
];
var DEMO_TV_GENRES = [
  { id: 10759, name: "A\xE7\xE3o e Aventura" },
  { id: 16, name: "Anima\xE7\xF5es" },
  { id: 35, name: "Com\xE9dia" },
  { id: 99, name: "Document\xE1rios" },
  { id: 18, name: "Drama" },
  { id: 9648, name: "Suspense" },
  { id: 10765, name: "Fic\xE7\xE3o Cient\xEDfica" }
];
var HERO_DUNE_BACKDROP = "/src/assets/images/hero_scifi_dune_backdrop_1794602722751.jpg";
var POSTER_NOIR = "/src/assets/images/poster_cyber_noir_batman_1794602723138.jpg";
var POSTER_OCEAN = "/src/assets/images/poster_ocean_avatar_1794602723299.jpg";
var LIVE_STADIUM = "/src/assets/images/live_tv_broadcast_backdrop_1794602724810.jpg";
var DEMO_MEDIA_CATALOG = [
  {
    id: 693134,
    tmdbId: 693134,
    mediaType: "movie",
    title: "Duna: Parte Dois",
    originalTitle: "Dune: Part Two",
    overview: "Paul Atreides se une a Chani e aos Fremen em uma jornada de vingan\xE7a contra os conspiradores que destru\xEDram sua fam\xEDlia, enfrentando escolhas que definem o destino do universo.",
    posterPath: HERO_DUNE_BACKDROP,
    backdropPath: HERO_DUNE_BACKDROP,
    releaseDate: "2024-02-27",
    releaseYear: "2024",
    voteAverage: 8.5,
    voteCount: 5980,
    popularity: 990,
    genreIds: [878, 12, 18],
    genres: [
      { id: 878, name: "Fic\xE7\xE3o Cient\xEDfica" },
      { id: 12, name: "Aventura" },
      { id: 18, name: "Drama" }
    ],
    originalLanguage: "en",
    originCountry: ["US"],
    source: "demo"
  },
  {
    id: 76600,
    tmdbId: 76600,
    mediaType: "movie",
    title: "Avatar: O Caminho da \xC1gua",
    originalTitle: "Avatar: The Way of Water",
    overview: "Jake Sully vive com sua nova fam\xEDlia em Pandora. Quando uma antiga amea\xE7a retorna, ele precisa trabalhar com o ex\xE9rcito dos Na\u2019vi para proteger seu lar.",
    posterPath: POSTER_OCEAN,
    backdropPath: POSTER_OCEAN,
    releaseDate: "2022-12-14",
    releaseYear: "2022",
    voteAverage: 7.7,
    voteCount: 11800,
    popularity: 910,
    genreIds: [878, 12, 28],
    genres: [
      { id: 878, name: "Fic\xE7\xE3o Cient\xEDfica" },
      { id: 12, name: "Aventura" },
      { id: 28, name: "A\xE7\xE3o" }
    ],
    originalLanguage: "en",
    originCountry: ["US"],
    source: "demo"
  },
  {
    id: 414906,
    tmdbId: 414906,
    mediaType: "movie",
    title: "Batman",
    originalTitle: "The Batman",
    overview: "Ap\xF3s dois anos espreitando as ruas como o Batman, Bruce Wayne mergulha nas sombras de Gotham City ao investigar um assassino que mira a elite da cidade.",
    posterPath: POSTER_NOIR,
    backdropPath: POSTER_NOIR,
    releaseDate: "2022-03-01",
    releaseYear: "2022",
    voteAverage: 7.9,
    voteCount: 10200,
    popularity: 880,
    genreIds: [28, 53, 18],
    genres: [
      { id: 28, name: "A\xE7\xE3o" },
      { id: 53, name: "Suspense" },
      { id: 18, name: "Drama" }
    ],
    originalLanguage: "en",
    originCountry: ["US"],
    source: "demo"
  },
  {
    id: 82856,
    tmdbId: 82856,
    mediaType: "tv",
    title: "The Mandalorian",
    originalTitle: "The Mandalorian",
    overview: "A jornada de um ca\xE7ador de recompensas solit\xE1rio nos confins da gal\xE1xia, longe da autoridade da Nova Rep\xFAblica, protegendo uma crian\xE7a misteriosa.",
    posterPath: HERO_DUNE_BACKDROP,
    backdropPath: HERO_DUNE_BACKDROP,
    releaseDate: "2019-11-12",
    releaseYear: "2019",
    voteAverage: 8.5,
    voteCount: 9900,
    popularity: 940,
    genreIds: [10765, 10759, 18],
    genres: [
      { id: 10765, name: "Fic\xE7\xE3o Cient\xEDfica" },
      { id: 10759, name: "A\xE7\xE3o e Aventura" },
      { id: 18, name: "Drama" }
    ],
    originalLanguage: "en",
    originCountry: ["US"],
    source: "demo"
  },
  {
    id: 66732,
    tmdbId: 66732,
    mediaType: "tv",
    title: "Stranger Things",
    originalTitle: "Stranger Things",
    overview: "Quando um garoto desaparece em Hawkins, uma pequena cidade descobre um mist\xE9rio envolvendo experimentos secretos, for\xE7as sobrenaturais e uma garota extraordin\xE1ria.",
    posterPath: POSTER_NOIR,
    backdropPath: POSTER_NOIR,
    releaseDate: "2016-07-15",
    releaseYear: "2016",
    voteAverage: 8.6,
    voteCount: 17500,
    popularity: 960,
    genreIds: [10765, 9648, 18],
    genres: [
      { id: 10765, name: "Fic\xE7\xE3o Cient\xEDfica" },
      { id: 9648, name: "Suspense" },
      { id: 18, name: "Drama" }
    ],
    originalLanguage: "en",
    originCountry: ["US"],
    source: "demo"
  },
  {
    id: 603692,
    tmdbId: 603692,
    mediaType: "movie",
    title: "John Wick 4: Baba Yaga",
    originalTitle: "John Wick: Chapter 4",
    overview: "John Wick descobre um caminho para derrotar a Alta C\xFApula, mas antes precisa enfrentar um novo inimigo com alian\xE7as poderosas ao redor do mundo.",
    posterPath: POSTER_NOIR,
    backdropPath: POSTER_NOIR,
    releaseDate: "2023-03-22",
    releaseYear: "2023",
    voteAverage: 7.8,
    voteCount: 6400,
    popularity: 850,
    genreIds: [28, 53],
    genres: [
      { id: 28, name: "A\xE7\xE3o" },
      { id: 53, name: "Suspense" }
    ],
    originalLanguage: "en",
    originCountry: ["US"],
    source: "demo"
  },
  {
    id: 361743,
    tmdbId: 361743,
    mediaType: "movie",
    title: "Top Gun: Maverick",
    originalTitle: "Top Gun: Maverick",
    overview: "Depois de mais de trinta anos de servi\xE7o como um dos principais aviadores da Marinha, Pete Mitchell volta para treinar uma nova gera\xE7\xE3o de pilotos de elite.",
    posterPath: HERO_DUNE_BACKDROP,
    backdropPath: LIVE_STADIUM,
    releaseDate: "2022-05-24",
    releaseYear: "2022",
    voteAverage: 8.2,
    voteCount: 9100,
    popularity: 830,
    genreIds: [28, 18],
    genres: [
      { id: 28, name: "A\xE7\xE3o" },
      { id: 18, name: "Drama" }
    ],
    originalLanguage: "en",
    originCountry: ["US"],
    source: "demo"
  },
  {
    id: 634649,
    tmdbId: 634649,
    mediaType: "movie",
    title: "Homem-Aranha: Sem Volta para Casa",
    originalTitle: "Spider-Man: No Way Home",
    overview: "Com sua identidade revelada, Peter Parker pede ajuda ao Doutor Estranho, mas um feiti\xE7o quebrado abre portais para visitantes perigosos de outros mundos.",
    posterPath: POSTER_OCEAN,
    backdropPath: POSTER_OCEAN,
    releaseDate: "2021-12-15",
    releaseYear: "2021",
    voteAverage: 8,
    voteCount: 19900,
    popularity: 820,
    genreIds: [28, 12, 878],
    genres: [
      { id: 28, name: "A\xE7\xE3o" },
      { id: 12, name: "Aventura" },
      { id: 878, name: "Fic\xE7\xE3o Cient\xEDfica" }
    ],
    originalLanguage: "en",
    originCountry: ["US"],
    source: "demo"
  },
  {
    id: 475557,
    tmdbId: 475557,
    mediaType: "movie",
    title: "Coringa",
    originalTitle: "Joker",
    overview: "Isolado, intimidado e desconsiderado pela sociedade, Arthur Fleck come\xE7a uma lenta descida \xE0 loucura em Gotham City at\xE9 assumir o alter ego Coringa.",
    posterPath: POSTER_NOIR,
    backdropPath: POSTER_NOIR,
    releaseDate: "2019-10-01",
    releaseYear: "2019",
    voteAverage: 8.2,
    voteCount: 25400,
    popularity: 810,
    genreIds: [18, 53],
    genres: [
      { id: 18, name: "Drama" },
      { id: 53, name: "Suspense" }
    ],
    originalLanguage: "en",
    originCountry: ["US"],
    source: "demo"
  },
  {
    id: 100088,
    tmdbId: 100088,
    mediaType: "tv",
    title: "The Last of Us",
    originalTitle: "The Last of Us",
    overview: "Vinte anos ap\xF3s a destrui\xE7\xE3o da civiliza\xE7\xE3o moderna, Joel \xE9 contratado para tirar Ellie de uma zona de quarentena opressiva em uma jornada brutal pelos EUA.",
    posterPath: POSTER_NOIR,
    backdropPath: HERO_DUNE_BACKDROP,
    releaseDate: "2023-01-15",
    releaseYear: "2023",
    voteAverage: 8.6,
    voteCount: 5200,
    popularity: 905,
    genreIds: [18, 10759],
    genres: [
      { id: 18, name: "Drama" },
      { id: 10759, name: "A\xE7\xE3o e Aventura" }
    ],
    originalLanguage: "en",
    originCountry: ["US"],
    source: "demo"
  },
  {
    id: 94605,
    tmdbId: 94605,
    mediaType: "tv",
    title: "Arcane",
    originalTitle: "Arcane",
    overview: "Em meio ao conflito entre as cidades g\xEAmeas de Piltover e Zaun, duas irm\xE3s lutam em lados opostos de uma guerra entre tecnologias m\xE1gicas e convic\xE7\xF5es.",
    posterPath: POSTER_OCEAN,
    backdropPath: POSTER_OCEAN,
    releaseDate: "2021-11-06",
    releaseYear: "2021",
    voteAverage: 8.8,
    voteCount: 4700,
    popularity: 870,
    genreIds: [16, 10765, 18],
    genres: [
      { id: 16, name: "Anima\xE7\xF5es" },
      { id: 10765, name: "Fic\xE7\xE3o Cient\xEDfica" },
      { id: 18, name: "Drama" }
    ],
    originalLanguage: "en",
    originCountry: ["US", "FR"],
    source: "demo"
  },
  {
    id: 1439930,
    tmdbId: 1439930,
    mediaType: "movie",
    title: "Miss\xE3o Horizonte (Demo TMDB)",
    originalTitle: "Horizon Mission",
    overview: "Exemplo de refer\xEAncia com ID TMDB 1439930 para validar incorpora\xE7\xE3o direta com o player MegaEmbed no ambiente de demonstra\xE7\xE3o.",
    posterPath: HERO_DUNE_BACKDROP,
    backdropPath: HERO_DUNE_BACKDROP,
    releaseDate: "2025-01-15",
    releaseYear: "2025",
    voteAverage: 8.1,
    voteCount: 320,
    popularity: 790,
    genreIds: [28, 878, 12],
    genres: [
      { id: 28, name: "A\xE7\xE3o" },
      { id: 878, name: "Fic\xE7\xE3o Cient\xEDfica" },
      { id: 12, name: "Aventura" }
    ],
    originalLanguage: "en",
    originCountry: ["US"],
    source: "demo"
  }
];
function getDemoMediaDetail(tmdbId, mediaType) {
  const base = DEMO_MEDIA_CATALOG.find((item) => item.tmdbId === tmdbId && item.mediaType === mediaType) ?? DEMO_MEDIA_CATALOG.find((item) => item.tmdbId === tmdbId);
  if (!base) return null;
  const related = DEMO_MEDIA_CATALOG.filter((m) => m.tmdbId !== base.tmdbId).slice(0, 6);
  return {
    ...base,
    runtime: mediaType === "movie" ? 166 : 45,
    status: mediaType === "movie" ? "Lan\xE7ado" : "Em Exibi\xE7\xE3o",
    tagline: "Experi\xEAncia cinematogr\xE1fica em alta defini\xE7\xE3o (Modo Demonstra\xE7\xE3o)",
    director: mediaType === "movie" ? "Denis Villeneuve" : "Jon Favreau",
    cast: [
      { id: 101, name: "Elenco Principal 1", character: "Protagonista", profilePath: null },
      { id: 102, name: "Elenco Principal 2", character: "Co-protagonista", profilePath: null },
      { id: 103, name: "Elenco Principal 3", character: "Antagonista", profilePath: null },
      { id: 104, name: "Elenco Principal 4", character: "Mentor", profilePath: null }
    ],
    videos: [],
    recommendations: related,
    similar: related.slice().reverse(),
    ...mediaType === "tv" ? {
      numberOfSeasons: 2,
      numberOfEpisodes: 16,
      seasons: [
        {
          id: 1,
          seasonNumber: 1,
          name: "Temporada 1",
          overview: "Temporada inicial da s\xE9rie com 8 epis\xF3dios.",
          posterPath: base.posterPath,
          episodeCount: 8,
          airDate: base.releaseDate
        },
        {
          id: 2,
          seasonNumber: 2,
          name: "Temporada 2",
          overview: "Segunda temporada expandindo o universo da trama.",
          posterPath: base.posterPath,
          episodeCount: 8,
          airDate: "2024-05-01"
        }
      ]
    } : {}
  };
}
function getDemoSeasonDetail(tmdbId, seasonNumber) {
  const item = DEMO_MEDIA_CATALOG.find((m) => m.tmdbId === tmdbId);
  return {
    id: seasonNumber,
    seasonNumber,
    name: `Temporada ${seasonNumber}`,
    overview: `Epis\xF3dios da Temporada ${seasonNumber} (Modo Demonstra\xE7\xE3o).`,
    posterPath: item?.posterPath ?? HERO_DUNE_BACKDROP,
    episodeCount: 6,
    airDate: item?.releaseDate ?? "2024-01-01",
    episodes: Array.from({ length: 6 }, (_, idx) => ({
      id: seasonNumber * 100 + idx + 1,
      episodeNumber: idx + 1,
      seasonNumber,
      name: `Epis\xF3dio ${idx + 1} \u2014 Cap\xEDtulo ${idx + 1}`,
      overview: `Descri\xE7\xE3o do epis\xF3dio ${idx + 1} da temporada ${seasonNumber} dispon\xEDvel ao conectar TMDB_ACCESS_TOKEN.`,
      stillPath: item?.backdropPath ?? HERO_DUNE_BACKDROP,
      runtime: 44 + idx % 3 * 4,
      airDate: "2024-01-10",
      voteAverage: 8.2 + idx % 4 * 0.1
    }))
  };
}

// server/services/TMDBService.ts
var TMDBServiceImpl = class {
  constructor() {
    this.detectedImageBaseUrl = null;
    this.externalImdbCache = /* @__PURE__ */ new Map();
  }
  getToken() {
    return SystemSettingsService.getActiveTmdbToken().token;
  }
  isTokenAvailable() {
    return Boolean(this.getToken());
  }
  isConfigured() {
    const settings = SystemSettingsService.getSettings();
    if (settings.catalogSource === "demo" || settings.catalogSource === "custom_only") {
      return false;
    }
    return this.isTokenAvailable();
  }
  isCustomOnly() {
    return SystemSettingsService.getSettings().catalogSource === "custom_only";
  }
  getActiveImageBaseUrl() {
    const configured = SystemSettingsService.getSettings().tmdbImageBaseUrl;
    if (configured && configured !== "https://image.tmdb.org/t/p/") {
      return configured;
    }
    return this.detectedImageBaseUrl || configured || "https://image.tmdb.org/t/p/";
  }
  getDemoOrCustomBaseCatalog() {
    const customAsMedia = repositoryStore.getCustomCatalog().filter((c) => c.active).map(customMediaToMediaItem);
    if (this.isCustomOnly()) {
      return deduplicateMediaByTmdbId(customAsMedia);
    }
    return deduplicateMediaByTmdbId([...customAsMedia, ...DEMO_MEDIA_CATALOG]);
  }
  async request(endpoint, params = {}) {
    const token = this.getToken();
    if (!token) {
      throw new Error("TMDB_ACCESS_TOKEN n\xE3o configurado");
    }
    const settings = SystemSettingsService.getSettings();
    const baseUrl = (settings.tmdbBaseUrl || "https://api.themoviedb.org/3").replace(/\/+$/, "");
    const url = new URL(`${baseUrl}${endpoint}`);
    if (!params.language) {
      url.searchParams.set("language", settings.tmdbLanguage || "pt-BR");
    }
    for (const [k, v] of Object.entries(params)) {
      if (v !== void 0 && v !== null && String(v).trim() !== "") {
        url.searchParams.set(k, String(v));
      }
    }
    const isBearerJwt = token.length > 40 || token.includes(".");
    if (!isBearerJwt) {
      url.searchParams.set("api_key", token);
    }
    const cacheKey = `tmdb:${settings.catalogSource}:${settings.tmdbLanguage}:${settings.tmdbImageQuality}:${settings.tmdbImageBaseUrl}:${url.toString()}`;
    const cached = CacheService.get(cacheKey);
    if (cached) return cached;
    const headers = { Accept: "application/json" };
    if (isBearerJwt) {
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(url.toString(), {
      headers,
      signal: AbortSignal.timeout(12e3)
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      repositoryStore.addLog({
        level: "error",
        service: "TMDBService",
        message: `Erro TMDB ${response.status} em ${endpoint}: ${body.slice(0, 160)}`
      });
      throw new Error(`TMDB API retornou status ${response.status}`);
    }
    const data = await response.json();
    const ttlMs = Math.max(1, settings.cacheTtlMinutes || 10) * 60 * 1e3;
    CacheService.set(cacheKey, data, ttlMs);
    return data;
  }
  async testConnection() {
    await SystemSettingsService.ensureHydrated();
    const started = Date.now();
    const settings = SystemSettingsService.getSettings();
    const tokenInfo = SystemSettingsService.getActiveTmdbToken();
    if (settings.catalogSource === "demo" || settings.catalogSource === "custom_only") {
      return {
        target: "tmdb",
        ok: true,
        latencyMs: Date.now() - started,
        message: `Fonte ativa configurada como "${settings.catalogSource}". Chamadas externas TMDB est\xE3o desabilitadas por escolha do administrador.`,
        detail: `Base configurada: ${settings.tmdbBaseUrl}`,
        testedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    if (!tokenInfo.token) {
      return {
        target: "tmdb",
        ok: false,
        latencyMs: Date.now() - started,
        message: "Nenhum token TMDB encontrado (nem em Secrets nem nas Configura\xE7\xF5es de API).",
        detail: "Informe um TMDB Access Token (v4) ou API Key (v3) em Fontes de API ou use o modo Demonstra\xE7\xE3o.",
        testedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    try {
      const baseUrl = (settings.tmdbBaseUrl || "https://api.themoviedb.org/3").replace(/\/+$/, "");
      const url = new URL(`${baseUrl}/configuration`);
      const isBearerJwt = tokenInfo.token.length > 40 || tokenInfo.token.includes(".");
      const headers = { Accept: "application/json" };
      if (isBearerJwt) {
        headers.Authorization = `Bearer ${tokenInfo.token}`;
      } else {
        url.searchParams.set("api_key", tokenInfo.token);
      }
      const res = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(1e4) });
      const latencyMs = Date.now() - started;
      if (!res.ok) {
        return {
          target: "tmdb",
          ok: false,
          latencyMs,
          statusCode: res.status,
          message: `Falha ao autenticar no TMDB (${res.status}). Verifique o token configurado (${tokenInfo.source}).`,
          detail: baseUrl,
          testedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      return {
        target: "tmdb",
        ok: true,
        latencyMs,
        statusCode: res.status,
        message: `Conex\xE3o TMDB validada com sucesso via ${tokenInfo.source === "admin_override" ? "Token do Painel Admin" : "Secret do Servidor"}.`,
        detail: `${baseUrl} \xB7 idioma ${settings.tmdbLanguage}`,
        testedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (err) {
      return {
        target: "tmdb",
        ok: false,
        latencyMs: Date.now() - started,
        message: `Erro de rede ao conectar em ${settings.tmdbBaseUrl}: ${err instanceof Error ? err.message : String(err)}`,
        testedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  }
  async ensureImageConfig() {
    if (!this.isConfigured()) return this.getActiveImageBaseUrl();
    const settings = SystemSettingsService.getSettings();
    if (settings.tmdbImageBaseUrl && settings.tmdbImageBaseUrl !== "https://image.tmdb.org/t/p/") {
      return settings.tmdbImageBaseUrl;
    }
    const cached = CacheService.get("tmdb:image_base_url");
    if (cached) return cached;
    try {
      const cfg = await this.request("/configuration", {});
      if (cfg.images?.secure_base_url) {
        this.detectedImageBaseUrl = cfg.images.secure_base_url;
        CacheService.set("tmdb:image_base_url", this.detectedImageBaseUrl, 60 * 60 * 1e3);
      }
    } catch {
    }
    return this.getActiveImageBaseUrl();
  }
  mapMedia(raw, forcedType) {
    const mediaType = forcedType ?? (raw.media_type === "tv" ? "tv" : "movie");
    const releaseDate = raw.release_date ?? raw.first_air_date ?? "";
    const imageBase = this.getActiveImageBaseUrl();
    const posterQuality = SystemSettingsService.getSettings().tmdbImageQuality || "w500";
    return {
      id: raw.id,
      tmdbId: raw.id,
      mediaType,
      title: raw.title ?? raw.name ?? "Sem t\xEDtulo",
      originalTitle: raw.original_title ?? raw.original_name ?? raw.title ?? raw.name ?? "",
      overview: raw.overview || "Sinopse indispon\xEDvel no momento.",
      posterPath: buildTmdbImageUrl(raw.poster_path, posterQuality, imageBase),
      backdropPath: buildTmdbImageUrl(raw.backdrop_path, "w1280", imageBase),
      releaseDate,
      releaseYear: releaseDate ? releaseDate.slice(0, 4) : "",
      voteAverage: Number((raw.vote_average ?? 0).toFixed(1)),
      voteCount: raw.vote_count ?? 0,
      popularity: raw.popularity ?? 0,
      genreIds: raw.genre_ids ?? (raw.genres ? raw.genres.map((g) => g.id) : []),
      genres: raw.genres,
      originalLanguage: raw.original_language ?? "en",
      originCountry: raw.origin_country ?? [],
      adult: raw.adult ?? false,
      source: "tmdb"
    };
  }
  async getGenres(mediaType) {
    await SystemSettingsService.ensureHydrated();
    if (!this.isConfigured()) {
      return mediaType === "movie" ? DEMO_MOVIE_GENRES : DEMO_TV_GENRES;
    }
    const res = await this.request(`/genre/${mediaType}/list`);
    return res.genres ?? [];
  }
  async getMovieList(category, page = 1) {
    await SystemSettingsService.ensureHydrated();
    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(this.getDemoOrCustomBaseCatalog(), {
        mediaType: "movie",
        sortBy: category === "top_rated" ? "rating" : category === "upcoming" ? "release_date" : "popularity",
        page,
        pageSize: 20
      });
      return { ...subset, source: "demo", demoMode: true };
    }
    await this.ensureImageConfig();
    const res = await this.request(`/movie/${category}`, { page });
    return {
      items: deduplicateMediaByTmdbId((res.results ?? []).map((r) => this.mapMedia(r, "movie"))),
      page: res.page ?? page,
      totalPages: Math.min(res.total_pages ?? 1, 500),
      totalResults: res.total_results ?? 0,
      source: "tmdb",
      demoMode: false
    };
  }
  async getSeriesList(category, page = 1) {
    await SystemSettingsService.ensureHydrated();
    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(this.getDemoOrCustomBaseCatalog(), {
        mediaType: "tv",
        sortBy: category === "top_rated" ? "rating" : category === "airing_today" ? "release_date" : "popularity",
        page,
        pageSize: 20
      });
      return { ...subset, source: "demo", demoMode: true };
    }
    await this.ensureImageConfig();
    const res = await this.request(`/tv/${category}`, { page });
    return {
      items: deduplicateMediaByTmdbId((res.results ?? []).map((r) => this.mapMedia(r, "tv"))),
      page: res.page ?? page,
      totalPages: Math.min(res.total_pages ?? 1, 500),
      totalResults: res.total_results ?? 0,
      source: "tmdb",
      demoMode: false
    };
  }
  async getTrending(page = 1) {
    await SystemSettingsService.ensureHydrated();
    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(this.getDemoOrCustomBaseCatalog(), {
        sortBy: "popularity",
        page,
        pageSize: 20
      });
      return { ...subset, source: "demo", demoMode: true };
    }
    await this.ensureImageConfig();
    const res = await this.request("/trending/all/week", { page });
    const valid = (res.results ?? []).filter((r) => r.media_type === "movie" || r.media_type === "tv");
    return {
      items: deduplicateMediaByTmdbId(valid.map((r) => this.mapMedia(r))),
      page: res.page ?? page,
      totalPages: Math.min(res.total_pages ?? 1, 500),
      totalResults: res.total_results ?? 0,
      source: "tmdb",
      demoMode: false
    };
  }
  async discover(params) {
    await Promise.all([SiteConfigService.ensureHydrated(), SystemSettingsService.ensureHydrated()]);
    const page = Math.max(1, params.page ?? 1);
    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(this.getDemoOrCustomBaseCatalog(), {
        ...params,
        page,
        pageSize: 20
      });
      return { ...subset, source: "demo", demoMode: true };
    }
    await this.ensureImageConfig();
    if (params.query && params.query.trim().length > 0) {
      return this.search(params.query.trim(), params.mediaType, page);
    }
    const buildDiscoverQuery = (targetType2) => {
      const sortMap = {
        popularity: "popularity.desc",
        rating: "vote_average.desc",
        release_date: targetType2 === "movie" ? "primary_release_date.desc" : "first_air_date.desc"
      };
      const q = {
        page,
        sort_by: sortMap[params.sortBy ?? "popularity"] ?? "popularity.desc",
        with_genres: params.genreId ?? void 0,
        "vote_average.gte": params.minRating ?? void 0,
        "vote_count.gte": params.sortBy === "rating" ? 100 : void 0,
        with_original_language: params.language && params.language !== "all" ? params.language : void 0,
        with_origin_country: params.country && params.country !== "all" ? params.country : void 0
      };
      if (params.year) {
        if (targetType2 === "movie") q.primary_release_year = params.year;
        else q.first_air_date_year = params.year;
      }
      return q;
    };
    if (params.mediaType === "all") {
      const [movieRes, tvRes] = await Promise.all([
        this.request("/discover/movie", buildDiscoverQuery("movie")),
        this.request("/discover/tv", buildDiscoverQuery("tv"))
      ]);
      const merged = deduplicateMediaByTmdbId([
        ...(movieRes.results ?? []).map((r) => this.mapMedia(r, "movie")),
        ...(tvRes.results ?? []).map((r) => this.mapMedia(r, "tv"))
      ]).sort((a, b) => {
        if (params.sortBy === "rating") return b.voteAverage - a.voteAverage;
        if (params.sortBy === "release_date") return (b.releaseDate || "").localeCompare(a.releaseDate || "");
        return b.popularity - a.popularity;
      });
      return {
        items: merged,
        page,
        totalPages: Math.min(Math.max(movieRes.total_pages ?? 1, tvRes.total_pages ?? 1), 500),
        totalResults: (movieRes.total_results ?? 0) + (tvRes.total_results ?? 0),
        source: "tmdb",
        demoMode: false
      };
    }
    const targetType = params.mediaType === "tv" ? "tv" : "movie";
    const res = await this.request(`/discover/${targetType}`, buildDiscoverQuery(targetType));
    return {
      items: deduplicateMediaByTmdbId((res.results ?? []).map((r) => this.mapMedia(r, targetType))),
      page: res.page ?? page,
      totalPages: Math.min(res.total_pages ?? 1, 500),
      totalResults: res.total_results ?? 0,
      source: "tmdb",
      demoMode: false
    };
  }
  async search(query, mediaType = "all", page = 1) {
    await SystemSettingsService.ensureHydrated();
    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(this.getDemoOrCustomBaseCatalog(), {
        mediaType,
        query,
        page,
        pageSize: 20
      });
      return { ...subset, source: "demo", demoMode: true };
    }
    await this.ensureImageConfig();
    const endpoint = mediaType === "movie" ? "/search/movie" : mediaType === "tv" ? "/search/tv" : "/search/multi";
    const includeAdult = SystemSettingsService.getSettings().includeAdult ? "true" : "false";
    const res = await this.request(endpoint, { query, page, include_adult: includeAdult });
    const valid = (res.results ?? []).filter(
      (r) => mediaType === "all" ? r.media_type === "movie" || r.media_type === "tv" : true
    );
    return {
      items: deduplicateMediaByTmdbId(
        valid.map((r) => this.mapMedia(r, mediaType === "all" ? void 0 : mediaType))
      ),
      page: res.page ?? page,
      totalPages: Math.min(res.total_pages ?? 1, 500),
      totalResults: res.total_results ?? 0,
      source: "tmdb",
      demoMode: false
    };
  }
  async getDetail(tmdbId, mediaType) {
    await Promise.all([SiteConfigService.ensureHydrated(), SystemSettingsService.ensureHydrated()]);
    const customMatch = repositoryStore.getCustomCatalog().find((c) => c.active && c.tmdbId === tmdbId && c.mediaType === mediaType);
    if (!this.isConfigured()) {
      const demo = getDemoMediaDetail(tmdbId, mediaType);
      if (customMatch) {
        const baseCustom = customMediaToMediaItem(customMatch);
        if (!demo) {
          return {
            ...baseCustom,
            runtime: null,
            status: "Dispon\xEDvel",
            tagline: "",
            director: null,
            cast: [],
            videos: [],
            recommendations: DEMO_MEDIA_CATALOG.slice(0, 6),
            similar: DEMO_MEDIA_CATALOG.slice(6, 12),
            seasons: mediaType === "tv" ? [{ id: 1, seasonNumber: 1, name: "Temporada 1", overview: "", posterPath: baseCustom.posterPath, episodeCount: 1, airDate: "" }] : void 0
          };
        }
        return {
          ...demo,
          title: customMatch.title,
          originalTitle: customMatch.originalTitle || demo.originalTitle,
          overview: customMatch.overview || demo.overview,
          posterPath: customMatch.posterPath ?? demo.posterPath,
          backdropPath: customMatch.backdropPath ?? demo.backdropPath,
          releaseYear: customMatch.releaseYear || demo.releaseYear,
          voteAverage: customMatch.voteAverage
        };
      }
      return demo;
    }
    await this.ensureImageConfig();
    let raw;
    try {
      raw = await this.request(`/${mediaType}/${tmdbId}`, {
        append_to_response: "credits,videos,recommendations,similar"
      });
    } catch (err) {
      if (customMatch) {
        const baseCustom = customMediaToMediaItem(customMatch);
        return {
          ...baseCustom,
          runtime: null,
          status: "Dispon\xEDvel",
          tagline: "",
          director: null,
          cast: [],
          videos: [],
          recommendations: [],
          similar: [],
          seasons: mediaType === "tv" ? [{ id: 1, seasonNumber: 1, name: "Temporada 1", overview: "", posterPath: baseCustom.posterPath, episodeCount: 1, airDate: "" }] : void 0
        };
      }
      throw err;
    }
    const base = this.mapMedia(raw, mediaType);
    const director = raw.credits?.crew?.find((c) => c.job === "Director" || c.job === "Creator")?.name ?? null;
    const imageBase = this.getActiveImageBaseUrl();
    const cast = (raw.credits?.cast ?? []).slice(0, 14).map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profilePath: buildTmdbImageUrl(c.profile_path, "w185", imageBase)
    }));
    const videos = (raw.videos?.results ?? []).filter((v) => v.site === "YouTube");
    const recommendations = deduplicateMediaByTmdbId(
      (raw.recommendations?.results ?? []).map((r) => this.mapMedia(r, mediaType))
    );
    const similar = deduplicateMediaByTmdbId(
      (raw.similar?.results ?? []).map((r) => this.mapMedia(r, mediaType))
    );
    const detail = {
      ...base,
      runtime: raw.runtime ?? raw.episode_run_time?.[0] ?? null,
      status: raw.status ?? "",
      tagline: raw.tagline ?? "",
      director,
      cast,
      videos,
      recommendations,
      similar,
      numberOfSeasons: raw.number_of_seasons,
      numberOfEpisodes: raw.number_of_episodes,
      seasons: (raw.seasons ?? []).map((s) => ({
        id: s.id,
        seasonNumber: s.season_number,
        name: s.name,
        overview: s.overview,
        posterPath: buildTmdbImageUrl(s.poster_path, "w342", imageBase),
        episodeCount: s.episode_count,
        airDate: s.air_date ?? ""
      }))
    };
    if (customMatch) {
      return {
        ...detail,
        title: customMatch.title,
        originalTitle: customMatch.originalTitle || detail.originalTitle,
        overview: customMatch.overview || detail.overview,
        posterPath: customMatch.posterPath ?? detail.posterPath,
        backdropPath: customMatch.backdropPath ?? detail.backdropPath,
        releaseYear: customMatch.releaseYear || detail.releaseYear,
        voteAverage: customMatch.voteAverage
      };
    }
    return detail;
  }
  async getSeasonEpisodes(tmdbId, seasonNumber) {
    await SystemSettingsService.ensureHydrated();
    if (!this.isConfigured()) {
      return getDemoSeasonDetail(tmdbId, seasonNumber);
    }
    await this.ensureImageConfig();
    const imageBase = this.getActiveImageBaseUrl();
    const raw = await this.request(`/tv/${tmdbId}/season/${seasonNumber}`);
    const episodes = (raw.episodes ?? []).map((ep) => ({
      id: ep.id,
      episodeNumber: ep.episode_number,
      seasonNumber: ep.season_number,
      name: ep.name,
      overview: ep.overview || "Descri\xE7\xE3o do epis\xF3dio indispon\xEDvel.",
      stillPath: buildTmdbImageUrl(ep.still_path, "w500", imageBase),
      runtime: ep.runtime,
      airDate: ep.air_date ?? "",
      voteAverage: Number((ep.vote_average ?? 0).toFixed(1))
    }));
    return {
      id: raw.id,
      seasonNumber: raw.season_number,
      name: raw.name,
      overview: raw.overview,
      posterPath: buildTmdbImageUrl(raw.poster_path, "w342", imageBase),
      episodeCount: episodes.length,
      airDate: raw.air_date ?? "",
      episodes
    };
  }
  async getExternalImdbId(tmdbId, mediaType) {
    const cacheKey = `${mediaType}:${tmdbId}`;
    if (this.externalImdbCache.has(cacheKey)) {
      return this.externalImdbCache.get(cacheKey) ?? null;
    }
    await SystemSettingsService.ensureHydrated();
    if (!this.isConfigured()) {
      return null;
    }
    try {
      const path5 = mediaType === "tv" ? `/tv/${tmdbId}/external_ids` : `/movie/${tmdbId}/external_ids`;
      const data = await this.request(path5);
      const valid = typeof data.imdb_id === "string" && /^tt\d{5,12}$/i.test(data.imdb_id.trim()) ? data.imdb_id.trim().toLowerCase() : null;
      if (this.externalImdbCache.size > 500) {
        const firstKey = this.externalImdbCache.keys().next().value;
        if (firstKey) this.externalImdbCache.delete(firstKey);
      }
      this.externalImdbCache.set(cacheKey, valid);
      return valid;
    } catch {
      return null;
    }
  }
  async getMovieExternalImdbId(tmdbId) {
    return this.getExternalImdbId(tmdbId, "movie");
  }
};
var TMDBService = new TMDBServiceImpl();

// server/services/PlayerService.ts
var PlayerServiceImpl = class {
  constructor() {
    this.lastHydratedAt = 0;
    this.hydrationTtlMs = 2500;
    this.hydrationPromise = null;
  }
  async ensureHydrated(force = false) {
    if (!force && Date.now() - this.lastHydratedAt < this.hydrationTtlMs) {
      return;
    }
    if (!force && this.hydrationPromise) {
      return this.hydrationPromise;
    }
    const run = (async () => {
      const remote = await FirestoreRestService.getDocument("playerSettings/global");
      if (remote) {
        const local = playerConfigStore.getConfig();
        const localTs = Date.parse(local.updatedAt || "") || 0;
        const remoteIso = toIsoTimestamp(remote.updatedAt, "");
        const remoteTs = remoteIso ? Date.parse(remoteIso) : 0;
        const isLocalDefault = local.updatedAt === "2026-01-01T00:00:00.000Z";
        const changedRemote = remoteIso && remoteIso !== local.updatedAt;
        if (isLocalDefault || localTs === 0 || changedRemote && remoteTs >= localTs) {
          const resolvedMode = resolveHydratedSourceMode({
            remoteSourceMode: remote.sourceMode,
            remoteAntiAdSandbox: remote.antiAdSandbox,
            remoteHasPrincipalFields: typeof remote.defaultAspectMode === "string",
            fallback: local.sourceMode
          });
          playerConfigStore.updateConfig(
            {
              sourceMode: resolvedMode,
              defaultDomain: remote.defaultDomain,
              fallbackDomain: remote.fallbackDomain,
              autoFallback: remote.autoFallback,
              defaultPlayer: remote.defaultPlayer,
              defaultColorHex: remote.defaultColorHex,
              myembedBaseUrl: remote.myembedBaseUrl,
              antiAdSandbox: remote.antiAdSandbox,
              preferImdbForMovies: remote.preferImdbForMovies,
              watchaflixBaseUrl: remote.watchaflixBaseUrl,
              watchaflixLang: remote.watchaflixLang,
              customEmbedMovieTemplate: remote.customEmbedMovieTemplate,
              customEmbedTvTemplate: remote.customEmbedTvTemplate,
              customSources: remote.customSources,
              embedTimeoutSeconds: remote.embedTimeoutSeconds,
              defaultAspectMode: remote.defaultAspectMode,
              autoEnableSubtitles: remote.autoEnableSubtitles,
              defaultSubtitleSize: remote.defaultSubtitleSize,
              defaultSubtitleColor: remote.defaultSubtitleColor,
              defaultSubtitleBg: remote.defaultSubtitleBg,
              allowTvCast: remote.allowTvCast,
              allowPipMode: remote.allowPipMode,
              allowTheaterMode: remote.allowTheaterMode,
              watermarkEnabled: remote.watermarkEnabled,
              watermarkText: remote.watermarkText,
              watermarkLogoUrl: remote.watermarkLogoUrl,
              watermarkPosition: remote.watermarkPosition,
              watermarkOpacity: remote.watermarkOpacity,
              watermarkSize: remote.watermarkSize,
              autoNextEpisode: remote.autoNextEpisode,
              autoNextCountdownSeconds: remote.autoNextCountdownSeconds,
              updatedAt: remoteIso || void 0
            },
            true
          );
          StreamResolverService.clearCache();
        }
      }
      this.lastHydratedAt = Date.now();
    })().finally(() => {
      if (this.hydrationPromise === run) {
        this.hydrationPromise = null;
      }
    });
    this.hydrationPromise = run;
    return run;
  }
  getConfig() {
    return playerConfigStore.getConfig();
  }
  async getConfigAsync(force = false) {
    await this.ensureHydrated(force);
    return playerConfigStore.getConfig();
  }
  updateConfig(partial) {
    const updated = playerConfigStore.updateConfig(partial);
    this.lastHydratedAt = Date.now();
    StreamResolverService.clearCache();
    repositoryStore.addLog({
      level: "info",
      service: "PlayerService",
      message: `Configura\xE7\xE3o do player atualizada: modo=${updated.sourceMode}, propor\xE7\xE3o=${updated.defaultAspectMode}, autoLegenda=${updated.autoEnableSubtitles}, autoPr\xF3ximo=${updated.autoNextEpisode}, cor=#${updated.defaultColorHex}.`
    });
    return updated;
  }
  async resolveStreamAsync(params) {
    await Promise.all([this.ensureHydrated(), SiteConfigService.ensureHydrated()]);
    const cfg = playerConfigStore.getConfig();
    const numericId = normalizeTmdbId(params.tmdbId);
    const imdbPromise = numericId ? TMDBService.getExternalImdbId(numericId, params.mediaType).catch(() => null) : Promise.resolve(null);
    const customMatch = numericId && numericId > 0 ? SiteConfigService.getCustomMatch(numericId, params.mediaType) : null;
    const playableStreamPromise = numericId ? StreamResolverService.resolvePlayableStreams({
      tmdbId: numericId,
      imdbIdPromise: imdbPromise,
      mediaType: params.mediaType,
      seasonNumber: params.seasonNumber,
      episodeNumber: params.episodeNumber,
      preferredLang: cfg.watchaflixLang,
      playerConfig: cfg,
      customStreamUrl: customMatch?.customStreamUrl
    }) : Promise.resolve({
      audioOptions: [],
      posterUrl: null,
      cloudflareOnly: false
    });
    const [imdbId, playableStreams] = await Promise.all([imdbPromise, playableStreamPromise]);
    const subtitles = await StreamResolverService.resolveSubtitles({
      imdbId,
      mediaType: params.mediaType,
      seasonNumber: params.seasonNumber,
      episodeNumber: params.episodeNumber
    }).catch(() => []);
    const basePayload = this.resolveStream({ ...params, imdbId });
    if (playableStreams.audioOptions.length > 0) {
      const primary = playableStreams.audioOptions[0];
      return {
        ...basePayload,
        embedUrl: primary.streamUrl,
        streamKind: primary.streamKind,
        sandboxPolicy: resolveSandboxPolicy({
          streamKind: primary.streamKind,
          antiAdSandbox: cfg.antiAdSandbox
        }),
        audioOptions: playableStreams.audioOptions,
        subtitles,
        posterUrl: playableStreams.posterUrl,
        streamUnavailableReason: null
      };
    }
    return {
      ...basePayload,
      subtitles,
      posterUrl: playableStreams.posterUrl,
      streamUnavailableReason: playableStreams.cloudflareOnly ? "Este t\xEDtulo exige verifica\xE7\xE3o externa (Cloudflare) nas fontes configuradas e est\xE1 temporariamente indispon\xEDvel sem an\xFAncios." : "Este t\xEDtulo ainda n\xE3o possui uma fonte de v\xEDdeo limpa dispon\xEDvel no momento."
    };
  }
  resolveStream(params) {
    const numericId = Number(params.tmdbId);
    const customMatch = Number.isInteger(numericId) && numericId > 0 ? SiteConfigService.getCustomMatch(numericId, params.mediaType) : null;
    if (customMatch?.customStreamUrl) {
      const cfg = playerConfigStore.getConfig();
      const streamKind = detectStreamKind(customMatch.customStreamUrl);
      const sandboxPolicy = resolveSandboxPolicy({
        streamKind,
        antiAdSandbox: cfg.antiAdSandbox
      });
      repositoryStore.incrementPlaybackCounter();
      return {
        tmdbId: numericId,
        mediaType: params.mediaType,
        embedUrl: customMatch.customStreamUrl,
        domain: cfg.defaultDomain,
        player: cfg.defaultPlayer,
        colorHex: cfg.defaultColorHex,
        streamKind,
        sandboxPolicy,
        referrerPolicy: "strict-origin",
        seasonNumber: params.mediaType === "tv" ? params.seasonNumber ?? 1 : void 0,
        episodeNumber: params.mediaType === "tv" ? params.episodeNumber ?? 1 : void 0,
        branding: extractPlayerBranding(cfg)
      };
    }
    const result = MegaEmbedService.getEmbedPayload(params);
    repositoryStore.incrementPlaybackCounter();
    return result;
  }
};
var PlayerService = new PlayerServiceImpl();

// server/services/SystemSettingsService.ts
var SystemSettingsServiceImpl = class {
  constructor() {
    this.lastHydratedAt = 0;
    this.lastSecretsHydratedAt = 0;
    this.hydrationTtlMs = 2500;
    this.hydrationPromise = null;
  }
  async ensureHydrated(force = false) {
    if (!force && Date.now() - this.lastHydratedAt < this.hydrationTtlMs) {
      return;
    }
    if (!force && this.hydrationPromise) {
      return this.hydrationPromise;
    }
    const run = (async () => {
      const remote = await FirestoreRestService.getDocument(
        "systemSettings/global"
      );
      if (remote) {
        const local = repositoryStore.getSystemSettings();
        const localTs = Date.parse(local.updatedAt || DEFAULT_SYSTEM_SETTINGS.updatedAt) || 0;
        const remoteIso = toIsoTimestamp(remote.updatedAt, "");
        const remoteTs = remoteIso ? Date.parse(remoteIso) : 0;
        const isLocalDefault = local.updatedAt === DEFAULT_SYSTEM_SETTINGS.updatedAt;
        const changedRemote = remoteIso && remoteIso !== local.updatedAt;
        if (isLocalDefault || localTs === 0 || changedRemote && remoteTs >= localTs) {
          const merged = sanitizeSystemSettings(remote, local, true);
          repositoryStore.saveSystemSettings(merged);
          CacheService.clear("catalog:");
          CacheService.clear("tmdb:");
        }
      }
      this.lastHydratedAt = Date.now();
    })().finally(() => {
      if (this.hydrationPromise === run) {
        this.hydrationPromise = null;
      }
    });
    this.hydrationPromise = run;
    return run;
  }
  async ensureSecretsHydrated(bearerToken, force = false) {
    if (!bearerToken) return;
    if (!force && Date.now() - this.lastSecretsHydratedAt < 1e4) return;
    const remoteSecrets = await FirestoreRestService.getDocument(
      "adminSecrets/apiKeys",
      bearerToken
    );
    if (remoteSecrets) {
      const localSecrets = repositoryStore.getAdminSecrets();
      const localTs = Date.parse(localSecrets.updatedAt || "") || 0;
      const remoteIso = toIsoTimestamp(remoteSecrets.updatedAt, "");
      const remoteTs = remoteIso ? Date.parse(remoteIso) : 0;
      if (localTs === 0 || remoteTs >= localTs) {
        const next = {};
        if (typeof remoteSecrets.tmdbAccessToken === "string" && remoteSecrets.tmdbAccessToken.trim()) {
          next.tmdbAccessToken = remoteSecrets.tmdbAccessToken.trim();
        }
        if (typeof remoteSecrets.geminiApiKey === "string" && remoteSecrets.geminiApiKey.trim()) {
          next.geminiApiKey = remoteSecrets.geminiApiKey.trim();
        }
        if (remoteIso) next.updatedAt = remoteIso;
        repositoryStore.saveAdminSecrets(next);
        CacheService.clear("catalog:");
        CacheService.clear("tmdb:");
      }
    }
    this.lastSecretsHydratedAt = Date.now();
  }
  getSettings() {
    return repositoryStore.getSystemSettings();
  }
  async getSettingsAsync(force = false) {
    await this.ensureHydrated(force);
    return repositoryStore.getSystemSettings();
  }
  async getPublicRuntimeSettingsAsync() {
    await Promise.all([this.ensureHydrated(), PlayerService.ensureHydrated()]);
    const sys = repositoryStore.getSystemSettings();
    const playerCfg = playerConfigStore.getConfig();
    return extractPublicRuntimeSettings(
      sys,
      playerCfg.embedTimeoutSeconds,
      extractPlayerBranding(playerCfg)
    );
  }
  getSecrets() {
    return repositoryStore.getAdminSecrets();
  }
  getSecretsStatus() {
    const secrets = repositoryStore.getAdminSecrets();
    const envTmdb = process.env.TMDB_ACCESS_TOKEN?.trim() ?? "";
    const envGemini = process.env.GEMINI_API_KEY?.trim() ?? "";
    const hasEnvTmdbToken = Boolean(envTmdb && envTmdb !== "MY_TMDB_ACCESS_TOKEN");
    const hasEnvGeminiKey = Boolean(envGemini && envGemini !== "MY_GEMINI_API_KEY");
    const customTmdb = secrets.tmdbAccessToken?.trim() ?? "";
    const customGemini = secrets.geminiApiKey?.trim() ?? "";
    return {
      hasCustomTmdbToken: Boolean(customTmdb),
      tmdbTokenMask: maskSecretValue(customTmdb),
      hasEnvTmdbToken,
      hasCustomGeminiKey: Boolean(customGemini),
      geminiKeyMask: maskSecretValue(customGemini),
      hasEnvGeminiKey
    };
  }
  async getAdminPayloadAsync(force = false, bearerToken) {
    await Promise.all([
      this.ensureHydrated(force),
      this.ensureSecretsHydrated(bearerToken, force)
    ]);
    return {
      settings: repositoryStore.getSystemSettings(),
      secretsStatus: this.getSecretsStatus()
    };
  }
  updateSettings(payload) {
    const current = repositoryStore.getSystemSettings();
    const next = sanitizeSystemSettings(payload, current, false);
    repositoryStore.saveSystemSettings(next);
    const currentSecrets = repositoryStore.getAdminSecrets();
    let secretsChanged = false;
    const nextSecrets = { ...currentSecrets };
    if (payload.clearTmdbAccessToken) {
      delete nextSecrets.tmdbAccessToken;
      secretsChanged = true;
    } else if (typeof payload.tmdbAccessToken === "string") {
      const cleanToken = sanitizeSecretToken(payload.tmdbAccessToken, 500);
      if (cleanToken) {
        nextSecrets.tmdbAccessToken = cleanToken;
        secretsChanged = true;
      }
    }
    if (payload.clearGeminiApiKey) {
      delete nextSecrets.geminiApiKey;
      secretsChanged = true;
    } else if (typeof payload.geminiApiKey === "string") {
      const cleanKey = sanitizeSecretToken(payload.geminiApiKey, 500);
      if (cleanKey) {
        nextSecrets.geminiApiKey = cleanKey;
        secretsChanged = true;
      }
    }
    if (secretsChanged) {
      nextSecrets.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      repositoryStore.saveAdminSecrets(nextSecrets);
    }
    this.lastHydratedAt = Date.now();
    CacheService.clear("catalog:");
    CacheService.clear("tmdb:");
    repositoryStore.addLog({
      level: "info",
      service: "SystemSettingsService",
      message: `Fontes de API e pol\xEDticas atualizadas: cat\xE1logo=${next.catalogSource}, idioma=${next.tmdbLanguage}, IA=${next.aiMode}.`
    });
    return {
      settings: next,
      secretsStatus: this.getSecretsStatus()
    };
  }
  resetSettingsToDefaults() {
    const defaults = {
      ...DEFAULT_SYSTEM_SETTINGS,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    repositoryStore.saveSystemSettings(defaults);
    this.lastHydratedAt = Date.now();
    CacheService.clear("catalog:");
    CacheService.clear("tmdb:");
    repositoryStore.addLog({
      level: "warn",
      service: "SystemSettingsService",
      message: "Configura\xE7\xF5es de APIs e pol\xEDticas restauradas para o padr\xE3o de f\xE1brica."
    });
    return {
      settings: defaults,
      secretsStatus: this.getSecretsStatus()
    };
  }
  getActiveTmdbToken() {
    const custom = repositoryStore.getAdminSecrets().tmdbAccessToken?.trim();
    if (custom) {
      return { token: custom, source: "admin_override" };
    }
    const envToken = process.env.TMDB_ACCESS_TOKEN?.trim();
    if (envToken && envToken !== "MY_TMDB_ACCESS_TOKEN") {
      return { token: envToken, source: "env" };
    }
    return { token: null, source: "none" };
  }
  getActiveGeminiKey() {
    const custom = repositoryStore.getAdminSecrets().geminiApiKey?.trim();
    if (custom) {
      return { key: custom, source: "admin_override" };
    }
    const envKey = process.env.GEMINI_API_KEY?.trim();
    if (envKey && envKey !== "MY_GEMINI_API_KEY") {
      return { key: envKey, source: "env" };
    }
    return { key: null, source: "none" };
  }
};
var SystemSettingsService = new SystemSettingsServiceImpl();

// server/services/AuthenticationService.ts
var ADMIN_EMAILS = /* @__PURE__ */ new Set(["meggadriver@gmail.com"]);
function getFirebaseProjectId() {
  try {
    const cfgPath = path4.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs4.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs4.readFileSync(cfgPath, "utf-8"));
      if (cfg.projectId) return cfg.projectId;
    }
  } catch {
  }
  return "gen-lang-client-0094430568";
}
var AuthenticationServiceImpl = class {
  constructor() {
    this.projectId = getFirebaseProjectId();
    this.remoteAdminCache = /* @__PURE__ */ new Map();
  }
  async checkFirestoreAdmin(uid, bearerToken) {
    const cached = this.remoteAdminCache.get(uid);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.isAdmin;
    }
    try {
      const [adminDoc, userDoc] = await Promise.all([
        FirestoreRestService.getDocument(`admins/${uid}`, bearerToken),
        FirestoreRestService.getDocument(`users/${uid}`, bearerToken)
      ]);
      const isAdmin = Boolean(adminDoc) || userDoc?.role === "admin";
      this.remoteAdminCache.set(uid, {
        isAdmin,
        expiresAt: Date.now() + 6e4
      });
      return isAdmin;
    } catch {
      return false;
    }
  }
  async verifyBearerToken(authHeader) {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    const token = authHeader.slice(7).trim();
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    try {
      const payloadJson = Buffer.from(parts[1], "base64url").toString("utf-8");
      const payload = JSON.parse(payloadJson);
      const uid = payload.user_id || payload.sub;
      if (!uid || !payload.email) return null;
      if (payload.exp && payload.exp * 1e3 < Date.now()) {
        return null;
      }
      if (payload.aud && payload.aud !== this.projectId) {
        return null;
      }
      const existingUser = repositoryStore.getUser(uid);
      const isAdminEmail = ADMIN_EMAILS.has(payload.email.toLowerCase()) && Boolean(payload.email_verified);
      let isAdmin = isAdminEmail || existingUser?.role === "admin";
      if (!isAdmin) {
        isAdmin = await this.checkFirestoreAdmin(uid, token);
      }
      return {
        uid,
        email: payload.email,
        name: payload.name || payload.email.split("@")[0],
        picture: payload.picture,
        emailVerified: Boolean(payload.email_verified),
        isAdmin
      };
    } catch {
      return null;
    }
  }
  ensureUserRecord(identity) {
    const existing = repositoryStore.getUser(identity.uid);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const isBootAdmin = ADMIN_EMAILS.has(identity.email.toLowerCase()) && identity.emailVerified;
    if (existing) {
      if (isBootAdmin && existing.role !== "admin") {
        const promoted = { ...existing, role: "admin", updatedAt: now };
        return repositoryStore.upsertUser(promoted);
      }
      return existing;
    }
    const defaultPlan = SystemSettingsService.getSettings().defaultUserPlan || "free";
    const created = {
      uid: identity.uid,
      name: identity.name,
      email: identity.email,
      photoUrl: identity.picture,
      plan: defaultPlan,
      role: isBootAdmin ? "admin" : "user",
      blocked: false,
      preferredTheme: "cinematografico",
      preferredLanguage: "pt-BR",
      preferredQuality: "1080p",
      parentalControl: false,
      notificationsEnabled: true,
      createdAt: now,
      updatedAt: now
    };
    repositoryStore.upsertUser(created);
    repositoryStore.addLog({
      level: "info",
      service: "AuthenticationService",
      message: `Novo perfil sincronizado: ${created.email} (${created.role}).`
    });
    return created;
  }
};
var AuthenticationService = new AuthenticationServiceImpl();

// server/middleware/security.ts
var rateBuckets = /* @__PURE__ */ new Map();
function rateLimitMiddleware(maxRequests = 180, windowMs = 6e4) {
  return (req, res, next) => {
    const ip = req.ip || "local";
    const now = Date.now();
    const bucket = rateBuckets.get(ip);
    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (bucket.count >= maxRequests) {
      return res.status(429).json({
        error: "Limite de requisi\xE7\xF5es excedido. Aguarde alguns instantes e tente novamente."
      });
    }
    bucket.count += 1;
    next();
  };
}
async function requireAuth(req, res, next) {
  const identity = await AuthenticationService.verifyBearerToken(req.headers.authorization);
  if (!identity) {
    return res.status(401).json({ error: "Autentica\xE7\xE3o necess\xE1ria." });
  }
  const user = AuthenticationService.ensureUserRecord(identity);
  if (user.blocked) {
    return res.status(403).json({ error: "Conta suspensa pelo administrador." });
  }
  req.identity = { ...identity, isAdmin: identity.isAdmin || user.role === "admin" };
  next();
}
async function optionalAuth(req, _res, next) {
  const identity = await AuthenticationService.verifyBearerToken(req.headers.authorization);
  if (identity) {
    const user = AuthenticationService.ensureUserRecord(identity);
    req.identity = { ...identity, isAdmin: identity.isAdmin || user.role === "admin" };
  }
  next();
}
async function requireAdmin(req, res, next) {
  const identity = await AuthenticationService.verifyBearerToken(req.headers.authorization);
  if (!identity) {
    return res.status(401).json({ error: "Autentica\xE7\xE3o de administrador necess\xE1ria." });
  }
  const user = AuthenticationService.ensureUserRecord(identity);
  const isAdmin = identity.isAdmin || user.role === "admin";
  if (!isAdmin) {
    repositoryStore.addLog({
      level: "warn",
      service: "Security",
      message: `Tentativa de acesso administrativo negada para ${identity.email}.`
    });
    return res.status(403).json({ error: "Permiss\xE3o de administrador negada." });
  }
  req.identity = { ...identity, isAdmin: true };
  next();
}
function globalErrorHandler(err, _req, res, _next) {
  const message = err instanceof Error ? err.message : "Erro interno do servidor.";
  repositoryStore.addLog({
    level: "error",
    service: "API",
    message
  });
  res.status(500).json({ error: message });
}

// server/services/CatalogService.ts
var CatalogServiceImpl = class {
  constructor() {
    this.syncedCatalog = [];
    this.syncedGenres = { movie: [], tv: [] };
  }
  async syncCatalog() {
    await Promise.all([SiteConfigService.ensureHydrated(), SystemSettingsService.ensureHydrated()]);
    const pages = TMDBService.isConfigured() ? [1, 2, 3] : [1];
    const [
      popularMoviesPages,
      topMoviesPages,
      nowPlayingPages,
      upcomingPages,
      popularSeriesPages,
      topSeriesPages,
      onAirSeriesPages,
      trendingPages,
      movieGenres,
      tvGenres
    ] = await Promise.all([
      Promise.all(pages.map((p) => TMDBService.getMovieList("popular", p))),
      Promise.all(pages.map((p) => TMDBService.getMovieList("top_rated", p))),
      Promise.all(pages.map((p) => TMDBService.getMovieList("now_playing", p))),
      Promise.all(pages.map((p) => TMDBService.getMovieList("upcoming", p))),
      Promise.all(pages.map((p) => TMDBService.getSeriesList("popular", p))),
      Promise.all(pages.map((p) => TMDBService.getSeriesList("top_rated", p))),
      Promise.all(pages.map((p) => TMDBService.getSeriesList("on_the_air", p))),
      Promise.all(pages.map((p) => TMDBService.getTrending(p))),
      TMDBService.getGenres("movie"),
      TMDBService.getGenres("tv")
    ]);
    const combined = deduplicateMediaByTmdbId([
      ...trendingPages.flatMap((r) => r.items),
      ...popularMoviesPages.flatMap((r) => r.items),
      ...topMoviesPages.flatMap((r) => r.items),
      ...nowPlayingPages.flatMap((r) => r.items),
      ...upcomingPages.flatMap((r) => r.items),
      ...popularSeriesPages.flatMap((r) => r.items),
      ...topSeriesPages.flatMap((r) => r.items),
      ...onAirSeriesPages.flatMap((r) => r.items)
    ]);
    const source = popularMoviesPages[0]?.source ?? "demo";
    this.syncedCatalog = combined;
    this.syncedGenres = { movie: movieGenres, tv: tvGenres };
    CacheService.clear("catalog:");
    const syncedAt = (/* @__PURE__ */ new Date()).toISOString();
    repositoryStore.setLastSyncAt(syncedAt);
    repositoryStore.addLog({
      level: "info",
      service: "CatalogService",
      message: `Sincroniza\xE7\xE3o autom\xE1tica conclu\xEDda: ${combined.length} t\xEDtulos \xFAnicos (${source}).`
    });
    return {
      count: combined.length,
      syncedAt,
      source
    };
  }
  async getSyncedCatalog() {
    if (this.syncedCatalog.length === 0) {
      await this.syncCatalog();
    }
    return this.syncedCatalog;
  }
  async getHomeSections() {
    await Promise.all([SiteConfigService.ensureHydrated(), SystemSettingsService.ensureHydrated()]);
    const sys = SystemSettingsService.getSettings();
    const customRev = repositoryStore.getCustomCatalog().filter((c) => c.active).map((c) => `${c.id}:${c.updatedAt}`).join("|");
    const homeCacheKey = `catalog:home:${sys.catalogSource}:${sys.tmdbLanguage}:${sys.tmdbImageQuality}:${sys.tmdbImageBaseUrl}:${customRev}`;
    const cached = CacheService.get(homeCacheKey);
    if (cached) return cached;
    const [
      trending,
      popularMovies,
      nowPlayingMovies,
      topRatedMovies,
      upcomingMovies,
      popularSeries,
      topRatedSeries,
      onAirSeries,
      movieGenres,
      tvGenres
    ] = await Promise.all([
      TMDBService.getTrending(1),
      TMDBService.getMovieList("popular", 1),
      TMDBService.getMovieList("now_playing", 1),
      TMDBService.getMovieList("top_rated", 1),
      TMDBService.getMovieList("upcoming", 1),
      TMDBService.getSeriesList("popular", 1),
      TMDBService.getSeriesList("top_rated", 1),
      TMDBService.getSeriesList("on_the_air", 1),
      TMDBService.getGenres("movie"),
      TMDBService.getGenres("tv")
    ]);
    const customItems = repositoryStore.getCustomCatalog().filter((c) => c.active);
    const featuredCustoms = customItems.filter((c) => c.featured).map(customMediaToMediaItem);
    const mergedTrending = deduplicateMediaByTmdbId([
      ...featuredCustoms,
      ...mergeCustomCatalogIntoList(trending.items, customItems)
    ]);
    const mergedPopularMovies = mergeCustomCatalogIntoList(popularMovies.items, customItems, "movie");
    const mergedPopularSeries = mergeCustomCatalogIntoList(popularSeries.items, customItems, "tv");
    const combined = deduplicateMediaByTmdbId([
      ...mergedTrending,
      ...mergedPopularMovies,
      ...mergedPopularSeries,
      ...nowPlayingMovies.items,
      ...topRatedMovies.items,
      ...upcomingMovies.items,
      ...topRatedSeries.items,
      ...onAirSeries.items
    ]);
    this.syncedCatalog = deduplicateMediaByTmdbId([...this.syncedCatalog, ...combined]);
    this.syncedGenres = { movie: movieGenres, tv: tvGenres };
    const payload = {
      featured: featuredCustoms[0] ?? mergedTrending[0] ?? mergedPopularMovies[0] ?? null,
      trending: mergedTrending,
      popularMovies: mergedPopularMovies,
      nowPlayingMovies: nowPlayingMovies.items,
      topRatedMovies: topRatedMovies.items,
      upcomingMovies: upcomingMovies.items,
      popularSeries: mergedPopularSeries,
      topRatedSeries: topRatedSeries.items,
      onAirSeries: onAirSeries.items,
      genres: {
        movie: movieGenres,
        tv: tvGenres
      },
      source: popularMovies.source,
      demoMode: popularMovies.demoMode
    };
    const ttlMs = Math.max(1, SystemSettingsService.getSettings().cacheTtlMinutes || 5) * 60 * 1e3;
    CacheService.set(homeCacheKey, payload, ttlMs);
    return payload;
  }
  getCachedGenreCount() {
    return this.syncedGenres.movie.length + this.syncedGenres.tv.length;
  }
};
var CatalogService = new CatalogServiceImpl();

// server/services/ChannelService.ts
var VALID_CATEGORIES = [
  "Not\xEDcias",
  "Esportes",
  "Entretenimento",
  "Filmes",
  "Variedades",
  "Infantil"
];
var ChannelServiceImpl = class {
  constructor() {
    this.lastHydratedAt = 0;
    this.hydrationTtlMs = 2500;
    this.hydrationPromise = null;
  }
  async ensureHydrated(force = false) {
    if (!force && Date.now() - this.lastHydratedAt < this.hydrationTtlMs) {
      return;
    }
    if (!force && this.hydrationPromise) {
      return this.hydrationPromise;
    }
    const run = (async () => {
      const remoteRes = await FirestoreRestService.queryActiveCollectionChecked("channels");
      if (remoteRes.ok) {
        const remoteIds = /* @__PURE__ */ new Set();
        for (const raw of remoteRes.items) {
          if (!raw.id || !raw.name || !raw.category || !VALID_CATEGORIES.includes(raw.category) || !raw.streamUrl || !isValidStreamUrl(raw.streamUrl)) {
            continue;
          }
          const normalized = {
            id: String(raw.id),
            name: sanitizePlainText(raw.name, 100),
            category: raw.category,
            streamUrl: String(raw.streamUrl).trim().slice(0, 500),
            logoUrl: raw.logoUrl ? String(raw.logoUrl).trim().slice(0, 500) : void 0,
            description: raw.description ? sanitizePlainText(raw.description, 300) : void 0,
            active: raw.active !== false,
            createdAt: toIsoTimestamp(raw.createdAt, (/* @__PURE__ */ new Date()).toISOString())
          };
          remoteIds.add(normalized.id);
          repositoryStore.upsertChannel(normalized);
        }
        for (const localCh of repositoryStore.getChannels()) {
          if (!remoteIds.has(localCh.id)) {
            repositoryStore.deleteChannel(localCh.id);
          }
        }
      }
      this.lastHydratedAt = Date.now();
    })().finally(() => {
      if (this.hydrationPromise === run) {
        this.hydrationPromise = null;
      }
    });
    this.hydrationPromise = run;
    return run;
  }
  listPublic(category) {
    const channels = repositoryStore.getChannels().filter((c) => c.active);
    if (!category || category === "Todos") return channels;
    return channels.filter((c) => c.category === category);
  }
  async listPublicAsync(category, force = false) {
    await this.ensureHydrated(force);
    return this.listPublic(category);
  }
  listAllAdmin() {
    return repositoryStore.getChannels();
  }
  async listAllAdminAsync(force = false) {
    await this.ensureHydrated(force);
    return this.listAllAdmin();
  }
  createOrUpdate(payload) {
    const name = sanitizePlainText(payload.name, 100);
    if (!name) {
      throw new Error("Nome do canal \xE9 obrigat\xF3rio.");
    }
    if (!VALID_CATEGORIES.includes(payload.category)) {
      throw new Error("Categoria de canal inv\xE1lida.");
    }
    if (!isValidStreamUrl(payload.streamUrl)) {
      throw new Error("URL de transmiss\xE3o autorizada inv\xE1lida (use http:// ou https://).");
    }
    const id = payload.id?.trim() || `ch_${Date.now()}`;
    const existing = repositoryStore.getChannels().find((c) => c.id === id);
    const channel = {
      id,
      name,
      category: payload.category,
      streamUrl: payload.streamUrl.trim().slice(0, 500),
      logoUrl: payload.logoUrl ? payload.logoUrl.trim().slice(0, 500) : void 0,
      description: payload.description ? sanitizePlainText(payload.description, 300) : void 0,
      active: typeof payload.active === "boolean" ? payload.active : true,
      createdAt: existing?.createdAt ?? (/* @__PURE__ */ new Date()).toISOString()
    };
    repositoryStore.upsertChannel(channel);
    this.lastHydratedAt = Date.now();
    repositoryStore.addLog({
      level: "info",
      service: "ChannelService",
      message: `Canal autorizado salvo pelo admin: ${channel.name} (${channel.category}).`
    });
    return channel;
  }
  remove(id) {
    const ok = repositoryStore.deleteChannel(id);
    this.lastHydratedAt = Date.now();
    if (ok) {
      repositoryStore.addLog({
        level: "warn",
        service: "ChannelService",
        message: `Canal removido pelo admin: ${id}.`
      });
    }
    return ok;
  }
};
var ChannelService = new ChannelServiceImpl();

// server/services/RecommendationService.ts
import { GoogleGenAI, Type } from "@google/genai";
var RecommendationServiceImpl = class {
  isGeminiConfigured() {
    return Boolean(SystemSettingsService.getActiveGeminiKey().key);
  }
  createClient() {
    const { key } = SystemSettingsService.getActiveGeminiKey();
    if (!key) return null;
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  async recommend(params) {
    await SystemSettingsService.ensureHydrated();
    const sys = SystemSettingsService.getSettings();
    const maxItems = sys.aiMaxRecommendations || 12;
    if (sys.aiMode === "disabled") {
      return {
        summary: "As recomenda\xE7\xF5es autom\xE1ticas por IA est\xE3o temporariamente desabilitadas pelo administrador.",
        strategyNote: "Recurso desativado nas configura\xE7\xF5es administrativas.",
        suggestedQueries: [],
        items: [],
        source: "fallback"
      };
    }
    const syncedCatalog = await CatalogService.getSyncedCatalog();
    const userPrompt = params.prompt.trim();
    const favTitles = params.favorites.slice(0, 8).map((f) => `${f.title} (${f.mediaType})`);
    const historyTitles = params.history.slice(0, 8).map((h) => `${h.title} (${h.mediaType})`);
    if (sys.aiMode === "catalog_smart") {
      return this.buildDeterministicFallback(
        userPrompt,
        syncedCatalog,
        favTitles,
        historyTitles,
        maxItems
      );
    }
    const ai = this.createClient();
    if (!ai) {
      return this.buildDeterministicFallback(
        userPrompt,
        syncedCatalog,
        favTitles,
        historyTitles,
        maxItems
      );
    }
    try {
      const catalogContext = syncedCatalog.slice(0, 28).map((m) => ({
        tmdbId: m.tmdbId,
        mediaType: m.mediaType,
        title: m.title,
        year: m.releaseYear,
        rating: m.voteAverage,
        genres: m.genreIds,
        overview: m.overview.slice(0, 140)
      }));
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: JSON.stringify({
          pedidoUsuario: userPrompt || "Recomende os melhores t\xEDtulos com base no meu perfil.",
          tipoPreferido: params.preferredMediaType ?? "all",
          favoritosUsuario: favTitles,
          historicoRecente: historyTitles,
          catalogoDisponivel: catalogContext
        }),
        config: {
          systemInstruction: "Voc\xEA \xE9 a IA Inteligente do MegaStream. Sua fun\xE7\xE3o \xE9 analisar o pedido do usu\xE1rio, favoritos e hist\xF3rico, e selecionar SOMENTE t\xEDtulos reais presentes no cat\xE1logo TMDB dispon\xEDvel ou sugerir termos reais de busca TMDB (em portugu\xEAs ou ingl\xEAs) para consultar o TMDB. NUNCA invente filmes, s\xE9ries, notas ou sinopses. Responda em Portugu\xEAs do Brasil de forma objetiva e envolvente.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: "Resumo curatorial em portugu\xEAs explicando as recomenda\xE7\xF5es."
              },
              strategyNote: {
                type: Type.STRING,
                description: "Crit\xE9rios usados (g\xEAnero, ritmo, hist\xF3rico ou favoritos)."
              },
              matchedTmdbIds: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: "Lista de tmdbId selecionados diretamente do catalogoDisponivel."
              },
              searchQueries: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "At\xE9 3 termos reais de busca para consultar o TMDB quando necess\xE1rio."
              },
              genreKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Sugest\xF5es de listas personalizadas ou g\xEAneros compat\xEDveis."
              }
            },
            required: ["summary", "strategyNote", "matchedTmdbIds", "searchQueries"]
          }
        }
      });
      const rawJson = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawJson);
      const matchedItems = [];
      for (const id of parsed.matchedTmdbIds ?? []) {
        const found = syncedCatalog.find((m) => m.tmdbId === id);
        if (found) matchedItems.push(found);
      }
      if (TMDBService.isConfigured() && (parsed.searchQueries?.length ?? 0) > 0) {
        const searches = await Promise.all(
          (parsed.searchQueries ?? []).slice(0, 3).map(
            (q) => TMDBService.search(q, params.preferredMediaType ?? "all", 1).catch(() => null)
          )
        );
        for (const res of searches) {
          if (res?.items?.length) {
            matchedItems.push(...res.items.slice(0, 4));
          }
        }
      }
      const finalItems = deduplicateMediaByTmdbId(
        matchedItems.length > 0 ? matchedItems : syncedCatalog.slice(0, 6)
      ).slice(0, maxItems);
      return {
        summary: parsed.summary || "Selecionamos t\xEDtulos reais do cat\xE1logo TMDB alinhados ao seu perfil e solicita\xE7\xE3o.",
        strategyNote: parsed.strategyNote || "Curadoria combinando an\xE1lise sem\xE2ntica Gemini e dados oficiais do TMDB.",
        suggestedQueries: parsed.genreKeywords ?? parsed.searchQueries ?? [],
        items: finalItems,
        source: TMDBService.isConfigured() ? "gemini+tmdb" : "gemini+demo"
      };
    } catch (err) {
      repositoryStore.addLog({
        level: "warn",
        service: "RecommendationService",
        message: `Fallback de recomenda\xE7\xE3o acionado: ${err instanceof Error ? err.message : String(err)}`
      });
      return this.buildDeterministicFallback(userPrompt, syncedCatalog, favTitles, historyTitles, maxItems);
    }
  }
  buildDeterministicFallback(prompt, catalog, favTitles, historyTitles, maxItems = 8) {
    const q = prompt.toLowerCase();
    const keywordMatches = catalog.filter((item) => {
      if (!q) return true;
      const hay = `${item.title} ${item.originalTitle} ${item.overview}`.toLowerCase();
      return q.split(/\s+/).some((word) => word.length > 3 && hay.includes(word));
    });
    const selected = (keywordMatches.length > 0 ? keywordMatches : catalog).slice().sort((a, b) => b.voteAverage - a.voteAverage).slice(0, maxItems);
    const contextPieces = [];
    if (favTitles.length > 0) contextPieces.push(`${favTitles.length} favorito(s)`);
    if (historyTitles.length > 0) contextPieces.push(`${historyTitles.length} item(ns) no hist\xF3rico`);
    return {
      summary: q.length > 0 ? `Resultados do cat\xE1logo para "${prompt}" ordenados por relev\xE2ncia e avalia\xE7\xE3o TMDB.` : "Recomenda\xE7\xF5es curadas com base nos t\xEDtulos mais bem avaliados do cat\xE1logo dispon\xEDvel.",
      strategyNote: contextPieces.length > 0 ? `Baseado no seu perfil (${contextPieces.join(" e ")}) e t\xEDtulos reais do cat\xE1logo.` : "Ordena\xE7\xE3o por avalia\xE7\xE3o TMDB e correspond\xEAncia tem\xE1tica no cat\xE1logo carregado.",
      suggestedQueries: ["A\xE7\xE3o e Suspense", "Fic\xE7\xE3o Cient\xEDfica \xC9pica", "S\xE9ries Aclamadas"],
      items: selected,
      source: "fallback"
    };
  }
};
var RecommendationService = new RecommendationServiceImpl();

// server/services/AdminService.ts
var AdminServiceImpl = class {
  async getDashboardStats(force = false, bearerToken) {
    await Promise.all([
      ChannelService.ensureHydrated(force),
      SiteConfigService.ensureHydrated(force),
      SystemSettingsService.ensureHydrated(force),
      SystemSettingsService.ensureSecretsHydrated(bearerToken, force),
      PlayerService.ensureHydrated(force)
    ]);
    const users = repositoryStore.getUsers();
    const activeUsers = users.filter((u) => !u.blocked).length;
    const synced = await CatalogService.getSyncedCatalog();
    const catalogMovies = synced.filter((m) => m.mediaType === "movie").length;
    const catalogSeries = synced.filter((m) => m.mediaType === "tv").length;
    const subs = repositoryStore.getAllSubscriptions();
    const activeSubscriptions = subs.filter((s) => s.status === "active").length;
    const channelsCount = repositoryStore.getChannels().length;
    const totalPlaybacks = repositoryStore.getTotalPlaybacks();
    return {
      totalUsers: users.length,
      activeUsers,
      catalogMovies,
      catalogSeries,
      totalPlaybacks,
      activeSubscriptions,
      channelsCount,
      usageSeries: [
        { label: "Seg", playbacks: Math.max(4, Math.round(totalPlaybacks * 0.12)), searches: 14 },
        { label: "Ter", playbacks: Math.max(6, Math.round(totalPlaybacks * 0.14)), searches: 19 },
        { label: "Qua", playbacks: Math.max(8, Math.round(totalPlaybacks * 0.16)), searches: 22 },
        { label: "Qui", playbacks: Math.max(7, Math.round(totalPlaybacks * 0.15)), searches: 18 },
        { label: "Sex", playbacks: Math.max(11, Math.round(totalPlaybacks * 0.2)), searches: 28 },
        { label: "S\xE1b", playbacks: Math.max(14, Math.round(totalPlaybacks * 0.24)), searches: 34 },
        { label: "Dom", playbacks: Math.max(12, Math.round(totalPlaybacks * 0.21)), searches: 31 }
      ]
    };
  }
  async getIntegrationStatus(force = false, bearerToken) {
    await Promise.all([
      SystemSettingsService.ensureHydrated(force),
      SystemSettingsService.ensureSecretsHydrated(bearerToken, force),
      PlayerService.ensureHydrated(force)
    ]);
    const synced = await CatalogService.getSyncedCatalog();
    const sys = SystemSettingsService.getSettings();
    const tmdbToken = SystemSettingsService.getActiveTmdbToken();
    const geminiKey = SystemSettingsService.getActiveGeminiKey();
    const playerCfg = playerConfigStore.getConfig();
    return {
      tmdbConfigured: TMDBService.isConfigured(),
      tmdbRuntimeSource: sys.catalogSource,
      tmdbActiveTokenSource: tmdbToken.source,
      geminiConfigured: RecommendationService.isGeminiConfigured(),
      geminiActiveKeySource: geminiKey.source,
      firebaseConfigured: true,
      megaEmbedConfigured: true,
      playerSourceMode: playerCfg.sourceMode,
      paymentGatewayConfigured: false,
      demoMode: !TMDBService.isConfigured(),
      cacheEntries: CacheService.size(),
      lastSyncAt: repositoryStore.getLastSyncAt(),
      catalogSyncedCount: synced.length
    };
  }
  async runDiagnostic(target, bearerToken) {
    const started = Date.now();
    await Promise.all([
      SystemSettingsService.ensureHydrated(true),
      SystemSettingsService.ensureSecretsHydrated(bearerToken, true)
    ]);
    if (target === "tmdb") {
      return TMDBService.testConnection();
    }
    if (target === "player") {
      await PlayerService.ensureHydrated(true);
      const cfg = playerConfigStore.getConfig();
      try {
        const [movieRes, tvRes] = await Promise.all([
          PlayerService.resolveStreamAsync({ tmdbId: 693134, mediaType: "movie" }),
          PlayerService.resolveStreamAsync({
            tmdbId: 1399,
            mediaType: "tv",
            seasonNumber: 1,
            episodeNumber: 1
          })
        ]);
        const movieClean = (movieRes.streamKind === "hls" || movieRes.streamKind === "video") && !movieRes.streamUnavailableReason;
        const tvClean = (tvRes.streamKind === "hls" || tvRes.streamKind === "video") && !tvRes.streamUnavailableReason;
        const ok = movieClean && tvClean;
        return {
          target: "player",
          ok,
          statusCode: ok ? 200 : 502,
          latencyMs: Date.now() - started,
          message: ok ? `WatchaPlayer MegaStream operacional (${cfg.sourceMode}) \u2014 filmes (${movieRes.audioOptions?.length ?? 1} faixas) e s\xE9ries (${tvRes.audioOptions?.length ?? 1} faixas) carregando v\xEDdeo direto sem an\xFAncios, sem Cloudflare e com failover autom\xE1tico entre fontes.` : `Failover parcial ativo (${cfg.sourceMode}): filmes ${movieClean ? "OK" : "indispon\xEDvel"}, s\xE9ries ${tvClean ? "OK" : "indispon\xEDvel"}.`,
          detail: `Modo configurado: ${cfg.sourceMode} \xB7 Cor: #${cfg.defaultColorHex} \xB7 Idioma: ${cfg.watchaflixLang} \xB7 Propor\xE7\xE3o: ${cfg.defaultAspectMode}`,
          testedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      } catch (err) {
        return {
          target: "player",
          ok: false,
          latencyMs: Date.now() - started,
          message: `Falha ao testar resolu\xE7\xE3o do WatchaPlayer (${cfg.sourceMode}): ${err instanceof Error ? err.message : String(err)}`,
          testedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
    }
    try {
      const ping = await FirestoreRestService.getDocument("siteConfig/global");
      return {
        target: "firestore",
        ok: true,
        latencyMs: Date.now() - started,
        message: ping ? "Conex\xE3o REST com Cloud Firestore ativa e documento global encontrado." : "Conex\xE3o REST com Cloud Firestore respondeu (documento ainda n\xE3o criado na nuvem).",
        testedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (err) {
      return {
        target: "firestore",
        ok: false,
        latencyMs: Date.now() - started,
        message: `Erro ao consultar Firestore: ${err instanceof Error ? err.message : String(err)}`,
        testedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  }
  getLogs(limit = 100) {
    return repositoryStore.getLogs(limit);
  }
  clearCache() {
    const cleared = CacheService.clear();
    repositoryStore.addLog({
      level: "info",
      service: "AdminService",
      message: `Cache limpo pelo administrador (${cleared} entradas removidas).`
    });
    return cleared;
  }
};
var AdminService = new AdminServiceImpl();

// server/services/FavoritesService.ts
var FavoritesServiceImpl = class {
  list(userId, mediaType) {
    const items = repositoryStore.getFavorites(userId);
    if (!mediaType || mediaType === "all") return items;
    return items.filter((item) => item.mediaType === mediaType);
  }
  add(userId, payload) {
    const validId = normalizeTmdbId(payload.tmdbId);
    if (!validId) {
      throw new Error("ID TMDB inv\xE1lido para favoritar.");
    }
    const item = {
      id: `${payload.mediaType}_${validId}`,
      userId,
      tmdbId: validId,
      mediaType: payload.mediaType === "tv" ? "tv" : "movie",
      title: sanitizePlainText(payload.title || "Sem t\xEDtulo", 200),
      posterPath: payload.posterPath ?? null,
      voteAverage: Number(payload.voteAverage ?? 0),
      releaseYear: sanitizePlainText(payload.releaseYear ?? "", 10),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    return repositoryStore.addFavorite(item);
  }
  remove(userId, tmdbId, mediaType) {
    return repositoryStore.removeFavorite(userId, tmdbId, mediaType);
  }
};
var FavoritesService = new FavoritesServiceImpl();

// server/services/HistoryService.ts
var HistoryServiceImpl = class {
  list(userId) {
    return repositoryStore.getHistory(userId);
  }
  record(userId, payload) {
    const validId = normalizeTmdbId(payload.tmdbId);
    if (!validId) {
      throw new Error("ID TMDB inv\xE1lido para hist\xF3rico.");
    }
    const clampedProgress = Math.max(
      0,
      Math.min(100, Number.isFinite(payload.progressPercent) ? Number(payload.progressPercent) : 15)
    );
    const item = {
      id: `${payload.mediaType}_${validId}`,
      userId,
      tmdbId: validId,
      mediaType: payload.mediaType === "tv" ? "tv" : "movie",
      title: sanitizePlainText(payload.title || "Sem t\xEDtulo", 200),
      posterPath: payload.posterPath ?? null,
      backdropPath: payload.backdropPath ?? null,
      progressPercent: clampedProgress,
      seasonNumber: payload.seasonNumber,
      episodeNumber: payload.episodeNumber,
      playerProvider: payload.playerProvider ? validateMegaEmbedPlayer(payload.playerProvider) : void 0,
      watchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    return repositoryStore.upsertHistory(item);
  }
  remove(userId, tmdbId, mediaType) {
    const existing = repositoryStore.getHistory(userId);
    const filtered = existing.filter(
      (h) => !(h.tmdbId === tmdbId && h.mediaType === mediaType)
    );
    if (filtered.length === existing.length) return false;
    return repositoryStore.removeHistory(userId, tmdbId, mediaType);
  }
};
var HistoryService = new HistoryServiceImpl();

// server/services/ProfileService.ts
import crypto2 from "node:crypto";

// shared/profileUtils.ts
var MAX_PROFILES_PER_ACCOUNT = 6;
var VALID_PROFILE_THEMES = [
  "cinematografico",
  "neon-roxo",
  "minimalista",
  "gold-premium",
  "3d-glass"
];
var PROFILE_AVATAR_PRESETS = [
  {
    id: "avatar_cartoon_hero",
    label: "Her\xF3i Animado",
    category: "desenhos",
    fallbackPath: "/src/assets/images/avatar_cartoon_hero_1794675751477.jpg"
  },
  {
    id: "avatar_anime_pilot",
    label: "Piloto Cyber Anime",
    category: "desenhos",
    fallbackPath: "/src/assets/images/avatar_anime_pilot_1794675752025.jpg"
  },
  {
    id: "avatar_series_detective",
    label: "Detetive Noir",
    category: "series",
    fallbackPath: "/src/assets/images/avatar_series_detective_1794675751043.jpg"
  },
  {
    id: "avatar_series_queen",
    label: "Rainha Fantasia",
    category: "series",
    fallbackPath: "/src/assets/images/avatar_series_queen_1794675751674.jpg"
  },
  {
    id: "avatar_movie_explorer",
    label: "Explorador Duna",
    category: "filmes",
    fallbackPath: "/src/assets/images/avatar_movie_explorer_1794675752185.jpg"
  },
  {
    id: "avatar_movie_vigilante",
    label: "Vigilante Noturno",
    category: "filmes",
    fallbackPath: "/src/assets/images/avatar_movie_vigilante_1794675753040.jpg"
  },
  {
    id: "avatar_kids_dino",
    label: "Dino Pipoca Kids",
    category: "infantil",
    fallbackPath: "/src/assets/images/avatar_kids_dino_1794675753063.jpg"
  },
  {
    id: "avatar_movie_astronaut",
    label: "Astronauta Neon",
    category: "filmes",
    fallbackPath: "/src/assets/images/avatar_movie_astronaut_1794675753848.jpg"
  }
];
function getAvatarPresetById(id) {
  if (!id) return void 0;
  return PROFILE_AVATAR_PRESETS.find((preset) => preset.id === id);
}
function sanitizeProfileName(input, fallback = "Perfil") {
  const cleaned = sanitizePlainText(input ?? "", 40);
  return cleaned.length >= 1 ? cleaned : fallback;
}
function isValidProfileId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}
function sanitizeProfileTheme(theme, fallback = "cinematografico") {
  if (theme && VALID_PROFILE_THEMES.includes(theme)) {
    return theme;
  }
  return fallback;
}
function sanitizeAvatarUrl(url) {
  const trimmed = (url ?? "").trim();
  if (!trimmed) {
    return PROFILE_AVATAR_PRESETS[7].fallbackPath;
  }
  if (trimmed.startsWith("/src/assets/images/") || trimmed.startsWith("/assets/")) {
    return trimmed.slice(0, 300);
  }
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed.length <= 45e3 ? trimmed : PROFILE_AVATAR_PRESETS[7].fallbackPath;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString().slice(0, 500);
    }
  } catch {
  }
  return PROFILE_AVATAR_PRESETS[7].fallbackPath;
}
function validateProfilePin(pin) {
  if (typeof pin !== "string") return false;
  const trimmed = pin.trim();
  return trimmed.length >= 4 && trimmed.length <= 12 && !/\s/.test(trimmed);
}
async function hashProfilePin(profileId, pin) {
  const normalized = pin.trim();
  if (!validateProfilePin(normalized)) {
    throw new Error("A senha do perfil deve ter entre 4 e 12 caracteres sem espa\xE7os.");
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(`megastream:profile:v1:${profileId}:${normalized}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function verifyProfilePin(profileId, pin, expectedHash) {
  if (!expectedHash || !validateProfilePin(pin)) {
    return false;
  }
  const computed = await hashProfilePin(profileId, pin);
  return computed === expectedHash;
}
function toPublicStreamProfile(profile) {
  const { pinHash: _ignored, ...publicProfile } = profile;
  return publicProfile;
}
function createDefaultProfiles(userId, ownerName) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const mainName = sanitizeProfileName(ownerName || "Principal", "Principal");
  return [
    {
      id: "profile_main",
      userId,
      name: mainName,
      avatarId: "avatar_movie_astronaut",
      avatarUrl: PROFILE_AVATAR_PRESETS[7].fallbackPath,
      hasPin: false,
      pinHash: "",
      isKids: false,
      preferredTheme: "cinematografico",
      preferredLanguage: "pt-BR",
      preferredQuality: "1080p",
      autoplayNext: true,
      createdAt: now,
      updatedAt: now
    }
  ];
}

// server/services/ProfileService.ts
var ProfileServiceImpl = class {
  ensureProfiles(userId, ownerName) {
    const existing = repositoryStore.getProfiles(userId);
    if (existing.length > 0) return existing;
    const defaults = createDefaultProfiles(userId, ownerName);
    for (const prof of defaults) {
      repositoryStore.upsertProfile(prof);
    }
    return defaults;
  }
  list(userId, ownerName) {
    return this.ensureProfiles(userId, ownerName).map(toPublicStreamProfile);
  }
  async create(userId, payload) {
    await SystemSettingsService.ensureHydrated();
    const maxProfiles = Math.max(
      1,
      Math.min(8, SystemSettingsService.getSettings().maxProfilesPerAccount || MAX_PROFILES_PER_ACCOUNT)
    );
    const current = this.ensureProfiles(userId);
    if (current.length >= maxProfiles) {
      throw new Error(`Limite m\xE1ximo de ${maxProfiles} perfis por conta atingido.`);
    }
    const requestedId = typeof payload.id === "string" && isValidProfileId(payload.id) && !current.some((p) => p.id === payload.id) ? payload.id : null;
    const profileId = requestedId ?? `prof_${crypto2.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const preset = getAvatarPresetById(payload.avatarId);
    const avatarId = preset ? preset.id : "custom";
    const avatarUrl = preset ? preset.fallbackPath : sanitizeAvatarUrl(payload.avatarUrl);
    const rawPin = typeof payload.pin === "string" ? payload.pin.trim() : "";
    let hasPin = false;
    let pinHash = "";
    if (rawPin.length > 0) {
      if (!validateProfilePin(rawPin)) {
        throw new Error("A senha do perfil deve ter entre 4 e 12 caracteres sem espa\xE7os.");
      }
      hasPin = true;
      pinHash = await hashProfilePin(profileId, rawPin);
    }
    const created = {
      id: profileId,
      userId,
      name: sanitizeProfileName(payload.name, "Novo Perfil"),
      avatarId,
      avatarUrl,
      hasPin,
      pinHash,
      isKids: Boolean(payload.isKids),
      preferredTheme: sanitizeProfileTheme(payload.preferredTheme, "cinematografico"),
      preferredLanguage: payload.preferredLanguage === "en-US" || payload.preferredLanguage === "es-ES" ? payload.preferredLanguage : "pt-BR",
      preferredQuality: payload.preferredQuality === "auto" || payload.preferredQuality === "720p" ? payload.preferredQuality : "1080p",
      autoplayNext: payload.autoplayNext !== void 0 ? Boolean(payload.autoplayNext) : true,
      createdAt: now,
      updatedAt: now
    };
    repositoryStore.upsertProfile(created);
    return toPublicStreamProfile(created);
  }
  async update(userId, profileId, payload) {
    if (!isValidProfileId(profileId)) {
      throw new Error("Identificador de perfil inv\xE1lido.");
    }
    const current = this.ensureProfiles(userId);
    const existing = current.find((p) => p.id === profileId);
    if (!existing) {
      throw new Error("Perfil n\xE3o encontrado.");
    }
    if (existing.hasPin && (payload.pin || payload.removePin)) {
      const ok = await verifyProfilePin(profileId, payload.currentPin ?? "", existing.pinHash);
      if (!ok) {
        throw new Error("Senha atual do perfil incorreta.");
      }
    }
    let nextHasPin = existing.hasPin;
    let nextPinHash = existing.pinHash ?? "";
    if (payload.removePin) {
      nextHasPin = false;
      nextPinHash = "";
    } else if (typeof payload.pin === "string" && payload.pin.trim().length > 0) {
      if (!validateProfilePin(payload.pin)) {
        throw new Error("A senha do perfil deve ter entre 4 e 12 caracteres sem espa\xE7os.");
      }
      nextHasPin = true;
      nextPinHash = await hashProfilePin(profileId, payload.pin);
    }
    const preset = payload.avatarId ? getAvatarPresetById(payload.avatarId) : void 0;
    const nextAvatarId = payload.avatarId ? preset ? preset.id : "custom" : existing.avatarId;
    const nextAvatarUrl = payload.avatarId || payload.avatarUrl ? preset ? preset.fallbackPath : sanitizeAvatarUrl(payload.avatarUrl ?? existing.avatarUrl) : existing.avatarUrl;
    const updated = {
      ...existing,
      name: payload.name !== void 0 ? sanitizeProfileName(payload.name, existing.name) : existing.name,
      avatarId: nextAvatarId,
      avatarUrl: nextAvatarUrl,
      hasPin: nextHasPin,
      pinHash: nextPinHash,
      isKids: payload.isKids !== void 0 ? Boolean(payload.isKids) : existing.isKids,
      preferredTheme: payload.preferredTheme !== void 0 ? sanitizeProfileTheme(payload.preferredTheme, existing.preferredTheme) : existing.preferredTheme,
      preferredLanguage: payload.preferredLanguage === "pt-BR" || payload.preferredLanguage === "en-US" || payload.preferredLanguage === "es-ES" ? payload.preferredLanguage : existing.preferredLanguage,
      preferredQuality: payload.preferredQuality === "auto" || payload.preferredQuality === "1080p" || payload.preferredQuality === "720p" ? payload.preferredQuality : existing.preferredQuality,
      autoplayNext: payload.autoplayNext !== void 0 ? Boolean(payload.autoplayNext) : existing.autoplayNext,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    repositoryStore.upsertProfile(updated);
    return toPublicStreamProfile(updated);
  }
  async verifyPin(userId, profileId, pin) {
    if (!isValidProfileId(profileId)) return false;
    const list = this.ensureProfiles(userId);
    const target = list.find((p) => p.id === profileId);
    if (!target) return false;
    if (!target.hasPin) return true;
    return verifyProfilePin(profileId, pin, target.pinHash);
  }
  async remove(userId, profileId, currentPin) {
    if (!isValidProfileId(profileId)) {
      throw new Error("Identificador de perfil inv\xE1lido.");
    }
    const list = this.ensureProfiles(userId);
    if (list.length <= 1) {
      throw new Error("\xC9 necess\xE1rio manter pelo menos um perfil ativo.");
    }
    const target = list.find((p) => p.id === profileId);
    if (!target) return false;
    if (target.hasPin) {
      const ok = await verifyProfilePin(profileId, currentPin ?? "", target.pinHash);
      if (!ok) {
        throw new Error("Informe a senha atual do perfil para remov\xEA-lo.");
      }
    }
    return repositoryStore.deleteProfile(userId, profileId);
  }
};
var ProfileService = new ProfileServiceImpl();

// server/services/SubscriptionService.ts
var SubscriptionServiceImpl = class {
  getPlans() {
    return SUBSCRIPTION_PLANS;
  }
  getUserSubscription(userId) {
    return repositoryStore.getSubscription(userId);
  }
  selectPlanPendingGateway(userId, planId) {
    const plan = getPlanById(planId);
    if (!plan) {
      throw new Error("Plano selecionado inv\xE1lido.");
    }
    const expiresAt = new Date(
      Date.now() + plan.periodDays * 24 * 60 * 60 * 1e3
    ).toISOString();
    const record = {
      userId,
      planId,
      status: "pending_gateway",
      amountBrl: plan.priceBrl,
      expiresAt,
      gatewayReady: false,
      gatewayNotice: "Estrutura preparada para integra\xE7\xE3o de gateway de pagamento (Stripe / Mercado Pago). Nenhuma cobran\xE7a real foi simulada.",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    repositoryStore.upsertSubscription(record);
    repositoryStore.addLog({
      level: "info",
      service: "SubscriptionService",
      message: `Solicita\xE7\xE3o de assinatura registrada (gateway pendente): usu\xE1rio ${userId}, plano ${plan.name}.`
    });
    return record;
  }
};
var SubscriptionService = new SubscriptionServiceImpl();

// server/services/UserService.ts
var VALID_THEMES2 = [
  "cinematografico",
  "neon-roxo",
  "minimalista",
  "gold-premium",
  "3d-glass"
];
var UserServiceImpl = class {
  getAllUsers() {
    return repositoryStore.getUsers();
  }
  getUser(uid) {
    return repositoryStore.getUser(uid);
  }
  updatePreferences(uid, updates) {
    const user = repositoryStore.getUser(uid);
    if (!user) return null;
    const next = {
      ...user,
      name: updates.name ? sanitizePlainText(updates.name, 120) : user.name,
      photoUrl: updates.photoUrl !== void 0 ? sanitizePlainText(updates.photoUrl, 500) : user.photoUrl,
      preferredTheme: updates.preferredTheme && VALID_THEMES2.includes(updates.preferredTheme) ? updates.preferredTheme : user.preferredTheme,
      preferredLanguage: updates.preferredLanguage ? sanitizePlainText(updates.preferredLanguage, 16) : user.preferredLanguage,
      preferredQuality: updates.preferredQuality ? sanitizePlainText(updates.preferredQuality, 16) : user.preferredQuality,
      parentalControl: typeof updates.parentalControl === "boolean" ? updates.parentalControl : user.parentalControl,
      notificationsEnabled: typeof updates.notificationsEnabled === "boolean" ? updates.notificationsEnabled : user.notificationsEnabled,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    return repositoryStore.upsertUser(next);
  }
  adminUpdateUser(uid, updates) {
    const user = repositoryStore.getUser(uid);
    if (!user) return null;
    const validPlans = ["free", "monthly", "quarterly", "annual"];
    const next = {
      ...user,
      blocked: typeof updates.blocked === "boolean" ? updates.blocked : user.blocked,
      role: updates.role === "admin" || updates.role === "user" ? updates.role : user.role,
      plan: updates.plan && validPlans.includes(updates.plan) ? updates.plan : user.plan,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    repositoryStore.upsertUser(next);
    repositoryStore.addLog({
      level: "info",
      service: "UserService",
      message: `Admin atualizou conta ${user.email}: role=${next.role}, blocked=${next.blocked}, plan=${next.plan}.`
    });
    return next;
  }
};
var UserService = new UserServiceImpl();

// server/app.ts
function createApiApp() {
  const app2 = express();
  app2.set("trust proxy", 1);
  app2.use(express.json({ limit: "1mb" }));
  app2.use("/api", rateLimitMiddleware(240, 6e4));
  app2.use("/api", (req, res, next) => {
    const p = req.path || "";
    const isImmutableMediaChunk = p.startsWith("/player/hls/") && p.endsWith("/seg") || p.startsWith("/player/video/") || p.startsWith("/player/subtitle/");
    if (!isImmutableMediaChunk) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
    next();
  });
  app2.get("/api/health", async (_req, res) => {
    await SystemSettingsService.ensureHydrated().catch(() => null);
    res.json({
      ok: true,
      service: "megastream-api",
      runtime: process.env.VERCEL ? "vercel-serverless" : "node",
      tmdbConfigured: TMDBService.isConfigured(),
      geminiConfigured: RecommendationService.isGeminiConfigured()
    });
  });
  app2.get("/api/site-config", async (_req, res, next) => {
    try {
      res.json(await SiteConfigService.getConfigAsync());
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/system-config", async (_req, res, next) => {
    try {
      res.json(await SystemSettingsService.getPublicRuntimeSettingsAsync());
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/integrations/status", requireAdmin, async (req, res, next) => {
    try {
      const status = await AdminService.getIntegrationStatus(true, req.headers.authorization);
      res.json(status);
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/catalog/home", async (_req, res, next) => {
    try {
      const data = await CatalogService.getHomeSections();
      res.json(data);
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/genres", async (_req, res, next) => {
    try {
      const [movie, tv] = await Promise.all([
        TMDBService.getGenres("movie"),
        TMDBService.getGenres("tv")
      ]);
      res.json({ movie, tv });
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/discover", async (req, res, next) => {
    try {
      const mediaType = req.query.type === "movie" || req.query.type === "tv" ? req.query.type : "all";
      const genreId = req.query.genreId ? Number(req.query.genreId) : null;
      const year = req.query.year ? Number(req.query.year) : null;
      const minRating = req.query.minRating ? Number(req.query.minRating) : null;
      const language = typeof req.query.language === "string" ? req.query.language : "all";
      const country = typeof req.query.country === "string" ? req.query.country : "all";
      const sortBy = req.query.sortBy === "rating" || req.query.sortBy === "release_date" ? req.query.sortBy : "popularity";
      const query = typeof req.query.q === "string" ? req.query.q : "";
      const page = req.query.page ? Math.max(1, Number(req.query.page)) : 1;
      const data = await TMDBService.discover({
        mediaType,
        genreId: Number.isFinite(genreId) ? genreId : null,
        year: Number.isFinite(year) ? year : null,
        minRating: Number.isFinite(minRating) ? minRating : null,
        language,
        country,
        sortBy,
        query,
        page
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/search", async (req, res, next) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const type = req.query.type === "movie" || req.query.type === "tv" ? req.query.type : "all";
      const page = req.query.page ? Math.max(1, Number(req.query.page)) : 1;
      if (!q) {
        return res.json({
          items: [],
          page: 1,
          totalPages: 1,
          totalResults: 0,
          source: "tmdb",
          demoMode: !TMDBService.isConfigured()
        });
      }
      const data = await TMDBService.search(q, type, page);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/movies", async (req, res, next) => {
    try {
      const page = req.query.page ? Math.max(1, Number(req.query.page)) : 1;
      const category = req.query.category === "now_playing" || req.query.category === "top_rated" || req.query.category === "upcoming" ? req.query.category : "popular";
      const data = await TMDBService.getMovieList(category, page);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/movies/popular", async (req, res, next) => {
    try {
      const page = req.query.page ? Math.max(1, Number(req.query.page)) : 1;
      res.json(await TMDBService.getMovieList("popular", page));
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/movies/:id", async (req, res, next) => {
    try {
      const id = normalizeTmdbId(req.params.id);
      if (!id) return res.status(400).json({ error: "ID TMDB de filme inv\xE1lido." });
      const detail = await TMDBService.getDetail(id, "movie");
      if (!detail) return res.status(404).json({ error: "Filme n\xE3o encontrado." });
      res.json(detail);
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/movies/:id/recommendations", async (req, res, next) => {
    try {
      const id = normalizeTmdbId(req.params.id);
      if (!id) return res.status(400).json({ error: "ID TMDB inv\xE1lido." });
      const detail = await TMDBService.getDetail(id, "movie");
      res.json({ items: detail?.recommendations ?? [] });
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/series", async (req, res, next) => {
    try {
      const page = req.query.page ? Math.max(1, Number(req.query.page)) : 1;
      const category = req.query.category === "top_rated" || req.query.category === "on_the_air" || req.query.category === "airing_today" ? req.query.category : "popular";
      res.json(await TMDBService.getSeriesList(category, page));
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/series/popular", async (req, res, next) => {
    try {
      const page = req.query.page ? Math.max(1, Number(req.query.page)) : 1;
      res.json(await TMDBService.getSeriesList("popular", page));
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/series/:id", async (req, res, next) => {
    try {
      const id = normalizeTmdbId(req.params.id);
      if (!id) return res.status(400).json({ error: "ID TMDB de s\xE9rie inv\xE1lido." });
      const detail = await TMDBService.getDetail(id, "tv");
      if (!detail) return res.status(404).json({ error: "S\xE9rie n\xE3o encontrada." });
      res.json(detail);
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/series/:id/seasons", async (req, res, next) => {
    try {
      const id = normalizeTmdbId(req.params.id);
      if (!id) return res.status(400).json({ error: "ID TMDB de s\xE9rie inv\xE1lido." });
      const seasonNumber = req.query.season ? Number(req.query.season) : 1;
      const detail = await TMDBService.getSeasonEpisodes(id, Math.max(0, seasonNumber));
      res.json(detail);
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/player/config", requireAdmin, async (_req, res, next) => {
    try {
      res.json(await PlayerService.getConfigAsync());
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/player/hls/:token/playlist.m3u8", async (req, res) => {
    await StreamResolverService.handleHlsManifestRequest(req.params.token, req, res);
  });
  app2.get("/api/player/video/:token", async (req, res) => {
    await StreamResolverService.handleHlsManifestRequest(req.params.token, req, res);
  });
  app2.get("/api/player/hls/:token/seg", async (req, res) => {
    const targetUrl = typeof req.query.u === "string" ? req.query.u : "";
    const sig = typeof req.query.s === "string" ? req.query.s : "";
    if (!targetUrl) {
      return res.status(400).json({ error: "Par\xE2metro de segmento ausente." });
    }
    await StreamResolverService.handleHlsSegmentRequest(req.params.token, targetUrl, sig, req, res);
  });
  app2.get("/api/player/subtitle/:subId.vtt", async (req, res) => {
    await StreamResolverService.handleSubtitleVttRequest(req.params.subId, res);
  });
  app2.get("/api/player/movie/:tmdbId", optionalAuth, async (req, res) => {
    try {
      await SystemSettingsService.ensureHydrated();
      const sys = SystemSettingsService.getSettings();
      if (sys.requireAuthForPlayer && !req.identity) {
        return res.status(401).json({ error: "Fa\xE7a login na plataforma para assistir a este t\xEDtulo." });
      }
      const payload = await PlayerService.resolveStreamAsync({
        tmdbId: req.params.tmdbId,
        mediaType: "movie"
      });
      res.json({
        tmdbId: payload.tmdbId,
        mediaType: payload.mediaType,
        embedUrl: payload.embedUrl,
        streamKind: payload.streamKind ?? "iframe",
        sandboxPolicy: payload.sandboxPolicy ?? "strict_no_ads",
        referrerPolicy: payload.referrerPolicy,
        branding: payload.branding,
        audioOptions: payload.audioOptions,
        subtitles: payload.subtitles,
        posterUrl: payload.posterUrl,
        streamUnavailableReason: payload.streamUnavailableReason ?? null
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Erro ao carregar reprodu\xE7\xE3o." });
    }
  });
  app2.get("/api/player/tv/:tmdbId", optionalAuth, async (req, res) => {
    try {
      await SystemSettingsService.ensureHydrated();
      const sys = SystemSettingsService.getSettings();
      if (sys.requireAuthForPlayer && !req.identity) {
        return res.status(401).json({ error: "Fa\xE7a login na plataforma para assistir a esta s\xE9rie." });
      }
      const seasonNumber = typeof req.query.season === "string" && req.query.season.trim() !== "" ? Number(req.query.season) : void 0;
      const episodeNumber = typeof req.query.episode === "string" && req.query.episode.trim() !== "" ? Number(req.query.episode) : void 0;
      const payload = await PlayerService.resolveStreamAsync({
        tmdbId: req.params.tmdbId,
        mediaType: "tv",
        seasonNumber,
        episodeNumber
      });
      res.json({
        tmdbId: payload.tmdbId,
        mediaType: payload.mediaType,
        embedUrl: payload.embedUrl,
        streamKind: payload.streamKind ?? "iframe",
        sandboxPolicy: payload.sandboxPolicy ?? "strict_no_ads",
        referrerPolicy: payload.referrerPolicy,
        seasonNumber: payload.seasonNumber,
        episodeNumber: payload.episodeNumber,
        branding: payload.branding,
        audioOptions: payload.audioOptions,
        subtitles: payload.subtitles,
        posterUrl: payload.posterUrl,
        streamUnavailableReason: payload.streamUnavailableReason ?? null
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Erro ao carregar reprodu\xE7\xE3o." });
    }
  });
  app2.get("/api/channels", async (req, res, next) => {
    try {
      const category = typeof req.query.category === "string" ? req.query.category : void 0;
      res.json({ items: await ChannelService.listPublicAsync(category) });
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/plans", (_req, res) => {
    res.json({ items: SubscriptionService.getPlans() });
  });
  app2.post("/api/subscriptions/select", requireAuth, (req, res) => {
    try {
      const planId = req.body?.planId;
      if (planId !== "monthly" && planId !== "quarterly" && planId !== "annual") {
        return res.status(400).json({ error: "Plano inv\xE1lido." });
      }
      const record = SubscriptionService.selectPlanPendingGateway(req.identity.uid, planId);
      res.json(record);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Erro ao selecionar plano." });
    }
  });
  app2.post("/api/ai/recommend", optionalAuth, async (req, res, next) => {
    try {
      const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
      const preferredMediaType = req.body?.mediaType === "movie" || req.body?.mediaType === "tv" ? req.body.mediaType : "all";
      const uid = req.identity?.uid;
      const favorites = uid ? FavoritesService.list(uid) : [];
      const history = uid ? HistoryService.list(uid) : [];
      const result = await RecommendationService.recommend({
        prompt,
        favorites,
        history,
        preferredMediaType
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/users/me", requireAuth, (req, res) => {
    const user = AuthenticationService.ensureUserRecord(req.identity);
    const subscription = SubscriptionService.getUserSubscription(user.uid);
    res.json({ user, subscription });
  });
  app2.patch("/api/users/me", requireAuth, (req, res) => {
    const updated = UserService.updatePreferences(req.identity.uid, req.body ?? {});
    if (!updated) return res.status(404).json({ error: "Usu\xE1rio n\xE3o encontrado." });
    res.json({ user: updated });
  });
  app2.get("/api/users/profiles", requireAuth, (req, res) => {
    const items = ProfileService.list(req.identity.uid, req.identity.name);
    res.json({ items });
  });
  app2.post("/api/users/profiles", requireAuth, async (req, res) => {
    try {
      const created = await ProfileService.create(req.identity.uid, req.body ?? {});
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Erro ao criar perfil." });
    }
  });
  app2.patch("/api/users/profiles/:profileId", requireAuth, async (req, res) => {
    try {
      const updated = await ProfileService.update(
        req.identity.uid,
        req.params.profileId,
        req.body ?? {}
      );
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Erro ao atualizar perfil." });
    }
  });
  app2.post(
    "/api/users/profiles/:profileId/verify-pin",
    requireAuth,
    async (req, res) => {
      const pin = typeof req.body?.pin === "string" ? req.body.pin : "";
      const verified = await ProfileService.verifyPin(
        req.identity.uid,
        req.params.profileId,
        pin
      );
      if (!verified) {
        return res.status(403).json({ verified: false, error: "Senha do perfil incorreta." });
      }
      res.json({ verified: true });
    }
  );
  app2.delete("/api/users/profiles/:profileId", requireAuth, async (req, res) => {
    try {
      const currentPin = typeof req.body?.currentPin === "string" ? req.body.currentPin : void 0;
      const removed = await ProfileService.remove(
        req.identity.uid,
        req.params.profileId,
        currentPin
      );
      res.json({ removed });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Erro ao remover perfil." });
    }
  });
  app2.get("/api/users/favorites", requireAuth, (req, res) => {
    const type = req.query.type === "movie" || req.query.type === "tv" ? req.query.type : "all";
    res.json({ items: FavoritesService.list(req.identity.uid, type) });
  });
  app2.post("/api/users/favorites", requireAuth, (req, res) => {
    try {
      const item = FavoritesService.add(req.identity.uid, req.body ?? {});
      res.status(201).json(item);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Erro ao salvar favorito." });
    }
  });
  app2.delete("/api/users/favorites/:id", requireAuth, (req, res) => {
    const tmdbId = normalizeTmdbId(req.params.id);
    const mediaType = req.query.type === "tv" ? "tv" : "movie";
    if (!tmdbId) return res.status(400).json({ error: "ID TMDB inv\xE1lido." });
    const removed = FavoritesService.remove(req.identity.uid, tmdbId, mediaType);
    res.json({ removed });
  });
  app2.get("/api/users/history", requireAuth, (req, res) => {
    res.json({ items: HistoryService.list(req.identity.uid) });
  });
  app2.post("/api/users/history", requireAuth, (req, res) => {
    try {
      const item = HistoryService.record(req.identity.uid, req.body ?? {});
      res.status(201).json(item);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Erro ao registrar hist\xF3rico." });
    }
  });
  app2.delete("/api/users/history/:id", requireAuth, (req, res) => {
    const tmdbId = normalizeTmdbId(req.params.id);
    const mediaType = req.query.type === "tv" ? "tv" : "movie";
    if (!tmdbId) return res.status(400).json({ error: "ID TMDB inv\xE1lido." });
    const removed = HistoryService.remove(req.identity.uid, tmdbId, mediaType);
    res.json({ removed });
  });
  app2.get("/api/admin/dashboard", requireAdmin, async (req, res, next) => {
    try {
      const [stats, integrations] = await Promise.all([
        AdminService.getDashboardStats(true, req.headers.authorization),
        AdminService.getIntegrationStatus(true, req.headers.authorization)
      ]);
      res.json({ stats, integrations });
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/admin/users", requireAdmin, (_req, res) => {
    res.json({ items: UserService.getAllUsers() });
  });
  app2.patch("/api/admin/users/:uid", requireAdmin, (req, res) => {
    const updated = UserService.adminUpdateUser(req.params.uid, req.body ?? {});
    if (!updated) return res.status(404).json({ error: "Usu\xE1rio n\xE3o encontrado." });
    res.json(updated);
  });
  app2.get("/api/admin/channels", requireAdmin, async (_req, res, next) => {
    try {
      res.json({ items: await ChannelService.listAllAdminAsync(true) });
    } catch (err) {
      next(err);
    }
  });
  app2.post("/api/admin/channels", requireAdmin, (req, res) => {
    try {
      const channel = ChannelService.createOrUpdate(req.body ?? {});
      res.status(201).json(channel);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Erro ao salvar canal." });
    }
  });
  app2.delete("/api/admin/channels/:id", requireAdmin, (req, res) => {
    const removed = ChannelService.remove(req.params.id);
    if (!removed) return res.status(404).json({ error: "Canal n\xE3o encontrado." });
    res.json({ removed: true });
  });
  app2.get("/api/admin/player-config", requireAdmin, async (_req, res, next) => {
    try {
      res.json(await PlayerService.getConfigAsync(true));
    } catch (err) {
      next(err);
    }
  });
  app2.put("/api/admin/player-config", requireAdmin, (req, res) => {
    const updated = PlayerService.updateConfig(req.body ?? {});
    res.json(updated);
  });
  app2.post("/api/admin/player-sources/test", requireAdmin, async (req, res, next) => {
    try {
      const cfg = await PlayerService.getConfigAsync(true);
      const rawSources = Array.isArray(req.body?.customSources) ? req.body.customSources : cfg.customSources || [];
      const results = await StreamResolverService.testCustomSources(rawSources);
      res.json({ results });
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/admin/site-config", requireAdmin, async (_req, res, next) => {
    try {
      res.json(await SiteConfigService.getConfigAsync(true));
    } catch (err) {
      next(err);
    }
  });
  app2.put("/api/admin/site-config", requireAdmin, (req, res) => {
    const updated = SiteConfigService.updateConfig(req.body ?? {});
    res.json(updated);
  });
  app2.get("/api/admin/system-settings", requireAdmin, async (req, res, next) => {
    try {
      res.json(await SystemSettingsService.getAdminPayloadAsync(true, req.headers.authorization));
    } catch (err) {
      next(err);
    }
  });
  app2.put("/api/admin/system-settings", requireAdmin, (req, res) => {
    const updated = SystemSettingsService.updateSettings(req.body ?? {});
    res.json(updated);
  });
  app2.post("/api/admin/system-settings/reset", requireAdmin, (_req, res) => {
    const reset = SystemSettingsService.resetSettingsToDefaults();
    res.json(reset);
  });
  app2.post("/api/admin/diagnostics/test", requireAdmin, async (req, res, next) => {
    try {
      const target = req.body?.target === "player" || req.body?.target === "firestore" ? req.body.target : "tmdb";
      const result = await AdminService.runDiagnostic(target, req.headers.authorization);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/admin/catalog/custom", requireAdmin, async (_req, res, next) => {
    try {
      res.json({ items: await SiteConfigService.listCustomCatalogAsync(true) });
    } catch (err) {
      next(err);
    }
  });
  app2.post("/api/admin/catalog/custom", requireAdmin, (req, res) => {
    try {
      const saved = SiteConfigService.upsertCustomMedia(req.body ?? {});
      StreamResolverService.clearCache();
      res.status(201).json(saved);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Erro ao salvar m\xEDdia." });
    }
  });
  app2.delete("/api/admin/catalog/custom/:id", requireAdmin, (req, res) => {
    const removed = SiteConfigService.deleteCustomMedia(req.params.id);
    if (!removed) return res.status(404).json({ error: "M\xEDdia personalizada n\xE3o encontrada." });
    StreamResolverService.clearCache();
    res.json({ removed: true });
  });
  app2.post("/api/admin/catalog/sync", requireAdmin, async (_req, res, next) => {
    try {
      const result = await CatalogService.syncCatalog();
      res.json(result);
    } catch (err) {
      next(err);
    }
  });
  app2.post("/api/admin/cache/clear", requireAdmin, (_req, res) => {
    StreamResolverService.clearCache();
    const cleared = AdminService.clearCache();
    res.json({ cleared });
  });
  app2.get("/api/admin/logs", requireAdmin, (_req, res) => {
    res.json({ items: AdminService.getLogs(120) });
  });
  app2.use("/api", (_req, res) => {
    res.status(404).json({ error: "Rota da API n\xE3o encontrada." });
  });
  app2.use("/api", globalErrorHandler);
  return app2;
}
var app = createApiApp();

// shared/vercelUtils.ts
function normalizeVercelApiUrl(rawUrl) {
  const input = rawUrl && rawUrl.trim().length > 0 ? rawUrl : "/api";
  const url = new URL(input, "http://localhost");
  const pathOverride = url.searchParams.get("__path");
  if (pathOverride !== null) {
    url.searchParams.delete("__path");
    const cleanSubpath = pathOverride.replace(/^\/+/, "");
    url.pathname = cleanSubpath ? `/api/${cleanSubpath}` : "/api";
  } else if (url.pathname === "/api/index") {
    url.pathname = "/api";
  }
  const qs = url.searchParams.toString();
  return qs ? `${url.pathname}?${qs}` : url.pathname;
}

// server/vercel.ts
function handler(req, res) {
  try {
    req.url = normalizeVercelApiUrl(req.url ?? "/api");
    if (req.query && typeof req.query === "object" && "__path" in req.query) {
      try {
        delete req.query.__path;
      } catch {
      }
    }
    if (req.body !== void 0 && !req._body) {
      req._body = true;
    }
    return app(req, res);
  } catch (err) {
    console.error("MegaStream Vercel handler error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : "Erro interno na fun\xE7\xE3o serverless."
        })
      );
    }
  }
}
export {
  handler as default
};
