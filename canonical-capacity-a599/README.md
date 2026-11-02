# Current-work HTTP guard boundary qualification

Frozen sourcea599faa29ff65567e5c080609cb2d000acd33666, real Node24 HTTP with two disposable normalized-current-v1 rooms. Seed creates four synthetic members per room through model initialization; every proposal, acceptance, claim, release, invalid renewal, policy read/write and retry under test uses the real local HTTP endpoint. No runtime/source edits. Adjust the driver's absolute clean checkout/Git paths, run `node canonical_work_capacity_http.mjs`. Source pin and tracked cleanliness are enforced before and after.

Both real owner config reads return defaults maxOpenClaims1000/maxMemberOpenClaims20. The owner explicitly sets small synthetic caps (room2; member2 with room10) to test exact admission boundaries without replaying a scale test. Nonowner policy updates403 work_claims_not_permitted. Acceptance at the room cap409 work_board_full; after owner raises cap, the exact previously refused command ID succeeds and its exact retry is duplicate=true with no writes. Third active write claim at member cap409 too_many_open_claims. Another contributor releasing the holder's claim422 command_rejected; chat profile release403 work_claims_not_permitted. Holder renewal with past, null or malformed expiresAt422 command_rejected. Holder release frees one slot and the third item can acquire it. Eleven named controls pass; all nine refusals leave byte-identical serialized observations of ten authoritative tables. Legacy mirror work_claims stays empty and final auditRecovery passes.

This is local canonical HTTP boundary evidence with explicit small caps. It does not execute the default1000/20 scale boundary, Native runtime, hosted limits or another laptop. It does not clear the default suite's33skips or the red abuse-guards checker.

## Mapping from the old checker

| Old check | Current surface / result | Qualification limit |
| --- | --- | --- |
| C1 guest/chat legacy create | Legacy work creation is retired; canonical proposal has its own permissions | No replacement proposal-role matrix run here |
| C2 nonholder/profile mutation | Actual canonical claim.released refuses nonholder and chat; tables unchanged | No full renew/reassign role matrix |
| C3 room open cap | Actual work.accepted cap2 refusal, owner change/retry success | Default cap read1000; no1000-item scale run |
| C4 member holdings cap | Actual claim.acquired cap2 refusal; holder release frees slot | Default cap read20; no20-item scale run |
| C5 legacy leaseHours max/null | Canonical expiresAt future requirement: past/null/malformed renewals refuse | Legacy168h bound is not asserted for canonical scope claims |
| H1/D1 webhook/name | Existing prior opt-in observation passed both | Reuse evidence/member2-charter-read-gap-1102; not rerun |
| R1 instructions | Standalone charter read remains409 on normalized rooms | Separate baseline/candidate repro remains red; integration owned |
| T1 content trust | Still unexecuted in the original/reordered checker | No claimed closure |

The useful modernization is to test each current contract independently, keep retired legacy API expectations separate, and preserve unexpected failures instead of skipping them. Root retains runtime integration, merging and release. This packet adds no scheduling, orchestration, credentials or policy changes outside its disposable fixtures.
