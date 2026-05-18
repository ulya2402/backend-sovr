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