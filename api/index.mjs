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
var DEFAULT_PLAYER_CONFIG = {
  defaultDomain: "mgeb.lat",
  availableDomains: ["mgeb.lat", "mgeb.space"],
  defaultPlayer: "vidstack",
  availablePlayers: ["vidstack", "megaplay", "megatube", "clappr"],
  defaultColorHex: "00a8ff",
  seriesSeasonEpisodeDocumented: true,
  seriesLimitationNote: "S\xE9ries utilizam o endpoint oficial /embed/{TMDB_ID}/{TEMPORADA}/{EPISODIO} com ?player= e #color:."
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
function buildTmdbImageUrl(path5, size = "w500", baseUrl = "https://image.tmdb.org/t/p/") {
  if (!path5) return null;
  if (path5.startsWith("http://") || path5.startsWith("https://") || path5.startsWith("/src/") || path5.startsWith("/assets/")) {
    return path5;
  }
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path5.startsWith("/") ? path5 : `/${path5}`;
  return `${normalizedBase}${size}${normalizedPath}`;
}

// server/services/AuthenticationService.ts
import fs3 from "node:fs";
import path3 from "node:path";

// server/repositories/interfaces.ts
import fs2 from "node:fs";
import path2 from "node:path";

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

// server/repositories/interfaces.ts
var DATA_FILE = process.env.VERCEL ? "/tmp/.megastream-store.json" : path2.resolve(process.cwd(), ".megastream-store.json");
var JsonRepositoryStore = class {
  constructor() {
    this.state = this.load();
  }
  load() {
    try {
      if (fs2.existsSync(DATA_FILE)) {
        const raw = fs2.readFileSync(DATA_FILE, "utf-8");
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
      fs2.writeFileSync(DATA_FILE, JSON.stringify(this.state, null, 2), "utf-8");
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

// server/services/AuthenticationService.ts
var ADMIN_EMAILS = /* @__PURE__ */ new Set(["meggadriver@gmail.com"]);
function getFirebaseProjectId() {
  try {
    const cfgPath = path3.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs3.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs3.readFileSync(cfgPath, "utf-8"));
      if (cfg.projectId) return cfg.projectId;
    }
  } catch {
  }
  return "gen-lang-client-0094430568";
}
var AuthenticationServiceImpl = class {
  constructor() {
    this.projectId = getFirebaseProjectId();
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
      const isAdminEmail = ADMIN_EMAILS.has(payload.email.toLowerCase());
      const isAdmin = isAdminEmail && Boolean(payload.email_verified) || existingUser?.role === "admin";
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
    const created = {
      uid: identity.uid,
      name: identity.name,
      email: identity.email,
      photoUrl: identity.picture,
      plan: "free",
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

// server/services/FirestoreRestService.ts
import fs4 from "node:fs";
import path4 from "node:path";
function loadConfig() {
  try {
    const cfgPath = path4.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs4.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs4.readFileSync(cfgPath, "utf-8"));
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
  async getDocument(docPath) {
    try {
      const res = await fetch(`${this.baseDocumentsUrl}/${docPath}`, {
        headers: { Accept: "application/json" },
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
  async queryActiveCollection(collectionId) {
    try {
      const res = await fetch(`${this.baseDocumentsUrl}:runQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
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
      if (!res.ok) return [];
      const rows = await res.json();
      const items = [];
      for (const row of rows) {
        if (row.document?.fields) {
          items.push(decodeFields(row.document.fields));
        }
      }
      return items;
    } catch {
      return [];
    }
  }
};
var FirestoreRestService = new FirestoreRestServiceImpl();

// server/services/SiteConfigService.ts
var SiteConfigServiceImpl = class {
  constructor() {
    this.lastHydratedAt = 0;
    this.hydrationTtlMs = 2e4;
  }
  async ensureHydrated(force = false) {
    if (!force && Date.now() - this.lastHydratedAt < this.hydrationTtlMs) {
      return;
    }
    const [remoteSite, remoteCustom] = await Promise.all([
      FirestoreRestService.getDocument("siteConfig/global"),
      FirestoreRestService.queryActiveCollection("customCatalog")
    ]);
    if (remoteSite) {
      const local = repositoryStore.getSiteConfig();
      const localTs = Date.parse(local.updatedAt || DEFAULT_SITE_CONFIG.updatedAt) || 0;
      const remoteIso = toIsoTimestamp(remoteSite.updatedAt, "");
      const remoteTs = remoteIso ? Date.parse(remoteIso) : 0;
      const isLocalDefault = local.updatedAt === DEFAULT_SITE_CONFIG.updatedAt;
      if (isLocalDefault || remoteTs >= localTs) {
        const merged = sanitizeSiteConfig(remoteSite, local, true);
        repositoryStore.saveSiteConfig(merged);
      }
    }
    if (remoteCustom.length > 0) {
      let changed = false;
      const localList = repositoryStore.getCustomCatalog();
      for (const raw of remoteCustom) {
        try {
          if (!raw.title) continue;
          const existing = raw.id ? localList.find((c) => c.id === raw.id) : void 0;
          const sanitized = sanitizeCustomMediaInput(raw, existing);
          const remoteItemIso = toIsoTimestamp(raw.updatedAt, "");
          if (remoteItemIso) {
            sanitized.updatedAt = remoteItemIso;
          }
          if (!existing || existing.updatedAt !== sanitized.updatedAt) {
            repositoryStore.upsertCustomMedia(sanitized);
            changed = true;
          }
        } catch {
        }
      }
      if (changed) {
        CacheService.clear("catalog:");
      }
    }
    this.lastHydratedAt = Date.now();
  }
  getConfig() {
    return repositoryStore.getSiteConfig();
  }
  async getConfigAsync() {
    await this.ensureHydrated();
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
  async listCustomCatalogAsync() {
    await this.ensureHydrated();
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
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var TMDBServiceImpl = class {
  constructor() {
    this.imageBaseUrl = "https://image.tmdb.org/t/p/";
  }
  isConfigured() {
    const token = process.env.TMDB_ACCESS_TOKEN?.trim();
    return Boolean(token && token !== "MY_TMDB_ACCESS_TOKEN");
  }
  getToken() {
    const token = process.env.TMDB_ACCESS_TOKEN?.trim();
    if (!token || token === "MY_TMDB_ACCESS_TOKEN") return null;
    return token;
  }
  async request(endpoint, params = {}) {
    const token = this.getToken();
    if (!token) {
      throw new Error("TMDB_ACCESS_TOKEN n\xE3o configurado");
    }
    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    if (!params.language) {
      url.searchParams.set("language", "pt-BR");
    }
    for (const [k, v] of Object.entries(params)) {
      if (v !== void 0 && v !== null && String(v).trim() !== "") {
        url.searchParams.set(k, String(v));
      }
    }
    const cacheKey = `tmdb:${url.toString()}`;
    const cached = CacheService.get(cacheKey);
    if (cached) return cached;
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      },
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
    CacheService.set(cacheKey, data, 10 * 60 * 1e3);
    return data;
  }
  async ensureImageConfig() {
    if (!this.isConfigured()) return this.imageBaseUrl;
    const cached = CacheService.get("tmdb:image_base_url");
    if (cached) return cached;
    try {
      const cfg = await this.request("/configuration", {});
      if (cfg.images?.secure_base_url) {
        this.imageBaseUrl = cfg.images.secure_base_url;
        CacheService.set("tmdb:image_base_url", this.imageBaseUrl, 60 * 60 * 1e3);
      }
    } catch {
    }
    return this.imageBaseUrl;
  }
  mapMedia(raw, forcedType) {
    const mediaType = forcedType ?? (raw.media_type === "tv" ? "tv" : "movie");
    const releaseDate = raw.release_date ?? raw.first_air_date ?? "";
    return {
      id: raw.id,
      tmdbId: raw.id,
      mediaType,
      title: raw.title ?? raw.name ?? "Sem t\xEDtulo",
      originalTitle: raw.original_title ?? raw.original_name ?? raw.title ?? raw.name ?? "",
      overview: raw.overview || "Sinopse indispon\xEDvel no momento.",
      posterPath: buildTmdbImageUrl(raw.poster_path, "w500", this.imageBaseUrl),
      backdropPath: buildTmdbImageUrl(raw.backdrop_path, "w1280", this.imageBaseUrl),
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
    if (!this.isConfigured()) {
      return mediaType === "movie" ? DEMO_MOVIE_GENRES : DEMO_TV_GENRES;
    }
    const res = await this.request(`/genre/${mediaType}/list`);
    return res.genres ?? [];
  }
  async getMovieList(category, page = 1) {
    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(DEMO_MEDIA_CATALOG, {
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
    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(DEMO_MEDIA_CATALOG, {
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
    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(DEMO_MEDIA_CATALOG, { sortBy: "popularity", page, pageSize: 20 });
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
    await SiteConfigService.ensureHydrated();
    const page = Math.max(1, params.page ?? 1);
    if (!this.isConfigured()) {
      const customAsMedia = repositoryStore.getCustomCatalog().filter((c) => c.active).map(customMediaToMediaItem);
      const subset = filterAndSortMedia(
        deduplicateMediaByTmdbId([...customAsMedia, ...DEMO_MEDIA_CATALOG]),
        {
          ...params,
          page,
          pageSize: 20
        }
      );
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
    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(DEMO_MEDIA_CATALOG, {
        mediaType,
        query,
        page,
        pageSize: 20
      });
      return { ...subset, source: "demo", demoMode: true };
    }
    await this.ensureImageConfig();
    const endpoint = mediaType === "movie" ? "/search/movie" : mediaType === "tv" ? "/search/tv" : "/search/multi";
    const res = await this.request(endpoint, { query, page, include_adult: "false" });
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
    await SiteConfigService.ensureHydrated();
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
    const cast = (raw.credits?.cast ?? []).slice(0, 14).map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profilePath: buildTmdbImageUrl(c.profile_path, "w185", this.imageBaseUrl)
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
        posterPath: buildTmdbImageUrl(s.poster_path, "w342", this.imageBaseUrl),
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
    if (!this.isConfigured()) {
      return getDemoSeasonDetail(tmdbId, seasonNumber);
    }
    await this.ensureImageConfig();
    const raw = await this.request(`/tv/${tmdbId}/season/${seasonNumber}`);
    const episodes = (raw.episodes ?? []).map((ep) => ({
      id: ep.id,
      episodeNumber: ep.episode_number,
      seasonNumber: ep.season_number,
      name: ep.name,
      overview: ep.overview || "Descri\xE7\xE3o do epis\xF3dio indispon\xEDvel.",
      stillPath: buildTmdbImageUrl(ep.still_path, "w500", this.imageBaseUrl),
      runtime: ep.runtime,
      airDate: ep.air_date ?? "",
      voteAverage: Number((ep.vote_average ?? 0).toFixed(1))
    }));
    return {
      id: raw.id,
      seasonNumber: raw.season_number,
      name: raw.name,
      overview: raw.overview,
      posterPath: buildTmdbImageUrl(raw.poster_path, "w342", this.imageBaseUrl),
      episodeCount: episodes.length,
      airDate: raw.air_date ?? "",
      episodes
    };
  }
};
var TMDBService = new TMDBServiceImpl();

// server/services/CatalogService.ts
var CatalogServiceImpl = class {
  constructor() {
    this.syncedCatalog = [];
    this.syncedGenres = { movie: [], tv: [] };
  }
  async syncCatalog() {
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
    await SiteConfigService.ensureHydrated();
    const cached = CacheService.get("catalog:home");
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
    CacheService.set("catalog:home", payload, 5 * 60 * 1e3);
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
    this.hydrationTtlMs = 2e4;
  }
  async ensureHydrated(force = false) {
    if (!force && Date.now() - this.lastHydratedAt < this.hydrationTtlMs) {
      return;
    }
    const remoteChannels = await FirestoreRestService.queryActiveCollection("channels");
    for (const raw of remoteChannels) {
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
      repositoryStore.upsertChannel(normalized);
    }
    this.lastHydratedAt = Date.now();
  }
  listPublic(category) {
    const channels = repositoryStore.getChannels().filter((c) => c.active);
    if (!category || category === "Todos") return channels;
    return channels.filter((c) => c.category === category);
  }
  async listPublicAsync(category) {
    await this.ensureHydrated();
    return this.listPublic(category);
  }
  listAllAdmin() {
    return repositoryStore.getChannels();
  }
  async listAllAdminAsync() {
    await this.ensureHydrated();
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
    const key = process.env.GEMINI_API_KEY?.trim();
    return Boolean(key && key !== "MY_GEMINI_API_KEY");
  }
  createClient() {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key || key === "MY_GEMINI_API_KEY") return null;
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
    const syncedCatalog = await CatalogService.getSyncedCatalog();
    const userPrompt = params.prompt.trim();
    const favTitles = params.favorites.slice(0, 8).map((f) => `${f.title} (${f.mediaType})`);
    const historyTitles = params.history.slice(0, 8).map((h) => `${h.title} (${h.mediaType})`);
    const ai = this.createClient();
    if (!ai) {
      return this.buildDeterministicFallback(userPrompt, syncedCatalog, favTitles, historyTitles);
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
      ).slice(0, 12);
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
      return this.buildDeterministicFallback(userPrompt, syncedCatalog, favTitles, historyTitles);
    }
  }
  buildDeterministicFallback(prompt, catalog, favTitles, historyTitles) {
    const q = prompt.toLowerCase();
    const keywordMatches = catalog.filter((item) => {
      if (!q) return true;
      const hay = `${item.title} ${item.originalTitle} ${item.overview}`.toLowerCase();
      return q.split(/\s+/).some((word) => word.length > 3 && hay.includes(word));
    });
    const selected = (keywordMatches.length > 0 ? keywordMatches : catalog).slice().sort((a, b) => b.voteAverage - a.voteAverage).slice(0, 8);
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
  async getDashboardStats() {
    await Promise.all([ChannelService.ensureHydrated(), SiteConfigService.ensureHydrated()]);
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
  async getIntegrationStatus() {
    const synced = await CatalogService.getSyncedCatalog();
    return {
      tmdbConfigured: TMDBService.isConfigured(),
      geminiConfigured: RecommendationService.isGeminiConfigured(),
      firebaseConfigured: true,
      megaEmbedConfigured: true,
      paymentGatewayConfigured: false,
      demoMode: !TMDBService.isConfigured(),
      cacheEntries: CacheService.size(),
      lastSyncAt: repositoryStore.getLastSyncAt(),
      catalogSyncedCount: synced.length
    };
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
};
var HistoryService = new HistoryServiceImpl();

// server/config/playerConfig.ts
var PlayerConfigStore = class {
  getPersisted() {
    const stored = repositoryStore.getPlayerSettings();
    if (!stored) {
      return { ...DEFAULT_PLAYER_CONFIG };
    }
    return {
      ...DEFAULT_PLAYER_CONFIG,
      defaultDomain: validateMegaEmbedDomain(stored.defaultDomain, DEFAULT_PLAYER_CONFIG.defaultDomain),
      defaultPlayer: validateMegaEmbedPlayer(stored.defaultPlayer, DEFAULT_PLAYER_CONFIG.defaultPlayer),
      defaultColorHex: sanitizeHexColor(stored.defaultColorHex, DEFAULT_PLAYER_CONFIG.defaultColorHex)
    };
  }
  getConfig() {
    return this.getPersisted();
  }
  updateConfig(partial) {
    const current = this.getPersisted();
    const nextDomain = partial.defaultDomain ? validateMegaEmbedDomain(partial.defaultDomain, current.defaultDomain) : current.defaultDomain;
    const nextPlayer = partial.defaultPlayer ? validateMegaEmbedPlayer(partial.defaultPlayer, current.defaultPlayer) : current.defaultPlayer;
    const nextColor = partial.defaultColorHex ? sanitizeHexColor(partial.defaultColorHex, current.defaultColorHex) : current.defaultColorHex;
    repositoryStore.savePlayerSettings({
      defaultDomain: nextDomain,
      defaultPlayer: nextPlayer,
      defaultColorHex: nextColor
    });
    return this.getPersisted();
  }
};
var playerConfigStore = new PlayerConfigStore();

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
    const embedUrl = buildMegaEmbedUrl({
      tmdbId: validId,
      domain,
      player,
      colorHex,
      mediaType: params.mediaType,
      seasonNumber,
      episodeNumber
    });
    return {
      tmdbId: validId,
      mediaType: params.mediaType,
      embedUrl,
      domain,
      player,
      colorHex,
      seasonNumber,
      episodeNumber,
      ...params.mediaType === "tv" && !cfg.seriesSeasonEpisodeDocumented ? {
        seriesSupportNote: cfg.seriesLimitationNote
      } : {}
    };
  }
};
var MegaEmbedService = new MegaEmbedServiceImpl();

// server/services/PlayerService.ts
var PlayerServiceImpl = class {
  constructor() {
    this.lastHydratedAt = 0;
    this.hydrationTtlMs = 2e4;
  }
  async ensureHydrated(force = false) {
    if (!force && Date.now() - this.lastHydratedAt < this.hydrationTtlMs) {
      return;
    }
    const remote = await FirestoreRestService.getDocument("playerSettings/global");
    if (remote) {
      playerConfigStore.updateConfig({
        defaultDomain: remote.defaultDomain,
        defaultPlayer: remote.defaultPlayer,
        defaultColorHex: remote.defaultColorHex
      });
    }
    this.lastHydratedAt = Date.now();
  }
  getConfig() {
    return playerConfigStore.getConfig();
  }
  async getConfigAsync() {
    await this.ensureHydrated();
    return playerConfigStore.getConfig();
  }
  updateConfig(partial) {
    const updated = playerConfigStore.updateConfig(partial);
    this.lastHydratedAt = Date.now();
    repositoryStore.addLog({
      level: "info",
      service: "PlayerService",
      message: `Configura\xE7\xE3o do player atualizada: ${updated.defaultDomain} (${updated.defaultPlayer}, #${updated.defaultColorHex}).`
    });
    return updated;
  }
  async resolveStreamAsync(params) {
    await Promise.all([this.ensureHydrated(), SiteConfigService.ensureHydrated()]);
    return this.resolveStream(params);
  }
  resolveStream(params) {
    const numericId = Number(params.tmdbId);
    const customMatch = Number.isInteger(numericId) && numericId > 0 ? SiteConfigService.getCustomMatch(numericId, params.mediaType) : null;
    if (customMatch?.customStreamUrl) {
      const cfg = playerConfigStore.getConfig();
      repositoryStore.incrementPlaybackCounter();
      return {
        tmdbId: numericId,
        mediaType: params.mediaType,
        embedUrl: customMatch.customStreamUrl,
        domain: cfg.defaultDomain,
        player: cfg.defaultPlayer,
        colorHex: cfg.defaultColorHex,
        seasonNumber: params.mediaType === "tv" ? params.seasonNumber ?? 1 : void 0,
        episodeNumber: params.mediaType === "tv" ? params.episodeNumber ?? 1 : void 0
      };
    }
    const result = MegaEmbedService.getEmbedPayload(params);
    repositoryStore.incrementPlaybackCounter();
    return result;
  }
};
var PlayerService = new PlayerServiceImpl();

// server/services/ProfileService.ts
import crypto from "node:crypto";

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
    const current = this.ensureProfiles(userId);
    if (current.length >= MAX_PROFILES_PER_ACCOUNT) {
      throw new Error(`Limite m\xE1ximo de ${MAX_PROFILES_PER_ACCOUNT} perfis por conta atingido.`);
    }
    const profileId = `prof_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
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
  app2.get("/api/health", (_req, res) => {
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
  app2.get("/api/integrations/status", requireAdmin, async (_req, res, next) => {
    try {
      const status = await AdminService.getIntegrationStatus();
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
  app2.get("/api/player/movie/:tmdbId", async (req, res) => {
    try {
      const payload = await PlayerService.resolveStreamAsync({
        tmdbId: req.params.tmdbId,
        mediaType: "movie"
      });
      res.json({
        tmdbId: payload.tmdbId,
        mediaType: payload.mediaType,
        embedUrl: payload.embedUrl
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Erro ao carregar reprodu\xE7\xE3o." });
    }
  });
  app2.get("/api/player/tv/:tmdbId", async (req, res) => {
    try {
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
        seasonNumber: payload.seasonNumber,
        episodeNumber: payload.episodeNumber
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
  app2.get("/api/admin/dashboard", requireAdmin, async (_req, res, next) => {
    try {
      const [stats, integrations] = await Promise.all([
        AdminService.getDashboardStats(),
        AdminService.getIntegrationStatus()
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
      res.json({ items: await ChannelService.listAllAdminAsync() });
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
      res.json(await PlayerService.getConfigAsync());
    } catch (err) {
      next(err);
    }
  });
  app2.put("/api/admin/player-config", requireAdmin, (req, res) => {
    const updated = PlayerService.updateConfig(req.body ?? {});
    res.json(updated);
  });
  app2.get("/api/admin/site-config", requireAdmin, async (_req, res, next) => {
    try {
      res.json(await SiteConfigService.getConfigAsync());
    } catch (err) {
      next(err);
    }
  });
  app2.put("/api/admin/site-config", requireAdmin, (req, res) => {
    const updated = SiteConfigService.updateConfig(req.body ?? {});
    res.json(updated);
  });
  app2.get("/api/admin/catalog/custom", requireAdmin, async (_req, res, next) => {
    try {
      res.json({ items: await SiteConfigService.listCustomCatalogAsync() });
    } catch (err) {
      next(err);
    }
  });
  app2.post("/api/admin/catalog/custom", requireAdmin, (req, res) => {
    try {
      const saved = SiteConfigService.upsertCustomMedia(req.body ?? {});
      res.status(201).json(saved);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Erro ao salvar m\xEDdia." });
    }
  });
  app2.delete("/api/admin/catalog/custom/:id", requireAdmin, (req, res) => {
    const removed = SiteConfigService.deleteCustomMedia(req.params.id);
    if (!removed) return res.status(404).json({ error: "M\xEDdia personalizada n\xE3o encontrada." });
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
