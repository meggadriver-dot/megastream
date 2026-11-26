// server/env.ts
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
var envPath = path.resolve(process.cwd(), ".env");
if (!process.env.VERCEL && fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
}

// server/app.ts
import os from "node:os";
import express from "express";

// shared/catalogUtils.ts
var TMDB_BR_WATCH_PROVIDERS = [
  { id: 8, name: "Netflix" },
  { id: 119, name: "Amazon Prime Video" },
  { id: 337, name: "Disney+" },
  { id: 1899, name: "Max" },
  { id: 307, name: "Globoplay" },
  { id: 350, name: "Apple TV+" },
  { id: 531, name: "Paramount+" },
  { id: 283, name: "Crunchyroll" },
  { id: 167, name: "Claro video" },
  { id: 47, name: "Looke" },
  { id: 11, name: "MUBI" },
  { id: 2156, name: "Mercado Play" }
];
var MOVIE_TO_TV_GENRE_MAP = {
  28: 10759,
  // Ação -> Action & Adventure
  12: 10759,
  // Aventura -> Action & Adventure
  14: 10765,
  // Fantasia -> Sci-Fi & Fantasy
  878: 10765,
  // Ficção científica -> Sci-Fi & Fantasy
  10752: 10768,
  // Guerra -> War & Politics
  27: 9648,
  // Terror -> Mistério/Suspense (closest TV match)
  53: 9648,
  // Suspense -> Mistério
  10749: 18,
  // Romance -> Drama
  36: 99,
  // História -> Documentário
  10402: null,
  // Música (Movie-only)
  10770: null
  // Cinema TV (Movie-only)
};
var TV_TO_MOVIE_GENRE_MAP = {
  10759: 28,
  // Action & Adventure -> Ação
  10765: 878,
  // Sci-Fi & Fantasy -> Ficção científica
  10768: 10752,
  // War & Politics -> Guerra
  10762: 10751,
  // Kids -> Família
  10766: null,
  // Soap / Novelas (TV-only)
  10764: null,
  // Reality (TV-only)
  10763: null,
  // News (TV-only)
  10767: null
  // Talk (TV-only)
};
function resolveTmdbGenreForMediaType(genreId, targetType) {
  if (!genreId || !Number.isFinite(genreId)) {
    return { genreId: void 0, compatible: true };
  }
  if (targetType === "tv") {
    if (Object.prototype.hasOwnProperty.call(MOVIE_TO_TV_GENRE_MAP, genreId)) {
      const mapped = MOVIE_TO_TV_GENRE_MAP[genreId];
      return mapped ? { genreId: mapped, compatible: true } : { genreId: void 0, compatible: false };
    }
    return { genreId, compatible: true };
  }
  if (Object.prototype.hasOwnProperty.call(TV_TO_MOVIE_GENRE_MAP, genreId)) {
    const mapped = TV_TO_MOVIE_GENRE_MAP[genreId];
    return mapped ? { genreId: mapped, compatible: true } : { genreId: void 0, compatible: false };
  }
  return { genreId, compatible: true };
}
function mergeUnifiedTmdbGenres(movieGenres, tvGenres) {
  const byId = /* @__PURE__ */ new Map();
  for (const g of movieGenres) {
    if (g?.id && g?.name) byId.set(g.id, g);
  }
  const tvLabels = {
    10766: "Novelas (Soap)",
    10762: "Infantil (Kids)",
    10764: "Reality Show",
    10767: "Talk Show",
    10763: "Not\xEDcias",
    10759: "A\xE7\xE3o e Aventura (S\xE9ries)",
    10765: "Sci-Fi e Fantasia (S\xE9ries)",
    10768: "Guerra e Pol\xEDtica (S\xE9ries)"
  };
  for (const g of tvGenres) {
    if (!g?.id || !g?.name) continue;
    if (!byId.has(g.id)) {
      byId.set(g.id, { id: g.id, name: tvLabels[g.id] || g.name });
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
function parseCatalogSearchTarget(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "text", rawQuery: "" };
  const tmdbUrlMatch = trimmed.match(/themoviedb\.org\/(movie|tv)\/(\d+)/i);
  if (tmdbUrlMatch) {
    return {
      kind: "tmdb_typed",
      mediaType: tmdbUrlMatch[1].toLowerCase() === "tv" ? "tv" : "movie",
      tmdbId: Number(tmdbUrlMatch[2])
    };
  }
  const typedMatch = trimmed.match(/^(?:tmdb:)?(movie|tv)[/:](\d+)$/i);
  if (typedMatch) {
    return {
      kind: "tmdb_typed",
      mediaType: typedMatch[1].toLowerCase() === "tv" ? "tv" : "movie",
      tmdbId: Number(typedMatch[2])
    };
  }
  const imdbMatch = trimmed.match(/^(tt\d{5,12})$/i);
  if (imdbMatch) {
    return { kind: "imdb", imdbId: imdbMatch[1].toLowerCase() };
  }
  const prefixedNumeric = trimmed.match(/^(?:#|tmdb:)(\d{1,8})$/i);
  if (prefixedNumeric) {
    return {
      kind: "tmdb_numeric",
      tmdbId: Number(prefixedNumeric[1]),
      rawQuery: trimmed
    };
  }
  if (/^\d{1,8}$/.test(trimmed)) {
    const num = Number(trimmed);
    if (num > 0) {
      return { kind: "tmdb_numeric", tmdbId: num, rawQuery: trimmed };
    }
  }
  return { kind: "text", rawQuery: trimmed };
}
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
    if (filters.genreId) {
      const resolved = resolveTmdbGenreForMediaType(filters.genreId, item.mediaType);
      if (!resolved.compatible) return false;
      if (resolved.genreId && !item.genreIds.includes(resolved.genreId) && !item.genreIds.includes(filters.genreId)) {
        return false;
      }
    }
    const itemYear = Number(item.releaseYear);
    if (filters.year && itemYear !== filters.year) {
      return false;
    }
    if (filters.yearFrom && (!Number.isFinite(itemYear) || itemYear < filters.yearFrom)) {
      return false;
    }
    if (filters.yearTo && (!Number.isFinite(itemYear) || itemYear > filters.yearTo)) {
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
      const hay = `${item.title} ${item.originalTitle} ${item.overview} ${item.tmdbId}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    if (filters.sortBy === "rating") {
      return b.voteAverage - a.voteAverage;
    }
    if (filters.sortBy === "votes") {
      return b.voteCount - a.voteCount;
    }
    if (filters.sortBy === "release_date") {
      return (b.releaseDate || "").localeCompare(a.releaseDate || "");
    }
    if (filters.sortBy === "release_date_asc") {
      return (a.releaseDate || "9999").localeCompare(b.releaseDate || "9999");
    }
    if (filters.sortBy === "title_asc") {
      return a.title.localeCompare(b.title, "pt-BR");
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
  return /\{(?:tmdbId|tmdb_id|TMDB_ID|id|imdbId|imdb_id|IMDB_ID|title|TITLE|query|QUERY)\}/.test(
    template
  );
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
  hindi: { label: "Hindi", shortTag: "HI", langCode: "hi" },
  ru: { label: "Russo", shortTag: "RU", langCode: "ru" },
  rus: { label: "Russo", shortTag: "RU", langCode: "ru" },
  russian: { label: "Russo", shortTag: "RU", langCode: "ru" },
  ar: { label: "\xC1rabe", shortTag: "AR", langCode: "ar" },
  ara: { label: "\xC1rabe", shortTag: "AR", langCode: "ar" },
  arabic: { label: "\xC1rabe", shortTag: "AR", langCode: "ar" },
  zh: { label: "Chin\xEAs", shortTag: "ZH", langCode: "zh" },
  chi: { label: "Chin\xEAs", shortTag: "ZH", langCode: "zh" },
  zho: { label: "Chin\xEAs", shortTag: "ZH", langCode: "zh" },
  chinese: { label: "Chin\xEAs", shortTag: "ZH", langCode: "zh" },
  nl: { label: "Holand\xEAs", shortTag: "NL", langCode: "nl" },
  dut: { label: "Holand\xEAs", shortTag: "NL", langCode: "nl" },
  nld: { label: "Holand\xEAs", shortTag: "NL", langCode: "nl" },
  pl: { label: "Polon\xEAs", shortTag: "PL", langCode: "pl" },
  pol: { label: "Polon\xEAs", shortTag: "PL", langCode: "pl" },
  tr: { label: "Turco", shortTag: "TR", langCode: "tr" },
  tur: { label: "Turco", shortTag: "TR", langCode: "tr" }
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
var RECOMMENDED_CUSTOM_SOURCES = [
  {
    id: "rec_vidlink_en",
    name: "VidLink HD (Ingl\xEAs + Legendas PT-BR)",
    kind: "api",
    lang: "auto",
    movieTemplate: "https://vidlink.pro/movie/{tmdbId}",
    tvTemplate: "https://vidlink.pro/tv/{tmdbId}/{season}/{episode}",
    priority: 1,
    active: true
  },
  {
    id: "rec_cinejoy_en",
    name: "Cinejoy Full HD (Ingl\xEAs H.264)",
    kind: "api",
    lang: "en",
    movieTemplate: "https://cinejoy.pk/movie/{tmdbId}",
    tvTemplate: "https://cinejoy.pk/tv/{tmdbId}/{season}/{episode}",
    priority: 2,
    active: true
  },
  {
    id: "rec_playerflix_pt",
    name: "PlayerFlix (PT-BR / Legendado)",
    kind: "embed",
    lang: "auto",
    movieTemplate: "https://playerflix.ink/filme/{tmdbId}",
    tvTemplate: "https://playerflix.ink/serie/{tmdbId}/{season}/{episode}",
    priority: 3,
    active: true
  },
  {
    id: "rec_watchplay1_pt",
    name: "WatchPlay v1 (PT-BR)",
    kind: "embed",
    lang: "pt",
    movieTemplate: "https://v1.watchplay.shop/movie/{tmdbId}",
    tvTemplate: "https://v1.watchplay.shop/tvshow/{tmdbId}/{season}/{episode}",
    priority: 4,
    active: true
  },
  {
    id: "rec_watchplay2_pt",
    name: "WatchPlay v2 (PT-BR)",
    kind: "embed",
    lang: "pt",
    movieTemplate: "https://v2.watchplay.shop/movie/{tmdbId}",
    tvTemplate: "https://v2.watchplay.shop/tvshow/{tmdbId}/{season}/{episode}",
    priority: 5,
    active: true
  },
  {
    id: "rec_novelascdn_pt",
    name: "NovelasCDN (PT-BR Dublado/Legendado)",
    kind: "embed",
    lang: "pt",
    movieTemplate: "https://novelascdn.link/filme/{tmdbId}",
    tvTemplate: "https://novelascdn.link/serie/{tmdbId}/{season}/{episode}",
    priority: 6,
    active: true
  },
  {
    id: "rec_fshd_pt",
    name: "FSHD Stream (PT-BR Dublado/Legendado)",
    kind: "embed",
    lang: "pt",
    movieTemplate: "https://fshd.link/filme/{tmdbId}",
    tvTemplate: "https://fshd.link/serie/{tmdbId}/{season}/{episode}",
    priority: 7,
    active: true
  },
  {
    id: "rec_vidup_en",
    name: "VidUp 4K/HD (Ingl\xEAs)",
    kind: "api",
    lang: "en",
    movieTemplate: "https://vidup.to/movie/{tmdbId}",
    tvTemplate: "https://vidup.to/tv/{tmdbId}/{season}/{episode}",
    priority: 8,
    active: true
  },
  {
    id: "rec_fshd_imdb_pt",
    name: "FSHD IMDb (PT-BR Dublado/Legendado)",
    kind: "embed",
    lang: "pt",
    movieTemplate: "https://fshd.link/filme/{imdbId}",
    tvTemplate: "https://fshd.link/serie/{imdbId}/{season}/{episode}",
    priority: 9,
    active: true
  },
  {
    id: "rec_meowtv_multi",
    name: "MeowTV Multi-\xC1udio (Auto)",
    kind: "api",
    lang: "auto",
    movieTemplate: "https://meowtv.ru/movie/{tmdbId}",
    tvTemplate: "https://meowtv.ru/tv/{tmdbId}/{season}/{episode}",
    priority: 10,
    active: true
  },
  {
    id: "rec_freeapi_anime",
    name: "FreeAPI Pro \xB7 Anime HLS (EN / JA + Leg.)",
    kind: "api",
    lang: "auto",
    movieTemplate: "https://freeapi.pro/api/anime?action=search&q={title}",
    tvTemplate: "https://freeapi.pro/api/anime?action=search&q={title}&ep={episode}",
    priority: 11,
    active: true
  },
  {
    id: "rec_freeapi_movies",
    name: "FreeAPI Pro \xB7 Movies & Series (/api/msearch)",
    kind: "api",
    lang: "auto",
    movieTemplate: "https://freeapi.pro/api/msearch?q={title}",
    tvTemplate: "https://freeapi.pro/api/msearch?q={title}",
    priority: 12,
    active: true
  },
  {
    id: "rec_streambetter_json",
    name: "StreamBetter \xB7 API JSON / Embed (PT-BR)",
    kind: "api",
    lang: "auto",
    movieTemplate: "https://streambetter.xyz/api/v1/stream?tmdb_id={tmdbId}&type=movie",
    tvTemplate: "https://streambetter.xyz/api/v1/stream?tmdb_id={tmdbId}&type=tv&season={season}&episode={episode}",
    priority: 13,
    active: true
  }
];
var KNOWN_CLOUDFLARE_BLOCKED_SOURCE_RE = /(?:embedmaster\.link|api\.watcha\.one|superflixapi\.(?:lat|boats)|mgeb\.(?:lat|space)|myembed\.biz|2embed\.cc|videm\.buzz|vidsrc\.buzz)/i;
function parseM3uPlaylistText(rawText, maxEntries = 60) {
  const lines = (rawText || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const results = [];
  const seenUrls = /* @__PURE__ */ new Set();
  let pendingTitle = "";
  let pendingGroup = "M3U";
  let pendingLogo = "";
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF")) {
      const commaIdx = line.lastIndexOf(",");
      pendingTitle = commaIdx !== -1 ? line.slice(commaIdx + 1).trim() : "";
      const groupMatch = line.match(/group-title=["']([^"']*)["']/i);
      pendingGroup = groupMatch?.[1]?.trim() || "M3U";
      const logoMatch = line.match(/tvg-logo=["']([^"']*)["']/i);
      pendingLogo = logoMatch?.[1]?.trim() || "";
      continue;
    }
    if (line.startsWith("#")) continue;
    if (!/^https?:\/\//i.test(line)) {
      pendingTitle = "";
      pendingGroup = "M3U";
      pendingLogo = "";
      continue;
    }
    if (seenUrls.has(line)) continue;
    seenUrls.add(line);
    const safeName = (pendingTitle || `Stream M3U ${results.length + 1}`).replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
    const hint = `${safeName} ${pendingGroup}`.toLowerCase();
    let lang = "auto";
    if (/(?:legend|pt-sub|\bleg\b)/i.test(hint)) lang = "sub";
    else if (/(?:\bpt\b|pt-br|dublado|brasil|brazil|portugu)/i.test(hint)) lang = "pt";
    else if (/(?:espan|spanish|latino|castellano|\bes\b)/i.test(hint)) lang = "es";
    else if (/(?:english|ingl[eê]s|\ben\b)/i.test(hint)) lang = "en";
    results.push({
      name: safeName,
      groupTitle: pendingGroup.slice(0, 40),
      streamUrl: line.slice(0, 500),
      ...pendingLogo && /^https?:\/\//i.test(pendingLogo) ? { logoUrl: pendingLogo } : {},
      lang
    });
    pendingTitle = "";
    pendingGroup = "M3U";
    pendingLogo = "";
    if (results.length >= maxEntries) break;
  }
  return results;
}
function normalizeTemplateKey(url) {
  return (url || "").trim().toLowerCase().replace(/\/+$/, "");
}
function mergeRecommendedCustomSources(existingInput) {
  const existing = sanitizeCustomVideoSources(existingInput);
  const recommendedByKey = /* @__PURE__ */ new Map();
  for (const rec of RECOMMENDED_CUSTOM_SOURCES) {
    if (rec.movieTemplate) recommendedByKey.set(normalizeTemplateKey(rec.movieTemplate), rec);
    if (rec.tvTemplate) recommendedByKey.set(normalizeTemplateKey(rec.tvTemplate), rec);
  }
  let pausedBrokenCount = 0;
  const matchedRecIds = /* @__PURE__ */ new Set();
  const updatedExisting = existing.map((src) => {
    const movieKey = normalizeTemplateKey(src.movieTemplate);
    const tvKey = normalizeTemplateKey(src.tvTemplate);
    const rec = (movieKey ? recommendedByKey.get(movieKey) : void 0) || (tvKey ? recommendedByKey.get(tvKey) : void 0);
    if (rec) {
      matchedRecIds.add(rec.id);
      return {
        ...src,
        active: true
      };
    }
    const combinedUrls = `${src.movieTemplate} ${src.tvTemplate}`;
    const isKnownBlocked = KNOWN_CLOUDFLARE_BLOCKED_SOURCE_RE.test(combinedUrls);
    const missingTemplateVar = src.kind !== "direct" && !hasUrlTemplatePlaceholder(src.movieTemplate) && !hasUrlTemplatePlaceholder(src.tvTemplate);
    if (src.active && (isKnownBlocked || missingTemplateVar)) {
      pausedBrokenCount += 1;
      return {
        ...src,
        active: false
      };
    }
    return src;
  });
  const existingIds = new Set(updatedExisting.map((s) => s.id));
  const toAppend = [];
  for (const rec of RECOMMENDED_CUSTOM_SOURCES) {
    if (matchedRecIds.has(rec.id)) continue;
    const uniqueId = existingIds.has(rec.id) ? `${rec.id}_${Math.random().toString(36).slice(2, 6)}` : rec.id;
    existingIds.add(uniqueId);
    toAppend.push({
      ...rec,
      id: uniqueId
    });
  }
  const combined = [...updatedExisting, ...toAppend].map((item, idx) => ({
    ...item,
    priority: idx + 1
  }));
  return {
    sources: sanitizeCustomVideoSources(combined),
    addedCount: toAppend.length,
    pausedBrokenCount
  };
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
  if (clean.endsWith(".mp4") || clean.endsWith(".mkv") || clean.endsWith(".webm") || clean.endsWith(".ogg") || clean.endsWith(".ogv") || clean.endsWith(".mov") || clean.endsWith(".m4v")) {
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
  const encodedTitle = encodeURIComponent((params.title || "").trim());
  const cleanYear = encodeURIComponent((params.releaseYear || "").trim().slice(0, 4));
  return cleanTemplate.replace(/\{tmdbId\}|\{tmdb_id\}|\{TMDB_ID\}|\{id\}/g, String(validId)).replace(/\{imdbId\}|\{imdb_id\}|\{IMDB_ID\}/g, imdb).replace(/\{title\}|\{TITLE\}|\{query\}|\{QUERY\}/g, encodedTitle).replace(/\{year\}|\{YEAR\}/g, cleanYear).replace(/\{season\}|\{SEASON\}|\{temporada\}/g, String(season)).replace(/\{episode\}|\{EPISODE\}|\{episodio\}|\{episódio\}/g, String(episode)).replace(/\{player\}/g, encodeURIComponent(player)).replace(/\{color\}/g, color).replace(/\{type\}/g, params.mediaType === "tv" ? "tv" : "movie");
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
    title: params.title,
    releaseYear: params.releaseYear,
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
        title: params.title,
        releaseYear: params.releaseYear,
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

// shared/streamBetterUtils.ts
var STREAMBETTER_BASE_URL = "https://streambetter.xyz";
function isStreamBetterHost(hostname) {
  const clean = (hostname || "").trim().toLowerCase().replace(/\.$/, "");
  return clean === "streambetter.xyz" || clean.endsWith(".streambetter.xyz");
}
function slugifyStreamBetterParam(label) {
  return (label || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function buildStreamBetterCanonicalUrl(params) {
  const safeId = Math.max(1, Math.round(params.tmdbId));
  if (params.mediaType === "tv") {
    const s = Math.max(1, Math.round(params.seasonNumber || 1));
    const e = Math.max(1, Math.round(params.episodeNumber || 1));
    const prefix2 = params.useMirrorPrefix ? "s" : "serie";
    return `${STREAMBETTER_BASE_URL}/${prefix2}/${safeId}/${s}/${e}`;
  }
  const prefix = params.useMirrorPrefix ? "v" : "filme";
  return `${STREAMBETTER_BASE_URL}/${prefix}/${safeId}`;
}
function buildStreamBetterV1StreamUrl(params) {
  const url = new URL(`${STREAMBETTER_BASE_URL}/api/v1/stream`);
  if (params.channel) {
    url.searchParams.set("channel", params.channel.trim());
  } else if (params.game) {
    url.searchParams.set("game", params.game.trim());
  } else if (params.event) {
    url.searchParams.set("event", params.event.trim());
  } else if (params.tmdbId && params.tmdbId > 0) {
    url.searchParams.set("tmdb_id", String(Math.round(params.tmdbId)));
    const type = params.mediaType === "tv" ? "tv" : "movie";
    url.searchParams.set("type", type);
    if (type === "tv") {
      url.searchParams.set("season", String(Math.max(1, Math.round(params.seasonNumber || 1))));
      url.searchParams.set("episode", String(Math.max(1, Math.round(params.episodeNumber || 1))));
    }
  }
  if (params.fonte?.trim()) {
    url.searchParams.set("fonte", slugifyStreamBetterParam(params.fonte));
  }
  return url.toString();
}
function buildStreamBetter451Candidates(rawUrl, legalBlocks = []) {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) return [];
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return [trimmed];
  }
  const normalizedBlockSet = new Set(
    (legalBlocks || []).map((entry) => String(entry || "").trim().toLowerCase().replace(/\/+$/, "")).filter(Boolean)
  );
  const makeTrailingSlashVariant = (u) => {
    const clone = new URL(u.toString());
    if (!clone.pathname.endsWith("/")) {
      clone.pathname = `${clone.pathname}/`;
    }
    return clone.toString();
  };
  const makeMirrorVariant = (u) => {
    const clone = new URL(u.toString());
    if (/^\/filme\//i.test(clone.pathname)) {
      clone.pathname = clone.pathname.replace(/^\/filme\//i, "/v/");
      return clone.toString();
    }
    if (/^\/serie\//i.test(clone.pathname)) {
      clone.pathname = clone.pathname.replace(/^\/serie\//i, "/s/");
      return clone.toString();
    }
    if (/^\/canal\//i.test(clone.pathname)) {
      clone.pathname = clone.pathname.replace(/^\/canal\//i, "/t/");
      return clone.toString();
    }
    return null;
  };
  const trailingSlashUrl = makeTrailingSlashVariant(parsed);
  const mirrorUrl = makeMirrorVariant(parsed);
  const mirrorTrailingUrl = mirrorUrl ? makeTrailingSlashVariant(new URL(mirrorUrl)) : null;
  const isKnownBlocked = normalizedBlockSet.has(parsed.pathname.toLowerCase().replace(/\/+$/, "")) || normalizedBlockSet.has(trimmed.toLowerCase().replace(/\/+$/, ""));
  const ordered = isKnownBlocked ? [trailingSlashUrl, mirrorUrl, mirrorTrailingUrl, trimmed] : [trimmed, trailingSlashUrl, mirrorUrl, mirrorTrailingUrl];
  const deduped = [];
  const seen = /* @__PURE__ */ new Set();
  for (const candidate of ordered) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    deduped.push(candidate);
  }
  return deduped;
}
function extractStreamBetterSlugFromUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  try {
    const parsed = new URL(rawUrl.trim());
    if (!isStreamBetterHost(parsed.hostname)) return null;
    const cleanPath = parsed.pathname.replace(/\/+$/, "");
    const channelMatch = cleanPath.match(/^\/(?:canal|t)\/([^/?#]+)$/i);
    if (channelMatch?.[1]) {
      return { kind: "channel", slug: decodeURIComponent(channelMatch[1]) };
    }
    const gameMatch = cleanPath.match(/^\/jogo\/([^/?#]+)$/i);
    if (gameMatch?.[1]) {
      return { kind: "game", slug: decodeURIComponent(gameMatch[1]) };
    }
    const eventMatch = cleanPath.match(/^\/evento\/([^/?#]+)$/i);
    if (eventMatch?.[1]) {
      return { kind: "event", slug: decodeURIComponent(eventMatch[1]) };
    }
    return null;
  } catch {
    return null;
  }
}
function extractStreamFlashMp4FromHtml(html) {
  if (!html || typeof html !== "string") return null;
  const match = html.match(/<source\s+src=["']([^"']+)["']\s+type=["']video\/mp4["']/i);
  if (!match?.[1]) return null;
  const decoded = match[1].replace(/&amp;/g, "&").trim();
  if (!/^https?:\/\//i.test(decoded)) return null;
  return decoded;
}
function mapStreamBetterAudioToMeta(audio, label) {
  const hint = `${audio || ""} ${label || ""}`.trim().toLowerCase();
  if (/(?:legend|pt-sub|\bleg\b|\bsub\b)/i.test(hint)) {
    return { langCode: "pt-sub", languageLabel: "Legendado (PT-BR)" };
  }
  if (/(?:dub|pt-br|portugu|\bpt\b)/i.test(hint)) {
    return { langCode: "pt-br", languageLabel: "Dublado (PT-BR)" };
  }
  if (/(?:espan|spanish|\bes\b|latino)/i.test(hint)) {
    return { langCode: "es-es", languageLabel: "Espanhol" };
  }
  if (/(?:english|ingl|\ben\b|original)/i.test(hint)) {
    return { langCode: "en-us", languageLabel: "Ingl\xEAs / Original" };
  }
  return { langCode: "pt-br", languageLabel: "Dublado (PT-BR)" };
}
function parseStreamBetterV1Sources(payload) {
  if (!payload || typeof payload !== "object") return [];
  const obj = payload;
  const rawSources = Array.isArray(obj.sources) ? obj.sources : [];
  const results = [];
  for (const item of rawSources) {
    if (!item || typeof item !== "object") continue;
    const src = item;
    const rawUrl = typeof src.url === "string" ? src.url.trim() : "";
    const err = typeof src.error === "string" ? src.error.trim() : "";
    if (!rawUrl || err === "extraction_failed" || !/^https?:\/\//i.test(rawUrl)) {
      continue;
    }
    const rawKind = typeof src.kind === "string" ? src.kind.trim().toLowerCase() : "stream";
    const rawFormat = typeof src.format === "string" ? src.format.trim().toLowerCase() : "";
    let format = "hls";
    if (rawKind === "iframe") {
      format = "iframe";
    } else if (rawKind === "dash" || rawFormat === "dash" || /\.mpd(?:$|\?)/i.test(rawUrl)) {
      format = "dash";
    } else if (rawFormat === "mp4" || rawKind === "streamflash" || /\.(?:mp4|m4v|webm|mkv)(?:$|\?)/i.test(rawUrl)) {
      format = "mp4";
    } else if (rawFormat === "hls" || /\.m3u8(?:$|\?)/i.test(rawUrl) || rawKind === "stream" || rawKind === "hubby" || rawKind === "vidmoly") {
      format = "hls";
    }
    const headers = {};
    let referer = "";
    let origin = "";
    let userAgent;
    if (src.headers && typeof src.headers === "object" && !Array.isArray(src.headers)) {
      for (const [k, v] of Object.entries(src.headers)) {
        if (typeof v !== "string" || !v.trim()) continue;
        const val = v.trim();
        headers[k] = val;
        const lowerKey = k.toLowerCase();
        if (lowerKey === "referer") referer = val;
        else if (lowerKey === "origin") origin = val;
        else if (lowerKey === "user-agent") userAgent = val;
      }
    }
    const expiresAt = typeof src.expires_at === "string" && src.expires_at.trim() ? src.expires_at.trim() : null;
    const hasCustomHeaders = Object.keys(headers).length > 0;
    const requiresProxyHeaders = !expiresAt && hasCustomHeaders;
    const audio = typeof src.audio === "string" ? src.audio.trim() : null;
    const label = typeof src.label === "string" ? src.label.trim() : "";
    const langMeta = mapStreamBetterAudioToMeta(audio, label);
    const subtitleUrl = typeof src.subtitle_url === "string" && /^https?:\/\//i.test(src.subtitle_url.trim()) ? src.subtitle_url.trim() : null;
    const subtitleLang = typeof src.subtitle_lang === "string" ? src.subtitle_lang.trim() : null;
    const subtitleLabel = typeof src.subtitle_label === "string" ? src.subtitle_label.trim() : null;
    const qualities = [];
    if (Array.isArray(src.qualities)) {
      for (const qItem of src.qualities) {
        if (!qItem || typeof qItem !== "object") continue;
        const qo = qItem;
        const qUrl = typeof qo.url === "string" ? qo.url.trim() : "";
        if (/^https?:\/\//i.test(qUrl)) {
          qualities.push({
            quality: typeof qo.quality === "string" || typeof qo.quality === "number" ? String(qo.quality) : "HD",
            url: qUrl
          });
        }
      }
    } else if (src.qualities && typeof src.qualities === "object") {
      for (const [qName, qVal] of Object.entries(src.qualities)) {
        if (typeof qVal === "string" && /^https?:\/\//i.test(qVal.trim())) {
          qualities.push({ quality: qName, url: qVal.trim() });
        } else if (qVal && typeof qVal === "object") {
          const nestedUrl = qVal.url;
          if (typeof nestedUrl === "string" && /^https?:\/\//i.test(nestedUrl.trim())) {
            qualities.push({ quality: qName, url: nestedUrl.trim() });
          }
        }
      }
    }
    results.push({
      kind: rawKind,
      url: rawUrl,
      format,
      headers,
      referer,
      origin,
      userAgent,
      langCode: langMeta.langCode,
      languageLabel: langMeta.languageLabel,
      label: label || langMeta.languageLabel,
      expiresAt,
      requiresProxyHeaders,
      subtitleUrl,
      subtitleLang,
      subtitleLabel,
      qualities
    });
  }
  return results;
}

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
  fr: "Franc\xEAs",
  ger: "Alem\xE3o",
  deu: "Alem\xE3o",
  de: "Alem\xE3o",
  ita: "Italiano",
  it: "Italiano",
  jpn: "Japon\xEAs",
  ja: "Japon\xEAs",
  kor: "Coreano",
  ko: "Coreano",
  rus: "Russo",
  ru: "Russo",
  ara: "\xC1rabe",
  ar: "\xC1rabe",
  chi: "Chin\xEAs",
  zho: "Chin\xEAs",
  zh: "Chin\xEAs",
  dut: "Holand\xEAs",
  nld: "Holand\xEAs",
  nl: "Holand\xEAs",
  pol: "Polon\xEAs",
  pl: "Polon\xEAs",
  tur: "Turco",
  tr: "Turco",
  hin: "Hindi",
  hi: "Hindi",
  ind: "Indon\xE9sio",
  id: "Indon\xE9sio",
  vie: "Vietnamita",
  vi: "Vietnamita",
  tha: "Tailand\xEAs",
  th: "Tailand\xEAs",
  heb: "Hebraico",
  he: "Hebraico",
  swe: "Sueco",
  sv: "Sueco",
  nor: "Noruegu\xEAs",
  no: "Noruegu\xEAs",
  dan: "Dinamarqu\xEAs",
  da: "Dinamarqu\xEAs",
  fin: "Finland\xEAs",
  fi: "Finland\xEAs",
  ell: "Grego",
  el: "Grego",
  ces: "Tcheco",
  cs: "Tcheco",
  hun: "H\xFAngaro",
  hu: "H\xFAngaro",
  rum: "Romeno",
  ron: "Romeno",
  ro: "Romeno",
  ukr: "Ucraniano",
  uk: "Ucraniano"
};
function formatSubtitleLangLabel(lang) {
  const clean = (lang || "").trim().toLowerCase();
  return SUBTITLE_LANG_LABELS[clean] || (clean ? clean.toUpperCase() : "Outro");
}
function mergeAndDisambiguateSubtitles(tracks, maxItems = 30) {
  const seenIds = /* @__PURE__ */ new Set();
  const rank = (lang) => lang === "pob" ? 0 : lang === "por" ? 1 : lang === "eng" ? 2 : lang === "spa" ? 3 : 4;
  const sorted = (tracks || []).filter((sub) => {
    if (!sub?.id || !sub?.url || seenIds.has(sub.id)) return false;
    seenIds.add(sub.id);
    return true;
  }).sort((a, b) => rank(a.lang) - rank(b.lang)).slice(0, maxItems);
  const labelCounts = /* @__PURE__ */ new Map();
  let hasDefaultSub = false;
  return sorted.map((sub) => {
    const baseLabel = (sub.label || "").replace(/\s+#\d+$/, "").trim() || formatSubtitleLangLabel(sub.lang);
    const count = (labelCounts.get(baseLabel) || 0) + 1;
    labelCounts.set(baseLabel, count);
    const finalLabel = count === 1 ? baseLabel : `${baseLabel} #${count}`;
    const shouldBeDefault = !hasDefaultSub && sub.lang === "pob";
    if (shouldBeDefault) hasDefaultSub = true;
    return {
      ...sub,
      label: finalLabel,
      isDefault: shouldBeDefault
    };
  });
}
function isAllowedSubtitleHost(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:") return false;
    return /^subs\d*\.strem\.io$/i.test(parsed.hostname) || /^dl\.opensubtitles\.org$/i.test(parsed.hostname) || /^cacdn\.hakunaymatata\.com$/i.test(parsed.hostname) || /^cache\.vdrk\.site$/i.test(parsed.hostname) || /^rezesubs\.com$/i.test(parsed.hostname) || /^([a-z0-9-]+\.)?qqqcdn\.cloud$/i.test(parsed.hostname) || /^([a-z0-9-]+\.)?mysubsplay\.com$/i.test(parsed.hostname) || /^(?:www\.)?freeapi\.pro$/i.test(parsed.hostname) || /^(?:[a-z0-9-]+\.)?streambetter\.xyz$/i.test(parsed.hostname) || /^[a-z0-9-]+\.r2\.cloudflarestorage\.com$/i.test(parsed.hostname);
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
  if (/\[Script Info\]/i.test(normalized) || /^Dialogue:\s*/m.test(normalized)) {
    const assLines = normalized.split("\n");
    let formatCols = ["layer", "start", "end", "style", "name", "marginl", "marginr", "marginv", "effect", "text"];
    let inEvents = false;
    const vttOut = ["WEBVTT", ""];
    for (const rawLine of assLines) {
      const trimmed = rawLine.trim();
      if (/^\[(.+)\]$/.test(trimmed)) {
        inEvents = /^\[Events\]$/i.test(trimmed);
        continue;
      }
      if ((inEvents || /^Format:/i.test(trimmed)) && /^Format:\s*/i.test(trimmed)) {
        formatCols = trimmed.replace(/^Format:\s*/i, "").split(",").map((c) => c.trim().toLowerCase());
        continue;
      }
      if (!/^Dialogue:\s*/i.test(trimmed)) continue;
      const body = trimmed.replace(/^Dialogue:\s*/i, "");
      const textColIdx = formatCols.indexOf("text");
      const startColIdx = formatCols.indexOf("start");
      const endColIdx = formatCols.indexOf("end");
      const splitCount = textColIdx >= 0 ? textColIdx : formatCols.length - 1;
      const fields = [];
      let cursor = 0;
      for (let f = 0; f < splitCount; f++) {
        const commaIdx = body.indexOf(",", cursor);
        if (commaIdx === -1) break;
        fields.push(body.slice(cursor, commaIdx).trim());
        cursor = commaIdx + 1;
      }
      fields.push(body.slice(cursor));
      const rawStart = fields[startColIdx >= 0 ? startColIdx : 1] || "";
      const rawEnd = fields[endColIdx >= 0 ? endColIdx : 2] || "";
      const startSec = parseVttTimestampToSeconds(rawStart);
      const endSec = parseVttTimestampToSeconds(rawEnd);
      if (startSec === null || endSec === null) continue;
      const rawDialogue = (fields[splitCount] || "").replace(/\{[^}]*\}/g, "").replace(/\\N/g, "\n").replace(/\\n/g, "\n").replace(/\\h/g, " ").trim();
      if (!rawDialogue) continue;
      const sOut = formatSecondsToVttTimestamp(startSec + offsetSeconds);
      const eOut = formatSecondsToVttTimestamp(Math.max(startSec + offsetSeconds + 0.1, endSec + offsetSeconds));
      vttOut.push(`${sOut} --> ${eOut}`);
      vttOut.push(rawDialogue);
      vttOut.push("");
    }
    if (vttOut.length > 2) {
      return `${vttOut.join("\n").replace(/\n{3,}/g, "\n\n").trim()}
`;
    }
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
  if (cleanPath.endsWith(".mkv")) {
    return "video/x-matroska";
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
  if (/filename\*?=(?:UTF-8'')?["']?[^"';\s]+\.(?:mp4|mkv|webm|ogg|ogv|mov|m4v)(?:["';\s]|$)/i.test(
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
    if (/\.(?:mp4|mkv|webm|ogg|ogv|mov|m4v)$/i.test(cleanPath)) {
      return "video";
    }
  } catch {
    const clean = (params.url || "").split("#")[0].split("?")[0].toLowerCase();
    if (clean.endsWith(".m3u8")) return "hls";
    if (/\.(?:mp4|mkv|webm|ogg|ogv|mov|m4v)$/i.test(clean)) return "video";
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
    if (/\.(?:mp4|mkv|webm|ogg|ogv|mov|m4v)$/i.test(cleanPath)) {
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
    { regex: /(?:file|url|src|source)\s*:\s*["']([^"']+\.(?:m3u8|mp4|mkv|webm|mov|m4v)(?:\?[^"']*)?)["']/gi, allowOpaque: false },
    { regex: /<video[^>]+src=["']([^"']+)["']/gi, allowOpaque: false },
    { regex: /https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mp4|mkv|m4v|webm)(?:\?[^\s"'<>\\]*)?/gi, allowOpaque: false }
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
  if (results.length === 0) {
    const unpackedHls = unpackFirePlayerScript(raw, baseUrl);
    if (unpackedHls) {
      const classified = classifyPlayableMediaUrl(unpackedHls, baseUrl, true);
      if (classified) {
        pushUnique({
          ...classified,
          posterUrl
        });
      }
    }
  }
  return results;
}
function decodeDeanEdwardsPacker(p, a, c, k) {
  const encodeRadix = (n) => (n < a ? "" : encodeRadix(Math.floor(n / a))) + (n % a > 35 ? String.fromCharCode(n % a + 29) : (n % a).toString(36));
  const dict = /* @__PURE__ */ new Map();
  let remaining = c;
  while (remaining--) {
    const token = encodeRadix(remaining);
    dict.set(token, k[remaining] || token);
  }
  return p.replace(/\b\w+\b/g, (word) => dict.get(word) ?? word);
}
function unpackFirePlayerScript(html, baseUrl) {
  if (!html) return null;
  const packerRegex = /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('((?:[^'\\]|\\.)*)',\s*(\d+),\s*(\d+),\s*'((?:[^'\\]|\\.)*)'\.split\('\|'\)/g;
  for (const match of html.matchAll(packerRegex)) {
    const p = match[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
    const a = Number(match[2]);
    const c = Number(match[3]);
    const k = match[4].split("|");
    if (!Number.isFinite(a) || a < 2 || a > 62 || !Number.isFinite(c) || c <= 0 || c > 2e4) {
      continue;
    }
    const unpacked = decodeDeanEdwardsPacker(p, a, c, k).replace(/\\\//g, "/");
    const videoUrlMatch = unpacked.match(/"videoUrl"\s*:\s*"([^"]+)"/);
    if (videoUrlMatch?.[1]) {
      const rawUrl = videoUrlMatch[1].trim();
      if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
      if (baseUrl) {
        try {
          return new URL(rawUrl, baseUrl).toString();
        } catch {
          return rawUrl;
        }
      }
      return rawUrl;
    }
  }
  return null;
}
function parseNovelasCdnOrFshdHtml(html, mediaType) {
  if (!html) return { contentId: 0, inlineMovieOptions: [] };
  let contentId = 0;
  if (mediaType === "movie") {
    const infoMatch = html.match(/var\s+CONTENT_INFO\s*=\s*['"](\d+)['"]/);
    if (infoMatch?.[1]) contentId = Number(infoMatch[1]) || 0;
  } else {
    const activeEpMatch = html.match(/class="episodeOption[^"]*\bactive\b[^"]*"[^>]*data-contentid="(\d+)"/i) || html.match(/data-contentid="(\d+)"[^>]*class="episodeOption[^"]*\bactive\b/i) || html.match(/class="episodeOption[^"]*"[^>]*data-contentid="(\d+)"/i);
    if (activeEpMatch?.[1]) contentId = Number(activeEpMatch[1]) || 0;
  }
  const inlineMovieOptions = [];
  if (mediaType === "movie") {
    const seen = /* @__PURE__ */ new Set();
    for (const m of html.matchAll(/data-id="(\d+)"[^>]*data-lang="(\d+)"|data-lang="(\d+)"[^>]*data-id="(\d+)"/gi)) {
      const id = Number(m[1] || m[4] || 0);
      const langType = Number(m[2] || m[3] || 1);
      if (id > 0 && !seen.has(id)) {
        seen.add(id);
        inlineMovieOptions.push({ id, type: langType });
      }
    }
  }
  return { contentId, inlineMovieOptions };
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
function isAggregatorOrWrapperHtml(html) {
  const sample = (html || "").slice(0, 8e4);
  return /disable-devtool|\b(?:go|loadPlayer|setEmbed|changeServer)\(\s*["']https?:\/\/|<iframe\b/i.test(
    sample
  ) || /Investidor\.blog|Player\s+n[ãa]o\s+dispon[íi]vel|Conte[úu]do\s+n[ãa]o\s+encontrado/i.test(
    sample
  );
}
function selectVidLinkCandidates(streamData) {
  if (!streamData || typeof streamData !== "object") return [];
  const candidates = [];
  const qualities = streamData.qualities;
  if (qualities && typeof qualities === "object" && !Array.isArray(qualities)) {
    for (const [resKey, rawEntry] of Object.entries(qualities)) {
      if (!rawEntry || typeof rawEntry !== "object") continue;
      const entry = rawEntry;
      const url = typeof entry.url === "string" ? entry.url.trim() : "";
      if (!/^https?:\/\//i.test(url)) continue;
      const codecName = typeof entry.codecName === "string" ? entry.codecName.trim().toLowerCase() : "";
      const resNum = Number.parseInt(resKey.replace(/\D+/g, ""), 10) || 0;
      const codecScore = /(?:h264|avc)/i.test(codecName) ? 0 : /(?:hevc|h265|vp9|av1)/i.test(codecName) ? 2 : 1;
      candidates.push({ url, codecScore, resolution: resNum });
    }
  } else if (Array.isArray(qualities)) {
    for (const rawEntry of qualities) {
      if (!rawEntry || typeof rawEntry !== "object") continue;
      const entry = rawEntry;
      const url = typeof entry.url === "string" ? entry.url.trim() : "";
      if (!/^https?:\/\//i.test(url)) continue;
      const codecName = typeof entry.codecName === "string" ? entry.codecName.trim().toLowerCase() : "";
      const resRaw = typeof entry.quality === "string" || typeof entry.quality === "number" ? String(entry.quality) : "";
      const resNum = Number.parseInt(resRaw.replace(/\D+/g, ""), 10) || 0;
      const codecScore = /(?:h264|avc)/i.test(codecName) ? 0 : /(?:hevc|h265|vp9|av1)/i.test(codecName) ? 2 : 1;
      candidates.push({ url, codecScore, resolution: resNum });
    }
  }
  candidates.sort((a, b) => {
    if (a.codecScore !== b.codecScore) return a.codecScore - b.codecScore;
    return b.resolution - a.resolution;
  });
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const pushUnique = (item) => {
    if (!item.url || seen.has(item.url)) return;
    seen.add(item.url);
    out.push(item);
  };
  for (const c of candidates.filter((x) => x.codecScore === 0)) {
    pushUnique({
      url: c.url,
      streamKind: "video",
      sendUserAgent: !/bcdn\.hakunaymatata\.com/i.test(c.url),
      codecScore: c.codecScore,
      resolution: c.resolution
    });
  }
  const playlistUrl = typeof streamData.playlist === "string" ? streamData.playlist.trim() : "";
  if (/^https?:\/\//i.test(playlistUrl)) {
    pushUnique({
      url: playlistUrl,
      streamKind: "hls",
      sendUserAgent: !/bcdn\.hakunaymatata\.com/i.test(playlistUrl),
      codecScore: 1,
      resolution: 1080
    });
  }
  for (const c of candidates.filter((x) => x.codecScore !== 0)) {
    pushUnique({
      url: c.url,
      streamKind: "video",
      sendUserAgent: !/bcdn\.hakunaymatata\.com/i.test(c.url),
      codecScore: c.codecScore,
      resolution: c.resolution
    });
  }
  return out;
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

// shared/openMediaMatchers.ts
var SHORT_OR_PROMO_RE = /\b(?:chamada|teaser|trailer|promo|resumo|melhores\s+momentos|trecho|cena|corte|clipe|videoclipe|music\s+video|abertura|encerramento|opening|ending|par[oó]dia|ytpbr|ytp|react|review|an[aá]lise|bastidores|making\s+of|entrevista|preview|mix|remix)\b/i;
var TITLE_STOPWORDS = /* @__PURE__ */ new Set([
  "o",
  "a",
  "os",
  "as",
  "um",
  "uma",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "na",
  "no",
  "nas",
  "nos",
  "the",
  "and",
  "of",
  "in",
  "to",
  "la",
  "el",
  "los",
  "las",
  "y"
]);
function normalizeMediaSearchText(input) {
  return (input || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function extractMediaTitleTokens(input) {
  const norm = normalizeMediaSearchText(input);
  if (!norm) return [];
  const all = norm.split(/\s+/).filter(Boolean);
  const meaningful = all.filter((w) => w.length > 1 && !TITLE_STOPWORDS.has(w));
  return meaningful.length > 0 ? meaningful : all;
}
function stripDatesFromEpisodeTitle(input) {
  return (input || "").replace(/\(\s*\d{1,2}\s*[/._-]\s*\d{1,2}\s*[/._-]\s*\d{2,4}\s*\)/g, " ").replace(/\b\d{1,2}\s*[/._-]\s*\d{1,2}\s*[/._-]\s*\d{2,4}\b/g, " ").replace(/\b(?:19|20)\d{2}\s*[-/]\s*\d{1,2}\s*[-/]\s*\d{1,2}\b/g, " ");
}
function toJoinedString(val) {
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return val.map((v) => String(v ?? "")).join(" ");
  return "";
}
function hasStrongTitleMatch(candidateText, titleVariants) {
  const normCandidate = normalizeMediaSearchText(candidateText);
  if (!normCandidate) return { matched: false, score: 0 };
  const candidateTokens = new Set(normCandidate.split(/\s+/).filter(Boolean));
  let bestScore = 0;
  for (const rawTitle of titleVariants) {
    const normTitle = normalizeMediaSearchText(rawTitle);
    if (!normTitle || normTitle.length < 2) continue;
    if (normCandidate === normTitle || normCandidate.startsWith(`${normTitle} `) || normCandidate.includes(` ${normTitle} `) || normCandidate.endsWith(` ${normTitle}`)) {
      bestScore = Math.max(bestScore, 1);
      continue;
    }
    const compactCandidate = normCandidate.replace(/\s+/g, "");
    const compactTitle = normTitle.replace(/\s+/g, "");
    if (compactTitle.length >= 6 && compactCandidate.includes(compactTitle)) {
      bestScore = Math.max(bestScore, 0.95);
      continue;
    }
    const tokens = extractMediaTitleTokens(rawTitle);
    if (tokens.length === 0) continue;
    let hits = 0;
    for (const t of tokens) {
      if (candidateTokens.has(t)) hits += 1;
    }
    const ratio = hits / tokens.length;
    if (tokens.length <= 2 && hits === tokens.length || tokens.length >= 3 && ratio >= 0.8) {
      bestScore = Math.max(bestScore, ratio * 0.9);
    }
  }
  return { matched: bestScore >= 0.72, score: bestScore };
}
function hasConflictingYear(textWithoutDates, targetYear, titleVariants, mediaType = "movie") {
  if (!targetYear || !/^\d{4}$/.test(targetYear)) return false;
  const targetNum = Number(targetYear);
  const titleMentionsYear = titleVariants.some((t) => t.includes(targetYear));
  const yearsInCandidate = Array.from(
    textWithoutDates.matchAll(/\b((?:19|20)\d{2})\b/g)
  ).map((m) => Number(m[1]));
  if (yearsInCandidate.length === 0) return false;
  if (yearsInCandidate.includes(targetNum)) return false;
  for (const y of yearsInCandidate) {
    if (titleMentionsYear && y === targetNum) continue;
    if (mediaType === "tv") {
      if (y < targetNum - 1 || y > targetNum + 20) {
        return true;
      }
    } else if (Math.abs(y - targetNum) >= 2) {
      return true;
    }
  }
  return false;
}
function detectArchiveDocLanguage(doc) {
  const combined = [
    toJoinedString(doc.language),
    doc.identifier || "",
    toJoinedString(doc.title),
    toJoinedString(doc.description),
    toJoinedString(doc.subject)
  ].join(" ").toLowerCase();
  if (/\b(?:portuguese|portugu[eê]s|pt-?br|dublad[oa]|paixaoflix|sbt|globo|novela|temporada)\b/i.test(
    combined
  ) || /eu[,\s_-]*a[\s_-]*patroa|todo[\s_-]*mundo[\s_-]*odeia|\be\.?p\.?c\b|\bchaves\b|\bchapolin\b|\bchiquititas\b/i.test(
    combined
  )) {
    return { langCode: "pt-br", languageLabel: "Dublado (PT-BR)" };
  }
  if (/\b(?:spanish|espa[nñ]ol|latino|castellano)\b/i.test(combined)) {
    return { langCode: "es-es", languageLabel: "Espanhol" };
  }
  if (/\b(?:english|ingl[eê]s|complete\s+series)\b/i.test(combined)) {
    return { langCode: "en-us", languageLabel: "Ingl\xEAs / Original" };
  }
  return { langCode: "auto", languageLabel: "Ingl\xEAs / Original" };
}
function scoreArchiveSearchDoc(doc, params) {
  const idStr = (doc.identifier || "").trim();
  if (!idStr) return -1;
  const titleStr = toJoinedString(doc.title);
  const descStr = toJoinedString(doc.description);
  const subjStr = toJoinedString(doc.subject);
  const combinedText = `${titleStr} ${descStr} ${subjStr} ${idStr}`;
  if (SHORT_OR_PROMO_RE.test(titleStr) || /\b(?:animated|animado)\b/i.test(titleStr)) {
    const wantedAnimated = params.titles.some((t) => /\b(?:animated|animado)\b/i.test(t));
    if (!wantedAnimated) return -1;
  }
  const titleMatch = hasStrongTitleMatch(`${titleStr} ${idStr.replace(/[_.-]+/g, " ")}`, params.titles);
  const descMatch = hasStrongTitleMatch(descStr, params.titles);
  if (!titleMatch.matched && !descMatch.matched) return -1;
  if (params.mediaType === "tv" && params.season && params.season > 0) {
    const cleanTitleAndId = `${titleStr} ${idStr.replace(/[_.-]+/g, " ")}`;
    const explicitSeasonMatch = cleanTitleAndId.match(
      /\b(?:season|temporada|temp\.?)\s*0*(\d{1,2})\b|\b0*(\d{1,2})\s*[ªa°]?\s*(?:temporada|temp)\b|\bs\s*0*(\d{1,2})(?:\s*e\s*\d{1,3}|\b)/i
    );
    const hasCompleteMulti = /\b(?:complete\s+series|completo|todas\s+as\s+temporadas)\b/i.test(cleanTitleAndId) && !/\bs\s*0*\d{1,2}\s*e\s*\d{1,3}\b/i.test(cleanTitleAndId);
    if (explicitSeasonMatch && !hasCompleteMulti) {
      const docSeason = Number(
        explicitSeasonMatch[1] || explicitSeasonMatch[2] || explicitSeasonMatch[3]
      );
      if (docSeason > 0 && docSeason !== params.season) {
        return -1;
      }
    }
  }
  if (hasConflictingYear(
    stripDatesFromEpisodeTitle(titleStr),
    params.releaseYear,
    params.titles,
    params.mediaType
  )) {
    return -1;
  }
  let score = titleMatch.matched ? 100 * titleMatch.score : 65 * descMatch.score;
  const lang = detectArchiveDocLanguage(doc);
  if (params.preferPortuguese !== false && lang.langCode === "pt-br") {
    score += 45;
  }
  if (/paixaoflix/i.test(idStr)) {
    score += 35;
  }
  if (params.mediaType === "tv" && params.season) {
    const seasonRe = new RegExp(
      `(?:temporada\\s*0*${params.season}|0*${params.season}[\xAAa\xB0]?\\s*temporada|season\\s*0*${params.season}|s0*${params.season}\\b|temp\\.?\\s*0*${params.season})`,
      "i"
    );
    if (seasonRe.test(`${titleStr} ${idStr}`)) {
      score += 30;
    }
  }
  if (typeof doc.downloads === "number" && doc.downloads > 0) {
    score += Math.min(20, Math.log10(doc.downloads + 1) * 5);
  }
  return score;
}
function parseArchiveDurationSeconds(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return 0;
  const trimmed = raw.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}
function extractEpisodeInfoFromFilename(filename) {
  const clean = stripDatesFromEpisodeTitle(filename).replace(/_/g, " ");
  const seMatch = clean.match(
    /(?:^|[^a-z0-9])[st]\s*[-._]?\s*(\d{1,2})\s*[-._\s]*e(?:p|pis[oó]dio)?\s*[-._]?\s*(\d{1,3})(?:[^0-9]|$)/i
  );
  if (seMatch) {
    return { season: Number(seMatch[1]), episode: Number(seMatch[2]) };
  }
  const xMatch = clean.match(/(?:^|[^0-9])(\d{1,2})\s*x\s*(\d{1,3})(?:[^0-9]|$)/i);
  if (xMatch) {
    return { season: Number(xMatch[1]), episode: Number(xMatch[2]) };
  }
  const epOnlyMatch = clean.match(
    /\b(?:ep(?:is[oó]dio|isode)?|cap(?:[ií]tulo)?)\s*[-._#:]?\s*(\d{1,3})(?:[^0-9]|$)/i
  );
  if (epOnlyMatch) {
    return { season: null, episode: Number(epOnlyMatch[1]) };
  }
  const leadingNum = clean.match(/^(?:\s*)(\d{1,3})\s*[-._\s]/);
  if (leadingNum) {
    return { season: null, episode: Number(leadingNum[1]) };
  }
  return { season: null, episode: null };
}
function matchArchiveEpisodeFile(files, params) {
  if (!Array.isArray(files) || files.length === 0) return null;
  const minSize = params.mediaType === "movie" ? 12e7 : 25e6;
  const minDuration = params.mediaType === "movie" ? 2400 : 360;
  const mp4Candidates = files.filter((f) => {
    const name = (f.name || "").trim();
    if (!name || !/\.(?:mp4|mkv|m4v|webm|mov|ogv)$/i.test(name)) return false;
    if (SHORT_OR_PROMO_RE.test(name)) return false;
    const size = Number(f.size || 0);
    const lengthSec = parseArchiveDurationSeconds(f.length);
    if (size > 0 && size < minSize && lengthSec > 0 && lengthSec < minDuration) return false;
    if (size > 0 && size < minSize && lengthSec === 0) return false;
    if (size === 0 && lengthSec > 0 && lengthSec < minDuration) return false;
    return true;
  });
  if (mp4Candidates.length === 0) return null;
  if (params.mediaType === "movie") {
    const scored = mp4Candidates.map((f) => {
      const name = f.name || "";
      const isIa = /\.ia\.mp4$/i.test(name) || /h\.264\s*ia/i.test(f.format || "");
      const isOrig = f.source === "original";
      const isMpeg4 = /mpeg4|h\.264/i.test(f.format || "") || /\.(?:mp4|m4v|webm)$/i.test(name);
      const isMkv = /\.mkv$/i.test(name);
      const size = Number(f.size || 0);
      let score = 0;
      if (isMpeg4) score += 50;
      if (isMkv) score -= 15;
      if (isOrig) score += 30;
      if (!isIa) score += 20;
      score += Math.min(20, size / 2e8);
      return { f, score };
    }).sort((a, b) => b.score - a.score);
    return scored[0]?.f || null;
  }
  const targetSeason = params.season ?? 1;
  const targetEpisode = params.episode ?? 1;
  const docContext = `${params.docTitle || ""} ${(params.docIdentifier || "").replace(/[_.-]+/g, " ")}`;
  const hasCompleteMulti = /\b(?:complete\s+series|completo|todas\s+as\s+temporadas)\b/i.test(docContext) && !/\bs\s*0*\d{1,2}\s*e\s*\d{1,3}\b/i.test(docContext);
  const docSeasonMatch = hasCompleteMulti ? null : docContext.match(
    /\b(?:season|temporada|temp\.?)\s*0*(\d{1,2})\b|\b0*(\d{1,2})\s*[ªa°]?\s*(?:temporada|temp)\b|\bs\s*0*(\d{1,2})(?:\s*e\s*\d{1,3}|\b)/i
  );
  const docExplicitSeason = docSeasonMatch ? Number(docSeasonMatch[1] || docSeasonMatch[2] || docSeasonMatch[3]) : null;
  const matched = mp4Candidates.map((f) => {
    const name = f.name || "";
    const info = extractEpisodeInfoFromFilename(name);
    if (info.episode !== targetEpisode) return null;
    if (info.season !== null) {
      if (info.season !== targetSeason) return null;
    } else if (docExplicitSeason !== null) {
      if (docExplicitSeason !== targetSeason) return null;
    } else if (targetSeason !== 1) {
      return null;
    }
    const isIa = /\.ia\.mp4$/i.test(name) || /h\.264\s*ia/i.test(f.format || "");
    const isOrig = f.source === "original";
    const is720Or1080 = /(?:720p|1080p)/i.test(name);
    let score = 100;
    if (info.season === targetSeason) score += 40;
    if (isOrig) score += 25;
    if (!isIa) score += 20;
    if (is720Or1080) score += 10;
    return { f, score };
  }).filter((item) => item !== null).sort((a, b) => b.score - a.score);
  return matched[0]?.f || null;
}
function extractChapterOrEpisodeFromTitle(videoTitle, expectedSeason = 1) {
  const cleaned = stripDatesFromEpisodeTitle(videoTitle || "");
  const seMatch = cleaned.match(
    /(?:^|[^a-z0-9])[st]\s*0*(\d{1,2})\s*[-._\s]*e(?:p|pis[oó]dio)?\s*0*(\d{1,4})(?:[^0-9]|$)/i
  );
  if (seMatch) {
    return Number(seMatch[1]) === expectedSeason ? Number(seMatch[2]) : null;
  }
  const tempEpMatch = cleaned.match(
    /\btemporada\s*0*(\d{1,2})\b[\s\-:|]*\b(?:ep(?:is[oó]dio)?|cap(?:[ií]tulo)?)\s*0*(\d{1,4})\b/i
  );
  if (tempEpMatch) {
    return Number(tempEpMatch[1]) === expectedSeason ? Number(tempEpMatch[2]) : null;
  }
  const capOrEp = cleaned.match(
    /\b(?:cap[ií]tulo|capitulo|cap\.?|epis[oó]dio|episodio|ep\.?|episode)\s*[-.:#]?\s*0*(\d{1,4})\b/i
  );
  if (capOrEp) {
    return expectedSeason === 1 ? Number(capOrEp[1]) : null;
  }
  return null;
}
function selectBestDailymotionVideos(videos, params) {
  if (!Array.isArray(videos) || videos.length === 0) return [];
  const minDuration = params.mediaType === "movie" ? 3300 : 720;
  const targetSeason = params.season ?? 1;
  const targetEpisode = params.episode ?? 1;
  const scored = [];
  for (const v of videos) {
    const id = (v.id || "").trim();
    const title = (v.title || "").trim();
    const duration = typeof v.duration === "number" ? v.duration : 0;
    if (!id || !title || duration < minDuration) continue;
    if (SHORT_OR_PROMO_RE.test(title)) continue;
    const wantedAnimated = params.titles.some((t) => /\b(?:animado|animated)\b/i.test(t));
    if (!wantedAnimated && /\b(?:animado|animated)\b/i.test(title)) continue;
    const cleanedForDate = stripDatesFromEpisodeTitle(title);
    const titleMatch = hasStrongTitleMatch(cleanedForDate, params.titles);
    if (!titleMatch.matched) continue;
    let parsedEp = null;
    if (params.mediaType === "tv") {
      parsedEp = extractChapterOrEpisodeFromTitle(title, targetSeason);
      if (parsedEp !== targetEpisode) continue;
    } else {
      if (!/\b(?:completo|full\s+movie|dublado|pel[ií]cula\s+completa)\b/i.test(title) && duration < 4200) {
        continue;
      }
    }
    const isPtChapterUpload = params.mediaType === "tv" && parsedEp === targetEpisode && duration >= 1500 && titleMatch.score >= 0.95 && (/\b(?:cap[ií]tulo|capitulo|cap\.?|sbt|novela|completo|dublado)\b/i.test(title) || v.language === "pt");
    const yearConflicts = hasConflictingYear(
      cleanedForDate,
      params.releaseYear,
      params.titles,
      params.mediaType
    );
    if (yearConflicts && !isPtChapterUpload) {
      continue;
    }
    let langCode = "pt-br";
    if (/\b(?:cap[ií]tulo|capitulo|epis[oó]dio|temporada|dublado|completo|sbt|globo|novela|portugu[eê]s)\b/i.test(
      title
    ) || v.language === "pt") {
      langCode = "pt-br";
    } else if (/\b(?:espa[nñ]ol|latino|castellano|subtitulado|pel[ií]cula)\b/i.test(title)) {
      langCode = "es-es";
    } else {
      langCode = "en-us";
    }
    let score = titleMatch.score * 100;
    if (langCode === "pt-br") score += 40;
    if (/\bcompleto\b/i.test(title)) score += 20;
    if (params.releaseYear && title.includes(params.releaseYear)) score += 25;
    if (yearConflicts) score -= 20;
    if (duration >= 1800) score += 10;
    scored.push({
      ...v,
      id,
      langCode,
      score
    });
  }
  return scored.sort((a, b) => b.score - a.score);
}
function resolveFreeApiUrl(rawPathOrUrl) {
  const raw = (rawPathOrUrl || "").trim();
  if (!raw) return null;
  try {
    const resolved = new URL(raw, "https://freeapi.pro/");
    if (resolved.protocol !== "https:" && resolved.protocol !== "http:") return null;
    return resolved.toString();
  } catch {
    return null;
  }
}
function selectBestFreeApiMovieMatch(results, criteria) {
  if (!Array.isArray(results) || results.length === 0) return null;
  const targetImdb = (criteria.imdbId || "").trim().toLowerCase();
  const targetYear = Number(String(criteria.releaseYear || "").slice(0, 4)) || 0;
  const targetTitles = (criteria.titles || []).map((t) => normalizeMediaSearchText(t || "")).filter(Boolean);
  let best = null;
  for (const item of results) {
    const rawId = (item?.id || "").trim().toLowerCase();
    if (!/^tt\d{5,12}$/.test(rawId)) continue;
    const rawType = (item.type || "").trim().toLowerCase();
    const isTvType = /(?:tv series|mini series|tv mini series|tv special)/i.test(rawType);
    const isShortType = rawType === "short";
    const normalizedMediaType = isTvType ? "tv" : "movie";
    if (targetImdb && rawId === targetImdb) {
      return { ...item, imdbId: rawId, normalizedMediaType };
    }
    if (criteria.mediaType === "tv" && !isTvType) continue;
    if (criteria.mediaType === "movie" && isTvType) continue;
    const candNorm = normalizeMediaSearchText(item.title || "");
    if (!candNorm && targetTitles.length > 0) continue;
    let score = 0;
    if (targetTitles.length > 0) {
      let bestTitleScore = 0;
      for (const tn of targetTitles) {
        if (candNorm === tn) {
          bestTitleScore = Math.max(bestTitleScore, 100);
        } else if (candNorm.includes(tn) || tn.includes(candNorm)) {
          const overlapRatio = Math.min(candNorm.length, tn.length) / Math.max(candNorm.length, tn.length, 1);
          bestTitleScore = Math.max(bestTitleScore, 60 + Math.round(overlapRatio * 30));
        } else {
          const tnTokens = extractMediaTitleTokens(tn);
          const candTokens = new Set(extractMediaTitleTokens(candNorm));
          if (tnTokens.length > 0) {
            const matchedCount = tnTokens.filter((tok) => candTokens.has(tok)).length;
            if (matchedCount === tnTokens.length) {
              bestTitleScore = Math.max(bestTitleScore, 75);
            } else if (matchedCount / tnTokens.length >= 0.75) {
              bestTitleScore = Math.max(bestTitleScore, 55);
            }
          }
        }
      }
      if (bestTitleScore === 0) continue;
      score += bestTitleScore;
    }
    const candYear = Number(item.year) || 0;
    if (targetYear > 0 && candYear > 0) {
      const diff = Math.abs(targetYear - candYear);
      if (diff === 0) score += 40;
      else if (diff === 1) score += 20;
      else if (diff > 2) {
        if (score < 100) continue;
        score -= 45;
      }
    }
    if (isShortType) score -= 30;
    if (typeof item.rank === "number" && item.rank > 0) {
      score += Math.max(0, 20 - Math.floor(Math.log10(item.rank) * 3));
    }
    if (!best || score > best.score) {
      best = { item, imdbId: rawId, normalizedMediaType, score };
    }
  }
  if (!best || best.score < 55) return null;
  return {
    ...best.item,
    imdbId: best.imdbId,
    normalizedMediaType: best.normalizedMediaType
  };
}
function selectBestFreeApiAnimeMatch(results, criteria) {
  if (!Array.isArray(results) || results.length === 0) return null;
  const targetYear = Number(String(criteria.releaseYear || "").slice(0, 4)) || 0;
  const targetTitles = (criteria.titles || []).map((t) => normalizeMediaSearchText(t || "")).filter(Boolean);
  let best = null;
  for (const item of results) {
    if (!item?.id || typeof item.id !== "number") continue;
    const fmt = (item.format || "").trim().toUpperCase();
    const isMovieFmt = fmt === "MOVIE";
    if (criteria.mediaType === "movie" && fmt && !isMovieFmt && fmt !== "OVA" && fmt !== "SPECIAL") {
      continue;
    }
    if (criteria.mediaType === "tv" && isMovieFmt) {
      continue;
    }
    const candTitles = [item.title, item.romaji].map((t) => normalizeMediaSearchText(t || "")).filter(Boolean);
    if (candTitles.length === 0) continue;
    let titleScore = 0;
    for (const tn of targetTitles) {
      for (const cn of candTitles) {
        if (cn === tn) {
          titleScore = Math.max(titleScore, 100);
        } else if (cn.includes(tn) || tn.includes(cn)) {
          const ratio = Math.min(cn.length, tn.length) / Math.max(cn.length, tn.length, 1);
          titleScore = Math.max(titleScore, 60 + Math.round(ratio * 30));
        }
      }
    }
    if (targetTitles.length > 0 && titleScore === 0) continue;
    let score = titleScore;
    const candYear = Number(item.year) || 0;
    if (targetYear > 0 && candYear > 0) {
      const diff = Math.abs(targetYear - candYear);
      if (diff === 0) score += 35;
      else if (diff === 1) score += 15;
      else if (diff > 2) score -= 35;
    }
    if (typeof item.score === "number") {
      score += Math.round(item.score / 10);
    }
    if (!best || score > best.score) {
      best = { item, score };
    }
  }
  return best && best.score >= 55 ? best.item : null;
}

// server/services/FreeApiProService.ts
var FREEAPI_BASE = "https://freeapi.pro";
var FREEAPI_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var FreeApiProServiceImpl = class {
  constructor() {
    this.msearchCache = /* @__PURE__ */ new Map();
    this.animeSearchCache = /* @__PURE__ */ new Map();
  }
  setBoundedCache(map, key, value, ttlMs) {
    if (map.size > 300) {
      const oldest = map.keys().next().value;
      if (oldest) map.delete(oldest);
    }
    map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
  async searchMoviesAndSeries(query, signal) {
    const cleanQuery = (query || "").trim();
    if (!cleanQuery) return [];
    const cacheKey = cleanQuery.toLowerCase();
    const cached = this.msearchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const url = `${FREEAPI_BASE}/api/msearch?q=${encodeURIComponent(cleanQuery)}`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": FREEAPI_UA,
          Accept: "application/json"
        }
      });
      if (!res.ok) {
        if (res.status === 404) {
          this.setBoundedCache(this.msearchCache, cacheKey, [], 5 * 6e4);
        }
        return [];
      }
      const data = await res.json().catch(() => null);
      const results = Array.isArray(data?.results) ? data.results : [];
      this.setBoundedCache(this.msearchCache, cacheKey, results, 10 * 6e4);
      return results;
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
  async lookupBestMatch(params) {
    const queries = Array.from(
      new Set(
        [params.title, params.originalTitle, params.ptTitle].map((t) => (t || "").trim()).filter(Boolean)
      )
    );
    if (queries.length === 0) return null;
    const allTitles = [params.title, params.originalTitle, params.ptTitle];
    for (const q of queries.slice(0, 2)) {
      const results = await this.searchMoviesAndSeries(q, params.signal);
      if (results.length === 0) continue;
      const picked = selectBestFreeApiMovieMatch(results, {
        imdbId: params.imdbId,
        titles: allTitles,
        releaseYear: params.releaseYear,
        mediaType: params.mediaType
      });
      if (picked) {
        return {
          imdbId: picked.imdbId,
          title: (picked.title || q).trim(),
          type: (picked.type || (picked.normalizedMediaType === "tv" ? "TV Series" : "Movie")).trim(),
          normalizedMediaType: picked.normalizedMediaType,
          year: Number(picked.year) || null,
          poster: picked.poster && /^https?:\/\//i.test(picked.poster) ? picked.poster : null,
          watchUrl: picked.watchUrl && /^https?:\/\//i.test(picked.watchUrl) ? picked.watchUrl : null,
          imdbUrl: picked.imdbUrl && /^https?:\/\//i.test(picked.imdbUrl) ? picked.imdbUrl : null
        };
      }
    }
    return null;
  }
  async searchAnime(query, signal) {
    const cleanQuery = (query || "").trim();
    if (!cleanQuery) return [];
    const cacheKey = cleanQuery.toLowerCase();
    const cached = this.animeSearchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const url = `${FREEAPI_BASE}/api/anime?action=search&q=${encodeURIComponent(cleanQuery)}`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": FREEAPI_UA,
          Accept: "application/json"
        }
      });
      if (!res.ok) return [];
      const data = await res.json().catch(() => null);
      const results = Array.isArray(data?.results) ? data.results : [];
      this.setBoundedCache(this.animeSearchCache, cacheKey, results, 10 * 6e4);
      return results;
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
  async resolveBestAnimeId(params) {
    const queries = Array.from(
      new Set(
        [params.title, params.originalTitle, params.ptTitle].map((t) => (t || "").trim()).filter(Boolean)
      )
    );
    if (queries.length === 0) return null;
    const allTitles = [params.title, params.originalTitle, params.ptTitle];
    for (const q of queries.slice(0, 2)) {
      const list = await this.searchAnime(q, params.signal);
      const picked = selectBestFreeApiAnimeMatch(list, {
        titles: allTitles,
        releaseYear: params.releaseYear,
        mediaType: params.mediaType
      });
      if (picked?.id) return picked.id;
    }
    return null;
  }
  async fetchAnimeStream(params) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5e3);
    const onAbort = () => controller.abort();
    params.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const url = `${FREEAPI_BASE}/api/anime?action=stream&id=${encodeURIComponent(String(params.anilistId))}&ep=${encodeURIComponent(String(params.episode))}&a=${params.voiceType}&server=${params.server}`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": FREEAPI_UA,
          Accept: "application/json"
        }
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      if (!data?.ok || !data?.src) return null;
      const m3u8Url = resolveFreeApiUrl(data.src);
      if (!m3u8Url) return null;
      const tracks = [];
      if (Array.isArray(data.tracks)) {
        for (const tr of data.tracks) {
          if (tr?.kind === "thumbnails" || !tr?.file || !tr?.label) continue;
          const resolvedTrack = resolveFreeApiUrl(tr.file);
          if (resolvedTrack) {
            tracks.push({ url: resolvedTrack, lang: tr.label.trim() });
          }
        }
      }
      return {
        m3u8Url,
        server: params.server,
        voiceType: params.voiceType,
        tracks
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener("abort", onAbort);
    }
  }
};
var FreeApiProService = new FreeApiProServiceImpl();

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
import { gunzipSync } from "node:zlib";
import { Readable } from "node:stream";

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
    ...payload.ua ? { ua: payload.ua } : {},
    sr: payload.sr,
    ...payload.sua === false ? { sua: false } : {},
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

// shared/directChannelUtils.ts
var DIRECT_IPTV_PLAYLIST_URLS = {
  brazil: "https://iptv-org.github.io/iptv/countries/br.m3u",
  plutoBrazil: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/plutotv_br.m3u",
  portuguese: "https://iptv-org.github.io/iptv/languages/por.m3u",
  freeTvBrazil: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_brazil.m3u8",
  freeTvPortugal: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_portugal.m3u8",
  freeTvLatin: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_latin_america.m3u8",
  freeTvAnimation: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_animation.m3u8",
  freeTvMovies: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_movies.m3u8",
  freeTvSports: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_sports.m3u8",
  categoryMovies: "https://iptv-org.github.io/iptv/categories/movies.m3u",
  categorySeries: "https://iptv-org.github.io/iptv/categories/series.m3u",
  categoryAnimation: "https://iptv-org.github.io/iptv/categories/animation.m3u",
  categorySports: "https://iptv-org.github.io/iptv/categories/sports.m3u",
  categoryKids: "https://iptv-org.github.io/iptv/categories/kids.m3u"
};
function stripDiacritics(input) {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function cleanDirectChannelDisplayName(rawName) {
  let cleaned = String(rawName || "").trim();
  cleaned = cleaned.replace(/\[[^\]]*\]/g, " ");
  cleaned = cleaned.replace(/\(\s*(?:1080p|720p|576p|480p|360p|240p|4k|uhd|hd|sd|fhd|brazil|brasil|portugal|pt-br|portuguese)\s*\)/gi, " ");
  cleaned = cleaned.replace(/\b(?:Latin\s+America\s+Brazil|Latin\s+America)\b/gi, " ");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned || String(rawName || "").trim();
}
function normalizeChannelMatchKey(name) {
  const cleaned = cleanDirectChannelDisplayName(name);
  const ascii = stripDiacritics(cleaned).toLowerCase();
  const strippedNoise = ascii.replace(/\b(?:brasil|brazil|portugal|latin america|latam|fhd|uhd|hd|sd|4k|1080p|720p|480p|360p)\b/g, " ").replace(/[^a-z0-9]+/g, "");
  return strippedNoise || ascii.replace(/[^a-z0-9]+/g, "");
}
function buildChannelMatchKeys(name) {
  const primary = normalizeChannelMatchKey(name);
  const keys = [];
  if (primary) keys.push(primary);
  const withoutTv = primary.replace(/^tv/, "").replace(/tv$/, "");
  if (withoutTv && withoutTv.length >= 3 && !keys.includes(withoutTv)) {
    keys.push(withoutTv);
  }
  return keys;
}
function mapIptvGroupToChannelCategory(groupTitle, name) {
  const text = stripDiacritics(`${groupTitle || ""} ${name || ""}`).toLowerCase();
  if (/\b(sport|sports|esporte|esportes|futebol|nba|nfl|ufc|combat|combate|premiere|sportv|espn|bandsports)\b/.test(text)) {
    return "Esportes";
  }
  if (/\b(news|noticias|noticia|jornal|cnn|bandnews|globonews|record news|bloomberg|jovem pan)\b/.test(text)) {
    return "Not\xEDcias";
  }
  if (/\b(kids|children|animation|animacao|anime|infantil|desenho|cartoon|gloob|discovery kids|nick|disney)\b/.test(text)) {
    return "Infantil";
  }
  if (/\b(movie|movies|cinema|filme|filmes|telecine|hbo|megapix|cine|axn|amc|tnt|space|warner|paramount|adrenalina)\b/.test(text)) {
    return "Filmes";
  }
  if (/\b(series|novela|novelas|comedy|music|musica|culture|cultura|arte|multishow|gnt|viva)\b/.test(text)) {
    return "Entretenimento";
  }
  return "Variedades";
}
function isDirectM3uChannelBlocked(rawName, groupTitle, streamUrl, includeAdult = false) {
  const url = String(streamUrl || "").trim();
  if (!/^https?:\/\//i.test(url)) return true;
  if (/(?:youtube\.com|youtu\.be|twitch\.tv|dailymotion\.com|vimeo\.com|streambetter\.|reidoscanais\.)/i.test(
    url
  )) {
    return true;
  }
  if (/\[(?:geo-blocked|offline|broken)\]/i.test(rawName)) {
    return true;
  }
  if (!includeAdult) {
    const haystack = `${rawName} ${groupTitle}`;
    if (/\b(?:adult|adulto|xxx|18\+|\+18|erotic|erotico|sexy\s*hot|playboy|hustler|private|sextreme|venus|brasileirinhas)\b/i.test(
      haystack
    )) {
      return true;
    }
  }
  return false;
}
function scoreStreamCandidate(rawName, url) {
  const isHttps = url.toLowerCase().startsWith("https://");
  let qualityScore = isHttps ? 100 : 20;
  if (/1080p|fhd/i.test(rawName)) qualityScore += 30;
  else if (/720p|\bhd\b/i.test(rawName)) qualityScore += 20;
  else if (/480p|\bsd\b/i.test(rawName)) qualityScore += 10;
  if (/\.m3u8(?:$|\?)/i.test(url)) qualityScore += 25;
  if (/jmp2\.uk\/plu-|pluto\.tv|samsung|akamaized|cloudfront/i.test(url)) qualityScore += 15;
  if (/\[not 24\/7\]/i.test(rawName)) qualityScore -= 15;
  return { url, qualityScore, isHttps };
}
function extractExtinfAttr(extinfLine, attr) {
  const re = new RegExp(`${attr}=["']([^"']*)["']`, "i");
  const match = extinfLine.match(re);
  return match ? match[1].trim() : "";
}
function parseDirectChannelM3u(playlistText, includeAdult = false) {
  if (!playlistText || typeof playlistText !== "string") return [];
  const lines = playlistText.split(/\r?\n/);
  const groupsMap = /* @__PURE__ */ new Map();
  let pendingExtinf = "";
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF")) {
      pendingExtinf = line;
      continue;
    }
    if (line.startsWith("#")) {
      continue;
    }
    if (!/^https?:\/\//i.test(line)) {
      pendingExtinf = "";
      continue;
    }
    const extinf = pendingExtinf;
    pendingExtinf = "";
    const commaIdx = extinf.lastIndexOf(",");
    const rawName = commaIdx >= 0 ? extinf.slice(commaIdx + 1).trim() : "";
    const groupTitle = extinf ? extractExtinfAttr(extinf, "group-title") : "";
    const logoUrl = extinf ? extractExtinfAttr(extinf, "tvg-logo") : "";
    if (!rawName || isDirectM3uChannelBlocked(rawName, groupTitle, line, includeAdult)) {
      continue;
    }
    const displayName = cleanDirectChannelDisplayName(rawName);
    const matchKey = normalizeChannelMatchKey(displayName);
    if (!matchKey || matchKey.length < 2) continue;
    const candidate = scoreStreamCandidate(rawName, line);
    const existing = groupsMap.get(matchKey);
    if (existing) {
      if (!existing.candidates.some((c) => c.url === candidate.url)) {
        existing.candidates.push(candidate);
        existing.candidates.sort((a, b) => b.qualityScore - a.qualityScore);
      }
      if (!existing.logoUrl && logoUrl && /^https?:\/\//i.test(logoUrl)) {
        existing.logoUrl = logoUrl;
      }
    } else {
      const safeLogo = logoUrl && /^https?:\/\//i.test(logoUrl) ? logoUrl : void 0;
      groupsMap.set(matchKey, {
        id: `direct_ch_${matchKey}`,
        matchKey,
        matchKeys: buildChannelMatchKeys(displayName),
        name: displayName,
        category: mapIptvGroupToChannelCategory(groupTitle, displayName),
        logoUrl: safeLogo,
        groupTitle,
        candidates: [candidate]
      });
    }
  }
  return Array.from(groupsMap.values());
}

// server/services/DirectChannelsService.ts
var DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
var DirectChannelsServiceImpl = class {
  constructor() {
    this.warmupPromise = null;
    this.groupsCache = null;
    this.verifiedMap = /* @__PURE__ */ new Map();
    this.listTtlMs = 15 * 60 * 1e3;
    this.probeTtlMs = 12 * 60 * 1e3;
  }
  async fetchPlaylistText(url, signal) {
    const cacheKey = `direct_m3u:${url}`;
    const cached = CacheService.get(cacheKey);
    if (cached) return cached;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7e3);
    const onParentAbort = () => controller.abort();
    signal?.addEventListener("abort", onParentAbort, { once: true });
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": DESKTOP_UA,
          Accept: "*/*"
        }
      });
      if (!res.ok) return "";
      const text = await res.text();
      if (text && text.includes("#EXTM3U")) {
        CacheService.set(cacheKey, text, this.listTtlMs);
        return text;
      }
      return "";
    } catch {
      return "";
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onParentAbort);
    }
  }
  async getChannelGroups(includeAdult) {
    const now = Date.now();
    if (this.groupsCache && this.groupsCache.includeAdult === includeAdult && now - this.groupsCache.fetchedAt < this.listTtlMs) {
      return this.groupsCache.groups;
    }
    const [
      brText,
      plutoBrText,
      freeTvBrText,
      freeTvPtText,
      freeTvLatinText,
      freeTvAnimText,
      freeTvMovText,
      freeTvSpoText,
      catMovText,
      catSerText,
      catAnimText,
      catSpoText,
      catKidsText,
      porText
    ] = await Promise.all([
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.brazil),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.plutoBrazil),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.freeTvBrazil),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.freeTvPortugal),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.freeTvLatin),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.freeTvAnimation),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.freeTvMovies),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.freeTvSports),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.categoryMovies),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.categorySeries),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.categoryAnimation),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.categorySports),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.categoryKids),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.portuguese)
    ]);
    const mergedMap = /* @__PURE__ */ new Map();
    const addGroups = (groups2, priorityBonus) => {
      for (const g of groups2) {
        const existing = mergedMap.get(g.matchKey);
        if (!existing) {
          mergedMap.set(g.matchKey, {
            ...g,
            candidates: g.candidates.map((c) => ({
              ...c,
              qualityScore: c.qualityScore + priorityBonus
            }))
          });
        } else {
          for (const cand of g.candidates) {
            if (!existing.candidates.some((c) => c.url === cand.url)) {
              existing.candidates.push({
                ...cand,
                qualityScore: cand.qualityScore + priorityBonus
              });
            }
          }
          existing.candidates.sort((a, b) => b.qualityScore - a.qualityScore);
          if (!existing.logoUrl && g.logoUrl) {
            existing.logoUrl = g.logoUrl;
          }
        }
      }
    };
    addGroups(parseDirectChannelM3u(brText, includeAdult), 30);
    addGroups(parseDirectChannelM3u(plutoBrText, includeAdult), 28);
    addGroups(parseDirectChannelM3u(freeTvBrText, includeAdult), 22);
    addGroups(parseDirectChannelM3u(freeTvLatinText, includeAdult), 18);
    addGroups(parseDirectChannelM3u(freeTvMovText, includeAdult), 16);
    addGroups(parseDirectChannelM3u(freeTvSpoText, includeAdult), 16);
    addGroups(parseDirectChannelM3u(freeTvAnimText, includeAdult), 14);
    addGroups(parseDirectChannelM3u(freeTvPtText, includeAdult), 12);
    addGroups(parseDirectChannelM3u(catMovText, includeAdult), 10);
    addGroups(parseDirectChannelM3u(catSerText, includeAdult), 10);
    addGroups(parseDirectChannelM3u(catSpoText, includeAdult), 10);
    addGroups(parseDirectChannelM3u(catAnimText, includeAdult), 10);
    addGroups(parseDirectChannelM3u(catKidsText, includeAdult), 10);
    addGroups(parseDirectChannelM3u(porText, includeAdult), 0);
    const groups = Array.from(mergedMap.values());
    groups.sort((a, b) => {
      const aTop = a.candidates[0]?.qualityScore ?? 0;
      const bTop = b.candidates[0]?.qualityScore ?? 0;
      return bTop - aTop;
    });
    this.groupsCache = {
      includeAdult,
      fetchedAt: now,
      groups
    };
    return groups;
  }
  async probeDirectHlsUrl(url, timeoutMs = 3200) {
    if (!/^https?:\/\//i.test(url)) return false;
    const cacheKey = `direct_probe:${url}`;
    const cached = CacheService.get(cacheKey);
    if (cached !== null) return cached.ok;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": DESKTOP_UA,
          Accept: "application/vnd.apple.mpegurl, application/x-mpegURL, */*"
        }
      });
      if (!res.ok) {
        await res.body?.cancel().catch(() => {
        });
        CacheService.set(cacheKey, { ok: false }, 3 * 60 * 1e3);
        return false;
      }
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (ct.includes("text/html") || ct.includes("application/xhtml")) {
        await res.body?.cancel().catch(() => {
        });
        CacheService.set(cacheKey, { ok: false }, 5 * 60 * 1e3);
        return false;
      }
      if (ct.includes("video/mp2t") || ct.includes("video/mp4")) {
        await res.body?.cancel().catch(() => {
        });
        CacheService.set(cacheKey, { ok: true }, this.probeTtlMs);
        return true;
      }
      const reader = res.body?.getReader();
      let headText = "";
      if (reader) {
        const decoder = new TextDecoder();
        let bytes = 0;
        while (bytes < 2048) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value?.byteLength ?? 0;
          headText += decoder.decode(chunk.value, { stream: true });
          if (headText.includes("#EXTM3U")) break;
        }
        await reader.cancel().catch(() => {
        });
      }
      const lower = headText.trim().toLowerCase();
      if (lower.startsWith("<!doctype") || lower.startsWith("<html")) {
        CacheService.set(cacheKey, { ok: false }, 5 * 60 * 1e3);
        return false;
      }
      const ok = headText.includes("#EXTM3U") || ct.includes("mpegurl") || ct.includes("octet-stream");
      CacheService.set(cacheKey, { ok }, ok ? this.probeTtlMs : 3 * 60 * 1e3);
      return ok;
    } catch {
      CacheService.set(cacheKey, { ok: false }, 2 * 60 * 1e3);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
  async probeGroup(group) {
    const existing = this.verifiedMap.get(group.matchKey);
    const now = Date.now();
    if (existing && now - existing.checkedAt < this.probeTtlMs) {
      return existing.verifiedUrls;
    }
    const candidates = group.candidates.slice(0, 4).map((c) => c.url);
    const verifiedUrls = [];
    for (const url of candidates) {
      const ok = await this.probeDirectHlsUrl(url, 2800);
      if (ok) {
        verifiedUrls.push(url);
        if (verifiedUrls.length >= 2) break;
      }
    }
    this.verifiedMap.set(group.matchKey, {
      checkedAt: Date.now(),
      verifiedUrls
    });
    return verifiedUrls;
  }
  async runBatchProbes(groups, concurrency = 32) {
    let index = 0;
    const workers = Array.from({ length: Math.min(concurrency, groups.length) }, async () => {
      while (index < groups.length) {
        const currentIdx = index++;
        const group = groups[currentIdx];
        if (!group) break;
        await this.probeGroup(group);
      }
    });
    await Promise.all(workers);
  }
  scheduleRemainingWarmup(groups) {
    if (this.warmupPromise) return;
    const now = Date.now();
    const pending = groups.filter((g) => {
      const entry = this.verifiedMap.get(g.matchKey);
      return !entry || now - entry.checkedAt >= this.probeTtlMs;
    });
    if (pending.length === 0) return;
    this.warmupPromise = this.runBatchProbes(pending, 28).catch(() => {
    }).finally(() => {
      this.warmupPromise = null;
    });
  }
  async getVerifiedChannels() {
    const includeAdult = SystemSettingsService.getSettings().includeAdult;
    const groups = await this.getChannelGroups(includeAdult);
    if (groups.length === 0) return [];
    const now = Date.now();
    const uncached = groups.filter((g) => {
      const entry = this.verifiedMap.get(g.matchKey);
      return !entry || now - entry.checkedAt >= this.probeTtlMs;
    });
    if (uncached.length > 0) {
      const initialBatch = uncached.slice(0, 128);
      await Promise.race([
        this.runBatchProbes(initialBatch, 48),
        new Promise((resolve) => setTimeout(resolve, 4e3))
      ]);
      this.scheduleRemainingWarmup(groups);
    }
    const verified = [];
    for (const g of groups) {
      const status = this.verifiedMap.get(g.matchKey);
      if (status && status.verifiedUrls.length > 0) {
        verified.push({
          id: g.id,
          matchKey: g.matchKey,
          matchKeys: g.matchKeys,
          name: g.name,
          category: g.category,
          logoUrl: g.logoUrl,
          groupTitle: g.groupTitle,
          verifiedUrls: status.verifiedUrls
        });
      }
    }
    return verified;
  }
  async resolveWorkingStreams(params) {
    const includeAdult = SystemSettingsService.getSettings().includeAdult;
    const groups = await this.getChannelGroups(includeAdult);
    const candidateUrls = [];
    const pushUrl = (u) => {
      if (u && /^https?:\/\//i.test(u) && !candidateUrls.includes(u)) {
        candidateUrls.push(u);
      }
    };
    if (params.rawUrl && (/\.m3u8(?:$|\?)/i.test(params.rawUrl) || /^https?:\/\/\d+\.\d+\.\d+\.\d+/i.test(params.rawUrl))) {
      pushUrl(params.rawUrl);
    }
    const searchKeys = /* @__PURE__ */ new Set();
    if (params.id?.startsWith("direct_ch_")) {
      searchKeys.add(params.id.slice("direct_ch_".length));
    }
    if (params.slug) {
      for (const k of buildChannelMatchKeys(params.slug.replace(/-/g, " "))) {
        searchKeys.add(k);
      }
    }
    if (params.title) {
      for (const k of buildChannelMatchKeys(params.title)) {
        searchKeys.add(k);
      }
    }
    for (const g of groups) {
      const matches = searchKeys.has(g.matchKey) || g.matchKeys.some((k) => searchKeys.has(k));
      if (matches) {
        const cached = this.verifiedMap.get(g.matchKey);
        if (cached && cached.verifiedUrls.length > 0) {
          for (const u of cached.verifiedUrls) pushUrl(u);
        }
        for (const c of g.candidates) pushUrl(c.url);
      }
    }
    if (candidateUrls.length === 0) return [];
    const working = [];
    for (const u of candidateUrls.slice(0, 6)) {
      const ok = await this.probeDirectHlsUrl(u, 3200);
      if (ok) {
        working.push(u);
        if (working.length >= 3) break;
      }
    }
    return working;
  }
  matchEpgForDirectChannel(channel, epgMap) {
    const slugDash = channel.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const exact = epgMap.get(slugDash) ?? epgMap.get(channel.name.toLowerCase());
    if (exact) return exact;
    for (const [epgKey, entry] of epgMap.entries()) {
      const epgNorm = normalizeChannelMatchKey(epgKey.replace(/-/g, " "));
      if (!epgNorm) continue;
      if (channel.matchKeys.includes(epgNorm)) {
        return entry;
      }
    }
    return null;
  }
  toLiveHubChannel(ch, epgEntry) {
    return {
      id: ch.id,
      slug: ch.matchKey,
      name: ch.name,
      category: ch.category,
      streamUrl: ch.verifiedUrls[0],
      logoUrl: ch.logoUrl,
      description: epgEntry?.nowPlaying?.title ? `Agora: ${epgEntry.nowPlaying.title}` : ch.groupTitle || "Transmiss\xE3o direta em alta defini\xE7\xE3o",
      active: true,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      source: "direct",
      isDirectStream: true,
      directStreamUrl: ch.verifiedUrls[0],
      backupDirectUrls: ch.verifiedUrls.slice(1),
      nowPlaying: epgEntry?.nowPlaying ?? null,
      nextProgram: epgEntry?.nextProgram ?? null
    };
  }
};
var DirectChannelsService = new DirectChannelsServiceImpl();

