"""Export a small read-only roster slice for the M2 interface prototype."""
import hashlib
import json
import pathlib
import sqlite3

game_root = pathlib.Path(__file__).resolve().parents[1]
database = game_root.parents[1] / "data/nba/2026-10-03/nba.sqlite"
connection = sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)
connection.row_factory = sqlite3.Row
teams = [dict(row) for row in connection.execute(
    "SELECT team_id AS id,name_zh AS name,name_en AS englishName,abbr,color FROM teams ORDER BY abbr"
)]
players = [dict(row) for row in connection.execute(
    "SELECT r.player_id AS id,r.name_en AS name,t.team_id AS teamId,r.position,"
    "r.base_salary_usd AS salaryUsd,r.current_salary_status AS salaryStatus "
    "FROM current_roster r JOIN teams t ON r.abbr=t.abbr ORDER BY r.name_en"
)]
snapshot = dict(connection.execute("SELECT * FROM snapshots LIMIT 1").fetchone())
connection.close()
output = game_root / "src/prototype/roster.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({
    "version": "m2-interface-20261003", "season": snapshot["roster_season"],
    "asOf": snapshot["as_of_date"], "fetchedToUtc": snapshot["fetched_to_utc"],
    "databaseSha256": hashlib.sha256(database.read_bytes()).hexdigest(),
    "teams": teams, "players": players,
}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(json.dumps({"teams": len(teams), "players": len(players),
                  "missingSalaries": sum(p["salaryUsd"] is None for p in players)}, ensure_ascii=False))
