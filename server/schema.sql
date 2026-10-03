CREATE TABLE IF NOT EXISTS runs (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, nickname TEXT NOT NULL,
 difficulty TEXT NOT NULL, start_team TEXT NOT NULL, rules_version TEXT NOT NULL,
 roster_version TEXT NOT NULL, events TEXT NOT NULL DEFAULT '[]', revision INTEGER NOT NULL DEFAULT 0,
 assets INTEGER NOT NULL, day INTEGER NOT NULL DEFAULT 1, ended INTEGER NOT NULL DEFAULT 0,
 initial_cash INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_board ON runs (rules_version,roster_version,difficulty,assets DESC,created_at,id);
