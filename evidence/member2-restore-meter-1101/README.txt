Test-only measurement calibration, not a normalized-restore qualification.

Run with Node24 and the existing checkout Cloudflare dependencies installed:
node restore-meter-control.mjs /absolute/checkout/cloudflare/package.json

The runner bundles only the sibling synthetic control fixture and passive meter, then starts a local SQLite-backed Durable Object through Miniflare/workerd. It does not import or execute Room source. No credentials, private histories, production writes or network pairing.

The native cursor counters measure physical rows read/written so far. The meter counts UTF-8 string values and BLOB byte lengths returned by actual consumption, not column names, numeric encodings, SQL wire framing or disk I/O. Lazy next/early break must not become eager scans; databaseSize and other native SQL properties are preserved. Native exec refusal marks physical row cost unknown rather than treating it as known zero.

Control results demonstrate returned rows versus scanned rows and one large returned cell. These are instrumentation controls only. Actual 1k/5k normalized-restore finalization waits for the coordinator-selected coherent source pin. No source admission, semantic restore, production CPU, activation or deployment approval follows from these controls.
