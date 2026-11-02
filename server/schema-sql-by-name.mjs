// Fresh catalog lookup only: no schema verdict, epoch or cross-call cache.
// sqlite_master is a rowid table. Preserve the original name-only .get()
// first-match behavior when table/trigger namespaces contain the same name.
export function schemaSqlByName(db, names) {
  const unique = [...new Set(names)], result = new Map();
  for (let start = 0; start < unique.length; start += 64) {
    const batch = unique.slice(start, start + 64);
    const rows = db.prepare('SELECT name,sql FROM sqlite_master WHERE name IN (' + batch.map(() => '?').join(',') + ') ORDER BY rowid').all(...batch);
    for (const row of rows) if (!result.has(row.name)) result.set(row.name, row.sql);
  }
  return result;
}
