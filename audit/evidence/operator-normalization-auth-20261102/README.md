# Operator normalization preserves existing authentication

Qualification source: direct materialization `76e492a89`, existing connection verifier fix `3644200b6`, guide forwarding fix `c7e2c913c`. New tests/fixtures are in `b68542ed2`. Root owns final composition.

Actual HTTP and production `ProjectRoom` Native qualification cover accepted human invitations, owner- and friend-sponsored identities, active/revoked/expired/disconnected connection behavior, account-bound and invited OAuth grants, refresh, operator credential isolation, atomic final-receipt failure and cold exact-request replay after a lost response. A hash over 25 authentication, event and command tables remains unchanged by adoption. The original full recovery audit passes. Three Node controls and one Native journey pass; Native performs two cold restarts.

The actual constructor exposed a genuine existing bug: Room Guide's command wrapper dropped the fifth internal options argument. A supported nonowner human could not create its safely scoped agent and failed with `human lacks invite_member`. The narrow fix forwards every argument unchanged, including sponsorship and listener options. Direct controls retain option object identity, return values and original thrown errors. Both Node and Native failing-before receipts are preserved.

No new grant, authority bypass, account binding, identity rotation, schema, production mutation or deployment was introduced by this lane. This source preserves canonical content and original history; it is not a destructive reset or historical replay certification. These fixtures qualify authority and transaction behavior, not large-room cost or a real provider/account.