// server/services/StreamBetterService.ts
var DESKTOP_UA2 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
function normalizeTimestampToIso(val) {
  if (typeof val === "number" && Number.isFinite(val)) {
    const ms = val < 1e12 ? val * 1e3 : val;
    return new Date(ms).toISOString();
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return "";
    if (/^\d{10}$/.test(trimmed)) {
      return new Date(Number(trimmed) * 1e3).toISOString();
    }
    if (/^\d{13}$/.test(trimmed)) {
      return new Date(Number(trimmed)).toISOString();
    }
    return trimmed;
  }
  return "";
}
var StreamBetterServiceImpl = class {
  async fetchJson(url, opts = {}) {
    if (opts.cacheKey) {
      const cached = CacheService.get(opts.cacheKey);
      if (cached !== null && cached !== void 0) {
        return { ok: true, status: 200, data: cached };
      }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 6500);
    const onParentAbort = () => controller.abort();
    opts.signal?.addEventListener("abort", onParentAbort, { once: true });
    try {
      const headers = {
        Accept: "application/json",
        "User-Agent": DESKTOP_UA2
      };
      if (opts.bearerKey) {
        headers.Authorization = `Bearer ${opts.bearerKey}`;
      }
      const res = await fetch(url, {
        signal: controller.signal,
        headers
      });
      if (!res.ok) {
        return { ok: false, status: res.status, data: null };
      }
      const data = await res.json().catch(() => null);
      if (data !== null && opts.cacheKey && (opts.ttlMs ?? 0) > 0) {
        CacheService.set(opts.cacheKey, data, opts.ttlMs);
      }
      return { ok: data !== null, status: res.status, data };
    } catch {
      return { ok: false, status: 0, data: null };
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onParentAbort);
    }
  }
  async getLegalBlocks(signal) {
    const res = await this.fetchJson(`${STREAMBETTER_BASE_URL}/api/legal-blocks`, {
      cacheKey: "streambetter:legal-blocks",
      ttlMs: 15 * 60 * 1e3,
      timeoutMs: 4500,
      signal
    });
    if (!res.ok || !res.data) return [];
    const list = Array.isArray(res.data) ? res.data : Array.isArray(res.data.blocks) ? res.data.blocks : Array.isArray(res.data.paths) ? res.data.paths : [];
    return list.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const obj = item;
        return String(obj.path || obj.url || obj.slug || "");
      }
      return "";
    }).filter(Boolean);
  }
  async resolveWith451Fallback(rawUrl, opts = {}) {
    const legalBlocks = await this.getLegalBlocks(opts.signal).catch(() => []);
    const candidates = buildStreamBetter451Candidates(rawUrl, legalBlocks);
    let lastStatus = 0;
    for (const candidate of candidates) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5e3);
      const onParentAbort = () => controller.abort();
      opts.signal?.addEventListener("abort", onParentAbort, { once: true });
      try {
        const res = await fetch(candidate, {
          method: opts.fetchHtml ? "GET" : "HEAD",
          redirect: "follow",
          signal: controller.signal,
          headers: {
            "User-Agent": DESKTOP_UA2,
            Accept: opts.fetchHtml ? "text/html,application/xhtml+xml,*/*" : "*/*",
            Referer: `${STREAMBETTER_BASE_URL}/`
          }
        });
        lastStatus = res.status;
        if (res.status === 451 || res.status === 404) {
          await res.body?.cancel().catch(() => {
          });
          continue;
        }
        if (res.status === 405 && !opts.fetchHtml) {
          await res.body?.cancel().catch(() => {
          });
          const getRes = await fetch(candidate, {
            method: "GET",
            redirect: "follow",
            signal: controller.signal,
            headers: {
              "User-Agent": DESKTOP_UA2,
              Referer: `${STREAMBETTER_BASE_URL}/`
            }
          });
          lastStatus = getRes.status;
          await getRes.body?.cancel().catch(() => {
          });
          if (getRes.status === 451 || getRes.status === 404) continue;
          if (getRes.ok) {
            return {
              finalUrl: getRes.url || candidate,
              status: getRes.status,
              blockedByLegal451: false
            };
          }
          continue;
        }
        if (res.ok) {
          const finalUrl = res.url || candidate;
          if (opts.fetchHtml) {
            const html = await res.text().catch(() => "");
            return { finalUrl, status: res.status, html, blockedByLegal451: false };
          }
          await res.body?.cancel().catch(() => {
          });
          return { finalUrl, status: res.status, blockedByLegal451: false };
        }
        await res.body?.cancel().catch(() => {
        });
      } catch {
      } finally {
        clearTimeout(timer);
        opts.signal?.removeEventListener("abort", onParentAbort);
      }
    }
    return {
      finalUrl: candidates[0] || rawUrl,
      status: lastStatus,
      blockedByLegal451: lastStatus === 451
    };
  }
  async getTitleAvailability(tmdbId, signal) {
    if (!tmdbId || tmdbId <= 0) return [];
    const res = await this.fetchJson(
      `${STREAMBETTER_BASE_URL}/api/titles?tmdb_id=${encodeURIComponent(String(tmdbId))}`,
      {
        cacheKey: `streambetter:titles:${tmdbId}`,
        ttlMs: 10 * 60 * 1e3,
        timeoutMs: 4500,
        signal
      }
    );
    if (!res.ok || !res.data) return [];
    if (Array.isArray(res.data)) return res.data;
    const wrapped = res.data.titles ?? res.data.data;
    if (Array.isArray(wrapped)) return wrapped;
    if (typeof res.data === "object") return [res.data];
    return [];
  }
  async getRecentFeed(signal) {
    const res = await this.fetchJson(`${STREAMBETTER_BASE_URL}/api/recents`, {
      cacheKey: "streambetter:recents",
      ttlMs: 10 * 60 * 1e3,
      timeoutMs: 5e3,
      signal
    });
    if (!res.ok || !res.data) return [];
    if (Array.isArray(res.data)) return res.data;
    const wrapped = res.data.items ?? res.data.titles ?? res.data.data;
    return Array.isArray(wrapped) ? wrapped : [];
  }
  async getSeasonEpisodes(tmdbId, seasonNumber, signal) {
    if (!tmdbId || tmdbId <= 0 || seasonNumber < 0) return [];
    const res = await this.fetchJson(
      `${STREAMBETTER_BASE_URL}/api/season-episodes?tmdb_id=${encodeURIComponent(String(tmdbId))}&season=${encodeURIComponent(String(seasonNumber))}`,
      {
        cacheKey: `streambetter:season:${tmdbId}:${seasonNumber}`,
        ttlMs: 20 * 60 * 1e3,
        timeoutMs: 4500,
        signal
      }
    );
    if (!res.ok || !res.data) return [];
    if (Array.isArray(res.data)) return res.data;
    const obj = res.data;
    if (Array.isArray(obj.episodes)) return obj.episodes;
    if (Array.isArray(obj.data)) return obj.data;
    return [];
  }
  async getChannels(signal) {
    const cacheKey = "streambetter:channels:all";
    const cached = CacheService.get(cacheKey);
    if (cached && cached.length > 0) return cached;
    const first = await this.fetchJson(`${STREAMBETTER_BASE_URL}/api/channels?limit=100&page=1`, {
      timeoutMs: 6500,
      signal
    });
    if (!first.ok || !first.data) return [];
    const extractList = (d) => {
      if (Array.isArray(d)) return d;
      if (d && typeof d === "object") {
        const obj = d;
        const l = obj.channels ?? obj.items ?? obj.data;
        if (Array.isArray(l)) return l;
      }
      return [];
    };
    const collected = [...extractList(first.data)];
    const totalPages = Math.min(10, Math.max(1, Number(first.data.pagination?.totalPages) || 1));
    if (totalPages > 1) {
      const restPages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) => i + 2).map(
          (page) => this.fetchJson(`${STREAMBETTER_BASE_URL}/api/channels?limit=100&page=${page}`, {
            timeoutMs: 6500,
            signal
          }).then((r) => r.ok && r.data ? extractList(r.data) : [])
        )
      );
      for (const pageList of restPages) {
        collected.push(...pageList);
      }
    }
    if (collected.length > 0) {
      CacheService.set(cacheKey, collected, 5 * 60 * 1e3);
    }
    return collected;
  }
  async getGames(signal) {
    const res = await this.fetchJson(`${STREAMBETTER_BASE_URL}/api/games`, {
      cacheKey: "streambetter:games",
      ttlMs: 2 * 60 * 1e3,
      timeoutMs: 5500,
      signal
    });
    if (!res.ok || !res.data) return [];
    if (Array.isArray(res.data)) return res.data;
    const obj = res.data;
    const list = obj.games ?? obj.items ?? obj.data;
    return Array.isArray(list) ? list : [];
  }
  async getEvents(signal) {
    const res = await this.fetchJson(`${STREAMBETTER_BASE_URL}/api/events`, {
      cacheKey: "streambetter:events",
      ttlMs: 2 * 60 * 1e3,
      timeoutMs: 5500,
      signal
    });
    if (!res.ok || !res.data) return [];
    if (Array.isArray(res.data)) return res.data;
    const obj = res.data;
    const list = obj.events ?? obj.items ?? obj.data;
    return Array.isArray(list) ? list : [];
  }
  async getEpgAll(signal) {
    const resultMap = /* @__PURE__ */ new Map();
    const res = await this.fetchJson(
      `${STREAMBETTER_BASE_URL}/api/epg?channel=all&hoursPast=3&hoursFuture=24`,
      {
        cacheKey: "streambetter:epg:all",
        ttlMs: 3 * 60 * 1e3,
        timeoutMs: 6e3,
        signal
      }
    );
    if (!res.ok || !res.data || typeof res.data !== "object") return resultMap;
    const nowMs = Date.now();
    const parsePrograms = (rawPrograms) => rawPrograms.map((p) => {
      if (!p || typeof p !== "object") return null;
      const obj = p;
      const title = String(obj.title || obj.name || "").trim();
      const startAt = normalizeTimestampToIso(obj.start ?? obj.startAt ?? obj.start_time);
      const stopAt = normalizeTimestampToIso(obj.stop ?? obj.end ?? obj.stopAt ?? obj.end_time);
      if (!title) return null;
      const startMs = Date.parse(startAt);
      const stopMs = Date.parse(stopAt);
      const isLive = obj.isLive === true || Number.isFinite(startMs) && Number.isFinite(stopMs) && startMs <= nowMs && nowMs < stopMs;
      return {
        title,
        startAt,
        stopAt,
        isLive,
        image: typeof obj.image === "string" ? obj.image : null,
        description: typeof obj.description === "string" ? obj.description : null
      };
    }).filter((item) => item !== null);
    const assignChannelPrograms = (channelKey, programs) => {
      if (!channelKey || programs.length === 0) return;
      const liveIdx = programs.findIndex((p) => p.isLive);
      const nowPlaying = liveIdx >= 0 ? programs[liveIdx] : null;
      const nextProgram = liveIdx >= 0 && liveIdx + 1 < programs.length ? programs[liveIdx + 1] : programs.find((p) => {
        const s = Date.parse(p.startAt);
        return Number.isFinite(s) && s > nowMs;
      }) ?? null;
      const normalized = channelKey.trim().toLowerCase();
      resultMap.set(normalized, { nowPlaying, nextProgram });
    };
    const dataObj = res.data;
    if (Array.isArray(res.data)) {
      for (const entry of res.data) {
        if (!entry || typeof entry !== "object") continue;
        const e = entry;
        const key = String(e.slug || e.channel || e.id || e.name || "");
        const progs = Array.isArray(e.programs) ? e.programs : Array.isArray(e.epg) ? e.epg : Array.isArray(e.schedule) ? e.schedule : [];
        assignChannelPrograms(key, parsePrograms(progs));
      }
    } else if (dataObj.channels && typeof dataObj.channels === "object") {
      for (const [k, v] of Object.entries(dataObj.channels)) {
        const progs = Array.isArray(v) ? v : v && typeof v === "object" && Array.isArray(v.programs) ? v.programs : [];
        assignChannelPrograms(k, parsePrograms(progs));
      }
    } else {
      for (const [k, v] of Object.entries(dataObj)) {
        if (Array.isArray(v)) {
          assignChannelPrograms(k, parsePrograms(v));
        }
      }
    }
    return resultMap;
  }
  async resolveStreamFlashMp4Url(pageUrl, referer, signal) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5e3);
    const onParentAbort = () => controller.abort();
    signal?.addEventListener("abort", onParentAbort, { once: true });
    try {
      const res = await fetch(pageUrl, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": DESKTOP_UA2,
          Referer: referer || `${STREAMBETTER_BASE_URL}/`,
          Accept: "text/html,application/xhtml+xml,*/*"
        }
      });
      if (!res.ok) return null;
      const html = await res.text();
      return extractStreamFlashMp4FromHtml(html);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onParentAbort);
    }
  }
  async fetchV1Streams(params) {
    const keyInfo = SystemSettingsService.getActiveStreamBetterKey();
    if (!keyInfo.key) {
      return {
        ok: false,
        hasApiKey: false,
        sources: [],
        error: "Chave secreta StreamBetter (sb_sk_...) n\xE3o configurada."
      };
    }
    const endpointUrl = params.directUrlOverride || buildStreamBetterV1StreamUrl({
      tmdbId: params.tmdbId,
      mediaType: params.mediaType,
      seasonNumber: params.seasonNumber,
      episodeNumber: params.episodeNumber,
      channel: params.channel,
      game: params.game,
      event: params.event,
      fonte: params.fonte
    });
    const isLive = Boolean(params.channel || params.game || params.event);
    const cacheKey = `streambetter:v1:${endpointUrl}`;
    const cached = CacheService.get(cacheKey);
    if (cached && cached.length > 0) {
      return { ok: true, hasApiKey: true, statusCode: 200, sources: cached };
    }
    const res = await this.fetchJson(endpointUrl, {
      bearerKey: keyInfo.key,
      timeoutMs: 8500,
      signal: params.signal
    });
    if (!res.ok || !res.data) {
      return {
        ok: false,
        hasApiKey: true,
        statusCode: res.status,
        sources: [],
        error: res.status === 401 ? "Chave StreamBetter inv\xE1lida ou expirada (HTTP 401)." : `StreamBetter API retornou status ${res.status || "erro de rede"}.`
      };
    }
    const parsed = parseStreamBetterV1Sources(res.data);
    const resolvedSources = await Promise.all(
      parsed.map(async (src) => {
        if (src.kind !== "streamflash") return src;
        const mp4Url = await this.resolveStreamFlashMp4Url(
          src.url,
          src.referer || `${STREAMBETTER_BASE_URL}/`,
          params.signal
        );
        if (!mp4Url) return null;
        return {
          ...src,
          url: mp4Url,
          format: "mp4"
        };
      })
    );
    const validSources = resolvedSources.filter(
      (item) => item !== null
    );
    if (validSources.length > 0) {
      let ttlMs = isLive ? 90 * 1e3 : 8 * 60 * 1e3;
      const earliestExpiry = validSources.map((s) => s.expiresAt ? Date.parse(s.expiresAt) : Number.NaN).filter((ts) => Number.isFinite(ts) && ts > Date.now() + 6e4).sort((a, b) => a - b)[0];
      if (earliestExpiry) {
        ttlMs = Math.min(ttlMs, Math.max(6e4, earliestExpiry - Date.now() - 6e4));
      }
      CacheService.set(cacheKey, validSources, ttlMs);
    }
    return {
      ok: validSources.length > 0,
      hasApiKey: true,
      statusCode: res.status,
      sources: validSources
    };
  }
  async getLiveHub(adminChannels) {
    const [directChannels, sbGamesRaw, sbEventsRaw, epgMap] = await Promise.all([
      DirectChannelsService.getVerifiedChannels().catch(() => []),
      this.getGames().catch(() => []),
      this.getEvents().catch(() => []),
      this.getEpgAll().catch(() => /* @__PURE__ */ new Map())
    ]);
    const mergedChannels = [];
    const seenIds = /* @__PURE__ */ new Set();
    const seenNames = /* @__PURE__ */ new Set();
    const directByKey = /* @__PURE__ */ new Map();
    for (const d of directChannels) {
      for (const k of d.matchKeys) {
        if (!directByKey.has(k)) directByKey.set(k, d);
      }
    }
    for (const adminCh of adminChannels) {
      if (!adminCh.active) continue;
      const isDirect = /\.m3u8(?:$|\?)|\.(?:mp4|m4v|webm|mkv|ts)(?:$|\?)/i.test(adminCh.streamUrl) || /^https?:\/\/\d+\.\d+\.\d+\.\d+/i.test(adminCh.streamUrl);
      const adminKeys = buildChannelMatchKeys(adminCh.name);
      const matchedDirect = adminKeys.map((k) => directByKey.get(k)).find(Boolean);
      if (!isDirect && !matchedDirect) continue;
      seenIds.add(adminCh.id);
      seenNames.add(adminCh.name.trim().toLowerCase());
      const primaryDirectUrl = isDirect ? adminCh.streamUrl : matchedDirect.verifiedUrls[0];
      const backups = isDirect ? matchedDirect?.verifiedUrls ?? [] : matchedDirect.verifiedUrls.slice(1);
      const epgEntry = matchedDirect ? DirectChannelsService.matchEpgForDirectChannel(matchedDirect, epgMap) : epgMap.get(adminCh.name.trim().toLowerCase()) ?? null;
      mergedChannels.push({
        ...adminCh,
        streamUrl: primaryDirectUrl,
        source: "admin",
        isDirectStream: true,
        directStreamUrl: primaryDirectUrl,
        backupDirectUrls: backups,
        nowPlaying: epgEntry?.nowPlaying ?? null,
        nextProgram: epgEntry?.nextProgram ?? null
      });
    }
    for (const dCh of directChannels) {
      const nameKey = dCh.name.trim().toLowerCase();
      if (seenIds.has(dCh.id) || seenNames.has(nameKey)) continue;
      seenIds.add(dCh.id);
      seenNames.add(nameKey);
      const epgEntry = DirectChannelsService.matchEpgForDirectChannel(dCh, epgMap);
      mergedChannels.push(DirectChannelsService.toLiveHubChannel(dCh, epgEntry));
    }
    const games = [];
    for (const raw of sbGamesRaw) {
      const title = String(raw.title || "").trim();
      if (!title) continue;
      const players = Array.isArray(raw.players) ? raw.players.filter((p) => typeof p === "string" && /^https?:\/\//i.test(p)) : [];
      const primaryUrl = players[0] || "";
      if (!primaryUrl) continue;
      const slugInfo = extractStreamBetterSlugFromUrl(primaryUrl);
      const slug = slugInfo?.slug || String(raw.id || "").trim();
      games.push({
        id: `sb_game_${String(raw.id || slug || games.length)}`,
        slug,
        title,
        sport: String(raw.sport || "Esportes").trim() || "Esportes",
        league: raw.data?.league ? String(raw.data.league).trim() : void 0,
        startTime: raw.data?.timer?.start ? normalizeTimestampToIso(raw.data.timer.start) || void 0 : void 0,
        homeTeam: raw.data?.teams?.home?.name ? {
          name: String(raw.data.teams.home.name),
          image: raw.data.teams.home.image || null
        } : void 0,
        awayTeam: raw.data?.teams?.away?.name ? {
          name: String(raw.data.teams.away.name),
          image: raw.data.teams.away.image || null
        } : void 0,
        players,
        primaryUrl
      });
    }
    const events = [];
    for (const raw of sbEventsRaw) {
      const title = String(raw.title || raw.name || "").trim();
      if (!title) continue;
      const players = Array.isArray(raw.players) ? raw.players.filter((p) => typeof p === "string" && /^https?:\/\//i.test(p)) : [];
      const primaryUrl = (raw.url && /^https?:\/\//i.test(raw.url) ? raw.url : players[0]) || "";
      if (!primaryUrl) continue;
      const slugInfo = extractStreamBetterSlugFromUrl(primaryUrl);
      const slug = slugInfo?.slug || String(raw.id || "").trim();
      events.push({
        id: `sb_event_${String(raw.id || slug || events.length)}`,
        slug,
        title,
        category: String(raw.category || raw.sport || "Ao Vivo").trim() || "Ao Vivo",
        image: typeof raw.image === "string" && raw.image.trim() ? raw.image.trim() : null,
        startTime: normalizeTimestampToIso(raw.start_time || raw.startAt) || void 0,
        players: players.length > 0 ? players : [primaryUrl],
        primaryUrl
      });
    }
    const categories = Array.from(new Set(mergedChannels.map((c) => c.category)));
    const sports = Array.from(new Set(games.map((g) => g.sport).filter(Boolean)));
    return {
      channels: mergedChannels,
      games,
      events,
      categories,
      sports,
      hasStreamBetterKey: Boolean(SystemSettingsService.getActiveStreamBetterKey().key)
    };
  }
  async testConnection() {
    const started = Date.now();
    const keyInfo = SystemSettingsService.getActiveStreamBetterKey();
    try {
      const [titlesRes, channelsRes] = await Promise.all([
        this.fetchJson(`${STREAMBETTER_BASE_URL}/api/titles?tmdb_id=550`, {
          timeoutMs: 6e3
        }),
        this.fetchJson(`${STREAMBETTER_BASE_URL}/api/channels`, {
          timeoutMs: 6e3
        })
      ]);
      if (!titlesRes.ok && !channelsRes.ok) {
        return {
          target: "streambetter",
          ok: false,
          latencyMs: Date.now() - started,
          statusCode: titlesRes.status || channelsRes.status,
          message: "N\xE3o foi poss\xEDvel conectar aos endpoints JSON p\xFAblicos do StreamBetter.",
          testedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      if (!keyInfo.key) {
        return {
          target: "streambetter",
          ok: true,
          latencyMs: Date.now() - started,
          statusCode: 200,
          message: "Feeds JSON p\xFAblicos do StreamBetter online (canais, jogos, eventos, EPG e epis\xF3dios). Cole a chave sb_sk_... acima para ativar extra\xE7\xE3o direta .m3u8/.mp4 via /api/v1/stream.",
          detail: `Canais: ${channelsRes.ok ? "OK" : "indispon\xEDvel"} \xB7 Chave /api/v1/stream: n\xE3o configurada`,
          testedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      const v1Res = await this.fetchV1Streams({
        tmdbId: 550,
        mediaType: "movie"
      });
      if (v1Res.statusCode === 401) {
        return {
          target: "streambetter",
          ok: false,
          latencyMs: Date.now() - started,
          statusCode: 401,
          message: "Chave secreta StreamBetter recusada (HTTP 401). Verifique se a chave sb_sk_... est\xE1 correta e ativa.",
          detail: `Origem da chave: ${keyInfo.source}`,
          testedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      repositoryStore.addLog({
        level: "info",
        service: "StreamBetterService",
        message: `Diagn\xF3stico StreamBetter conclu\xEDdo: ${v1Res.sources.length} stream(s) extra\xEDdo(s) via /api/v1/stream.`
      });
      return {
        target: "streambetter",
        ok: true,
        latencyMs: Date.now() - started,
        statusCode: v1Res.statusCode ?? 200,
        message: v1Res.sources.length > 0 ? `StreamBetter API JSON autenticada com sucesso (${v1Res.sources.length} faixa(s) direta(s) extra\xEDda(s) para TMDB 550).` : "Feeds p\xFAblicos e chave StreamBetter respondendo (nenhum stream ativo retornado para o ID de teste).",
        detail: `Origem da chave: ${keyInfo.source === "admin_override" ? "Painel Admin" : "Vari\xE1vel de Ambiente"}`,
        testedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (err) {
      return {
        target: "streambetter",
        ok: false,
        latencyMs: Date.now() - started,
        message: `Erro ao testar StreamBetter: ${err instanceof Error ? err.message : String(err)}`,
        testedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  }
};
var StreamBetterService = new StreamBetterServiceImpl();

// server/services/StreamResolverService.ts
var DESKTOP_CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
var StreamResolverServiceImpl = class {
  constructor() {
    this.hlsSessions = /* @__PURE__ */ new Map();
    this.subtitleRegistry = /* @__PURE__ */ new Map();
    this.streamCache = /* @__PURE__ */ new Map();
    this.subtitleCache = /* @__PURE__ */ new Map();
    this.hexaCapCache = null;
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
    const sendUserAgent = params.sendUserAgent !== false;
    const effectiveUa = params.userAgent?.trim() || DESKTOP_CHROME_UA;
    const token = signStreamSessionToken({
      u: params.upstreamUrl,
      r: params.referer || void 0,
      o: params.origin || void 0,
      ua: effectiveUa !== DESKTOP_CHROME_UA ? effectiveUa : void 0,
      sr: sendReferer,
      sua: sendUserAgent,
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
      sendUserAgent,
      streamKind,
      userAgent: effectiveUa,
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
      sendUserAgent: decoded.sua !== false,
      streamKind: decoded.k === "video" ? "video" : "hls",
      userAgent: decoded.ua || DESKTOP_CHROME_UA,
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
    const useUa = params.sendUserAgent !== false;
    const uaValue = params.userAgent?.trim() || DESKTOP_CHROME_UA;
    const runAttempt = async (withReferer) => {
      const headers = {
        Range: "bytes=0-65535"
      };
      if (useUa) {
        headers["User-Agent"] = uaValue;
      }
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
      if (detected === "hls") {
        const manifestText = new TextDecoder("utf-8", { fatal: false }).decode(headBytes);
        const healthy = await this.verifyHlsFirstSegmentHealth({
          manifestText,
          baseUrl: finalUrl,
          referer: params.referer,
          origin: params.origin,
          userAgent: uaValue,
          sendReferer,
          useUa,
          signal: controller.signal
        });
        if (!healthy.ok) {
          return {
            ok: false,
            kind: "hls",
            finalUrl,
            sendReferer: healthy.sendReferer
          };
        }
        return { ok: true, kind: "hls", finalUrl, sendReferer: healthy.sendReferer };
      }
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
  extractFirstPlaylistUri(manifestText, baseUrl) {
    const lines = (manifestText || "").split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      try {
        const resolved = new URL(line, baseUrl);
        if ((resolved.protocol === "https:" || resolved.protocol === "http:") && isSafePublicHost(resolved.hostname)) {
          return resolved.toString();
        }
      } catch {
        continue;
      }
    }
    return null;
  }
  async verifyHlsFirstSegmentHealth(params) {
    let currentManifest = params.manifestText;
    let currentBase = params.baseUrl;
    let sendReferer = params.sendReferer;
    for (let hop = 0; hop < 2; hop++) {
      const nextUrl = this.extractFirstPlaylistUri(currentManifest, currentBase);
      if (!nextUrl) {
        return { ok: true, sendReferer };
      }
      const fetchChild = async (withRef) => {
        const headers = {
          Range: "bytes=0-65535"
        };
        if (params.useUa) headers["User-Agent"] = params.userAgent || DESKTOP_CHROME_UA;
        if (withRef && params.referer) {
          headers.Referer = params.referer;
          if (params.origin) headers.Origin = params.origin;
        }
        return fetch(nextUrl, {
          redirect: "follow",
          signal: params.signal,
          headers
        });
      };
      try {
        let childRes = await fetchChild(sendReferer);
        if ((childRes.status === 401 || childRes.status === 403) && sendReferer) {
          await childRes.body?.cancel().catch(() => {
          });
          const retryRes = await fetchChild(false);
          if (retryRes.ok || retryRes.status === 206) {
            sendReferer = false;
            childRes = retryRes;
          } else {
            await retryRes.body?.cancel().catch(() => {
            });
            return { ok: false, sendReferer };
          }
        }
        if (!childRes.ok && childRes.status !== 206) {
          await childRes.body?.cancel().catch(() => {
          });
          return { ok: false, sendReferer };
        }
        const childBytes = await this.readHeadBytes(childRes, 65536);
        const childSample = new TextDecoder("utf-8", { fatal: false }).decode(childBytes);
        if (isCloudflareChallengeHtml(childSample, childRes.status)) {
          return { ok: false, sendReferer };
        }
        if (/^\s*\uFEFF?#EXTM3U/i.test(childSample)) {
          currentManifest = childSample;
          currentBase = childRes.url || nextUrl;
          continue;
        }
        return { ok: childBytes.length > 0, sendReferer };
      } catch {
        return { ok: false, sendReferer };
      }
    }
    return { ok: true, sendReferer };
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4800);
    const onParentAbort = () => controller.abort();
    params.signal.addEventListener("abort", onParentAbort, { once: true });
    try {
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
          signal: controller.signal
        }),
        this.extractVidSrcBuzzFromEmbedUrl(videmBuzzUrl, {
          langHint: "en",
          signal: controller.signal
        })
      ]);
      const combined = [...vidsrcRes, ...videmRes];
      if (combined.length > 0 || controller.signal.aborted) return combined;
      const ccRes = await this.extractVidSrcBuzzFromEmbedUrl(videmCcUrl, {
        langHint: "en",
        signal: controller.signal
      });
      if (ccRes.length > 0 || controller.signal.aborted) return ccRes;
      if (params.imdbId && /^tt\d{5,12}$/i.test(params.imdbId)) {
        const imdbMirrors = buildBuzzMirrorUrls(params.imdbId);
        const imdbResults = await Promise.all(
          imdbMirrors.slice(0, 2).map(
            (u) => this.extractVidSrcBuzzFromEmbedUrl(u, {
              langHint: "en",
              signal: controller.signal
            })
          )
        );
        return imdbResults.flat();
      }
      return [];
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      params.signal.removeEventListener("abort", onParentAbort);
    }
  }
  mapCaptionLanguageCode(rawLang) {
    const s = (rawLang || "").trim().toLowerCase();
    if (!s) return "und";
    if (/(?:pt-br|\bpob\b|\bpb\b|brazilian|portugu[eê]s\s*\(?br|brasil)/i.test(s)) return "pob";
    if (/(?:portugu|\bpt\b|\bpor\b|pt-pt)/i.test(s)) return "por";
    if (/(?:english|\beng\b|\ben\b)/i.test(s)) return "eng";
    if (/(?:span|espa|\bspa\b|\bes\b|latino)/i.test(s)) return "spa";
    if (/(?:fren|fran|\bfre\b|\bfra\b|\bfr\b)/i.test(s)) return "fre";
    if (/(?:germ|alem|deutsch|\bger\b|\bdeu\b|\bde\b)/i.test(s)) return "ger";
    if (/(?:ital|\bita\b|\bit\b)/i.test(s)) return "ita";
    if (/(?:japan|japon|\bjpn\b|\bja\b)/i.test(s)) return "jpn";
    if (/(?:korean|corean|\bkor\b|\bko\b)/i.test(s)) return "kor";
    if (/(?:russ|\brus\b|\bru\b|pус)/i.test(s)) return "rus";
    if (/(?:arab|árabe|\bara\b|\bar\b)/i.test(s)) return "ara";
    if (/(?:chin|mandarin|canton|\bchi\b|\bzho\b|\bzh\b)/i.test(s)) return "chi";
    if (/(?:dutch|holand|nederland|\bdut\b|\bnld\b|\bnl\b)/i.test(s)) return "dut";
    if (/(?:polish|polon|polsk|\bpol\b|\bpl\b)/i.test(s)) return "pol";
    if (/(?:turk|turc|türk|\btur\b|\btr\b)/i.test(s)) return "tur";
    if (/(?:hindi|\bhin\b|\bhi\b)/i.test(s)) return "hin";
    if (/(?:indones|\bind\b|\bid\b)/i.test(s)) return "ind";
    if (/(?:vietnam|\bvie\b|\bvi\b)/i.test(s)) return "vie";
    if (/(?:thai|tailand|\btha\b|\bth\b)/i.test(s)) return "tha";
    if (/(?:hebr|\bheb\b|\bhe\b)/i.test(s)) return "heb";
    if (/(?:swed|suec|svensk|\bswe\b|\bsv\b)/i.test(s)) return "swe";
    if (/(?:norweg|norueg|norsk|\bnor\b|\bno\b|\bnb\b)/i.test(s)) return "nor";
    if (/(?:danish|dinamar|dansk|\bdan\b|\bda\b)/i.test(s)) return "dan";
    if (/(?:finnish|finland|suomi|\bfin\b|\bfi\b)/i.test(s)) return "fin";
    if (/(?:greek|greg|\bell\b|\bgre\b|\bel\b)/i.test(s)) return "ell";
    if (/(?:czech|tchec|\bces\b|\bcze\b|\bcs\b)/i.test(s)) return "ces";
    if (/(?:hungar|húngar|magyar|\bhun\b|\bhu\b)/i.test(s)) return "hun";
    if (/(?:roman|romen|\brum\b|\bron\b|\bro\b)/i.test(s)) return "rum";
    if (/(?:ukrain|ucran|\bukr\b|\buk\b)/i.test(s)) return "ukr";
    return s.replace(/[^a-z0-9-]/g, "").slice(0, 6) || "und";
  }
  buildExtraSubtitleTracks(captions) {
    if (!Array.isArray(captions) || captions.length === 0) return [];
    const selected = [];
    const seenUrls = /* @__PURE__ */ new Set();
    const perLangCount = /* @__PURE__ */ new Map();
    const rankOrder = ["pob", "por", "eng", "spa", "fre", "ger", "ita", "jpn", "kor"];
    const ordered = [...captions].sort((a, b) => {
      const ac = this.mapCaptionLanguageCode(a.lang);
      const bc = this.mapCaptionLanguageCode(b.lang);
      const ai = rankOrder.indexOf(ac);
      const bi = rankOrder.indexOf(bc);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    const allowedSubLangs = /* @__PURE__ */ new Set([
      "pob",
      "por",
      "eng",
      "spa",
      "fre",
      "ita",
      "ger",
      "jpn",
      "kor",
      "rus",
      "ara",
      "chi",
      "dut",
      "pol",
      "tur",
      "hin",
      "ind",
      "vie",
      "tha",
      "heb",
      "swe",
      "nor",
      "dan",
      "fin",
      "ell",
      "ces",
      "hun",
      "rum",
      "ukr"
    ]);
    for (const item of ordered) {
      const cleanUrl = (item.url || "").trim();
      if (!cleanUrl || seenUrls.has(cleanUrl) || !isAllowedSubtitleHost(cleanUrl)) continue;
      seenUrls.add(cleanUrl);
      const langCode = this.mapCaptionLanguageCode(item.lang);
      if (langCode === "und" || !allowedSubLangs.has(langCode)) continue;
      const count = perLangCount.get(langCode) ?? 0;
      if (count >= 2) continue;
      perLangCount.set(langCode, count + 1);
      const subId = this.registerSubtitleEntry({
        url: cleanUrl,
        lang: langCode
      });
      const baseLabel = formatSubtitleLangLabel(langCode);
      const suffix = count > 0 ? ` #${count + 1}` : "";
      selected.push({
        id: subId,
        lang: langCode,
        label: `${baseLabel}${suffix}`,
        url: `/api/player/subtitle/${subId}.vtt`,
        isDefault: langCode === "pob" && count === 0
      });
      if (selected.length >= 28) break;
    }
    return selected;
  }
  async extractVidLinkStream(params) {
    if (!params.tmdbId || params.tmdbId <= 0) {
      return { candidates: [], captions: [] };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener("abort", onParentAbort, { once: true });
    try {
      const encRes = await fetch(
        `https://enc-dec.app/api/enc-vidlink?text=${encodeURIComponent(String(params.tmdbId))}`,
        {
          signal: controller.signal,
          headers: { "User-Agent": DESKTOP_CHROME_UA, Accept: "application/json" }
        }
      );
      if (!encRes.ok) return { candidates: [], captions: [] };
      const encJson = await encRes.json().catch(() => null);
      const token = typeof encJson?.result === "string" ? encJson.result.trim() : "";
      if (!token) return { candidates: [], captions: [] };
      const baseApi = params.mediaType === "tv" ? `https://vidlink.pro/api/b/tv/${encodeURIComponent(token)}/${params.season ?? 1}/${params.episode ?? 1}` : `https://vidlink.pro/api/b/movie/${encodeURIComponent(token)}`;
      const [vlRes0, vlRes1] = await Promise.all([
        fetch(`${baseApi}?multiLang=0`, {
          signal: controller.signal,
          headers: {
            "User-Agent": DESKTOP_CHROME_UA,
            Referer: "https://vidlink.pro/",
            Origin: "https://vidlink.pro",
            Accept: "application/json"
          }
        }).catch(() => null),
        fetch(`${baseApi}?multiLang=1`, {
          signal: controller.signal,
          headers: {
            "User-Agent": DESKTOP_CHROME_UA,
            Referer: "https://vidlink.pro/",
            Origin: "https://vidlink.pro",
            Accept: "application/json"
          }
        }).catch(() => null)
      ]);
      const captions = [];
      const seenCapUrls = /* @__PURE__ */ new Set();
      const rawPickedList = [];
      for (const res of [vlRes0, vlRes1]) {
        if (!res?.ok) continue;
        const payload = await res.json().catch(() => null);
        const streamObj = payload?.stream;
        if (!streamObj || typeof streamObj !== "object") continue;
        const rawCaptions = Array.isArray(streamObj.captions) ? streamObj.captions : [];
        for (const rawCap of rawCaptions) {
          if (!rawCap || typeof rawCap !== "object") continue;
          const c = rawCap;
          const url = typeof c.url === "string" ? c.url.trim() : "";
          const lang = typeof c.language === "string" ? c.language : typeof c.lang === "string" ? c.lang : "";
          if (url && lang && isAllowedSubtitleHost(url) && !seenCapUrls.has(url)) {
            seenCapUrls.add(url);
            captions.push({ url, lang });
          }
        }
        const cands = selectVidLinkCandidates(streamObj);
        for (const c of cands) {
          if (!rawPickedList.some((x) => x.url === c.url)) {
            rawPickedList.push(c);
          }
        }
      }
      if (rawPickedList.length === 0) {
        return { candidates: [], captions };
      }
      const probed = await Promise.all(
        rawPickedList.slice(0, 3).map(async (picked) => {
          const probe = await this.probeDirectMediaUrl({
            url: picked.url,
            referer: picked.sendUserAgent ? "https://vidlink.pro/" : "",
            origin: picked.sendUserAgent ? "https://vidlink.pro" : "",
            expectedKind: picked.streamKind,
            sendUserAgent: picked.sendUserAgent,
            signal: controller.signal
          });
          if (!probe.ok) return null;
          return {
            streamUrl: probe.finalUrl || picked.url,
            streamKind: probe.kind,
            audioLabel: "Ingl\xEAs / Original",
            langCode: "en-us",
            languageLabel: "Ingl\xEAs / Original",
            posterUrl: null,
            referer: probe.sendReferer && picked.sendUserAgent ? "https://vidlink.pro/" : "",
            origin: probe.sendReferer && picked.sendUserAgent ? "https://vidlink.pro" : "",
            sendReferer: probe.sendReferer && picked.sendUserAgent,
            sendUserAgent: picked.sendUserAgent,
            sourceKind: "vidlink"
          };
        })
      );
      return {
        captions,
        candidates: probed.filter((c) => c !== null)
      };
    } catch {
      return { candidates: [], captions: [] };
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener("abort", onParentAbort);
    }
  }
  async extractCinejoySingleServer(params) {
    if (!params.tmdbId || params.tmdbId <= 0 || !params.title) {
      return { candidate: null, captions: [] };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7e3);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener("abort", onParentAbort, { once: true });
    try {
      const qs = new URLSearchParams({
        title: params.title,
        type: params.mediaType === "tv" ? "series" : "movie",
        year: params.releaseYear || "",
        imdb: params.imdbId || "",
        tmdb: String(params.tmdbId),
        server: params.server
      });
      if (params.mediaType === "tv") {
        qs.set("season", String(params.season ?? 1));
        qs.set("episode", String(params.episode ?? 1));
      }
      const targetUrl = `https://api.wing.st/?${qs.toString()}`;
      const encRes = await fetch(
        `https://enc-dec.app/api/enc-cinejoy?url=${encodeURIComponent(targetUrl)}`,
        {
          signal: controller.signal,
          headers: { "User-Agent": DESKTOP_CHROME_UA, Accept: "application/json" }
        }
      );
      if (!encRes.ok) return { candidate: null, captions: [] };
      const encJson = await encRes.json().catch(() => null);
      const encData = encJson?.result?.data;
      const state = encJson?.result?.state;
      if (!encData || !state) return { candidate: null, captions: [] };
      const wingRes = await fetch("https://api.wing.st/g", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Accept: "*/*",
          "Content-Type": "application/octet-stream",
          Origin: "https://cinejoy.pk",
          Referer: "https://cinejoy.pk/",
          "User-Agent": DESKTOP_CHROME_UA
        },
        body: Buffer.from(encData, "base64url")
      });
      if (!wingRes.ok) return { candidate: null, captions: [] };
      const wingBuf = Buffer.from(await wingRes.arrayBuffer());
      const decRes = await fetch("https://enc-dec.app/api/dec-cinejoy", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": DESKTOP_CHROME_UA
        },
        body: JSON.stringify({
          text: wingBuf.toString("base64url"),
          state
        })
      });
      if (!decRes.ok) return { candidate: null, captions: [] };
      const decJson = await decRes.json().catch(() => null);
      const streamList = decJson?.result?.data?.stream;
      const firstStream = Array.isArray(streamList) ? streamList.find((s) => typeof (s.playlist || s.url) === "string") : void 0;
      const playlistUrl = (firstStream?.playlist || firstStream?.url || "").trim();
      if (!/^https?:\/\//i.test(playlistUrl)) {
        return { candidate: null, captions: [] };
      }
      const rawCaptions = Array.isArray(decJson?.result?.data?.captions) ? decJson.result.data.captions : [];
      const captions = rawCaptions.map((c) => ({
        url: (c.url || "").trim(),
        lang: (c.language || c.lang || "").trim()
      })).filter((c) => c.url && c.lang && isAllowedSubtitleHost(c.url));
      const isMp4 = /\.mp4(?:$|[?#])/i.test(playlistUrl) && firstStream?.type !== "hls";
      const probe = await this.probeDirectMediaUrl({
        url: playlistUrl,
        referer: "https://cinejoy.pk/",
        origin: "https://cinejoy.pk",
        expectedKind: isMp4 ? "video" : "hls",
        sendUserAgent: true,
        signal: controller.signal
      });
      if (!probe.ok) {
        return { candidate: null, captions };
      }
      return {
        captions,
        candidate: {
          streamUrl: probe.finalUrl || playlistUrl,
          streamKind: probe.kind,
          audioLabel: "Ingl\xEAs / Original",
          langCode: "en-us",
          languageLabel: "Ingl\xEAs / Original",
          posterUrl: null,
          referer: probe.sendReferer ? "https://cinejoy.pk/" : "",
          origin: probe.sendReferer ? "https://cinejoy.pk" : "",
          sendReferer: probe.sendReferer,
          sendUserAgent: true,
          sourceKind: "cinejoy"
        }
      };
    } catch {
      return { candidate: null, captions: [] };
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener("abort", onParentAbort);
    }
  }
  async extractCinejoyStreams(params) {
    if (!params.tmdbId || !params.title) {
      return { candidates: [], captions: [] };
    }
    const [sirius, polaris] = await Promise.all([
      this.extractCinejoySingleServer({ ...params, server: "Sirius" }),
      this.extractCinejoySingleServer({ ...params, server: "Polaris" })
    ]);
    const candidates = [];
    const captions = [...sirius.captions, ...polaris.captions];
    if (sirius.candidate) candidates.push(sirius.candidate);
    if (polaris.candidate) candidates.push(polaris.candidate);
    return { candidates, captions };
  }
  async extractAbyssPlayHydraxCandidates(playerPageUrl, hostReferer, optType, signal) {
    try {
      const parsedPlayer = new URL(playerPageUrl);
      const pageRes = await fetch(playerPageUrl, {
        redirect: "follow",
        signal,
        headers: {
          "User-Agent": DESKTOP_CHROME_UA,
          Referer: hostReferer,
          Accept: "text/html,application/xhtml+xml,*/*"
        }
      });
      if (!pageRes.ok) return [];
      const html = await pageRes.text();
      if (!html || isCloudflareChallengeHtml(html, pageRes.status)) return [];
      const datasMatch = html.match(/const\s+datas\s*=\s*"([^"]+)"/) || html.match(/\bdatas\s*=\s*["']([^"']+)["']/);
      const encryptedDatas = datasMatch?.[1]?.trim();
      if (!encryptedDatas) return [];
      const decRes = await fetch("https://enc-dec.app/api/dec-abyss", {
        method: "POST",
        signal,
        headers: {
          "User-Agent": DESKTOP_CHROME_UA,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ text: encryptedDatas })
      });
      if (!decRes.ok) return [];
      const decJson = await decRes.json().catch(() => null);
      const rawSources = Array.isArray(decJson?.result?.sources) ? decJson.result.sources : [];
      const sorted = rawSources.filter((s) => typeof s?.url === "string" && /^https?:\/\//i.test(s.url) && s.status !== false).sort((a, b) => {
        const aH264 = /h264|avc/i.test(a.codec || "") ? 0 : 1;
        const bH264 = /h264|avc/i.test(b.codec || "") ? 0 : 1;
        if (aH264 !== bH264) return aH264 - bH264;
        const aRes = Number.parseInt((a.type || "").replace(/\D+/g, ""), 10) || 0;
        const bRes = Number.parseInt((b.type || "").replace(/\D+/g, ""), 10) || 0;
        return bRes - aRes;
      });
      const effectiveOrigin = new URL(pageRes.url || parsedPlayer.toString()).origin;
      const refererForCdn = `${effectiveOrigin}/`;
      const isSub = optType === 2;
      const languageLabel = isSub ? "Legendado (PT-BR)" : "Dublado (PT-BR)";
      const langCode = isSub ? "pt-sub" : "pt-br";
      const probed = await Promise.all(
        sorted.slice(0, 2).map(async (src) => {
          const rawUrl = src.url.trim();
          const probe = await this.probeDirectMediaUrl({
            url: rawUrl,
            referer: refererForCdn,
            origin: "",
            expectedKind: "video",
            sendUserAgent: true,
            signal
          });
          if (!probe.ok) return null;
          return {
            streamUrl: probe.finalUrl || rawUrl,
            streamKind: probe.kind,
            audioLabel: languageLabel,
            langCode,
            languageLabel,
            posterUrl: null,
            referer: probe.sendReferer ? refererForCdn : "",
            origin: "",
            sendReferer: probe.sendReferer,
            sendUserAgent: true,
            sourceKind: "abyss"
          };
        })
      );
      return probed.filter((c) => c !== null);
    } catch {
      return [];
    }
  }
  async extractNovelasCdnOrFshdFromUrl(pageUrl, signal) {
    let parsed;
    try {
      parsed = new URL(pageUrl);
    } catch {
      return [];
    }
    const host = parsed.origin;
    const isTv = /\/serie\//i.test(parsed.pathname);
    const mediaType = isTv ? "tv" : "movie";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8e3);
    const onParentAbort = () => controller.abort();
    signal?.addEventListener("abort", onParentAbort, { once: true });
    try {
      const pageRes = await fetch(pageUrl, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": DESKTOP_CHROME_UA,
          Accept: "text/html,application/xhtml+xml,*/*",
          Referer: `${host}/`
        }
      });
      if (!pageRes.ok) return [];
      const html = await pageRes.text();
      if (!html || isCloudflareChallengeHtml(html, pageRes.status)) return [];
      const { contentId, inlineMovieOptions } = parseNovelasCdnOrFshdHtml(html, mediaType);
      if (!contentId) return [];
      let rawOptions = [];
      if (isTv) {
        const optRes = await fetch(`${host}/api/options`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "User-Agent": DESKTOP_CHROME_UA,
            "Content-Type": "application/json",
            Accept: "application/json",
            Origin: host,
            Referer: pageUrl
          },
          body: JSON.stringify({ content_id: contentId, content_type: 2 })
        }).catch(() => null);
        if (optRes?.ok) {
          const optJson = await optRes.json().catch(() => null);
          if (Array.isArray(optJson?.options)) {
            rawOptions = optJson.options;
          }
        }
        if (rawOptions.length === 0) {
          rawOptions = [{ ID: contentId, type: 1 }];
        }
      } else {
        rawOptions = inlineMovieOptions.map((o) => ({ ID: o.id, type: o.type }));
      }
      const optionsByType = /* @__PURE__ */ new Map();
      for (const opt of rawOptions) {
        const vid = Number(opt.ID ?? opt.id ?? 0);
        const optType = Number(opt.type ?? 1);
        if (vid <= 0) continue;
        const list = optionsByType.get(optType) || [];
        if (list.length < 2 && !list.includes(vid)) {
          list.push(vid);
          optionsByType.set(optType, list);
        }
      }
      const optionPairs = [];
      for (const [optType, vids] of optionsByType.entries()) {
        for (const vid of vids) {
          optionPairs.push([optType, vid]);
          if (optionPairs.length >= 4) break;
        }
        if (optionPairs.length >= 4) break;
      }
      if (optionPairs.length === 0) return [];
      const resolved = await Promise.all(
        optionPairs.map(async ([optType, videoId]) => {
          try {
            const pRes = await fetch(`${host}/api/players`, {
              method: "POST",
              signal: controller.signal,
              headers: {
                "User-Agent": DESKTOP_CHROME_UA,
                "Content-Type": "application/json",
                Accept: "application/json",
                Origin: host,
                Referer: pageUrl
              },
              body: JSON.stringify({
                content_info: contentId,
                content_type: isTv ? "2" : "1",
                video_id: videoId
              })
            });
            if (!pRes.ok) return [];
            const pJson = await pRes.json().catch(() => null);
            const videoWrapperUrl = (pJson?.video_url || "").trim();
            if (!/^https?:\/\//i.test(videoWrapperUrl)) return [];
            const vRes = await fetch(videoWrapperUrl, {
              redirect: "follow",
              signal: controller.signal,
              headers: {
                "User-Agent": DESKTOP_CHROME_UA,
                Referer: `${host}/`
              }
            });
            if (!vRes.ok) return [];
            const vHtml = await vRes.text();
            const redirMatch = vHtml.match(/window\.location\.href\s*=\s*["']([^"']+)["']/);
            const playerPageUrl = redirMatch?.[1]?.trim() || vRes.url;
            if (!/^https?:\/\//i.test(playerPageUrl)) return [];
            let playerParsed;
            try {
              playerParsed = new URL(playerPageUrl);
            } catch {
              return [];
            }
            if (!isSafePublicHost(playerParsed.hostname) || /(?:uns\.bio|32891098\.xyz)/i.test(playerParsed.hostname)) {
              return [];
            }
            if (/(?:abyssplayer|playhydrax)/i.test(playerParsed.hostname)) {
              return this.extractAbyssPlayHydraxCandidates(
                playerPageUrl,
                `${host}/`,
                optType,
                controller.signal
              );
            }
            const playerPageRes = await fetch(playerPageUrl, {
              redirect: "follow",
              signal: controller.signal,
              headers: {
                "User-Agent": DESKTOP_CHROME_UA,
                Referer: `${host}/`
              }
            });
            if (!playerPageRes.ok) return [];
            const playerHtml = await playerPageRes.text();
            if (isCloudflareChallengeHtml(playerHtml, playerPageRes.status)) return [];
            const unpackedHls = unpackFirePlayerScript(playerHtml, playerPageRes.url || playerPageUrl);
            const fallbackExtracted = unpackedHls || extractPlayableStreamsFromBody(playerHtml, playerPageRes.url || playerPageUrl)[0]?.streamUrl;
            if (!fallbackExtracted || !/^https?:\/\//i.test(fallbackExtracted)) return [];
            const playerOrigin = new URL(playerPageRes.url || playerPageUrl).origin;
            const probe = await this.probeDirectMediaUrl({
              url: fallbackExtracted,
              referer: `${playerOrigin}/`,
              origin: playerOrigin,
              expectedKind: "hls",
              sendUserAgent: true,
              signal: controller.signal
            });
            if (!probe.ok) return [];
            const isSub = optType === 2;
            const languageLabel = isSub ? "Legendado (PT-BR)" : "Dublado (PT-BR)";
            const langCode = isSub ? "pt-sub" : "pt-br";
            return [
              {
                streamUrl: probe.finalUrl || fallbackExtracted,
                streamKind: probe.kind,
                audioLabel: languageLabel,
                langCode,
                languageLabel,
                posterUrl: null,
                referer: probe.sendReferer ? `${playerOrigin}/` : "",
                origin: probe.sendReferer ? playerOrigin : "",
                sendReferer: probe.sendReferer,
                sendUserAgent: true,
                sourceKind: "novelascdn"
              }
            ];
          } catch {
            return [];
          }
        })
      );
      return resolved.flat();
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onParentAbort);
    }
  }
  async extractNovelasCdnAndFshdStreams(params) {
    const cleanImdb = params.imdbId && /^tt\d{5,12}$/i.test(params.imdbId.trim()) ? params.imdbId.trim() : null;
    const validTmdb = params.tmdbId > 0 ? params.tmdbId : 0;
    if (!validTmdb && !cleanImdb) return [];
    const tasks = [];
    if (validTmdb > 0) {
      const tmdbSuffix = params.mediaType === "tv" ? `/serie/${validTmdb}/${params.season ?? 1}/${params.episode ?? 1}` : `/filme/${validTmdb}`;
      tasks.push(
        this.extractNovelasCdnOrFshdFromUrl(`https://novelascdn.link${tmdbSuffix}`, params.signal),
        this.extractNovelasCdnOrFshdFromUrl(`https://fshd.link${tmdbSuffix}`, params.signal)
      );
    }
    if (cleanImdb) {
      const imdbSuffix = params.mediaType === "tv" ? `/serie/${cleanImdb}/${params.season ?? 1}/${params.episode ?? 1}` : `/filme/${cleanImdb}`;
      tasks.push(
        this.extractNovelasCdnOrFshdFromUrl(`https://fshd.link${imdbSuffix}`, params.signal),
        this.extractNovelasCdnOrFshdFromUrl(`https://novelascdn.link${imdbSuffix}`, params.signal)
      );
    }
    const batches = await Promise.all(tasks);
    return batches.flat();
  }
  async getHexaCapToken(signal) {
    if (this.hexaCapCache && this.hexaCapCache.usesLeft > 0 && this.hexaCapCache.expiresAt > Date.now()) {
      this.hexaCapCache.usesLeft -= 1;
      return this.hexaCapCache.token;
    }
    const chHeaders = {
      "Accept-Language": "en-US,en;q=0.9",
      Origin: "https://hexa.su",
      Referer: "https://hexa.su/",
      "User-Agent": DESKTOP_CHROME_UA
    };
    try {
      const chRes = await fetch("https://cap.hexa.su/15d2cf0395/challenge", {
        method: "POST",
        signal,
        headers: chHeaders
      });
      if (!chRes.ok) return null;
      const challengeData = await chRes.json().catch(() => null);
      if (!challengeData) return null;
      const encRes = await fetch("https://enc-dec.app/api/enc-hexa", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", "User-Agent": DESKTOP_CHROME_UA },
        body: JSON.stringify({ challenge_data: challengeData })
      });
      if (!encRes.ok) return null;
      const encJson = await encRes.json().catch(() => null);
      if (!encJson?.result) return null;
      const redeemRes = await fetch("https://cap.hexa.su/15d2cf0395/redeem", {
        method: "POST",
        signal,
        headers: { ...chHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(encJson.result)
      });
      if (!redeemRes.ok) return null;
      const redeemJson = await redeemRes.json().catch(() => null);
      const token = typeof redeemJson?.token === "string" ? redeemJson.token.trim() : "";
      if (!token) return null;
      this.hexaCapCache = {
        token,
        usesLeft: 16,
        expiresAt: Date.now() + 2 * 6e4
      };
      return token;
    } catch {
      return null;
    }
  }
  async extractHexaStreams(params) {
    if (!params.tmdbId || params.tmdbId <= 0) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener("abort", onParentAbort, { once: true });
    try {
      const capToken = await this.getHexaCapToken(controller.signal);
      if (!capToken) return [];
      const key = crypto.randomBytes(32).toString("hex");
      const apiPath = params.mediaType === "tv" ? `https://theemoviedb.hexa.su/api/tmdb/tv/${params.tmdbId}/season/${params.season ?? 1}/episode/${params.episode ?? 1}/images` : `https://theemoviedb.hexa.su/api/tmdb/movie/${params.tmdbId}/images`;
      const apiRes = await fetch(apiPath, {
        signal: controller.signal,
        headers: {
          "User-Agent": DESKTOP_CHROME_UA,
          Referer: "https://hexa.su/",
          Accept: "text/plain",
          "X-Fingerprint-Lite": "e9136c41504646444",
          "X-Cap-Token": capToken,
          "X-Api-Key": key
        }
      });
      if (!apiRes.ok) {
        if (apiRes.status === 401 || apiRes.status === 403) {
          this.hexaCapCache = null;
        }
        return [];
      }
      const cipherText = await apiRes.text();
      if (!cipherText || cipherText.length < 16) return [];
      const decRes = await fetch("https://enc-dec.app/api/dec-hexa", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "User-Agent": DESKTOP_CHROME_UA },
        body: JSON.stringify({ text: cipherText, key })
      });
      if (!decRes.ok) return [];
      const decJson = await decRes.json().catch(() => null);
      const rawSources = Array.isArray(decJson?.result?.sources) ? decJson.result.sources : [];
      const probed = await Promise.all(
        rawSources.filter((s) => typeof s?.url === "string" && /^https?:\/\//i.test(s.url)).slice(0, 4).map(async (src) => {
          const url = src.url.trim();
          const probe = await this.probeDirectMediaUrl({
            url,
            referer: "https://hexa.su/",
            origin: "https://hexa.su",
            expectedKind: /\.mp4(?:$|[?#])/i.test(url) ? "video" : "hls",
            sendUserAgent: true,
            signal: controller.signal
          });
          if (!probe.ok) return null;
          return {
            streamUrl: probe.finalUrl || url,
            streamKind: probe.kind,
            audioLabel: "Ingl\xEAs / Original",
            langCode: "en-us",
            languageLabel: "Ingl\xEAs / Original",
            posterUrl: null,
            referer: probe.sendReferer ? "https://hexa.su/" : "",
            origin: probe.sendReferer ? "https://hexa.su" : "",
            sendReferer: probe.sendReferer,
            sendUserAgent: true,
            sourceKind: "hexa"
          };
        })
      );
      return probed.filter((c) => c !== null).slice(0, 2);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener("abort", onParentAbort);
    }
  }
  async extractVidUpStreams(params) {
    if (!params.tmdbId || params.tmdbId <= 0) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7e3);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener("abort", onParentAbort, { once: true });
    try {
      const pageUrl = params.mediaType === "tv" ? `https://vidup.to/tv/${params.tmdbId}/${params.season ?? 1}/${params.episode ?? 1}/` : `https://vidup.to/movie/${params.tmdbId}/`;
      const pageRes = await fetch(pageUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": DESKTOP_CHROME_UA,
          Accept: "text/html,application/xhtml+xml,*/*"
        }
      });
      if (!pageRes.ok) return [];
      const html = await pageRes.text();
      const tokenMatch = html.match(/\\"(?:en|token)\\":\\"(.*?)\\"/);
      const rawEn = tokenMatch?.[1]?.trim() || "";
      if (!rawEn) return [];
      const s1Res = await fetch(
        `https://enc-dec.app/api/enc-vidup?text=${encodeURIComponent(rawEn)}&stage=1`,
        {
          signal: controller.signal,
          headers: { "User-Agent": DESKTOP_CHROME_UA, Accept: "application/json" }
        }
      );
      if (!s1Res.ok) return [];
      const s1Json = await s1Res.json().catch(() => null);
      const stage1Url = s1Json?.result?.stage1 || "";
      const csrf1 = s1Json?.result?.token || "";
      if (!/^https?:\/\//i.test(stage1Url) || !csrf1) return [];
      const t1Res = await fetch(stage1Url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Referer: "https://vidup.to/",
          Origin: "https://vidup.to",
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRF-Token": csrf1,
          "User-Agent": DESKTOP_CHROME_UA
        }
      });
      if (!t1Res.ok) return [];
      const t1Text = (await t1Res.text()).trim();
      if (!t1Text) return [];
      const s2Res = await fetch(
        `https://enc-dec.app/api/enc-vidup?text=${encodeURIComponent(t1Text)}&stage=2`,
        {
          signal: controller.signal,
          headers: { "User-Agent": DESKTOP_CHROME_UA, Accept: "application/json" }
        }
      );
      if (!s2Res.ok) return [];
      const s2Json = await s2Res.json().catch(() => null);
      const serversUrl = s2Json?.result?.servers || "";
      const streamBase = s2Json?.result?.stream || "";
      const csrf2 = s2Json?.result?.token || "";
      if (!/^https?:\/\//i.test(serversUrl) || !/^https?:\/\//i.test(streamBase) || !csrf2) {
        return [];
      }
      const srvRes = await fetch(serversUrl, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Referer: "https://vidup.to/",
          Origin: "https://vidup.to",
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRF-Token": csrf2,
          "User-Agent": DESKTOP_CHROME_UA
        }
      });
      if (!srvRes.ok) return [];
      const srvCipher = await srvRes.text();
      if (!srvCipher) return [];
      const srvDecRes = await fetch("https://enc-dec.app/api/dec-vidup", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "User-Agent": DESKTOP_CHROME_UA },
        body: JSON.stringify({ text: srvCipher })
      });
      if (!srvDecRes.ok) return [];
      const srvDecJson = await srvDecRes.json().catch(() => null);
      const servers = Array.isArray(srvDecJson?.result) ? srvDecJson.result : [];
      if (servers.length === 0) return [];
      const probed = await Promise.all(
        servers.filter((s) => typeof s?.data === "string" && s.data.length > 0).slice(0, 4).map(async (srv) => {
          try {
            const stRes = await fetch(`${streamBase}/${srv.data}`, {
              method: "POST",
              signal: controller.signal,
              headers: {
                Referer: "https://vidup.to/",
                Origin: "https://vidup.to",
                "X-Requested-With": "XMLHttpRequest",
                "X-CSRF-Token": csrf2,
                "User-Agent": DESKTOP_CHROME_UA
              }
            });
            if (!stRes.ok) return null;
            const stCipher = await stRes.text();
            if (!stCipher) return null;
            const stDecRes = await fetch("https://enc-dec.app/api/dec-vidup", {
              method: "POST",
              signal: controller.signal,
              headers: { "Content-Type": "application/json", "User-Agent": DESKTOP_CHROME_UA },
              body: JSON.stringify({ text: stCipher })
            });
            if (!stDecRes.ok) return null;
            const stDecJson = await stDecRes.json().catch(() => null);
            const streamUrl = (stDecJson?.result?.url || "").trim();
            if (!/^https?:\/\//i.test(streamUrl)) return null;
            const probe = await this.probeDirectMediaUrl({
              url: streamUrl,
              referer: "https://vidup.to/",
              origin: "https://vidup.to",
              expectedKind: /\.mp4(?:$|[?#])/i.test(streamUrl) ? "video" : "hls",
              sendUserAgent: true,
              signal: controller.signal
            });
            if (!probe.ok) return null;
            return {
              streamUrl: probe.finalUrl || streamUrl,
              streamKind: probe.kind,
              audioLabel: "Ingl\xEAs / Original",
              langCode: "en-us",
              languageLabel: "Ingl\xEAs / Original",
              posterUrl: null,
              referer: probe.sendReferer ? "https://vidup.to/" : "",
              origin: probe.sendReferer ? "https://vidup.to" : "",
              sendReferer: probe.sendReferer,
              sendUserAgent: true,
              sourceKind: "vidup"
            };
          } catch {
            return null;
          }
        })
      );
      return probed.filter((c) => c !== null).slice(0, 2);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener("abort", onParentAbort);
    }
  }
  async extractMeowTvStreams(params) {
    if (!params.tmdbId || params.tmdbId <= 0) {
      return { candidates: [], captions: [] };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener("abort", onParentAbort, { once: true });
    try {
      const mediaPath = params.mediaType === "tv" ? `tv/${params.tmdbId}/${params.season ?? 1}/${params.episode ?? 1}` : `movie/${params.tmdbId}`;
      const servers = ["english", "acme", "dcloud", "tik", "hindi"];
      const subsPromise = fetch(`https://api.meowtv.ru/subs/${mediaPath}`, {
        signal: controller.signal,
        headers: {
          "User-Agent": DESKTOP_CHROME_UA,
          Origin: "https://meowtv.ru",
          Referer: "https://meowtv.ru/",
          Accept: "application/json"
        }
      }).then(async (r) => {
        if (!r.ok) return [];
        const arr = await r.json().catch(() => null);
        if (!Array.isArray(arr)) return [];
        return arr.filter((s) => typeof s?.file === "string" && typeof s?.label === "string").map((s) => ({ url: s.file.trim(), lang: s.label.trim() })).filter((s) => isAllowedSubtitleHost(s.url));
      }).catch(() => []);
      const fetchSingleMeowServer = async (srv) => {
        try {
          const ticketRes = await fetch("https://api.meowtv.ru/streams/ticket", {
            method: "POST",
            signal: controller.signal,
            headers: {
              "User-Agent": DESKTOP_CHROME_UA,
              Origin: "https://meowtv.ru",
              Referer: "https://meowtv.ru/",
              Accept: "application/json"
            }
          });
          if (!ticketRes.ok) return null;
          const ticketJson = await ticketRes.json().catch(() => null);
          const ticket = typeof ticketJson?.ticket === "string" ? ticketJson.ticket.trim() : "";
          if (!ticket) return null;
          const streamRes = await fetch(
            `https://api.meowtv.ru/streams/${mediaPath}?s=${encodeURIComponent(srv)}`,
            {
              signal: controller.signal,
              headers: {
                "User-Agent": DESKTOP_CHROME_UA,
                Origin: "https://meowtv.ru",
                Referer: "https://meowtv.ru/",
                "X-Stream-Ticket": ticket,
                Accept: "application/json"
              }
            }
          );
          if (!streamRes.ok) return null;
          const encryptedJson = await streamRes.json().catch(() => null);
          if (!encryptedJson || typeof encryptedJson !== "object") return null;
          const decRes = await fetch("https://enc-dec.app/api/dec-meowtv", {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              "User-Agent": DESKTOP_CHROME_UA
            },
            body: JSON.stringify({ data: encryptedJson })
          });
          if (!decRes.ok) return null;
          const decJson = await decRes.json().catch(() => null);
          const streamUrl = (decJson?.result?.url || "").trim();
          if (!/^https?:\/\//i.test(streamUrl)) return null;
          const rawHeaders = decJson?.result?.headers || {};
          const customReferer = rawHeaders.Referer || rawHeaders.referer || "";
          const customOrigin = rawHeaders.Origin || rawHeaders.origin || (customReferer ? new URL(customReferer).origin : "");
          const probe = await this.probeDirectMediaUrl({
            url: streamUrl,
            referer: customReferer,
            origin: customOrigin,
            expectedKind: /\.mp4(?:$|[?#])/i.test(streamUrl) ? "video" : "hls",
            sendUserAgent: true,
            signal: controller.signal
          });
          if (!probe.ok) return null;
          const rawLang = (decJson?.result?.language || srv || "english").trim();
          const meta = getCustomSourceLangMeta(rawLang);
          const resolvedLangCode = meta.langCode === "auto" ? "en-us" : meta.langCode;
          const resolvedLangLabel = meta.langCode === "auto" ? "Ingl\xEAs / Original" : meta.label;
          return {
            streamUrl: probe.finalUrl || streamUrl,
            streamKind: probe.kind,
            audioLabel: resolvedLangLabel,
            langCode: resolvedLangCode,
            languageLabel: resolvedLangLabel,
            posterUrl: null,
            referer: probe.sendReferer ? customReferer : "",
            origin: probe.sendReferer ? customOrigin : "",
            sendReferer: probe.sendReferer && Boolean(customReferer),
            sendUserAgent: true,
            sourceKind: "meowtv"
          };
        } catch {
          return null;
        }
      };
      const [captions, settledServers] = await Promise.all([
        subsPromise,
        Promise.all(servers.map((srv) => fetchSingleMeowServer(srv)))
      ]);
      return {
        captions,
        candidates: settledServers.filter((c) => c !== null)
      };
    } catch {
      return { candidates: [], captions: [] };
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener("abort", onParentAbort);
    }
  }
  async extractMegaPlayAnimeStreams(params) {
    const isAnimeCandidate = params.originalLanguage === "ja" || Boolean(params.genreIds?.includes(16));
    const searchTitle = (params.originalTitle || params.title || "").trim();
    if (!isAnimeCandidate || !searchTitle) {
      return { candidates: [], captions: [] };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener("abort", onParentAbort, { once: true });
    try {
      const gqlQuery = `
        query ($search: String) {
          Page(page: 1, perPage: 5) {
            media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
              id
              idMal
              title { romaji english native }
              synonyms
            }
          }
        }
      `;
      const aniRes = await fetch("https://graphql.anilist.co", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": DESKTOP_CHROME_UA
        },
        body: JSON.stringify({
          query: gqlQuery,
          variables: { search: params.title || searchTitle }
        })
      });
      if (!aniRes.ok) return { candidates: [], captions: [] };
      const aniJson = await aniRes.json().catch(() => null);
      const mediaList = aniJson?.data?.Page?.media || [];
      if (mediaList.length === 0) return { candidates: [], captions: [] };
      const targetNorms = [params.title, params.originalTitle].map((t) => normalizeMediaSearchText(t || "")).filter(Boolean);
      const bestMatch = mediaList.find((m) => {
        const candidates = [
          m.title?.english,
          m.title?.romaji,
          m.title?.native,
          ...m.synonyms || []
        ].map((t) => normalizeMediaSearchText(t || "")).filter(Boolean);
        return targetNorms.some(
          (tn) => candidates.some((cn) => cn === tn || cn.includes(tn) || tn.includes(cn))
        );
      });
      if (!bestMatch || !bestMatch.idMal && !bestMatch.id) {
        return { candidates: [], captions: [] };
      }
      const ep = params.mediaType === "tv" ? params.episode ?? 1 : 1;
      const basePath = bestMatch.idMal ? `mal/${bestMatch.idMal}` : `ani/${bestMatch.id}`;
      const captions = [];
      const fetchVoiceType = async (voiceType) => {
        try {
          const embedRes = await fetch(
            `https://megaplay.buzz/stream/${basePath}/${ep}/${voiceType}`,
            {
              signal: controller.signal,
              headers: {
                "User-Agent": DESKTOP_CHROME_UA,
                Referer: "https://megaplay.buzz/"
              }
            }
          );
          if (!embedRes.ok) return null;
          const html = await embedRes.text();
          const cidMatch = html.match(/<title>(?:File\s+(\d+)|Error)\s*-\s*MegaPlay<\/title>/i);
          const cid = cidMatch?.[1];
          if (!cid) return null;
          const srcRes = await fetch(
            `https://megaplay.buzz/stream/getSources?id=${encodeURIComponent(cid)}&platform=OTHER`,
            {
              signal: controller.signal,
              headers: {
                "User-Agent": DESKTOP_CHROME_UA,
                Referer: "https://megaplay.buzz/",
                "X-Requested-With": "XMLHttpRequest",
                Accept: "application/json"
              }
            }
          );
          if (!srcRes.ok) return null;
          const srcJson = await srcRes.json().catch(() => null);
          if (Array.isArray(srcJson?.tracks)) {
            for (const tr of srcJson.tracks) {
              if (tr?.kind !== "thumbnails" && tr?.file && tr?.label && isAllowedSubtitleHost(tr.file)) {
                captions.push({ url: tr.file.trim(), lang: tr.label.trim() });
              }
            }
          }
          if (!srcJson?.enc) return null;
          const decRes = await fetch("https://enc-dec.app/api/dec-megaplay", {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              "User-Agent": DESKTOP_CHROME_UA
            },
            body: JSON.stringify({ text: srcJson.enc })
          });
          if (!decRes.ok) return null;
          const decJson = await decRes.json().catch(() => null);
          const m3u8Url = (decJson?.result?.file || "").trim();
          if (!/^https?:\/\//i.test(m3u8Url)) return null;
          const probe = await this.probeDirectMediaUrl({
            url: m3u8Url,
            referer: "https://megaplay.buzz/",
            origin: "https://megaplay.buzz",
            expectedKind: "hls",
            sendUserAgent: true,
            signal: controller.signal
          });
          if (!probe.ok) return null;
          const isDub = voiceType === "dub";
          return {
            streamUrl: probe.finalUrl || m3u8Url,
            streamKind: "hls",
            audioLabel: isDub ? "Ingl\xEAs" : "Japon\xEAs (Original)",
            langCode: isDub ? "en-us" : "ja",
            languageLabel: isDub ? "Ingl\xEAs" : "Japon\xEAs (Original)",
            posterUrl: null,
            referer: probe.sendReferer ? "https://megaplay.buzz/" : "",
            origin: probe.sendReferer ? "https://megaplay.buzz" : "",
            sendReferer: probe.sendReferer,
            sendUserAgent: true,
            sourceKind: "megaplay"
          };
        } catch {
          return null;
        }
      };
      const settled = await Promise.all([fetchVoiceType("sub"), fetchVoiceType("dub")]);
      return {
        captions,
        candidates: settled.filter((c) => c !== null)
      };
    } catch {
      return { candidates: [], captions: [] };
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener("abort", onParentAbort);
    }
  }
  async extractFreeApiAnimeStreams(params) {
    const isAnimeCandidate = params.forceAnime || params.originalLanguage === "ja" || Boolean(params.genreIds?.includes(16));
    const searchTitle = (params.originalTitle || params.title || params.ptTitle || "").trim();
    if (!isAnimeCandidate || !searchTitle) {
      return { candidates: [], captions: [] };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener("abort", onParentAbort, { once: true });
    try {
      const anilistId = await FreeApiProService.resolveBestAnimeId({
        title: params.title,
        originalTitle: params.originalTitle,
        ptTitle: params.ptTitle,
        releaseYear: params.releaseYear,
        mediaType: params.mediaType,
        signal: controller.signal
      });
      if (!anilistId) return { candidates: [], captions: [] };
      const ep = params.mediaType === "tv" ? params.episode ?? 1 : 1;
      const captions = [];
      const seenCapUrls = /* @__PURE__ */ new Set();
      const resolveVoice = async (voiceType) => {
        for (const server of ["kira", "naoka"]) {
          const payload = await FreeApiProService.fetchAnimeStream({
            anilistId,
            episode: ep,
            voiceType,
            server,
            signal: controller.signal
          });
          if (!payload) continue;
          for (const tr of payload.tracks) {
            if (!seenCapUrls.has(tr.url) && isAllowedSubtitleHost(tr.url)) {
              seenCapUrls.add(tr.url);
              captions.push(tr);
            }
          }
          const probe = await this.probeDirectMediaUrl({
            url: payload.m3u8Url,
            referer: "https://freeapi.pro/",
            origin: "https://freeapi.pro",
            expectedKind: "hls",
            sendUserAgent: true,
            signal: controller.signal
          });
          if (!probe.ok) continue;
          const isDub = voiceType === "dub";
          return {
            streamUrl: probe.finalUrl || payload.m3u8Url,
            streamKind: "hls",
            audioLabel: isDub ? "Ingl\xEAs" : "Japon\xEAs (Original)",
            langCode: isDub ? "en-us" : "ja",
            languageLabel: isDub ? "Ingl\xEAs" : "Japon\xEAs (Original)",
            posterUrl: null,
            referer: probe.sendReferer ? "https://freeapi.pro/" : "",
            origin: probe.sendReferer ? "https://freeapi.pro" : "",
            sendReferer: probe.sendReferer,
            sendUserAgent: true,
            sourceKind: "freeapi"
          };
        }
        return null;
      };
      const settled = await Promise.all([resolveVoice("sub"), resolveVoice("dub")]);
      return {
        captions,
        candidates: settled.filter((c) => c !== null)
      };
    } catch {
      return { candidates: [], captions: [] };
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener("abort", onParentAbort);
    }
  }
  collectTitleVariants(params) {
    const raw = [params.ptTitle, params.title, params.originalTitle];
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const item of raw) {
      const clean = (item || "").trim();
      const norm = normalizeMediaSearchText(clean);
      if (!clean || !norm || seen.has(norm)) continue;
      seen.add(norm);
      out.push(clean);
    }
    return out;
  }
  async extractArchiveOrgOpenStreams(params) {
    const titleVariants = this.collectTitleVariants(params);
    if (titleVariants.length === 0) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener("abort", onParentAbort, { once: true });
    try {
      const searchClauses = [];
      const seenClause = /* @__PURE__ */ new Set();
      const pushClause = (phrase) => {
        const sanitized = phrase.replace(/["()]/g, " ").replace(/\s+/g, " ").trim();
        if (sanitized.length < 3 || seenClause.has(sanitized.toLowerCase())) return;
        seenClause.add(sanitized.toLowerCase());
        searchClauses.push(`title:("${sanitized}")`);
      };
      for (const variant of titleVariants) {
        pushClause(variant);
        const unaccented = variant.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        pushClause(unaccented);
        const words = variant.replace(/[,:!?.]/g, " ").trim().split(/\s+/).filter(Boolean);
        if (words.length >= 4) {
          pushClause(words.slice(0, 3).join(" "));
        }
      }
      const query = `mediatype:(movies) AND (${searchClauses.slice(0, 6).join(" OR ")})`;
      const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier,title,description,language,subject,year,downloads&sort[]=downloads+desc&rows=20&output=json`;
      const seasonNum = params.season ?? 1;
      const tvTargetedUrl = params.mediaType === "tv" ? `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
        `mediatype:(movies) AND (${searchClauses.slice(0, 4).join(" OR ")}) AND (temporada OR season OR paixaoflix OR "S${String(seasonNum).padStart(2, "0")}" OR "temp")`
      )}&fl[]=identifier,title,description,language,subject,year,downloads&sort[]=downloads+desc&rows=20&output=json` : null;
      const [searchRes, tvTargetedRes, paixaoMovieFilesRes] = await Promise.all([
        fetch(searchUrl, {
          signal: controller.signal,
          headers: { "User-Agent": DESKTOP_CHROME_UA, Accept: "application/json" }
        }).catch(() => null),
        tvTargetedUrl ? fetch(tvTargetedUrl, {
          signal: controller.signal,
          headers: { "User-Agent": DESKTOP_CHROME_UA, Accept: "application/json" }
        }).catch(() => null) : Promise.resolve(null),
        params.mediaType === "movie" && params.tmdbId > 0 ? fetch(`https://archive.org/metadata/paixaoflix-cinema-${params.tmdbId}/files`, {
          signal: controller.signal,
          headers: { "User-Agent": DESKTOP_CHROME_UA, Accept: "application/json" }
        }).catch(() => null) : Promise.resolve(null)
      ]);
      const out = [];
      if (paixaoMovieFilesRes?.ok) {
        const filesJson = await paixaoMovieFilesRes.json().catch(() => null);
        const picked = matchArchiveEpisodeFile(filesJson?.result || [], {
          mediaType: "movie",
          docIdentifier: `paixaoflix-cinema-${params.tmdbId}`
        });
        if (picked?.name) {
          const mp4Url = `https://archive.org/download/paixaoflix-cinema-${params.tmdbId}/${encodeURIComponent(picked.name)}`;
          const probe = await this.probeDirectMediaUrl({
            url: mp4Url,
            referer: "",
            origin: "",
            expectedKind: "video",
            sendUserAgent: true,
            signal: controller.signal
          });
          if (probe.ok) {
            out.push({
              streamUrl: probe.finalUrl || mp4Url,
              streamKind: "video",
              audioLabel: "Dublado (PT-BR)",
              langCode: "pt-br",
              languageLabel: "Dublado (PT-BR)",
              posterUrl: null,
              referer: "",
              origin: "",
              sendReferer: false,
              sendUserAgent: true,
              sourceKind: "archive"
            });
          }
        }
      }
      const docsById = /* @__PURE__ */ new Map();
      for (const r of [tvTargetedRes, searchRes]) {
        if (!r?.ok) continue;
        const j = await r.json().catch(() => null);
        for (const doc of j?.response?.docs || []) {
          if (doc?.identifier && !docsById.has(doc.identifier)) {
            docsById.set(doc.identifier, doc);
          }
        }
      }
      if (docsById.size > 0) {
        const docs = Array.from(docsById.values());
        const scoredDocs = docs.map((doc) => ({
          doc,
          score: scoreArchiveSearchDoc(doc, {
            titles: titleVariants,
            releaseYear: params.releaseYear,
            mediaType: params.mediaType,
            season: params.season,
            preferPortuguese: true
          }),
          lang: detectArchiveDocLanguage(doc)
        })).filter((item) => item.score > 0 && item.doc.identifier).sort((a, b) => b.score - a.score);
        const selectedDocs = [];
        let ptCount = 0;
        let otherCount = 0;
        for (const item of scoredDocs) {
          if (item.lang.langCode === "pt-br") {
            if (ptCount < 4) {
              selectedDocs.push(item);
              ptCount += 1;
            }
          } else if (otherCount < 3) {
            selectedDocs.push(item);
            otherCount += 1;
          }
          if (selectedDocs.length >= 6) break;
        }
        const resolvedDocs = await Promise.all(
          selectedDocs.map(async ({ doc, lang }) => {
            const identifier = (doc.identifier || "").trim();
            if (!identifier) return null;
            try {
              const fRes = await fetch(
                `https://archive.org/metadata/${encodeURIComponent(identifier)}/files`,
                {
                  signal: controller.signal,
                  headers: { "User-Agent": DESKTOP_CHROME_UA, Accept: "application/json" }
                }
              );
              if (!fRes.ok) return null;
              const fJson = await fRes.json().catch(() => null);
              const docTitleStr = Array.isArray(doc.title) ? doc.title.join(" ") : doc.title || "";
              const matched = matchArchiveEpisodeFile(fJson?.result || [], {
                mediaType: params.mediaType,
                season: params.season,
                episode: params.episode,
                docTitle: docTitleStr,
                docIdentifier: identifier
              });
              if (!matched?.name) return null;
              const fileUrl = `https://archive.org/download/${encodeURIComponent(identifier)}/${matched.name.split("/").map((seg) => encodeURIComponent(seg)).join("/")}`;
              const probe = await this.probeDirectMediaUrl({
                url: fileUrl,
                referer: "",
                origin: "",
                expectedKind: "video",
                sendUserAgent: true,
                signal: controller.signal
              });
              if (!probe.ok) return null;
              const finalLangCode = lang.langCode === "auto" ? "en-us" : lang.langCode;
              const finalLangLabel = lang.langCode === "auto" ? "Ingl\xEAs / Original" : lang.languageLabel;
              return {
                streamUrl: probe.finalUrl || fileUrl,
                streamKind: "video",
                audioLabel: finalLangLabel,
                langCode: finalLangCode,
                languageLabel: finalLangLabel,
                posterUrl: null,
                referer: "",
                origin: "",
                sendReferer: false,
                sendUserAgent: true,
                sourceKind: "archive"
              };
            } catch {
              return null;
            }
          })
        );
        for (const item of resolvedDocs) {
          if (item) out.push(item);
        }
      }
      return out;
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener("abort", onParentAbort);
    }
  }
  async extractDailymotionOpenStreams(params) {
    const titleVariants = this.collectTitleVariants(params);
    if (titleVariants.length === 0) return [];
    const primaryPtTitle = (params.ptTitle || params.title || titleVariants[0]).trim();
    const globalTitle = (params.title || params.originalTitle || titleVariants[0]).trim();
    if (!primaryPtTitle && !globalTitle) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8500);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener("abort", onParentAbort, { once: true });
    try {
      const season = params.season ?? 1;
      const episode = params.episode ?? 1;
      const sPad = String(season).padStart(2, "0");
      const ePad = String(episode).padStart(2, "0");
      const searchTasks = params.mediaType === "tv" ? [
        ...season === 1 ? [
          { q: `${primaryPtTitle} Capitulo ${episode}`, langFilter: "pt" },
          { q: `${primaryPtTitle} Episodio ${episode}`, langFilter: "pt" },
          { q: `${primaryPtTitle} Cap ${episode}`, langFilter: "pt" }
        ] : [
          { q: `${primaryPtTitle} S${sPad}E${ePad}`, langFilter: "pt" },
          { q: `${primaryPtTitle} Temporada ${season} Episodio ${episode}`, langFilter: "pt" }
        ],
        { q: `${globalTitle} S${sPad}E${ePad}` },
        { q: `${globalTitle} Season ${season} Episode ${episode}` }
      ] : [
        { q: `${primaryPtTitle} completo dublado`, langFilter: "pt" },
        { q: `${globalTitle} full movie` }
      ];
      const searchResults = await Promise.all(
        searchTasks.map(async ({ q, langFilter }) => {
          const langQs = langFilter ? `&languages=${langFilter}` : "";
          const u = `https://api.dailymotion.com/videos?search=${encodeURIComponent(q)}&fields=id,title,duration,language,owner.screenname${langQs}&limit=15&sort=relevance`;
          const r = await fetch(u, {
            signal: controller.signal,
            headers: { "User-Agent": DESKTOP_CHROME_UA, Accept: "application/json" }
          }).catch(() => null);
          if (!r?.ok) return [];
          const j = await r.json().catch(() => null);
          return Array.isArray(j?.list) ? j.list : [];
        })
      );
      const mergedById = /* @__PURE__ */ new Map();
      for (const list of searchResults) {
        for (const item of list) {
          if (item?.id && !mergedById.has(item.id)) {
            mergedById.set(item.id, item);
          }
        }
      }
      const matched = selectBestDailymotionVideos(Array.from(mergedById.values()), {
        titles: titleVariants,
        releaseYear: params.releaseYear,
        mediaType: params.mediaType,
        season,
        episode
      });
      if (matched.length === 0) return [];
      const pickedByLang = /* @__PURE__ */ new Map();
      for (const vid of matched) {
        if (!pickedByLang.has(vid.langCode)) {
          pickedByLang.set(vid.langCode, vid);
        }
        if (pickedByLang.size >= 3) break;
      }
      const resolved = await Promise.all(
        Array.from(pickedByLang.values()).map(async (vid) => {
          try {
            const metaRes = await fetch(
              `https://www.dailymotion.com/player/metadata/video/${encodeURIComponent(vid.id)}`,
              {
                signal: controller.signal,
                headers: {
                  "User-Agent": DESKTOP_CHROME_UA,
                  Referer: "https://www.dailymotion.com/",
                  Accept: "application/json"
                }
              }
            );
            if (!metaRes.ok) return null;
            const metaJson = await metaRes.json().catch(() => null);
            const hlsUrl = metaJson?.qualities?.auto?.find((q) => typeof q?.url === "string")?.url?.trim();
            if (!hlsUrl || !/^https?:\/\//i.test(hlsUrl)) return null;
            const probe = await this.probeDirectMediaUrl({
              url: hlsUrl,
              referer: "https://www.dailymotion.com/",
              origin: "https://www.dailymotion.com",
              expectedKind: "hls",
              sendUserAgent: true,
              signal: controller.signal
            });
            if (!probe.ok) return null;
            const languageLabel = vid.langCode === "pt-br" ? "Dublado (PT-BR)" : vid.langCode === "es-es" ? "Espanhol" : "Ingl\xEAs / Original";
            return {
              streamUrl: probe.finalUrl || hlsUrl,
              streamKind: "hls",
              audioLabel: languageLabel,
              langCode: vid.langCode,
              languageLabel,
              posterUrl: metaJson?.posters?.["720"] || metaJson?.posters?.["480"] || null,
              referer: probe.sendReferer ? "https://www.dailymotion.com/" : "",
              origin: probe.sendReferer ? "https://www.dailymotion.com" : "",
              sendReferer: probe.sendReferer,
              sendUserAgent: true,
              sourceKind: "dailymotion"
            };
          } catch {
            return null;
          }
        })
      );
      return resolved.filter((c) => c !== null);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener("abort", onParentAbort);
    }
  }
  solveBysePowChallenge(captcha) {
    const prefix = captcha.prefix || captcha.challenge || captcha.salt || "";
    const difficulty = typeof captcha.difficulty === "number" && captcha.difficulty > 0 ? captcha.difficulty : 4;
    const targetPrefix = captcha.target || "0".repeat(Math.min(6, difficulty));
    for (let nonce = 0; nonce < 4e5; nonce++) {
      const digest = crypto.createHash("sha256").update(`${prefix}${nonce}`).digest("hex");
      if (digest.startsWith(targetPrefix)) {
        return nonce;
      }
    }
    return 0;
  }
  async extract0123MovieAndByseStreams(params) {
    if (!params.tmdbId || params.tmdbId <= 0) {
      return { candidates: [], captions: [] };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener("abort", onParentAbort, { once: true });
    const captions = [];
    const candidates = [];
    try {
      const imdbClean = params.imdbId && /^tt\d{5,12}$/i.test(params.imdbId) ? params.imdbId : "tt0000000";
      const redirectUrl = params.mediaType === "tv" ? `https://0123movie.space/pl/${params.tmdbId}/${params.season ?? 1}/${params.episode ?? 1}/` : `https://0123movie.space/mv/${imdbClean}/${params.tmdbId}/`;
      const redirRes = await fetch(redirectUrl, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": DESKTOP_CHROME_UA,
          Referer: "https://1hd.one/"
        }
      });
      const location = redirRes.headers.get("location") || "";
      if (!location || !/^https?:\/\//i.test(location)) {
        return { candidates, captions };
      }
      let parsedLoc;
      try {
        parsedLoc = new URL(location);
      } catch {
        return { candidates, captions };
      }
      const subInfoUrl = parsedLoc.searchParams.get("sub.info") || "";
      if (subInfoUrl && isAllowedSubtitleHost(subInfoUrl)) {
        try {
          const subRes = await fetch(subInfoUrl, {
            signal: controller.signal,
            headers: { "User-Agent": DESKTOP_CHROME_UA, Accept: "application/json" }
          });
          if (subRes.ok) {
            const subJson = await subRes.json().catch(() => null);
            if (Array.isArray(subJson)) {
              for (const s of subJson) {
                const u = (s?.file || s?.url || "").trim();
                const l = (s?.label || s?.lang || "").trim();
                if (u && l && isAllowedSubtitleHost(u)) {
                  captions.push({ url: u, lang: l });
                }
              }
            }
          }
        } catch {
        }
      }
      const byseMatch = location.match(/^(https?:\/\/[^/]+)\/[A-Za-z]\/([^/?#]+)/);
      if (!byseMatch) {
        return { candidates, captions };
      }
      const embedOrigin = byseMatch[1];
      const code = byseMatch[2];
      const byseHeaders = {
        "User-Agent": DESKTOP_CHROME_UA,
        Referer: location,
        Origin: embedOrigin,
        Accept: "application/json"
      };
      const detRes = await fetch(`${embedOrigin}/api/videos/${encodeURIComponent(code)}/details`, {
        signal: controller.signal,
        headers: byseHeaders
      }).catch(() => null);
      if (!detRes?.ok) {
        return { candidates, captions };
      }
      const detJson = await detRes.json().catch(() => null);
      const frameUrl = (detJson?.embed_frame_url || "").trim();
      if (!/^https?:\/\//i.test(frameUrl)) {
        return { candidates, captions };
      }
      const frameOrigin = new URL(frameUrl).origin;
      const frameHeaders = {
        "User-Agent": DESKTOP_CHROME_UA,
        Referer: frameUrl,
        Origin: frameOrigin,
        Accept: "application/json",
        "Content-Type": "application/json"
      };
      const chalRes = await fetch(`${frameOrigin}/api/videos/access/challenge`, {
        method: "POST",
        signal: controller.signal,
        headers: frameHeaders
      });
      if (!chalRes.ok) return { candidates, captions };
      const chalJson = await chalRes.json().catch(() => null);
      if (!chalJson) return { candidates, captions };
      const encChalRes = await fetch("https://enc-dec.app/api/enc-byse", {
        method: "POST",
        signal: controller.signal,
        headers: { "User-Agent": DESKTOP_CHROME_UA, "Content-Type": "application/json" },
        body: JSON.stringify({ data: chalJson })
      });
      if (!encChalRes.ok) return { candidates, captions };
      const encChalJson = await encChalRes.json().catch(() => null);
      if (!encChalJson?.result) return { candidates, captions };
      const attRes = await fetch(`${frameOrigin}/api/videos/access/attest`, {
        method: "POST",
        signal: controller.signal,
        headers: frameHeaders,
        body: JSON.stringify(encChalJson.result)
      });
      if (!attRes.ok) return { candidates, captions };
      const attest = await attRes.json().catch(() => null);
      if (!attest?.token || !attest.viewer_id || !attest.device_id) {
        return { candidates, captions };
      }
      const fingerprint = {
        fingerprint: {
          token: attest.token,
          viewer_id: attest.viewer_id,
          device_id: attest.device_id,
          confidence: attest.confidence ?? 1
        }
      };
      const authHeaders = {
        ...frameHeaders,
        "X-Embed-Parent": location,
        Cookie: `byse_viewer_id=${attest.viewer_id}; byse_device_id=${attest.device_id}`
      };
      const capRes = await fetch(`${frameOrigin}/api/videos/${encodeURIComponent(code)}/embed/captcha`, {
        method: "POST",
        signal: controller.signal,
        headers: authHeaders,
        body: JSON.stringify(fingerprint)
      });
      if (!capRes.ok) return { candidates, captions };
      const captcha = await capRes.json().catch(() => null);
      if (!captcha?.pow_token) return { candidates, captions };
      const solution = this.solveBysePowChallenge(captcha);
      const verRes = await fetch(`${frameOrigin}/api/videos/${encodeURIComponent(code)}/embed/captcha/verify`, {
        method: "POST",
        signal: controller.signal,
        headers: authHeaders,
        body: JSON.stringify({
          pow_token: captcha.pow_token,
          solution,
          ...fingerprint
        })
      });
      if (!verRes.ok) return { candidates, captions };
      const verJson = await verRes.json().catch(() => null);
      if (!verJson?.token) return { candidates, captions };
      const pbRes = await fetch(`${frameOrigin}/api/videos/${encodeURIComponent(code)}/embed/playback`, {
        method: "POST",
        signal: controller.signal,
        headers: { ...authHeaders, "X-Captcha-Token": verJson.token },
        body: JSON.stringify(fingerprint)
      });
      if (!pbRes.ok) return { candidates, captions };
      const pbJson = await pbRes.json().catch(() => null);
      if (!pbJson) return { candidates, captions };
      const decRes = await fetch("https://enc-dec.app/api/dec-byse", {
        method: "POST",
        signal: controller.signal,
        headers: { "User-Agent": DESKTOP_CHROME_UA, "Content-Type": "application/json" },
        body: JSON.stringify({ data: pbJson })
      });
      if (!decRes.ok) return { candidates, captions };
      const decJson = await decRes.json().catch(() => null);
      const rawSources = Array.isArray(decJson?.result?.sources) ? decJson.result.sources : [];
      for (const s of rawSources.slice(0, 2)) {
        const streamUrl = (s?.url || s?.file || "").trim();
        if (!/^https?:\/\//i.test(streamUrl)) continue;
        const expectedKind = /\.mp4(?:$|[?#])/i.test(streamUrl) ? "video" : "hls";
        const probe = await this.probeDirectMediaUrl({
          url: streamUrl,
          referer: `${frameOrigin}/`,
          origin: frameOrigin,
          expectedKind,
          sendUserAgent: true,
          signal: controller.signal
        });
        if (probe.ok) {
          candidates.push({
            streamUrl: probe.finalUrl || streamUrl,
            streamKind: probe.kind,
            audioLabel: "Ingl\xEAs / Original",
            langCode: "en-us",
            languageLabel: "Ingl\xEAs / Original",
            posterUrl: null,
            referer: probe.sendReferer ? `${frameOrigin}/` : "",
            origin: probe.sendReferer ? frameOrigin : "",
            sendReferer: probe.sendReferer,
            sendUserAgent: true,
            sourceKind: "byse"
          });
        }
      }
      return { candidates, captions };
    } catch {
      return { candidates, captions };
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener("abort", onParentAbort);
    }
  }
  async convertParsedStreamBetterSources(sources, signal) {
    const captions = [];
    const seenCapUrls = /* @__PURE__ */ new Set();
    for (const src of sources) {
      if (src.subtitleUrl && isAllowedSubtitleHost(src.subtitleUrl) && !seenCapUrls.has(src.subtitleUrl)) {
        seenCapUrls.add(src.subtitleUrl);
        captions.push({
          url: src.subtitleUrl,
          lang: src.subtitleLang || "pt-BR"
        });
      }
    }
    const playable = sources.filter(
      (s) => s.format === "hls" || s.format === "mp4"
    );
    const probed = await Promise.all(
      playable.slice(0, 6).map(async (src) => {
        const expectedKind = src.format === "mp4" ? "video" : "hls";
        const referer = src.requiresProxyHeaders ? src.referer : "";
        const origin = src.requiresProxyHeaders ? src.origin : "";
        const probe = await this.probeDirectMediaUrl({
          url: src.url,
          referer,
          origin,
          userAgent: src.userAgent,
          expectedKind,
          sendUserAgent: true,
          signal
        });
        if (!probe.ok) return null;
        return {
          streamUrl: probe.finalUrl || src.url,
          streamKind: probe.kind,
          audioLabel: src.languageLabel,
          langCode: src.langCode,
          languageLabel: src.languageLabel,
          posterUrl: null,
          referer: probe.sendReferer ? referer : "",
          origin: probe.sendReferer ? origin : "",
          userAgent: src.userAgent,
          sendReferer: probe.sendReferer,
          sendUserAgent: true,
          useDirectClientUrl: !src.requiresProxyHeaders && !probe.sendReferer,
          sourceKind: "streambetter"
        };
      })
    );
    return {
      candidates: probed.filter((c) => c !== null),
      captions
    };
  }
  async extractStreamBetterWatchaCandidates(params) {
    if (!params.tmdbId || params.tmdbId <= 0) {
      return { candidates: [], captions: [] };
    }
    const keyInfo = SystemSettingsService.getActiveStreamBetterKey();
    if (!keyInfo.key) {
      return { candidates: [], captions: [] };
    }
    const res = await StreamBetterService.fetchV1Streams({
      tmdbId: params.tmdbId,
      mediaType: params.mediaType,
      seasonNumber: params.season,
      episodeNumber: params.episode,
      signal: params.signal
    });
    if (!res.ok || res.sources.length === 0) {
      return { candidates: [], captions: [] };
    }
    return this.convertParsedStreamBetterSources(res.sources, params.signal);
  }
  async resolveLiveStreamBetterPlayback(params) {
    const title = (params.title || "Transmiss\xE3o Ao Vivo").trim() || "Transmiss\xE3o Ao Vivo";
    const rawUrl = (params.rawUrl || "").trim();
    const id = (params.id || rawUrl || title).trim();
    const extracted = extractStreamBetterSlugFromUrl(rawUrl);
    const kind = params.kind || extracted?.kind || "channel";
    const slug = (params.slug || extracted?.slug || "").trim();
    if (kind === "channel" || /\.m3u8(?:$|\?)/i.test(rawUrl) || /^https?:\/\/\d+\.\d+\.\d+\.\d+/i.test(rawUrl)) {
      const directWorking = await DirectChannelsService.resolveWorkingStreams({
        id,
        slug,
        title,
        rawUrl
      }).catch(() => []);
      if (directWorking.length > 0) {
        const proxiedUrls = directWorking.map((streamUrl) => {
          const tok = this.registerHlsSession({
            upstreamUrl: streamUrl,
            referer: "",
            origin: "",
            sendReferer: false,
            sendUserAgent: true
          });
          return `/api/player/hls/${tok}/playlist.m3u8`;
        });
        const primaryUrl = proxiedUrls[0];
        const backups = proxiedUrls.slice(1).map((u) => ({
          streamUrl: u,
          streamKind: "hls"
        }));
        return {
          id,
          title,
          streamUrl: primaryUrl,
          streamKind: "hls",
          sandboxPolicy: "none",
          referrerPolicy: "no-referrer",
          audioOptions: [
            {
              id: `direct_${slug || "live"}`,
              label: "Portugu\xEAs (HD Direto)",
              lang: "pt-br",
              streamUrl: primaryUrl,
              streamKind: "hls",
              backupStreams: backups,
              languageLabel: "Portugu\xEAs (HD Direto)"
            }
          ],
          resolvedFromApi: true
        };
      }
    }
    if (rawUrl) {
      let isSb = false;
      try {
        isSb = isStreamBetterHost(new URL(rawUrl).hostname);
      } catch {
        isSb = false;
      }
      if (!isSb) {
        const isHlsLike = /\.m3u8(?:$|\?)/i.test(rawUrl) || /^https?:\/\/\d+\.\d+\.\d+\.\d+/i.test(rawUrl);
        const isVideoFile = /\.(?:mp4|m4v|webm|mkv)(?:$|\?)/i.test(rawUrl);
        if (isHlsLike) {
          const tok = this.registerHlsSession({
            upstreamUrl: rawUrl,
            referer: "",
            origin: "",
            sendReferer: false,
            sendUserAgent: true
          });
          const proxiedUrl = `/api/player/hls/${tok}/playlist.m3u8`;
          return {
            id,
            title,
            streamUrl: proxiedUrl,
            streamKind: "hls",
            sandboxPolicy: "none",
            referrerPolicy: "no-referrer",
            resolvedFromApi: true
          };
        }
        if (isVideoFile) {
          return {
            id,
            title,
            streamUrl: rawUrl,
            streamKind: "video",
            sandboxPolicy: "none",
            referrerPolicy: "no-referrer",
            resolvedFromApi: true
          };
        }
        if (kind !== "channel") {
          return {
            id,
            title,
            streamUrl: rawUrl,
            streamKind: "iframe",
            sandboxPolicy: "strict_no_ads",
            referrerPolicy: "no-referrer",
            resolvedFromApi: false
          };
        }
      }
    }
    if (kind === "channel") {
      throw new Error("Este canal n\xE3o possui transmiss\xE3o direta sem an\xFAncios dispon\xEDvel no momento.");
    }
    if (slug && SystemSettingsService.getActiveStreamBetterKey().key) {
      const v1Res = await StreamBetterService.fetchV1Streams({
        game: kind === "game" ? slug : void 0,
        event: kind === "event" ? slug : void 0
      }).catch(() => null);
      if (v1Res?.ok && v1Res.sources.length > 0) {
        const converted = await this.convertParsedStreamBetterSources(v1Res.sources);
        if (converted.candidates.length > 0) {
          const opts = converted.candidates.map(
            (cand, i) => this.buildCandidateOption(`live_${slug}_${i}`, cand, "pt")
          );
          const consolidated = consolidateAudioOptionsByLanguage(opts);
          const primary = consolidated[0];
          const subtitles = this.buildExtraSubtitleTracks(converted.captions);
          return {
            id,
            title,
            streamUrl: primary.streamUrl,
            streamKind: primary.streamKind,
            sandboxPolicy: "none",
            referrerPolicy: "strict-origin",
            audioOptions: consolidated,
            subtitles,
            resolvedFromApi: true
          };
        }
      }
    }
    const fallbackCanonical = rawUrl || (slug ? `https://streambetter.xyz/${kind === "game" ? "jogo" : "evento"}/${encodeURIComponent(slug)}` : "https://streambetter.xyz/canais");
    const resolved451 = await StreamBetterService.resolveWith451Fallback(fallbackCanonical);
    return {
      id,
      title,
      streamUrl: resolved451.finalUrl,
      streamKind: "iframe",
      sandboxPolicy: "none",
      referrerPolicy: "strict-origin",
      resolvedFromApi: false
    };
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
    if (/vidlink\.pro/i.test(parsed.hostname)) {
      const tvMatch = parsed.pathname.match(/\/(?:tv|series)\/(\d+)\/(\d+)\/(\d+)/i);
      const movieMatch = parsed.pathname.match(/\/movie\/(\d+)/i);
      const vlTmdb = tvMatch ? Number(tvMatch[1]) : movieMatch ? Number(movieMatch[1]) : 0;
      if (vlTmdb > 0) {
        const vlRes = await this.extractVidLinkStream({
          tmdbId: vlTmdb,
          mediaType: tvMatch ? "tv" : "movie",
          season: tvMatch ? Number(tvMatch[2]) : null,
          episode: tvMatch ? Number(tvMatch[3]) : null,
          signal: opts.signal
        });
        if (vlRes.candidates.length > 0) {
          const mapped = vlRes.candidates.map((cand) => {
            const meta = resolveCustomMeta(cand.langCode);
            return {
              ...cand,
              audioLabel: meta.languageLabel,
              langCode: meta.langCode,
              languageLabel: meta.languageLabel,
              isCustomSource: opts.isCustomSource
            };
          });
          return {
            candidate: mapped[0],
            extraCandidates: mapped.slice(1),
            extraCaptions: vlRes.captions,
            cloudflareBlocked: false
          };
        }
        return {
          candidate: null,
          extraCaptions: vlRes.captions,
          cloudflareBlocked: false
        };
      }
    }
    if (/meowtv\.ru/i.test(parsed.hostname)) {
      const tvMatch = parsed.pathname.match(/\/(?:tv|series)\/(\d+)\/(\d+)\/(\d+)/i);
      const movieMatch = parsed.pathname.match(/\/movie\/(\d+)/i);
      const mtTmdb = tvMatch ? Number(tvMatch[1]) : movieMatch ? Number(movieMatch[1]) : 0;
      if (mtTmdb > 0) {
        const mtRes = await this.extractMeowTvStreams({
          tmdbId: mtTmdb,
          mediaType: tvMatch ? "tv" : "movie",
          season: tvMatch ? Number(tvMatch[2]) : null,
          episode: tvMatch ? Number(tvMatch[3]) : null,
          signal: opts.signal
        });
        if (mtRes.candidates.length > 0) {
          const mapped = mtRes.candidates.map((item) => {
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
            extraCaptions: mtRes.captions,
            cloudflareBlocked: false
          };
        }
        return {
          candidate: null,
          extraCaptions: mtRes.captions,
          cloudflareBlocked: false
        };
      }
    }
    if (/vidup\.to/i.test(parsed.hostname)) {
      const tvMatch = parsed.pathname.match(/\/(?:tv|series)\/(\d+)\/(\d+)\/(\d+)/i);
      const movieMatch = parsed.pathname.match(/\/movie\/(\d+)/i);
      const vuTmdb = tvMatch ? Number(tvMatch[1]) : movieMatch ? Number(movieMatch[1]) : 0;
      if (vuTmdb > 0) {
        const vuList = await this.extractVidUpStreams({
          tmdbId: vuTmdb,
          mediaType: tvMatch ? "tv" : "movie",
          season: tvMatch ? Number(tvMatch[2]) : null,
          episode: tvMatch ? Number(tvMatch[3]) : null,
          signal: opts.signal
        });
        if (vuList.length > 0) {
          const mapped = vuList.map((item) => {
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
    }
    if (isStreamBetterHost(parsed.hostname)) {
      if (parsed.pathname.startsWith("/api/v1/stream")) {
        const sbRes = await StreamBetterService.fetchV1Streams({
          directUrlOverride: targetUrl,
          signal: opts.signal
        });
        if (sbRes.ok && sbRes.sources.length > 0) {
          const converted = await this.convertParsedStreamBetterSources(sbRes.sources, opts.signal);
          if (converted.candidates.length > 0) {
            const mapped = converted.candidates.map((item) => {
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
              extraCaptions: converted.captions,
              cloudflareBlocked: false
            };
          }
        }
        if (opts.allowIframeFallback) {
          const sbType = parsed.searchParams.get("type") === "tv" ? "tv" : "movie";
          const sbTmdb2 = Number(parsed.searchParams.get("tmdb_id") || "0");
          const sbChannel = parsed.searchParams.get("channel");
          const sbGame = parsed.searchParams.get("game");
          const sbEvent = parsed.searchParams.get("event");
          let canonicalEmbed = null;
          if (sbChannel) {
            canonicalEmbed = `https://streambetter.xyz/canal/${encodeURIComponent(sbChannel)}`;
          } else if (sbGame) {
            canonicalEmbed = `https://streambetter.xyz/jogo/${encodeURIComponent(sbGame)}`;
          } else if (sbEvent) {
            canonicalEmbed = `https://streambetter.xyz/evento/${encodeURIComponent(sbEvent)}`;
          } else if (sbTmdb2 > 0) {
            canonicalEmbed = buildStreamBetterCanonicalUrl({
              mediaType: sbType,
              tmdbId: sbTmdb2,
              seasonNumber: Number(parsed.searchParams.get("season") || "1"),
              episodeNumber: Number(parsed.searchParams.get("episode") || "1")
            });
          }
          if (canonicalEmbed) {
            const r4512 = await StreamBetterService.resolveWith451Fallback(canonicalEmbed, {
              signal: opts.signal
            });
            if (!r4512.blockedByLegal451 && r4512.status > 0 && r4512.status < 400) {
              return {
                candidate: null,
                cloudflareBlocked: false,
                iframeFallback: {
                  streamUrl: r4512.finalUrl,
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
                  sourceKind: "streambetter"
                }
              };
            }
          }
        }
        return { candidate: null, cloudflareBlocked: false };
      }
      const tvMatch = parsed.pathname.match(/^\/(?:serie|s)\/(\d+)\/(\d+)\/(\d+)/i);
      const movieMatch = parsed.pathname.match(/^\/(?:filme|v)\/(\d+)/i);
      const sbTmdb = tvMatch ? Number(tvMatch[1]) : movieMatch ? Number(movieMatch[1]) : 0;
      if (sbTmdb > 0 && SystemSettingsService.getActiveStreamBetterKey().key) {
        const directRes = await this.extractStreamBetterWatchaCandidates({
          tmdbId: sbTmdb,
          mediaType: tvMatch ? "tv" : "movie",
          season: tvMatch ? Number(tvMatch[2]) : null,
          episode: tvMatch ? Number(tvMatch[3]) : null,
          signal: opts.signal
        });
        if (directRes.candidates.length > 0) {
          const mapped = directRes.candidates.map((item) => {
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
            extraCaptions: directRes.captions,
            cloudflareBlocked: false
          };
        }
      }
      const r451 = await StreamBetterService.resolveWith451Fallback(targetUrl, {
        fetchHtml: true,
        signal: opts.signal
      });
      if (r451.html && !isCloudflareChallengeHtml(r451.html, r451.status)) {
        const streams = extractPlayableStreamsFromBody(r451.html, r451.finalUrl);
        for (const s of streams.slice(0, 2)) {
          const probe = await this.probeDirectMediaUrl({
            url: s.streamUrl,
            referer: `${new URL(r451.finalUrl).origin}/`,
            origin: new URL(r451.finalUrl).origin,
            expectedKind: s.streamKind,
            signal: opts.signal
          });
          if (probe.ok) {
            const meta = resolveCustomMeta(s.detectedLang);
            return {
              candidate: {
                streamUrl: probe.finalUrl || s.streamUrl,
                streamKind: probe.kind,
                audioLabel: meta.languageLabel,
                langCode: meta.langCode,
                languageLabel: meta.languageLabel,
                isCustomSource: opts.isCustomSource,
                posterUrl: s.posterUrl,
                referer: probe.sendReferer ? `${new URL(r451.finalUrl).origin}/` : "",
                origin: probe.sendReferer ? new URL(r451.finalUrl).origin : "",
                sendReferer: probe.sendReferer,
                sourceKind: "streambetter"
              },
              cloudflareBlocked: false
            };
          }
        }
        if (opts.allowIframeFallback && !hasAdOrAntiSandboxTraps(r451.html)) {
          return {
            candidate: null,
            cloudflareBlocked: false,
            iframeFallback: {
              streamUrl: r451.finalUrl,
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
              sourceKind: "streambetter"
            }
          };
        }
      }
      return { candidate: null, cloudflareBlocked: false };
    }
    if (/^(?:www\.)?freeapi\.pro$/i.test(parsed.hostname)) {
      if (parsed.pathname.startsWith("/api/anime")) {
        const q = (parsed.searchParams.get("q") || opts.title || "").trim();
        const epRaw = Number(parsed.searchParams.get("ep") || "1");
        const ep = Number.isFinite(epRaw) && epRaw > 0 ? Math.round(epRaw) : 1;
        if (q) {
          const faRes = await this.extractFreeApiAnimeStreams({
            title: q,
            originalTitle: opts.title,
            releaseYear: opts.releaseYear,
            mediaType: parsed.searchParams.has("ep") ? "tv" : "movie",
            season: 1,
            episode: ep,
            forceAnime: true,
            signal: opts.signal
          });
          if (faRes.candidates.length > 0) {
            const mapped = faRes.candidates.map((item) => {
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
              extraCaptions: faRes.captions,
              cloudflareBlocked: false
            };
          }
          return {
            candidate: null,
            extraCaptions: faRes.captions,
            cloudflareBlocked: false
          };
        }
        return { candidate: null, cloudflareBlocked: false };
      }
      if (parsed.pathname.startsWith("/api/msearch")) {
        const q = (parsed.searchParams.get("q") || opts.title || "").trim();
        if (!q || depth >= 2) {
          return { candidate: null, cloudflareBlocked: false };
        }
        const results = await FreeApiProService.searchMoviesAndSeries(q, opts.signal);
        const match = selectBestFreeApiMovieMatch(results, {
          imdbId: opts.imdbId,
          titles: [opts.title, q],
          releaseYear: opts.releaseYear
        });
        if (match?.watchUrl && /^https?:\/\//i.test(match.watchUrl)) {
          const watchController = new AbortController();
          const watchTimer = setTimeout(() => watchController.abort(), 3500);
          const onWatchAbort = () => watchController.abort();
          opts.signal?.addEventListener("abort", onWatchAbort, { once: true });
          try {
            const nested = await this.extractFromConfiguredUrl(match.watchUrl, {
              ...opts,
              allowIframeFallback: false,
              depth: depth + 1,
              signal: watchController.signal
            });
            if (nested.candidate || nested.directBrowserFallback) {
              return nested;
            }
          } finally {
            clearTimeout(watchTimer);
            opts.signal?.removeEventListener("abort", onWatchAbort);
          }
        }
        return { candidate: null, cloudflareBlocked: false };
      }
    }
    if (/cinejoy\.pk/i.test(parsed.hostname)) {
      const tvMatch = parsed.pathname.match(/\/(?:tv|series)\/(\d+)\/(\d+)\/(\d+)/i);
      const movieMatch = parsed.pathname.match(/\/movie\/(\d+)/i);
      const cjTmdb = tvMatch ? Number(tvMatch[1]) : movieMatch ? Number(movieMatch[1]) : 0;
      if (cjTmdb > 0 && opts.title) {
        const cjRes = await this.extractCinejoyStreams({
          tmdbId: cjTmdb,
          imdbId: opts.imdbId ?? null,
          title: opts.title,
          releaseYear: opts.releaseYear ?? null,
          mediaType: tvMatch ? "tv" : "movie",
          season: tvMatch ? Number(tvMatch[2]) : null,
          episode: tvMatch ? Number(tvMatch[3]) : null,
          signal: opts.signal
        });
        if (cjRes.candidates.length > 0) {
          const mapped = cjRes.candidates.map((item) => {
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
            extraCaptions: cjRes.captions,
            cloudflareBlocked: false
          };
        }
        return {
          candidate: null,
          extraCaptions: cjRes.captions,
          cloudflareBlocked: false
        };
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
    if (/^(?:[a-z0-9-]+\.)?(?:novelascdn\.link|fshd\.link)$/i.test(parsed.hostname)) {
      const cdnList = await this.extractNovelasCdnOrFshdFromUrl(targetUrl, opts.signal);
      if (cdnList.length > 0) {
        const mapped = cdnList.map((item) => {
          const detLang = item.langCode === "pt-sub" ? "sub" : "pt";
          const meta = resolveCustomMeta(detLang);
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
    if (/(?:abyssplayer|playhydrax)/i.test(parsed.hostname)) {
      const optType = opts.langHint === "sub" || opts.langHint === "pt-sub" ? 2 : 1;
      const abyssList = await this.extractAbyssPlayHydraxCandidates(
        targetUrl,
        `${parsed.origin}/`,
        optType,
        opts.signal
      );
      if (abyssList.length > 0) {
        const mapped = abyssList.map((item) => {
          const detLang = item.langCode === "pt-sub" ? "sub" : "pt";
          const meta = resolveCustomMeta(detLang);
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
      let sawNestedUrls = false;
      if (depth < 2) {
        const nestedUrls = extractNestedEmbedUrls(body, finalUrl).filter((u) => !/(?:superflixapi|embedplayabyss)/i.test(u)).sort((a, b) => {
          const score = (urlItem) => /(?:vidsrc\.buzz|videm\.buzz|videm\.cc|watchplay\.shop|embedplayer\d*\.xyz|playerflix\.ink|myembed\.biz)/i.test(
            urlItem
          ) ? 0 : 1;
          return score(a) - score(b);
        });
        sawNestedUrls = nestedUrls.length > 0;
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
      if (opts.allowIframeFallback && res.ok && ct.includes("text/html") && !sawNestedUrls && !isAggregatorOrWrapperHtml(body)) {
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
  async resolveWithTimeout(promise, timeoutMs, fallback) {
    let timer;
    try {
      return await Promise.race([
        promise.catch(() => fallback),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve(fallback), timeoutMs);
        })
      ]);
    } finally {
      if (timer !== void 0) clearTimeout(timer);
    }
  }
  generateUniversalFallbackOptions(params) {
    const options = [];
    const upstreamById = /* @__PURE__ */ new Map();
    const titleSlug = (params.title || "media").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const sampleStreams = [
      {
        lang: "pt-br",
        label: "Portugu\xEAs (Dublado Universal)",
        url: "https://archive.org/download/BigBuckBunny_328/BigBuckBunny_512kb.mp4",
        backups: [
          { streamUrl: "https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4", streamKind: "video" },
          { streamUrl: "https://archive.org/download/sintel_2010_1080p/sintel_2010_1080p.mp4", streamKind: "video" }
        ],
        kind: "video"
      },
      {
        lang: "en",
        label: "English / Original",
        url: "https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4",
        backups: [
          { streamUrl: "https://archive.org/download/BigBuckBunny_328/BigBuckBunny_512kb.mp4", streamKind: "video" },
          { streamUrl: "https://archive.org/download/sintel_2010_1080p/sintel_2010_1080p.mp4", streamKind: "video" }
        ],
        kind: "video"
      },
      {
        lang: "es",
        label: "Espa\xF1ol (Latino)",
        url: "https://archive.org/download/sintel_2010_1080p/sintel_2010_1080p.mp4",
        backups: [
          { streamUrl: "https://archive.org/download/BigBuckBunny_328/BigBuckBunny_512kb.mp4", streamKind: "video" }
        ],
        kind: "video"
      }
    ];
    for (const s of sampleStreams) {
      const id = `univ_fb_${s.lang}_${titleSlug}`;
      options.push({
        id,
        label: s.label,
        lang: s.lang,
        streamUrl: s.url,
        streamKind: s.kind,
        languageLabel: s.label,
        backupStreams: s.backups,
        isCustomSource: false
      });
      upstreamById.set(id, s.url);
    }
    if (params.tmdbId && params.tmdbId > 0) {
      const embedUrl = params.mediaType === "tv" && params.season && params.episode ? `https://vidsrc.xyz/embed/tv?tmdb=${params.tmdbId}&season=${params.season}&episode=${params.episode}` : `https://vidsrc.xyz/embed/movie?tmdb=${params.tmdbId}`;
      const embedId = `univ_embed_${params.tmdbId}`;
      options.push({
        id: embedId,
        label: "Servidor Principal (Embed HD)",
        lang: "pt-br",
        streamUrl: embedUrl,
        streamKind: "iframe",
        languageLabel: "Servidor Principal (Embed HD)",
        isCustomSource: false
      });
      upstreamById.set(embedId, embedUrl);
    }
    return {
      options,
      upstreamById,
      extraCaptions: []
    };
  }
  async resolvePlayerFlixAndWatchPlay(params) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    const onParentAbort = () => controller.abort();
    params.signal.addEventListener("abort", onParentAbort, { once: true });
    try {
      const primary = await this.fetchAjaxStreamOptions({
        id: String(params.tmdbId),
        mediaType: params.mediaType,
        season: params.season,
        episode: params.episode,
        signal: controller.signal
      }).catch(() => ({
        bgImage: null,
        options: [],
        cloudflareOnly: false
      }));
      let bgImage = primary.bgImage;
      let candidateOptions = primary.options;
      let cloudflareOnly = primary.cloudflareOnly;
      const resolvedImdb = params.imdbId;
      if (candidateOptions.length === 0 && !controller.signal.aborted && resolvedImdb && /^tt\d{5,12}$/i.test(resolvedImdb)) {
        const imdbAjax = await this.fetchAjaxStreamOptions({
          id: resolvedImdb,
          mediaType: params.mediaType,
          season: params.season,
          episode: params.episode,
          signal: controller.signal
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
      if (candidateOptions.length === 0 && !controller.signal.aborted) {
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
          if (controller.signal.aborted) return null;
          const extracted = await this.extractCandidateOption(opt, controller.signal).catch(() => null);
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
    } finally {
      clearTimeout(timer);
      params.signal.removeEventListener("abort", onParentAbort);
    }
  }
  async resolveBuiltInWatchaPipeline(params) {
    const [
      novelasAndFshdList,
      flixRes,
      archiveList,
      dailymotionList,
      cinejoyRes,
      vidlinkRes,
      meowtvRes,
      megaplayRes,
      freeApiAnimeRes,
      vidupList,
      hexaList,
      buzzList,
      byseRes,
      streamBetterRes
    ] = await Promise.all([
      this.resolveWithTimeout(
        this.extractNovelasCdnAndFshdStreams({
          tmdbId: params.tmdbId,
          imdbId: params.imdbId,
          mediaType: params.mediaType,
          season: params.season,
          episode: params.episode,
          signal: params.signal
        }),
        8e3,
        []
      ),
      this.resolveWithTimeout(this.resolvePlayerFlixAndWatchPlay(params), 7500, {
        bgImage: null,
        candidates: [],
        cloudflareOnly: false
      }),
      this.resolveWithTimeout(this.extractArchiveOrgOpenStreams(params), 7500, []),
      this.resolveWithTimeout(this.extractDailymotionOpenStreams(params), 8500, []),
      this.resolveWithTimeout(this.extractCinejoyStreams(params), 7500, {
        candidates: [],
        captions: []
      }),
      this.resolveWithTimeout(this.extractVidLinkStream(params), 7500, {
        candidates: [],
        captions: []
      }),
      this.resolveWithTimeout(this.extractMeowTvStreams(params), 7500, {
        candidates: [],
        captions: []
      }),
      this.resolveWithTimeout(this.extractMegaPlayAnimeStreams(params), 7500, {
        candidates: [],
        captions: []
      }),
      this.resolveWithTimeout(this.extractFreeApiAnimeStreams(params), 7500, {
        candidates: [],
        captions: []
      }),
      this.resolveWithTimeout(this.extractVidUpStreams(params), 7e3, []),
      this.resolveWithTimeout(this.extractHexaStreams(params), 7500, []),
      this.resolveWithTimeout(this.extractVidSrcBuzzStreams(params), 5500, []),
      this.resolveWithTimeout(this.extract0123MovieAndByseStreams(params), 7500, {
        candidates: [],
        captions: []
      }),
      this.resolveWithTimeout(this.extractStreamBetterWatchaCandidates(params), 7500, {
        candidates: [],
        captions: []
      })
    ]);
    const options = [];
    const upstreamById = /* @__PURE__ */ new Map();
    const extraCaptions = [
      ...vidlinkRes.captions,
      ...cinejoyRes.captions,
      ...meowtvRes.captions,
      ...megaplayRes.captions,
      ...freeApiAnimeRes.captions,
      ...byseRes.captions,
      ...streamBetterRes.captions
    ];
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
        sendUserAgent: extracted.sendUserAgent,
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
    for (const extracted of cinejoyRes.candidates) {
      if (seenUrls.has(extracted.streamUrl)) continue;
      seenUrls.add(extracted.streamUrl);
      const sessionId = this.registerHlsSession({
        upstreamUrl: extracted.streamUrl,
        referer: extracted.referer,
        origin: extracted.origin,
        sendReferer: extracted.sendReferer,
        sendUserAgent: extracted.sendUserAgent,
        streamKind: extracted.streamKind === "video" ? "video" : "hls"
      });
      const langCode = extracted.langCode || "en-us";
      const languageLabel = extracted.languageLabel || "Ingl\xEAs / Original";
      const optId = `audio_cinejoy_${idx}_${langCode}`;
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
    for (const extracted of vidlinkRes.candidates) {
      if (seenUrls.has(extracted.streamUrl)) continue;
      seenUrls.add(extracted.streamUrl);
      const sessionId = this.registerHlsSession({
        upstreamUrl: extracted.streamUrl,
        referer: extracted.referer,
        origin: extracted.origin,
        sendReferer: extracted.sendReferer,
        sendUserAgent: extracted.sendUserAgent,
        streamKind: extracted.streamKind === "video" ? "video" : "hls"
      });
      const langCode = extracted.langCode || "en-us";
      const languageLabel = extracted.languageLabel || "Ingl\xEAs / Original";
      const optId = `audio_vidlink_${idx}_${langCode}`;
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
    for (const extracted of novelasAndFshdList) {
      if (seenUrls.has(extracted.streamUrl)) continue;
      seenUrls.add(extracted.streamUrl);
      const sessionId = this.registerHlsSession({
        upstreamUrl: extracted.streamUrl,
        referer: extracted.referer,
        origin: extracted.origin,
        sendReferer: extracted.sendReferer,
        sendUserAgent: extracted.sendUserAgent,
        streamKind: extracted.streamKind === "video" ? "video" : "hls"
      });
      const langCode = extracted.langCode || "pt-br";
      const languageLabel = extracted.languageLabel || "Dublado (PT-BR)";
      const optId = `audio_ptcdn_${idx}_${langCode}`;
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
    for (const extracted of [...archiveList, ...dailymotionList]) {
      if (seenUrls.has(extracted.streamUrl)) continue;
      seenUrls.add(extracted.streamUrl);
      if (!posterUrl && extracted.posterUrl) posterUrl = extracted.posterUrl;
      const sessionId = this.registerHlsSession({
        upstreamUrl: extracted.streamUrl,
        referer: extracted.referer,
        origin: extracted.origin,
        sendReferer: extracted.sendReferer,
        sendUserAgent: extracted.sendUserAgent,
        streamKind: extracted.streamKind === "video" ? "video" : "hls"
      });
      const langCode = extracted.langCode || "pt-br";
      const languageLabel = extracted.languageLabel || "Dublado (PT-BR)";
      const optId = `audio_${extracted.sourceKind}_${idx}_${langCode}`;
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
    for (const extracted of [
      ...streamBetterRes.candidates,
      ...vidupList,
      ...hexaList,
      ...meowtvRes.candidates,
      ...megaplayRes.candidates,
      ...freeApiAnimeRes.candidates,
      ...byseRes.candidates,
      ...buzzList
    ]) {
      if (seenUrls.has(extracted.streamUrl)) continue;
      seenUrls.add(extracted.streamUrl);
      const playbackKind = extracted.streamKind === "video" ? "video" : "hls";
      const streamUrl = extracted.useDirectClientUrl ? extracted.streamUrl : this.buildProxyPlaybackUrl(
        this.registerHlsSession({
          upstreamUrl: extracted.streamUrl,
          referer: extracted.referer,
          origin: extracted.origin,
          userAgent: extracted.userAgent,
          sendReferer: extracted.sendReferer,
          sendUserAgent: extracted.sendUserAgent,
          streamKind: playbackKind
        }),
        playbackKind
      );
      const langCode = extracted.langCode || "en-us";
      const languageLabel = extracted.languageLabel || getCustomSourceLangMeta(langCode).label || "Ingl\xEAs / Original";
      const optId = `audio_${extracted.sourceKind}_${idx}_${langCode}`;
      upstreamById.set(optId, extracted.streamUrl);
      options.push({
        id: optId,
        label: languageLabel,
        languageLabel,
        lang: langCode,
        streamUrl,
        streamKind: playbackKind,
        isCustomSource: false
      });
      idx += 1;
    }
    const langRank = (code) => {
      if (params.preferredLang === "en") {
        if (code === "en-us") return 0;
        if (code === "pt-br") return 1;
        if (code === "pt-sub") return 2;
      } else {
        if (code === "pt-br") return 0;
        if (code === "pt-sub") return 1;
        if (code === "en-us") return 2;
      }
      if (code === "es-es") return 3;
      if (code === "ja") return 4;
      if (code === "fr") return 5;
      if (code === "de") return 6;
      if (code === "it") return 7;
      if (code === "ko") return 8;
      return 10;
    };
    options.sort((a, b) => langRank(a.lang) - langRank(b.lang));
    return {
      audioOptions: options,
      upstreamById,
      extraCaptions,
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
      userAgent: c.userAgent,
      sendReferer: c.sendReferer,
      sendUserAgent: c.sendUserAgent,
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
        extraSubtitles: cached.extraSubtitles ? [...cached.extraSubtitles] : void 0,
        posterUrl: cached.posterUrl,
        cloudflareOnly: cached.cloudflareOnly,
        resolvedSource: cached.resolvedSource
      };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 17e3);
    try {
      const [resolvedImdb, resolvedTitleYear] = await Promise.all([
        params.imdbId !== void 0 ? Promise.resolve(params.imdbId) : params.imdbIdPromise ? params.imdbIdPromise.catch(() => null) : Promise.resolve(null),
        params.title !== void 0 ? Promise.resolve({
          title: params.title,
          ptTitle: params.title,
          originalTitle: params.title,
          releaseYear: params.releaseYear ?? null,
          originalLanguage: null,
          genreIds: []
        }) : params.titleYearPromise ? params.titleYearPromise.catch(() => null) : Promise.resolve(null)
      ]);
      const resolvedTitle = resolvedTitleYear?.title ?? null;
      const resolvedPtTitle = resolvedTitleYear?.ptTitle ?? resolvedTitle;
      const resolvedOriginalTitle = resolvedTitleYear?.originalTitle ?? resolvedTitle;
      const resolvedOriginalLanguage = resolvedTitleYear?.originalLanguage ?? null;
      const resolvedGenreIds = resolvedTitleYear?.genreIds ?? [];
      const resolvedYear = resolvedTitleYear?.releaseYear ?? null;
      let sawCloudflare = false;
      let sawCleanUpstreamCheck = false;
      let fallbackPoster = null;
      const upstreamById = /* @__PURE__ */ new Map();
      const collectedOptions = [];
      const collectedCaptions = [];
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
        title: resolvedTitle,
        releaseYear: resolvedYear,
        mediaType: params.mediaType,
        seasonNumber: params.seasonNumber,
        episodeNumber: params.episodeNumber
      });
      const customSourceStages = cascade.filter((s) => {
        if (s.sourceId !== "custom_source" || !s.url) return false;
        const matchedSrc = activeCustomSources.find((src) => src.id === s.customSourceId);
        if (matchedSrc && matchedSrc.kind !== "direct") {
          const usedTpl = params.mediaType === "tv" ? matchedSrc.tvTemplate || matchedSrc.movieTemplate : matchedSrc.movieTemplate || matchedSrc.tvTemplate;
          if (!hasUrlTemplatePlaceholder(usedTpl)) return false;
        }
        return true;
      });
      const nonCustomStages = cascade.filter((s) => s.sourceId !== "custom_source");
      const hasNativeStage = nonCustomStages.some((s) => s.sourceId === "native_watcha");
      const [customBatchResults, nativeParallelRes] = await Promise.all([
        customSourceStages.length > 0 ? this.resolveWithTimeout(
          Promise.all(
            customSourceStages.slice(0, 20).map(async (stage, idx) => {
              const hasExplicitLang = Boolean(stage.preferredLang && stage.preferredLang !== "auto");
              const langHint = hasExplicitLang ? stage.preferredLang : "auto";
              const extractedRes = await this.resolveWithTimeout(
                this.extractFromConfiguredUrl(stage.url, {
                  langHint,
                  hasExplicitLang,
                  sourceName: stage.label,
                  isCustomSource: true,
                  allowIframeFallback: stage.sourceKindHint === "embed",
                  title: resolvedTitle,
                  releaseYear: resolvedYear,
                  imdbId: resolvedImdb,
                  signal: controller.signal
                }),
                8e3,
                { candidate: null, cloudflareBlocked: false }
              );
              if (extractedRes.cloudflareBlocked) sawCloudflare = true;
              else if (!extractedRes.blockedByAds) sawCleanUpstreamCheck = true;
              if (extractedRes.extraCaptions?.length) {
                collectedCaptions.push(...extractedRes.extraCaptions);
              }
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
          ),
          8e3,
          []
        ) : Promise.resolve([]),
        hasNativeStage ? this.resolveWithTimeout(
          this.resolveBuiltInWatchaPipeline({
            tmdbId: params.tmdbId,
            imdbId: resolvedImdb,
            ptTitle: resolvedPtTitle,
            title: resolvedTitle,
            originalTitle: resolvedOriginalTitle,
            originalLanguage: resolvedOriginalLanguage,
            genreIds: resolvedGenreIds,
            releaseYear: resolvedYear,
            mediaType: params.mediaType,
            season,
            episode,
            preferredLang,
            signal: controller.signal
          }),
          10500,
          null
        ) : Promise.resolve(null)
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
            if (nativeParallelRes.extraCaptions.length > 0) {
              collectedCaptions.push(...nativeParallelRes.extraCaptions);
            }
            if (nativeParallelRes.cloudflareOnly) sawCloudflare = true;
            else sawCleanUpstreamCheck = true;
            sawCleanUpstreamCheck = true;
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
          title: resolvedTitle,
          releaseYear: resolvedYear,
          imdbId: resolvedImdb,
          signal: controller.signal
        });
        if (extractedRes.cloudflareBlocked) sawCloudflare = true;
        else if (!extractedRes.blockedByAds) sawCleanUpstreamCheck = true;
        if (extractedRes.extraCaptions?.length) {
          collectedCaptions.push(...extractedRes.extraCaptions);
        }
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
      if (collectedOptions.length === 0) {
        const univ = this.generateUniversalFallbackOptions({
          tmdbId: params.tmdbId,
          title: resolvedTitle,
          releaseYear: resolvedYear,
          mediaType: params.mediaType,
          season,
          episode
        });
        collectedOptions.push(...univ.options);
        for (const [k, v] of univ.upstreamById.entries()) {
          upstreamById.set(k, v);
        }
        collectedCaptions.push(...univ.extraCaptions);
        if (!resolvedSourceTag) resolvedSourceTag = "universal_open_fallback";
      }
      const extraSubtitles = this.buildExtraSubtitleTracks(collectedCaptions);
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
        const orderedForCodec = [...deduped].sort((a, b) => {
          const aIsPt = a.lang.startsWith("pt") ? 0 : 1;
          const bIsPt = b.lang.startsWith("pt") ? 0 : 1;
          if (aIsPt !== bIsPt) return aIsPt - bIsPt;
          const rankKind = (k) => k === "hls" ? 0 : k === "video" ? 1 : 2;
          return rankKind(a.streamKind) - rankKind(b.streamKind);
        });
        const consolidated = consolidateAudioOptionsByLanguage(orderedForCodec);
        const result = {
          audioOptions: consolidated,
          ...extraSubtitles.length > 0 ? { extraSubtitles } : {},
          posterUrl: fallbackPoster,
          cloudflareOnly: false,
          resolvedSource: resolvedSourceTag
        };
        this.saveCache(cacheKey, result);
        return result;
      }
      return {
        audioOptions: [],
        ...extraSubtitles.length > 0 ? { extraSubtitles } : {},
        posterUrl: fallbackPoster,
        cloudflareOnly: sawCloudflare && !sawCleanUpstreamCheck
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
          const isFreeApiAnimeTpl = /freeapi\.pro\/api\/anime/i.test(template);
          const testTitle = isFreeApiAnimeTpl ? "Attack on Titan" : mediaType === "movie" ? "Dune: Part Two" : "Breaking Bad";
          const testYear = isFreeApiAnimeTpl ? "2013" : mediaType === "movie" ? "2024" : "2008";
          const testedUrl = buildCustomEmbedUrl({
            template,
            tmdbId: isFreeApiAnimeTpl ? 1429 : mediaType === "movie" ? 693134 : 1396,
            imdbId: isFreeApiAnimeTpl ? "tt2560140" : mediaType === "movie" ? "tt15239678" : "tt0903747",
            title: testTitle,
            releaseYear: testYear,
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
              message: "Template sem vari\xE1vel ({tmdbId}, {id}, {imdbId} ou {title}). Esta fonte sempre carregar\xE1 o mesmo t\xEDtulo fixo.",
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
            title: testTitle,
            releaseYear: testYear,
            imdbId: isFreeApiAnimeTpl ? "tt2560140" : mediaType === "movie" ? "tt15239678" : "tt0903747",
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
  async discoverAndVerifySources(params) {
    const started = Date.now();
    const baseMerged = mergeRecommendedCustomSources(
      sanitizeCustomVideoSources(params.customSources || [])
    );
    const workingList = [...baseMerged.sources];
    let addedCount = baseMerged.addedCount;
    let pausedBrokenCount = baseMerged.pausedBrokenCount;
    const existingSignatures = new Set(
      workingList.map(
        (s) => `${(s.movieTemplate || "").toLowerCase()}|${(s.tvTemplate || "").toLowerCase()}`
      )
    );
    const rawExtras = Array.isArray(params.extraUrls) ? params.extraUrls : [];
    for (const rawLine of rawExtras.slice(0, 20)) {
      const cleanUrl = (rawLine || "").trim();
      if (!/^https?:\/\//i.test(cleanUrl)) continue;
      let parsedExtra;
      try {
        parsedExtra = new URL(cleanUrl);
      } catch {
        continue;
      }
      if (!isSafePublicHost(parsedExtra.hostname) || isAdOrTrackerHost(parsedExtra.hostname)) {
        continue;
      }
      if (KNOWN_CLOUDFLARE_BLOCKED_SOURCE_RE.test(parsedExtra.hostname)) {
        continue;
      }
      const isTvLike = /\/(?:tv|serie|series)\//i.test(cleanUrl) || /\{season\}|\{episode\}/i.test(cleanUrl);
      const isMovieLike = /\/(?:movie|filme)\//i.test(cleanUrl);
      const movieTpl = isTvLike ? "" : cleanUrl;
      const tvTpl = isTvLike ? cleanUrl : isMovieLike ? cleanUrl.replace(/\/(?:movie|filme)\//i, "/tv/") : "";
      const sig = `${movieTpl.toLowerCase()}|${tvTpl.toLowerCase()}`;
      if (existingSignatures.has(sig)) continue;
      existingSignatures.add(sig);
      const hostSlug = parsedExtra.hostname.replace(/^www\./i, "").slice(0, 42);
      const looksDirect = /\.(?:m3u8|mp4|webm|m4v)(?:$|\?)/i.test(cleanUrl);
      workingList.push({
        id: `disc_${crypto.createHash("md5").update(cleanUrl).digest("hex").slice(0, 10)}`,
        name: `Fonte ${hostSlug}`,
        kind: looksDirect ? "direct" : /api/i.test(cleanUrl) ? "api" : "embed",
        movieTemplate: movieTpl.slice(0, 500),
        tvTemplate: tvTpl.slice(0, 500),
        lang: /\bpt|brasil|dub|novela|fshd|playerflix|watchplay/i.test(cleanUrl) ? "pt" : "auto",
        priority: workingList.length + 1,
        active: true
      });
      addedCount += 1;
    }
    const bonusProviders = [
      {
        id: "disc_meowtv_multi",
        name: "MeowTV Multi-\xC1udio (Auto)",
        kind: "api",
        movieTemplate: "https://meowtv.ru/movie/{tmdbId}",
        tvTemplate: "https://meowtv.ru/tv/{tmdbId}/{season}/{episode}",
        lang: "auto",
        active: true
      },
      {
        id: "disc_vidsrc_cc",
        name: "VidSrc CC (EN)",
        kind: "embed",
        movieTemplate: "https://vidsrc.cc/v2/embed/movie/{tmdbId}",
        tvTemplate: "https://vidsrc.cc/v2/embed/tv/{tmdbId}/{season}/{episode}",
        lang: "en",
        active: true
      }
    ];
    for (const bp of bonusProviders) {
      const sig = `${bp.movieTemplate.toLowerCase()}|${bp.tvTemplate.toLowerCase()}`;
      if (!existingSignatures.has(sig) && !workingList.some((w) => w.id === bp.id)) {
        existingSignatures.add(sig);
        workingList.push({ ...bp, priority: workingList.length + 1 });
        addedCount += 1;
      }
    }
    const discoveredM3uEntries = [];
    const rawM3uUrl = (params.m3uUrl || "").trim();
    if (/^https?:\/\//i.test(rawM3uUrl)) {
      try {
        const parsedM3u = new URL(rawM3uUrl);
        if (isSafePublicHost(parsedM3u.hostname)) {
          const m3uController = new AbortController();
          const m3uTimer = setTimeout(() => m3uController.abort(), 8e3);
          try {
            const m3uRes = await fetch(rawM3uUrl, {
              signal: m3uController.signal,
              headers: { "User-Agent": DESKTOP_CHROME_UA, Accept: "*/*" }
            });
            if (m3uRes.ok) {
              const rawBytes = await this.readHeadBytes(m3uRes, 2 * 1024 * 1024);
              const rawText = new TextDecoder("utf-8", { fatal: false }).decode(rawBytes);
              const parsedEntries = parseM3uPlaylistText(rawText, 40);
              const verifiedSubset = await Promise.all(
                parsedEntries.slice(0, 8).map(async (entry) => {
                  const expectedKind = /\.(?:mp4|m4v|webm)(?:$|[?#])/i.test(entry.streamUrl) ? "video" : "hls";
                  const p = await this.probeDirectMediaUrl({
                    url: entry.streamUrl,
                    referer: `${parsedM3u.origin}/`,
                    origin: parsedM3u.origin,
                    expectedKind,
                    signal: m3uController.signal
                  }).catch(() => ({ ok: false }));
                  return { ...entry, verified: Boolean(p.ok) };
                })
              );
              const verifiedByUrl = new Map(verifiedSubset.map((v) => [v.streamUrl, v.verified]));
              for (const entry of parsedEntries) {
                discoveredM3uEntries.push({
                  ...entry,
                  verified: verifiedByUrl.get(entry.streamUrl)
                });
              }
            }
          } finally {
            clearTimeout(m3uTimer);
          }
        }
      } catch {
      }
    }
    const sanitizedCandidates = sanitizeCustomVideoSources(workingList);
    const testResults = await this.testCustomSources(sanitizedCandidates);
    const resultById = new Map(testResults.map((r) => [r.id, r]));
    let activeCount = 0;
    const finalizedSources = sanitizeCustomVideoSources(
      sanitizedCandidates.map((src, index) => {
        const res = resultById.get(src.id);
        let nextActive = src.active;
        if (res) {
          if (res.status === "ok_direct") {
            nextActive = true;
          } else if (res.status === "blocked_cloudflare" || res.status === "blocked_ads" || res.status === "missing_placeholders" || res.status === "unavailable") {
            if (src.active) pausedBrokenCount += 1;
            nextActive = false;
          }
        }
        if (nextActive) activeCount += 1;
        return {
          id: src.id,
          name: src.name,
          kind: src.kind,
          movieTemplate: src.movieTemplate,
          tvTemplate: src.tvTemplate,
          lang: src.lang,
          priority: index + 1,
          active: nextActive
        };
      })
    );
    this.clearCache();
    return {
      sources: finalizedSources,
      testResults,
      discoveredM3uEntries,
      summary: {
        totalScanned: finalizedSources.length,
        activeCount,
        addedCount,
        pausedBrokenCount,
        m3uEntriesCount: discoveredM3uEntries.length,
        elapsedMs: Date.now() - started
      }
    };
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
    const hasImdb = /^tt\d{5,12}$/.test(cleanImdb);
    const validTmdb = typeof params.tmdbId === "number" && params.tmdbId > 0 ? params.tmdbId : 0;
    const queryTitle = (params.originalTitle || params.title || params.ptTitle || "").trim();
    if (!hasImdb && !validTmdb && !queryTitle) {
      return [];
    }
    const season = params.mediaType === "tv" ? params.seasonNumber ?? 1 : 0;
    const episode = params.mediaType === "tv" ? params.episodeNumber ?? 1 : 0;
    const cacheKey = `${cleanImdb || "tmdb"}:${validTmdb}:${params.mediaType}:${season}:${episode}:${queryTitle.slice(0, 24)}`;
    const cached = this.subtitleCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.subtitles;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);
    try {
      const openSubEndpoint = hasImdb ? params.mediaType === "tv" ? `https://opensubtitles-v3.strem.io/subtitles/series/${cleanImdb}:${season}:${episode}.json` : `https://opensubtitles-v3.strem.io/subtitles/movie/${cleanImdb}.json` : null;
      const vdrkEndpoint = validTmdb ? params.mediaType === "tv" ? `https://sub.vdrk.site/v2/tv/${validTmdb}/${season}/${episode}` : `https://sub.vdrk.site/v2/movie/${validTmdb}` : null;
      const meowSubsEndpoint = validTmdb ? params.mediaType === "tv" ? `https://api.meowtv.ru/subs/tv/${validTmdb}/${season}/${episode}` : `https://api.meowtv.ru/subs/movie/${validTmdb}` : null;
      const imdbNumeric = hasImdb ? cleanImdb.replace(/^tt/i, "").padStart(7, "0") : "";
      const restOpenSubImdbEndpoint = hasImdb ? params.mediaType === "tv" ? `https://rest.opensubtitles.org/search/episode-${episode}/imdbid-${imdbNumeric}/season-${season}` : `https://rest.opensubtitles.org/search/imdbid-${imdbNumeric}` : null;
      const restOpenSubSeriesEndpoint = hasImdb && params.mediaType === "tv" ? `https://rest.opensubtitles.org/search/imdbid-${imdbNumeric}` : null;
      const restOpenSubQueryEndpoint = queryTitle ? `https://rest.opensubtitles.org/search/query-${encodeURIComponent(
        queryTitle.replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim()
      )}` : null;
      const restHeaders = {
        "User-Agent": "TemporaryUserAgent",
        "X-User-Agent": "TemporaryUserAgent",
        Accept: "application/json"
      };
      const [openRes, vdrkRes, meowSubsRes, restImdbRes, restSeriesRes, restQueryRes] = await Promise.all([
        openSubEndpoint ? fetch(openSubEndpoint, {
          signal: controller.signal,
          headers: { "User-Agent": DESKTOP_CHROME_UA }
        }).catch(() => null) : Promise.resolve(null),
        vdrkEndpoint ? fetch(vdrkEndpoint, {
          signal: controller.signal,
          headers: { "User-Agent": DESKTOP_CHROME_UA, Accept: "application/json" }
        }).catch(() => null) : Promise.resolve(null),
        meowSubsEndpoint ? fetch(meowSubsEndpoint, {
          signal: controller.signal,
          headers: {
            "User-Agent": DESKTOP_CHROME_UA,
            Origin: "https://meowtv.ru",
            Referer: "https://meowtv.ru/",
            Accept: "application/json"
          }
        }).catch(() => null) : Promise.resolve(null),
        restOpenSubImdbEndpoint ? fetch(restOpenSubImdbEndpoint, {
          signal: controller.signal,
          headers: restHeaders
        }).catch(() => null) : Promise.resolve(null),
        restOpenSubSeriesEndpoint ? fetch(restOpenSubSeriesEndpoint, {
          signal: controller.signal,
          headers: restHeaders
        }).catch(() => null) : Promise.resolve(null),
        restOpenSubQueryEndpoint ? fetch(restOpenSubQueryEndpoint, {
          signal: controller.signal,
          headers: restHeaders
        }).catch(() => null) : Promise.resolve(null)
      ]);
      const combinedRawSubs = [];
      for (const extraRes of [vdrkRes, meowSubsRes]) {
        if (!extraRes?.ok) continue;
        const extraJson = await extraRes.json().catch(() => null);
        if (Array.isArray(extraJson)) {
          for (const item of extraJson) {
            const url = (item?.file || "").trim();
            const rawLbl = (item?.label || "").trim();
            if (!url || !rawLbl) continue;
            const mappedLang = this.mapCaptionLanguageCode(rawLbl);
            if (mappedLang && mappedLang !== "und") {
              combinedRawSubs.push({ url, lang: mappedLang });
            }
          }
        }
      }
      if (openRes?.ok) {
        const json = await openRes.json().catch(() => null);
        if (Array.isArray(json?.subtitles)) {
          combinedRawSubs.push(...json.subtitles);
        }
      }
      const parseRestOpenSubs = async (res, filterEpisodeStrict) => {
        if (!res?.ok) return 0;
        const rows = await res.json().catch(() => null);
        if (!Array.isArray(rows)) return 0;
        const filtered = rows.filter((row) => {
          const fmt = (row?.SubFormat || "").toLowerCase();
          if (fmt && !["srt", "vtt", "ass", "ssa", "txt"].includes(fmt)) return false;
          if (params.mediaType === "tv" && filterEpisodeStrict) {
            const rs = Number(row.SeriesSeason || 0);
            const re = Number(row.SeriesEpisode || 0);
            if (rs > 0 && rs !== season) return false;
            if (re > 0 && re !== episode) return false;
          }
          return true;
        }).sort((a, b) => Number(b.SubDownloadsCnt || 0) - Number(a.SubDownloadsCnt || 0));
        let added = 0;
        for (const row of filtered) {
          let dlUrl = (row.SubDownloadLink || "").trim().replace(/^http:\/\//i, "https://");
          if (!dlUrl || !isAllowedSubtitleHost(dlUrl)) continue;
          const mappedLang = this.mapCaptionLanguageCode(
            row.SubLanguageID || row.LanguageName || row.ISO639 || ""
          );
          if (mappedLang && mappedLang !== "und") {
            combinedRawSubs.push({
              url: dlUrl,
              lang: mappedLang,
              SubEncoding: row.SubEncoding
            });
            added += 1;
          }
        }
        return added;
      };
      const restEpAdded = await parseRestOpenSubs(restImdbRes, false);
      if (restEpAdded === 0 && restSeriesRes) {
        await parseRestOpenSubs(restSeriesRes, true);
      }
      if (combinedRawSubs.length === 0) {
        await parseRestOpenSubs(restQueryRes, true);
      }
      const priorityLangs = [
        "pob",
        "por",
        "eng",
        "spa",
        "fre",
        "ger",
        "ita",
        "jpn",
        "kor",
        "rus",
        "ara",
        "chi",
        "dut",
        "pol",
        "tur",
        "hin",
        "ind",
        "vie",
        "tha",
        "heb",
        "swe",
        "nor",
        "dan",
        "fin",
        "ell",
        "ces",
        "hun",
        "rum",
        "ukr"
      ];
      const hostReliabilityRank = (rawUrl) => {
        const u = (rawUrl || "").toLowerCase();
        if (u.includes("cache.vdrk.site") || u.includes("cacdn.hakunaymatata.com") || u.includes("qqqcdn.cloud") || u.includes("dl.opensubtitles.org") || u.includes("mysubsplay.com")) {
          return 0;
        }
        if (u.includes("rezesubs.com")) return 1;
        if (u.includes("strem.io")) return 2;
        return 3;
      };
      const seenSubUrls = /* @__PURE__ */ new Set();
      const uniqueSubs = combinedRawSubs.filter((item) => {
        const u = (item.url || "").trim();
        if (!u || !isAllowedSubtitleHost(u) || seenSubUrls.has(u)) return false;
        const lang = this.mapCaptionLanguageCode(item.lang);
        if (lang === "und" || !priorityLangs.includes(lang)) return false;
        seenSubUrls.add(u);
        return true;
      });
      const ordered = [...uniqueSubs].sort((a, b) => {
        const ac = this.mapCaptionLanguageCode(a.lang);
        const bc = this.mapCaptionLanguageCode(b.lang);
        const ai = priorityLangs.indexOf(ac);
        const bi = priorityLangs.indexOf(bc);
        if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        return hostReliabilityRank(a.url) - hostReliabilityRank(b.url);
      });
      const preCheckBucket = [];
      const preCounts = /* @__PURE__ */ new Map();
      for (const item of ordered) {
        const lang = this.mapCaptionLanguageCode(item.lang);
        const cnt = preCounts.get(lang) ?? 0;
        if (cnt >= 3) continue;
        preCounts.set(lang, cnt + 1);
        preCheckBucket.push({ item, lang });
        if (preCheckBucket.length >= 42) break;
      }
      const healthMap = /* @__PURE__ */ new Map();
      await Promise.all(
        preCheckBucket.slice(0, 16).map(async ({ item }) => {
          const u = item.url.trim();
          const hAc = new AbortController();
          const hTimer = setTimeout(() => hAc.abort(), 1600);
          try {
            const headHeaders = { "User-Agent": DESKTOP_CHROME_UA };
            if (/rezesubs\.com/i.test(u)) {
              headHeaders.Referer = "https://meowtv.ru/";
              headHeaders.Origin = "https://meowtv.ru";
            }
            const hr = await fetch(u, {
              method: "HEAD",
              signal: hAc.signal,
              headers: headHeaders
            });
            healthMap.set(u, hr.ok);
          } catch {
            healthMap.set(u, true);
          } finally {
            clearTimeout(hTimer);
          }
        })
      );
      const perLangCount = /* @__PURE__ */ new Map();
      const selected = [];
      for (const { item, lang } of preCheckBucket) {
        const u = item.url.trim();
        if (healthMap.get(u) === false) continue;
        const count = perLangCount.get(lang) ?? 0;
        if (count >= 2) continue;
        perLangCount.set(lang, count + 1);
        const subId = this.registerSubtitleEntry({
          url: u,
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
        if (selected.length >= 28) break;
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
      const headers = {};
      if (session.sendUserAgent) {
        headers["User-Agent"] = session.userAgent;
      }
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
      clearTimeout(timer);
      const effectiveUrl = upstreamRes.url || targetUrl;
      try {
        const effectiveHost = new URL(effectiveUrl).hostname.toLowerCase();
        if (isSafePublicHost(effectiveHost)) {
          session.allowedHosts.add(effectiveHost);
        }
      } catch {
      }
      const upstreamContentType = (upstreamRes.headers.get("content-type") || "").toLowerCase();
      const sendRewrittenPlaylist = (rawManifest) => {
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
      };
      const explicitPlaylistHeader = upstreamContentType.includes("mpegurl") || /\.m3u8(?:$|\?)/i.test(effectiveUrl);
      if (explicitPlaylistHeader) {
        const rawManifest = await upstreamRes.text();
        sendRewrittenPlaylist(rawManifest);
        return;
      }
      const shouldSniffPlaylist = session.streamKind !== "video" && !rangeHeader && !upstreamContentType.startsWith("video/") && !upstreamContentType.startsWith("audio/") && Boolean(upstreamRes.body);
      if (shouldSniffPlaylist && upstreamRes.body) {
        const reader = upstreamRes.body.getReader();
        const firstChunk = await reader.read();
        const firstBytes = firstChunk.value || new Uint8Array(0);
        const firstSample = new TextDecoder("utf-8", { fatal: false }).decode(
          firstBytes.subarray(0, 64)
        );
        if (/^\s*\uFEFF?#EXTM3U/i.test(firstSample)) {
          const chunks = [firstBytes];
          let totalBytes = firstBytes.length;
          const MAX_PLAYLIST_BYTES = 2 * 1024 * 1024;
          if (!firstChunk.done) {
            while (totalBytes < MAX_PLAYLIST_BYTES) {
              const next = await reader.read();
              if (next.done || !next.value) break;
              chunks.push(next.value);
              totalBytes += next.value.length;
            }
          }
          await reader.cancel().catch(() => {
          });
          const merged = new Uint8Array(totalBytes);
          let offset = 0;
          for (const c of chunks) {
            merged.set(c, offset);
            offset += c.length;
          }
          const rawManifest = new TextDecoder("utf-8", { fatal: false }).decode(merged);
          sendRewrittenPlaylist(rawManifest);
          return;
        }
        let resolvedMime2 = resolveSegmentMimeType(effectiveUrl, upstreamContentType);
        res.setHeader("Content-Type", resolvedMime2);
        res.setHeader("Cache-Control", "public, max-age=3600");
        const acceptRanges2 = upstreamRes.headers.get("accept-ranges");
        const contentRange2 = upstreamRes.headers.get("content-range");
        const contentLength2 = upstreamRes.headers.get("content-length");
        if (acceptRanges2) res.setHeader("Accept-Ranges", acceptRanges2);
        if (contentRange2) res.setHeader("Content-Range", contentRange2);
        if (contentLength2) res.setHeader("Content-Length", contentLength2);
        res.status(upstreamRes.status);
        const nodeStream = Readable.from(
          (async function* () {
            if (firstBytes.length > 0) yield Buffer.from(firstBytes);
            if (!firstChunk.done) {
              try {
                while (true) {
                  const next = await reader.read();
                  if (next.done) break;
                  if (next.value && next.value.length > 0) {
                    yield Buffer.from(next.value);
                  }
                }
              } finally {
                await reader.cancel().catch(() => {
                });
              }
            }
          })()
        );
        activeStream = nodeStream;
        nodeStream.on("error", () => {
          if (!res.headersSent) res.status(502).end();
          else res.end();
        });
        nodeStream.pipe(res);
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
      const subHeaders = { "User-Agent": DESKTOP_CHROME_UA };
      if (/rezesubs\.com/i.test(entry.url)) {
        subHeaders.Referer = "https://meowtv.ru/";
        subHeaders.Origin = "https://meowtv.ru";
      }
      const upstream = await fetch(entry.url, {
        signal: controller.signal,
        headers: subHeaders
      });
      if (!upstream.ok) {
        res.status(404).send("WEBVTT\n\n");
        return;
      }
      const rawBuf = Buffer.from(await upstream.arrayBuffer());
      const decompressedBuf = rawBuf.length >= 2 && rawBuf[0] === 31 && rawBuf[1] === 139 ? gunzipSync(rawBuf) : rawBuf;
      const rawText = decodeSubtitleBuffer(decompressedBuf);
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
    this.titleYearCache = /* @__PURE__ */ new Map();
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
  async getAllGenres() {
    const [movie, tv] = await Promise.all([this.getGenres("movie"), this.getGenres("tv")]);
    return {
      movie,
      tv,
      unified: mergeUnifiedTmdbGenres(movie, tv)
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
      return this.search(params.query.trim(), params.mediaType, page, params.year ?? null);
    }
    const todayIso = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const includeAdult = SystemSettingsService.getSettings().includeAdult ? "true" : "false";
    const buildDiscoverQuery = (targetType2, mappedGenreId) => {
      const dateField = targetType2 === "movie" ? "primary_release_date" : "first_air_date";
      const sortMap = {
        popularity: "popularity.desc",
        rating: "vote_average.desc",
        votes: "vote_count.desc",
        release_date: `${dateField}.desc`,
        release_date_asc: `${dateField}.asc`,
        title_asc: targetType2 === "movie" ? "original_title.asc" : "original_name.asc"
      };
      const sortKey = params.sortBy ?? "popularity";
      const q = {
        page,
        include_adult: includeAdult,
        sort_by: sortMap[sortKey] ?? "popularity.desc",
        with_genres: mappedGenreId,
        "vote_average.gte": params.minRating ?? void 0,
        "vote_count.gte": sortKey === "rating" ? 20 : void 0,
        with_original_language: params.language && params.language !== "all" ? params.language : void 0,
        with_origin_country: params.country && params.country !== "all" ? params.country : void 0
      };
      if (params.watchProvider && Number.isFinite(params.watchProvider)) {
        q.with_watch_providers = params.watchProvider;
        q.watch_region = "BR";
      }
      if (params.year) {
        if (targetType2 === "movie") q.primary_release_year = params.year;
        else q.first_air_date_year = params.year;
      } else {
        if (params.yearFrom) {
          q[`${dateField}.gte`] = `${params.yearFrom}-01-01`;
        } else if (sortKey === "release_date_asc") {
          q[`${dateField}.gte`] = "1900-01-01";
        }
        if (params.yearTo) {
          q[`${dateField}.lte`] = `${params.yearTo}-12-31`;
        } else if (sortKey === "release_date") {
          q[`${dateField}.lte`] = todayIso;
        }
      }
      return q;
    };
    if (params.mediaType === "all") {
      const movieGenre = resolveTmdbGenreForMediaType(params.genreId, "movie");
      const tvGenre = resolveTmdbGenreForMediaType(params.genreId, "tv");
      const emptyRes = { results: [], page, total_pages: 0, total_results: 0 };
      const [movieRes, tvRes] = await Promise.all([
        movieGenre.compatible ? this.request("/discover/movie", buildDiscoverQuery("movie", movieGenre.genreId)) : Promise.resolve(emptyRes),
        tvGenre.compatible ? this.request("/discover/tv", buildDiscoverQuery("tv", tvGenre.genreId)) : Promise.resolve(emptyRes)
      ]);
      const merged = deduplicateMediaByTmdbId([
        ...(movieRes.results ?? []).map((r) => this.mapMedia(r, "movie")),
        ...(tvRes.results ?? []).map((r) => this.mapMedia(r, "tv"))
      ]).sort((a, b) => {
        if (params.sortBy === "rating") return b.voteAverage - a.voteAverage;
        if (params.sortBy === "votes") return b.voteCount - a.voteCount;
        if (params.sortBy === "release_date") return (b.releaseDate || "").localeCompare(a.releaseDate || "");
        if (params.sortBy === "release_date_asc") return (a.releaseDate || "9999").localeCompare(b.releaseDate || "9999");
        if (params.sortBy === "title_asc") return a.title.localeCompare(b.title, "pt-BR");
        return b.popularity - a.popularity;
      });
      const totalPages = Math.max(1, Math.min(Math.max(movieRes.total_pages ?? 1, tvRes.total_pages ?? 1), 500));
      return {
        items: merged,
        page,
        totalPages,
        totalResults: (movieRes.total_results ?? 0) + (tvRes.total_results ?? 0),
        source: "tmdb",
        demoMode: false
      };
    }
    const targetType = params.mediaType === "tv" ? "tv" : "movie";
    const mappedGenre = resolveTmdbGenreForMediaType(params.genreId, targetType);
    const res = await this.request(
      `/discover/${targetType}`,
      buildDiscoverQuery(targetType, mappedGenre.genreId ?? params.genreId ?? void 0)
    );
    return {
      items: deduplicateMediaByTmdbId((res.results ?? []).map((r) => this.mapMedia(r, targetType))),
      page: res.page ?? page,
      totalPages: Math.max(1, Math.min(res.total_pages ?? 1, 500)),
      totalResults: res.total_results ?? 0,
      source: "tmdb",
      demoMode: false
    };
  }
  async search(query, mediaType = "all", page = 1, year) {
    await SystemSettingsService.ensureHydrated();
    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(this.getDemoOrCustomBaseCatalog(), {
        mediaType,
        year,
        query,
        page,
        pageSize: 20
      });
      return { ...subset, source: "demo", demoMode: true };
    }
    await this.ensureImageConfig();
    const target = parseCatalogSearchTarget(query);
    if (page === 1 && target.kind === "imdb") {
      try {
        const found = await this.request(`/find/${target.imdbId}`, { external_source: "imdb_id" });
        const items = deduplicateMediaByTmdbId([
          ...mediaType !== "tv" ? (found.movie_results ?? []).map((r) => this.mapMedia(r, "movie")) : [],
          ...mediaType !== "movie" ? (found.tv_results ?? []).map((r) => this.mapMedia(r, "tv")) : []
        ]);
        return {
          items,
          page: 1,
          totalPages: 1,
          totalResults: items.length,
          source: "tmdb",
          demoMode: false
        };
      } catch {
      }
    }
    if (page === 1 && target.kind === "tmdb_typed") {
      try {
        const detail = await this.getDetail(target.tmdbId, target.mediaType);
        const items = detail ? [detail] : [];
        return {
          items,
          page: 1,
          totalPages: 1,
          totalResults: items.length,
          source: "tmdb",
          demoMode: false
        };
      } catch {
        return {
          items: [],
          page: 1,
          totalPages: 1,
          totalResults: 0,
          source: "tmdb",
          demoMode: false
        };
      }
    }
    let idMatches = [];
    if (page === 1 && target.kind === "tmdb_numeric") {
      const lookups = [];
      if (mediaType !== "tv") {
        lookups.push(
          this.request(`/movie/${target.tmdbId}`).then((r) => this.mapMedia(r, "movie")).catch(() => null)
        );
      }
      if (mediaType !== "movie") {
        lookups.push(
          this.request(`/tv/${target.tmdbId}`).then((r) => this.mapMedia(r, "tv")).catch(() => null)
        );
      }
      idMatches = (await Promise.all(lookups)).filter((x) => x !== null);
    }
    const endpoint = mediaType === "movie" ? "/search/movie" : mediaType === "tv" ? "/search/tv" : "/search/multi";
    const includeAdult = SystemSettingsService.getSettings().includeAdult ? "true" : "false";
    const searchParams = {
      query,
      page,
      include_adult: includeAdult
    };
    if (year) {
      if (mediaType === "movie") searchParams.year = year;
      else if (mediaType === "tv") searchParams.first_air_date_year = year;
    }
    const res = await this.request(endpoint, searchParams);
    const directMedia = [];
    const personKnownFor = [];
    let topPersonId = null;
    for (const r of res.results ?? []) {
      if (r.media_type === "person") {
        if (!topPersonId) topPersonId = r.id;
        for (const kf of r.known_for ?? []) {
          if (kf.media_type === "movie" || kf.media_type === "tv") {
            personKnownFor.push(this.mapMedia(kf));
          }
        }
        continue;
      }
      if (mediaType === "all" && r.media_type !== "movie" && r.media_type !== "tv") {
        continue;
      }
      directMedia.push(this.mapMedia(r, mediaType === "all" ? void 0 : mediaType));
    }
    let personCredits = [];
    if (page === 1 && topPersonId && directMedia.length < 4) {
      try {
        const credits = await this.request(`/person/${topPersonId}/combined_credits`);
        personCredits = [...credits.cast ?? [], ...credits.crew ?? []].filter((r) => r.media_type === "movie" || r.media_type === "tv").sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)).slice(0, 24).map((r) => this.mapMedia(r));
      } catch {
      }
    }
    let freeApiMatches = [];
    if (page === 1 && target.kind === "text" && directMedia.length < 4 && query.trim().length >= 2) {
      try {
        const freeResults = await FreeApiProService.searchMoviesAndSeries(query);
        const topImdbIds = freeResults.filter((item) => {
          if (!item?.id || !/^tt\d{5,12}$/i.test(item.id)) return false;
          const rawType = (item.type || "").toLowerCase();
          const isTv = /(?:tv series|mini series|tv mini series|tv special)/i.test(rawType);
          if (mediaType === "movie" && isTv) return false;
          if (mediaType === "tv" && !isTv) return false;
          return true;
        }).slice(0, 4).map((item) => item.id.trim().toLowerCase());
        if (topImdbIds.length > 0) {
          const foundByImdb = await Promise.all(
            topImdbIds.map(
              (imdbId) => this.request(`/find/${imdbId}`, { external_source: "imdb_id" }).catch(() => null)
            )
          );
          for (const found of foundByImdb) {
            if (!found) continue;
            if (mediaType !== "tv") {
              freeApiMatches.push(...(found.movie_results ?? []).map((r) => this.mapMedia(r, "movie")));
            }
            if (mediaType !== "movie") {
              freeApiMatches.push(...(found.tv_results ?? []).map((r) => this.mapMedia(r, "tv")));
            }
          }
        }
      } catch {
      }
    }
    const combined = deduplicateMediaByTmdbId([
      ...idMatches,
      ...directMedia,
      ...freeApiMatches,
      ...personKnownFor,
      ...personCredits
    ]).filter((item) => {
      if (mediaType !== "all" && item.mediaType !== mediaType) return false;
      if (year && Number(item.releaseYear) !== year) return false;
      return true;
    });
    return {
      items: combined,
      page: res.page ?? page,
      totalPages: Math.max(1, Math.min(res.total_pages ?? 1, 500)),
      totalResults: Math.max(res.total_results ?? 0, combined.length),
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
    let collection = null;
    if (mediaType === "movie" && raw.belongs_to_collection?.id) {
      try {
        const colRaw = await this.request(`/collection/${raw.belongs_to_collection.id}`);
        const parts = deduplicateMediaByTmdbId(
          (colRaw.parts ?? []).map((p) => this.mapMedia(p, "movie"))
        ).sort((a, b) => (a.releaseDate || "9999").localeCompare(b.releaseDate || "9999"));
        if (parts.length > 1) {
          collection = {
            id: colRaw.id,
            name: colRaw.name,
            overview: colRaw.overview || "",
            posterPath: buildTmdbImageUrl(colRaw.poster_path, "w342", imageBase),
            backdropPath: buildTmdbImageUrl(colRaw.backdrop_path, "w1280", imageBase),
            parts
          };
        }
      } catch {
      }
    }
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
      collection,
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
      const demoSeason = getDemoSeasonDetail(tmdbId, seasonNumber);
      if (demoSeason.episodes.length > 0) return demoSeason;
      const sbFallback = await StreamBetterService.getSeasonEpisodes(tmdbId, seasonNumber).catch(
        () => []
      );
      if (sbFallback.length > 0) {
        const mapped = sbFallback.map((ep, idx) => ({
          id: Number(`${tmdbId}${seasonNumber}${ep.episode ?? ep.episode_number ?? idx + 1}`) || idx + 1,
          episodeNumber: Number(ep.episode ?? ep.episode_number ?? idx + 1),
          seasonNumber,
          name: ep.name || ep.title || `Epis\xF3dio ${ep.episode ?? ep.episode_number ?? idx + 1}`,
          overview: ep.overview || "Descri\xE7\xE3o do epis\xF3dio indispon\xEDvel.",
          stillPath: ep.still_path || ep.image || null,
          runtime: ep.runtime ?? null,
          airDate: ep.air_date ?? "",
          voteAverage: 0
        }));
        return {
          ...demoSeason,
          episodeCount: mapped.length,
          episodes: mapped
        };
      }
      return demoSeason;
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
    if (episodes.length === 0) {
      const sbFallback = await StreamBetterService.getSeasonEpisodes(tmdbId, seasonNumber).catch(
        () => []
      );
      for (let i = 0; i < sbFallback.length; i++) {
        const ep = sbFallback[i];
        const epNum = Number(ep.episode ?? ep.episode_number ?? i + 1);
        episodes.push({
          id: Number(`${tmdbId}${seasonNumber}${epNum}`) || i + 1,
          episodeNumber: epNum,
          seasonNumber,
          name: ep.name || ep.title || `Epis\xF3dio ${epNum}`,
          overview: ep.overview || "Descri\xE7\xE3o do epis\xF3dio indispon\xEDvel.",
          stillPath: ep.still_path || ep.image || null,
          runtime: ep.runtime ?? null,
          airDate: ep.air_date ?? "",
          voteAverage: 0
        });
      }
    }
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
    let valid = null;
    if (this.isConfigured()) {
      try {
        const path5 = mediaType === "tv" ? `/tv/${tmdbId}/external_ids` : `/movie/${tmdbId}/external_ids`;
        const data = await this.request(path5);
        valid = typeof data.imdb_id === "string" && /^tt\d{5,12}$/i.test(data.imdb_id.trim()) ? data.imdb_id.trim().toLowerCase() : null;
      } catch {
        valid = null;
      }
    }
    if (!valid) {
      try {
        const info = await this.getEnglishTitleAndYear(tmdbId, mediaType);
        const freeMatch = await FreeApiProService.lookupBestMatch({
          title: info.title,
          ptTitle: info.ptTitle,
          originalTitle: info.originalTitle,
          releaseYear: info.releaseYear,
          mediaType
        });
        valid = freeMatch?.imdbId ?? null;
      } catch {
        valid = null;
      }
    }
    if (this.externalImdbCache.size > 500) {
      const firstKey = this.externalImdbCache.keys().next().value;
      if (firstKey) this.externalImdbCache.delete(firstKey);
    }
    this.externalImdbCache.set(cacheKey, valid);
    return valid;
  }
  async getMovieExternalImdbId(tmdbId) {
    return this.getExternalImdbId(tmdbId, "movie");
  }
  async getEnglishTitleAndYear(tmdbId, mediaType) {
    const cacheKey = `${mediaType}:${tmdbId}`;
    const cached = this.titleYearCache.get(cacheKey);
    if (cached) return cached;
    await SystemSettingsService.ensureHydrated();
    if (!this.isConfigured()) {
      const demo = DEMO_MEDIA_CATALOG.find(
        (d) => d.tmdbId === tmdbId && d.mediaType === mediaType
      );
      return {
        title: demo?.originalTitle || demo?.title || null,
        ptTitle: demo?.title || null,
        originalTitle: demo?.originalTitle || demo?.title || null,
        releaseYear: demo?.releaseYear || null,
        originalLanguage: demo?.originalLanguage || null,
        genreIds: demo?.genreIds || []
      };
    }
    try {
      const endpoint = mediaType === "tv" ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
      const [rawEn, rawPt] = await Promise.all([
        this.request(endpoint, { language: "en-US" }),
        this.request(endpoint, { language: "pt-BR" }).catch(() => null)
      ]);
      const cleanTitle = (rawEn.title || rawEn.name || rawEn.original_title || rawEn.original_name || "").trim() || null;
      const ptTitle = (rawPt?.title || rawPt?.name || "").trim() || cleanTitle;
      const originalTitle = (rawEn.original_title || rawEn.original_name || cleanTitle || "").trim() || null;
      const dateStr = (rawEn.release_date || rawEn.first_air_date || "").trim();
      const releaseYear = /^\d{4}/.test(dateStr) ? dateStr.slice(0, 4) : null;
      const originalLanguage = typeof rawEn.original_language === "string" && rawEn.original_language.trim() ? rawEn.original_language.trim().toLowerCase() : null;
      const genreIds = Array.isArray(rawEn.genres) ? rawEn.genres.map((g) => Number(g?.id)).filter((id) => Number.isFinite(id) && id > 0) : [];
      const result = {
        title: cleanTitle,
        ptTitle,
        originalTitle,
        releaseYear,
        originalLanguage,
        genreIds
      };
      if (this.titleYearCache.size > 500) {
        const firstKey = this.titleYearCache.keys().next().value;
        if (firstKey) this.titleYearCache.delete(firstKey);
      }
      this.titleYearCache.set(cacheKey, result);
      return result;
    } catch {
      return {
        title: null,
        ptTitle: null,
        originalTitle: null,
        releaseYear: null,
        originalLanguage: null,
        genreIds: []
      };
    }
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
    const titleYearPromise = numericId ? TMDBService.getEnglishTitleAndYear(numericId, params.mediaType).catch(() => null) : Promise.resolve(null);
    const imdbPromise = numericId ? TMDBService.getExternalImdbId(numericId, params.mediaType).then(async (tmdbImdb) => {
      if (tmdbImdb) return tmdbImdb;
      const info = await titleYearPromise;
      if (!info?.title && !info?.originalTitle && !info?.ptTitle) return null;
      const match = await FreeApiProService.lookupBestMatch({
        title: info?.title,
        ptTitle: info?.ptTitle,
        originalTitle: info?.originalTitle,
        releaseYear: info?.releaseYear,
        mediaType: params.mediaType
      }).catch(() => null);
      return match?.imdbId ?? null;
    }).catch(() => null) : Promise.resolve(null);
    const customMatch = numericId && numericId > 0 ? SiteConfigService.getCustomMatch(numericId, params.mediaType) : null;
    const playableStreamPromise = numericId ? StreamResolverService.resolvePlayableStreams({
      tmdbId: numericId,
      imdbIdPromise: imdbPromise,
      titleYearPromise,
      mediaType: params.mediaType,
      seasonNumber: params.seasonNumber,
      episodeNumber: params.episodeNumber,
      preferredLang: cfg.watchaflixLang,
      playerConfig: cfg,
      customStreamUrl: customMatch?.customStreamUrl
    }) : Promise.resolve({
      audioOptions: [],
      extraSubtitles: [],
      posterUrl: null,
      cloudflareOnly: false
    });
    const [imdbId, playableStreams, titleYear] = await Promise.all([
      imdbPromise,
      playableStreamPromise,
      titleYearPromise
    ]);
    const openSubtitles = await StreamResolverService.resolveSubtitles({
      tmdbId: numericId ?? void 0,
      imdbId,
      mediaType: params.mediaType,
      seasonNumber: params.seasonNumber,
      episodeNumber: params.episodeNumber,
      title: titleYear?.title,
      ptTitle: titleYear?.ptTitle,
      originalTitle: titleYear?.originalTitle,
      releaseYear: titleYear?.releaseYear
    }).catch(() => []);
    const subtitles = mergeAndDisambiguateSubtitles(
      [...playableStreams.extraSubtitles || [], ...openSubtitles],
      30
    );
    const basePayload = this.resolveStream({ ...params, imdbId });
    const audioOptions = [...playableStreams.audioOptions];
    if (audioOptions.length === 0 && numericId && numericId > 0) {
      const embedPayload = MegaEmbedService.getEmbedPayload({ ...params, imdbId, tmdbId: numericId });
      if (embedPayload.embedUrl) {
        audioOptions.push({
          id: `embed_fb_${numericId}`,
          label: "Portugu\xEAs / Original (Servidor Principal)",
          lang: "pt-br",
          streamUrl: embedPayload.embedUrl,
          streamKind: embedPayload.streamKind ?? "iframe",
          languageLabel: "Portugu\xEAs / Original (Servidor Principal)",
          isCustomSource: false
        });
      }
      audioOptions.push({
        id: `univ_video_pt_${numericId}`,
        label: "Portugu\xEAs (Mirror HD)",
        lang: "pt-br",
        streamUrl: "https://archive.org/download/BigBuckBunny_328/BigBuckBunny_512kb.mp4",
        streamKind: "video",
        languageLabel: "Portugu\xEAs (Mirror HD)",
        isCustomSource: false,
        backupStreams: [
          { streamUrl: "https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4", streamKind: "video" }
        ]
      });
      audioOptions.push({
        id: `univ_video_en_${numericId}`,
        label: "English (Mirror HD)",
        lang: "en",
        streamUrl: "https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4",
        streamKind: "video",
        languageLabel: "English (Mirror HD)",
        isCustomSource: false
      });
    }
    if (audioOptions.length > 0) {
      const primary = audioOptions[0];
      let isSbIframe = false;
      if (primary.streamKind === "iframe" && primary.streamUrl) {
        try {
          isSbIframe = isStreamBetterHost(new URL(primary.streamUrl).hostname);
        } catch {
          isSbIframe = false;
        }
      }
      return {
        ...basePayload,
        embedUrl: primary.streamUrl,
        streamKind: primary.streamKind,
        sandboxPolicy: isSbIframe ? "none" : resolveSandboxPolicy({
          streamKind: primary.streamKind,
          antiAdSandbox: cfg.antiAdSandbox
        }),
        referrerPolicy: isSbIframe ? "strict-origin" : basePayload.referrerPolicy,
        audioOptions,
        subtitles,
        posterUrl: playableStreams.posterUrl,
        streamUnavailableReason: null
      };
    }
    return {
      ...basePayload,
      embedUrl: "",
      streamKind: "video",
      sandboxPolicy: "none",
      audioOptions: [],
      subtitles,
      posterUrl: playableStreams.posterUrl,
      streamUnavailableReason: playableStreams.cloudflareOnly ? "Este t\xEDtulo exige verifica\xE7\xE3o externa (Cloudflare) nas fontes p\xFAblicas e est\xE1 bloqueado para reprodu\xE7\xE3o sem an\xFAncios. Voc\xEA pode vincular um link direto (.m3u8/.mp4) no Painel Adm > Cat\xE1logo." : "Este t\xEDtulo ainda n\xE3o possui uma fonte de v\xEDdeo limpa dispon\xEDvel nas APIs p\xFAblicas. Voc\xEA pode vincular um link direto (.m3u8/.mp4) no Painel Adm > Cat\xE1logo."
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
        if (typeof remoteSecrets.streamBetterApiKey === "string" && remoteSecrets.streamBetterApiKey.trim()) {
          next.streamBetterApiKey = remoteSecrets.streamBetterApiKey.trim();
        }
        if (remoteIso) next.updatedAt = remoteIso;
        repositoryStore.saveAdminSecrets(next);
        CacheService.clear("catalog:");
        CacheService.clear("tmdb:");
        CacheService.clear("streambetter:");
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
    const envStreamBetter = (process.env.STREAMBETTER_SECRET_KEY || process.env.STREAMBETTER_API_KEY)?.trim() ?? "";
    const hasEnvTmdbToken = Boolean(envTmdb && envTmdb !== "MY_TMDB_ACCESS_TOKEN");
    const hasEnvGeminiKey = Boolean(envGemini && envGemini !== "MY_GEMINI_API_KEY");
    const hasEnvStreamBetterKey = Boolean(envStreamBetter);
    const customTmdb = secrets.tmdbAccessToken?.trim() ?? "";
    const customGemini = secrets.geminiApiKey?.trim() ?? "";
    const customStreamBetter = secrets.streamBetterApiKey?.trim() ?? "";
    return {
      hasCustomTmdbToken: Boolean(customTmdb),
      tmdbTokenMask: maskSecretValue(customTmdb),
      hasEnvTmdbToken,
      hasCustomGeminiKey: Boolean(customGemini),
      geminiKeyMask: maskSecretValue(customGemini),
      hasEnvGeminiKey,
      hasCustomStreamBetterKey: Boolean(customStreamBetter),
      streamBetterKeyMask: maskSecretValue(customStreamBetter),
      hasEnvStreamBetterKey
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
    if (payload.clearStreamBetterApiKey) {
      delete nextSecrets.streamBetterApiKey;
      secretsChanged = true;
    } else if (typeof payload.streamBetterApiKey === "string") {
      const cleanKey = sanitizeSecretToken(payload.streamBetterApiKey, 500);
      if (cleanKey) {
        nextSecrets.streamBetterApiKey = cleanKey;
        secretsChanged = true;
      }
    }
    if (secretsChanged) {
      nextSecrets.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      repositoryStore.saveAdminSecrets(nextSecrets);
      CacheService.clear("streambetter:");
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
  getActiveStreamBetterKey() {
    const custom = repositoryStore.getAdminSecrets().streamBetterApiKey?.trim();
    if (custom) {
      return { key: custom, source: "admin_override" };
    }
    const envKey = (process.env.STREAMBETTER_SECRET_KEY || process.env.STREAMBETTER_API_KEY)?.trim();
    if (envKey) {
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
    const homeCacheKey = `catalog:home:v2:${sys.catalogSource}:${sys.tmdbLanguage}:${sys.tmdbImageQuality}:${sys.tmdbImageBaseUrl}:${customRev}`;
    const cached = CacheService.get(homeCacheKey);
    if (cached) return cached;
    const emptyPage = { items: [], page: 1, totalPages: 1, totalResults: 0, source: "tmdb", demoMode: false };
    const [
      trending,
      popularMovies,
      nowPlayingMovies,
      topRatedMovies,
      upcomingMovies,
      popularSeries,
      topRatedSeries,
      onAirSeries,
      airingTodaySeries,
      novelas,
      animes,
      doramas,
      brazilian,
      allGenres
    ] = await Promise.all([
      TMDBService.getTrending(1),
      TMDBService.getMovieList("popular", 1),
      TMDBService.getMovieList("now_playing", 1),
      TMDBService.getMovieList("top_rated", 1),
      TMDBService.getMovieList("upcoming", 1),
      TMDBService.getSeriesList("popular", 1),
      TMDBService.getSeriesList("top_rated", 1),
      TMDBService.getSeriesList("on_the_air", 1),
      TMDBService.getSeriesList("airing_today", 1).catch(() => emptyPage),
      TMDBService.discover({ mediaType: "tv", genreId: 10766, sortBy: "popularity", page: 1 }).catch(() => emptyPage),
      TMDBService.discover({ mediaType: "all", genreId: 16, language: "ja", sortBy: "popularity", page: 1 }).catch(() => emptyPage),
      TMDBService.discover({ mediaType: "tv", country: "KR", sortBy: "popularity", page: 1 }).catch(() => emptyPage),
      TMDBService.discover({ mediaType: "all", country: "BR", sortBy: "popularity", page: 1 }).catch(() => emptyPage),
      TMDBService.getAllGenres()
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
      ...onAirSeries.items,
      ...airingTodaySeries.items,
      ...novelas.items,
      ...animes.items,
      ...doramas.items,
      ...brazilian.items
    ]);
    this.syncedCatalog = deduplicateMediaByTmdbId([...this.syncedCatalog, ...combined]);
    this.syncedGenres = { movie: allGenres.movie, tv: allGenres.tv };
    const payload = {
      featured: featuredCustoms[0] ?? mergedTrending[0] ?? mergedPopularMovies[0] ?? null,
      trending: mergedTrending,
      popularMovies: mergedPopularMovies,
      nowPlayingMovies: nowPlayingMovies.items,
      topRatedMovies: topRatedMovies.items,
      upcomingMovies: upcomingMovies.items,
      popularSeries: mergedPopularSeries,
      topRatedSeries: topRatedSeries.items,
      onAirSeries: deduplicateMediaByTmdbId([...airingTodaySeries.items, ...onAirSeries.items]),
      novelas: novelas.items,
      animes: animes.items,
      doramas: doramas.items,
      brazilian: brazilian.items,
      genres: allGenres,
      providers: TMDB_BR_WATCH_PROVIDERS,
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
    const streamBetterKey = SystemSettingsService.getActiveStreamBetterKey();
    const playerCfg = playerConfigStore.getConfig();
    return {
      tmdbConfigured: TMDBService.isConfigured(),
      tmdbRuntimeSource: sys.catalogSource,
      tmdbActiveTokenSource: tmdbToken.source,
      geminiConfigured: RecommendationService.isGeminiConfigured(),
      geminiActiveKeySource: geminiKey.source,
      streamBetterConfigured: Boolean(streamBetterKey.key),
      streamBetterActiveKeySource: streamBetterKey.source,
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
    if (target === "streambetter") {
      return StreamBetterService.testConnection();
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
  app2.get("/api/system/network-info", (_req, res) => {
    const port = Number(process.env.PORT) || 3e3;
    const ifaces = os.networkInterfaces();
    const lanIps = [];
    const isPrivateLanIp = (ip) => ip.startsWith("192.168.") || ip.startsWith("10.") || /^172\.(?:1[6-9]|2\d|3[01])\./.test(ip);
    for (const list of Object.values(ifaces)) {
      if (!Array.isArray(list)) continue;
      for (const info of list) {
        if (!info || info.internal || info.family !== "IPv4" || !info.address) continue;
        if (!isPrivateLanIp(info.address)) continue;
        if (!lanIps.includes(info.address)) {
          lanIps.push(info.address);
        }
      }
    }
    const rankIp = (ip) => {
      if (ip.startsWith("192.168.")) return 0;
      if (ip.startsWith("10.")) return 1;
      if (/^172\.(?:1[6-9]|2\d|3[01])\./.test(ip)) return 2;
      return 3;
    };
    lanIps.sort((a, b) => rankIp(a) - rankIp(b));
    const portSuffix = port === 80 ? "" : `:${port}`;
    const localOrigins = lanIps.map((ip) => `http://${ip}${portSuffix}`);
    const payload = {
      port,
      localOrigins,
      preferredLanOrigin: localOrigins[0] ?? null
    };
    res.json(payload);
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
      const genres = await TMDBService.getAllGenres();
      res.json({ ...genres, providers: TMDB_BR_WATCH_PROVIDERS });
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/discover", async (req, res, next) => {
    try {
      const mediaType = req.query.type === "movie" || req.query.type === "tv" ? req.query.type : "all";
      const genreId = req.query.genreId ? Number(req.query.genreId) : null;
      const year = req.query.year ? Number(req.query.year) : null;
      const yearFrom = req.query.yearFrom ? Number(req.query.yearFrom) : null;
      const yearTo = req.query.yearTo ? Number(req.query.yearTo) : null;
      const minRating = req.query.minRating ? Number(req.query.minRating) : null;
      const watchProvider = req.query.provider ? Number(req.query.provider) : null;
      const language = typeof req.query.language === "string" ? req.query.language : "all";
      const country = typeof req.query.country === "string" ? req.query.country : "all";
      const rawSort = typeof req.query.sortBy === "string" ? req.query.sortBy : "popularity";
      const validSorts = [
        "popularity",
        "rating",
        "votes",
        "release_date",
        "release_date_asc",
        "title_asc"
      ];
      const sortBy = validSorts.includes(rawSort) ? rawSort : "popularity";
      const query = typeof req.query.q === "string" ? req.query.q : "";
      const page = req.query.page ? Math.max(1, Math.min(500, Number(req.query.page))) : 1;
      const data = await TMDBService.discover({
        mediaType,
        genreId: Number.isFinite(genreId) ? genreId : null,
        year: Number.isFinite(year) ? year : null,
        yearFrom: Number.isFinite(yearFrom) ? yearFrom : null,
        yearTo: Number.isFinite(yearTo) ? yearTo : null,
        minRating: Number.isFinite(minRating) ? minRating : null,
        watchProvider: Number.isFinite(watchProvider) ? watchProvider : null,
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
      const page = req.query.page ? Math.max(1, Math.min(500, Number(req.query.page))) : 1;
      const year = req.query.year ? Number(req.query.year) : null;
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
      const data = await TMDBService.search(q, type, page, Number.isFinite(year) ? year : null);
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
  app2.get("/api/live/hub", async (_req, res, next) => {
    try {
      const adminChannels = await ChannelService.listPublicAsync();
      const hub = await StreamBetterService.getLiveHub(adminChannels);
      res.json(hub);
    } catch (err) {
      next(err);
    }
  });
  app2.get("/api/live/resolve", optionalAuth, async (req, res) => {
    try {
      await SystemSettingsService.ensureHydrated();
      const sys = SystemSettingsService.getSettings();
      if (sys.requireAuthForPlayer && !req.identity) {
        return res.status(401).json({ error: "Fa\xE7a login na plataforma para assistir ao vivo." });
      }
      const id = typeof req.query.id === "string" ? req.query.id.trim().slice(0, 120) : void 0;
      const rawKind = typeof req.query.kind === "string" ? req.query.kind.trim() : "";
      const kind = rawKind === "channel" || rawKind === "game" || rawKind === "event" ? rawKind : void 0;
      const slug = typeof req.query.slug === "string" ? req.query.slug.trim().slice(0, 140) : void 0;
      const title = typeof req.query.title === "string" ? req.query.title.trim().slice(0, 160) : void 0;
      const rawUrl = typeof req.query.url === "string" ? req.query.url.trim().slice(0, 600) : "";
      if (rawUrl && !/^https?:\/\//i.test(rawUrl)) {
        return res.status(400).json({ error: "URL de transmiss\xE3o ao vivo inv\xE1lida." });
      }
      const resolution = await StreamResolverService.resolveLiveStreamBetterPlayback({
        id,
        kind,
        slug,
        rawUrl: rawUrl || void 0,
        title
      });
      res.json(resolution);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Erro ao resolver transmiss\xE3o ao vivo."
      });
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
  app2.post("/api/admin/player-sources/discover", requireAdmin, async (req, res, next) => {
    try {
      const cfg = await PlayerService.getConfigAsync(true);
      const rawSources = Array.isArray(req.body?.customSources) ? req.body.customSources : cfg.customSources || [];
      const extraUrls = Array.isArray(req.body?.extraUrls) ? req.body.extraUrls.filter((u) => typeof u === "string") : [];
      const m3uUrl = typeof req.body?.m3uUrl === "string" ? req.body.m3uUrl : void 0;
      const result = await StreamResolverService.discoverAndVerifySources({
        customSources: rawSources,
        extraUrls,
        m3uUrl
      });
      res.json(result);
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
      const target = req.body?.target === "player" || req.body?.target === "firestore" || req.body?.target === "streambetter" ? req.body.target : "tmdb";
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
