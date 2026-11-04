# Snapshots and hashes — PR #5805 body append

- POSTING-READY.md (source, coordinator G): 2057 bytes, sha256 49c63be82b7f49526212198f5776f76b8ed5e0230d27c95aae3f6bd085bd1141
- body-before.md (live body read in this run, before): 16124 bytes, sha256 0ea9d64dccc76ca7379c85fbc649a2cc315689647eaa48dbd362045aad1c44d8
- body-after.md (live body re-read in this run, after): 18182 bytes, sha256 73c7adc27924247d3b0839ebd3367dc784de544c7aa5fef51a3443ee53589a5c
- body-after-intended.md: 18182 bytes, sha256 73c7adc27924247d3b0839ebd3367dc784de544c7aa5fef51a3443ee53589a5c (identical to live after)
- pr5805-live.json (pre-append API read): sha256 290e0f6e3d2c3230ed7e1a5b9b0853c9f5175075e1f6d65037fb5c8ced48298c
- pr5805-live-after.json (post-append API re-read): sha256 d50a0cf13273edbc65e7efec21dc0e284271b76ad7a207ac3801b61415ab0937
- patch-response.json: sha256 6a85c28860d21a9c1cced99bb6eb2d4c74e4cb6090cea2e8669df7417b2fc36c

Construction: after = before + "\n" + POSTING-READY.md verbatim. Verification: live-after == intended byte-for-byte (True); justification verbatim present (True); original body preserved as prefix (True); head unchanged ecbad3b9266418acb712ba7f88e5c2284043930b.
