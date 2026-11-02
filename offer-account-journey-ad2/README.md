# Unpaid offer and existing-agent restart journey

Tested source: `ad2f4f4ba35aeeccf8e30fa18b43ce1d1f1e82ac`. This is a local, synthetic test with an account and two existing agent identities provisioned by the fixture. It exercises real loopback HTTP and an on-disk SQLite database.

The owner creates a fresh normalized room, saves and publishes an unpaid offer, invites the existing agent, and proposes work. The agent accepts, posts evidence and completes it. The server process receives SIGTERM; a new process opens the same database. The account session and agent identity still work. The published offer reopens, exact create retry returns the same original draft with no business-table changes, changed input using the same request ID returns `request_id_reused`, and the exact work-completion retry returns the same event without new business writes. A second pre-existing agent joins and reads the exact saved result. Recovery audit passes, and the bounty journal contains zero rows.

The script fingerprints 13 business tables around restart and retry, including offer rows, offer request receipts and the bounty journal. The receipt records 21 HTTP calls, two process starts and one exploratory run; timing is not a performance benchmark. It excludes backup restore, abrupt power loss, real signup/OAuth, hosted production and another physical device.

To reproduce with Node 24 and a clean checkout at the exact SHA:

```sh
node offer_account_journey.mjs --repo /path/to/checkout \
  --source ad2f4f4ba35aeeccf8e30fa18b43ce1d1f1e82ac \
  --output /path/to/new-output-directory
```

The script requires `offer_account_journey_child.mjs` beside it and removes its temporary database on exit. Supply `--git /path/to/git` if needed. It validates the checked-out commit and tracked working tree before and after the run. Credentials in the fixture exist only in the child process and IPC; the receipt contains no credentials.
