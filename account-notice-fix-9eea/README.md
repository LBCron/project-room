# Account-room stale notice fix

Source: 9eea8ec403e5849ae307da5cc34a361cb32097bf
Tree: 25883289c96f94dd573a1e38c64b47efac242029
Parent: 2bf4cfb7d15265d6b6f690e0659a0c38a88ca25e
Branch: codex/member2-account-notice-fix-1102

Only src/app.js and tests/account-room-notice.test.js changed. A successfully accepted room snapshot clears exactly ROOM_ACCESS_NOTICE; unrelated account errors remain visible. No grants, storage, migrations, hosted changes, or scheduler.

Failing-before CUA on exact parent: A signup and saved marker, logout, B signup with A target, B opens its authorized own room; Connected plus stale not-in-room warning remain together (before JPEG and DOM). A marker absent from B.

Passing-after CUA on identical patched source: reload, navigate B to A URL and observe fresh denial; open own B room and observe warning removed. Save B marker, logout, log in A with B URL: legitimate warning remains until own A room is opened. Own A saved marker restored, no B marker, no stale warning (after JPEG and DOM). Browser operated through CUA, synthetic in-memory local app only. JPEG and DOM evidence are observations, not network status traces.

Focused regression result before patch: 2 failures / 1 pass. After patch: node --test tests/account-room-notice.test.js tests/room-deep-link.test.js tests/signin-stale-session-alert.test.js: 13 tests / 13 pass / 0 fail / 0 skip. eslint src/app.js tests/account-room-notice.test.js and git diff --check passed. Test uses actual snapshot acceptance prefix lifted from app.js with narrow stubs, not full app mounting.

Published source was fetched and its tree/working files matched byte-for-byte; checkout clean at9eea. Advisory map artifact unavailable; source traced directly. No delayed response race, provider OAuth, Native, hosted, or physical peer-device qualification. Root owns merge and deployment.
