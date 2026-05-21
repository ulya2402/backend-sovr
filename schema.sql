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

CREATE TABLE IF NOT EXISTS vault_tools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    logo TEXT,
    description TEXT,
    category TEXT,
    pricing TEXT,
    platform TEXT,
    url TEXT,
    summary TEXT,
    featured INTEGER DEFAULT 0, -- 🔥 TAMBAHAN: Kolom untuk menandai rekomendasi (0 = false, 1 = true)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS perspectives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    image_url TEXT,
    body TEXT,
    author TEXT,
    category TEXT,
    views INTEGER DEFAULT 0,
    published_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);