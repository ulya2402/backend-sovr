DROP TABLE IF EXISTS articles;

CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag TEXT,
    category TEXT,
    title TEXT,
    body TEXT,
    author TEXT,
    source_name TEXT,
    source_url TEXT,
    source_logo TEXT,
    published_date TEXT,
    status TEXT DEFAULT 'published',
    featured INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_cache (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vault_tools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    logo TEXT,
    description TEXT,
    category TEXT,
    pricing TEXT,
    platform TEXT,
    url TEXT,
    summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);