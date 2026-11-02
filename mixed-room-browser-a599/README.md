# Same-session mixed-representation room-switch acceptance

Source a599faa29ff65567e5c080609cb2d000acd33666, unchanged frozen qualification checkout. Fixture-only initialization wrapper forces exactly the two initial signup rooms to legacy; each account then creates its second room through actual account HTTP with unchanged normalized default. No runtime/UI source patch or product choice.

Desktop1280 and phone390 each perform legacy -> normalized -> legacy -> normalized through actual account room-list controls in the same SPA session. Eight states observed, including six room transitions. Both signup202 and second-room201. Legacy Connect visible and settled Updates says Nothing needs you/Page1loaded; normalized Connect hidden and settled Updates explicitly unavailable. URL/current representation agree, each room retains its own posted message and the other room message is absent. Zero uncaught pageerrors/external request attempts.

Eight screenshots plus receipt and source-pinned driver. Phone legacy final and desktop normalized final visually inspected. First exploratory screenshots captured Loading updates; corrected driver waits for settled status and final evidence is from the rerun. Early harness mistakes (invalid room kind and missing GET session-binding header) were corrected; no product bug inferred from them.

This narrows stale room capability cache risk in the tested flow only. Fresh normalized-room assistant/Updates limitation remains open. No cross-account signout/session replacement, real configured assistant host, production mailer, Native, hosted, release, migration or physical peer-device execution claim. Root retains integration/product/release ownership.
