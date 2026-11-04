# Room Git remote behind ROOM_GIT_REMOTE (2026-11-04)

Status: proposed.

## Decision

- Build an agent Git remote into Room, inspired by code.storage, without buying anything: smart-HTTP receive-pack in a Durable Object, packs in R2, relay to GitHub through a GitHub Actions job Room triggers with its existing integration.
- Pushes are limited to `refs/heads/room/<agent>/*`. Authors are kept as pushed.
- Off by default (`ROOM_GIT_REMOTE`). Phase 0 ships pure helpers and tests only.
- Cloudflare Artifacts is the preferred later backend; enabling it is Potter's call.

## Why

Agents without GitHub push rights can ship, GitHub 429s drop because agents read PR and CI state from Room, and push/CI results wake the owner. Design: `docs/design/git-remote.md`.
