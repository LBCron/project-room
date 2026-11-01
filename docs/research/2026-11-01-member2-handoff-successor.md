# Handoff successor result path: executed failing control

Source: `ef583ba81eeeb284c8b743829aa4a0555752a0e8`.
Reproduction: `tests/handoff-successor-result-path.test.mjs`.
Result: **0 passed / 1 failed**, at the intended unresolved result destination.
No runtime files changed and no production requests made.

The local fixture uses real commands to propose and accept a read-mode task,
record a handoff, complete the first task with signed evidence, and verify that
exact result. The first task's board row is genuinely done, so the successor's
dependency is satisfied. The mapper emitted `<source>-next`, but no corresponding
canonical work aggregate exists. Real HTTP operations then show:

- Claim successor: HTTP 200.
- Start successor: HTTP 200.
- Submit successor result: HTTP 409, directing the caller to linked work.
- Follow the advertised work-context URL: HTTP 404 `work_not_found`.

The final test assertion requires that the advertised canonical result path
resolve. It fails `404 !== 200`. This demonstrates the full dead end rather
than inferring it from a mapper field or merely asserting card existence.
An initial setup attempt stopped before this path because completion alone
correctly remained delivered pending verification; that fixture was corrected
to perform the actual verification before reaching the successor.

Cause: `phantomSuccessorCard` in `server/work-item-board.mjs` sets
`workItemId` to a generated board id even though it does not create that work.
The handoff plan creates such cards at its `-next` path. The acceptance gate in
`server/work-claim-routes.mjs` correctly redirects item-backed board completion
to canonical work, preserving evidence/review authority. Relaxing that gate
globally would fix the symptom by bypassing real task acceptance.

Root should choose the intended handoff semantics: transfer/resume the existing
work, create an explicitly authorized real successor, or retain a truthful
board-native card with no nonexistent canonical pointer. Preserve source
history, result identity, real task acceptance and exact retry. Do not mint a
new task merely to satisfy a broken UI link. Supersession with a real target
is a separate case and should not be weakened by the cure.

This is a finite non-author probe of Dot's Room 25387(B) source finding; author
and root retain runtime/integration ownership. The evidence branch is red and
must not land unchanged. Local raw output is
`/Users/potter/Documents/ChatGPT/project room/handoff-successor-ef583-red.log`.

```sh
node --test tests/handoff-successor-result-path.test.mjs
```
