-- MegaStream PostgreSQL Migration Schema (Future RDBMS Target)
-- Prepared for seamless migration from Cloud Firestore / Repository Store to PostgreSQL.

CREATE TABLE IF NOT EXISTS users (
  uid VARCHAR(128) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  photo_url TEXT,
  plan VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'monthly', 'quarterly', 'annual')),
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  blocked BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_theme VARCHAR(32) NOT NULL DEFAULT 'cinematografico',
  preferred_language VARCHAR(16) NOT NULL DEFAULT 'pt-BR',
  preferred_quality VARCHAR(16) NOT NULL DEFAULT '1080p',
  parental_control BOOLEAN NOT NULL DEFAULT FALSE,
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('movie', 'tv')),
  title VARCHAR(200) NOT NULL,
  poster_path TEXT,
  vote_average NUMERIC(3,1) DEFAULT 0,
  release_year VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tmdb_id, media_type)
);

CREATE TABLE IF NOT EXISTS playback_history (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('movie', 'tv')),
  title VARCHAR(200) NOT NULL,
  poster_path TEXT,
  backdrop_path TEXT,
  progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  season_number INTEGER,
  episode_number INTEGER,
  player_provider VARCHAR(32),
  watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tmdb_id, media_type)
);

CREATE TABLE IF NOT EXISTS live_channels (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(40) NOT NULL CHECK (category IN ('Notícias', 'Esportes', 'Entretenimento', 'Filmes', 'Variedades', 'Infantil')),
  stream_url TEXT NOT NULL,
  logo_url TEXT,
  description VARCHAR(300),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id VARCHAR(128) PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
  plan_id VARCHAR(20) NOT NULL CHECK (plan_id IN ('monthly', 'quarterly', 'annual')),
  status VARCHAR(24) NOT NULL CHECK (status IN ('pending_gateway', 'active', 'canceled', 'expired')),
  amount_brl NUMERIC(10,2) NOT NULL,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_logs (
  id VARCHAR(128) PRIMARY KEY,
  level VARCHAR(10) NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  service VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
