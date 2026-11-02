# Actual Native restore of5000pending access requests

Source00888c52110d36250d3e07629036701b72926d09; target1084460ddcf6d22d36aeb6e8deed24e91e6ba927 tree0a360f9afd74f2b0693e5f8b582bee4959594e78. Separate frozen clean checkouts, existing esbuild/Miniflare and matching July2026workerd binary. No application source edits. This is the new pending access-request/identity dataset, not a rerun of the earlier synthetic message-history1k/5k cases.

Normal producer calls create5000identities and5000pending requests at an equal creation timestamp. The old actual Native instance exports15,841,135bytes with no new pending-page index. The strict authorized operator restore API on the target refuses partial queue reads with503 and accepts an exact cold source resume. Independent full-content audit passes; cleanup completes after6206continuations, including822cleanup calls, with5383unique actual advancing frontiers. The independent diagnostic budget remains20000; this is not a production recovery bound.

After cold reopen: readiness200, restore admission clear, zero frozen guards, all request-row fingerprints/identity counts/original owner+admin credentials preserved, pending-page index admitted. All5000requests are reached once over200pages, at most25perpage. Every listing observes zero writes and known statement counters. First owner read after cold reopen1657physical rows (includes deferred initialization), admin946, later queue max955. The1000dataset previously observed late938; these are observations, not a constant-cost or latency claim. Source restore KV keys are gone. Page pacing400ms respects unchanged rate limits and is not a throughput measurement.

The receipt contains only synthetic credential fingerprints, never credentials or backup bodies. Raw log and synthetic backup remain local/in-memory; the temporary Native storage is removed by the driver. Process snapshot shows this Mac's node/esbuild/workerd processes (workerd98percent at one instant); no total/peak CPU or other-laptop execution is established.

Reproduce with Node24, existing installed esbuild/Miniflare, and the two fixtures adjacent:

```
LOCAL_LAB_GIT=/path/to/git \
ACCESS_RESTORE_AFTER_PIN=1084460ddcf6d22d36aeb6e8deed24e91e6ba927 \
ACCESS_RESTORE_DEPENDENCIES_ROOT=/path/to/checkout-with-cloudflare-dependencies \
MINIFLARE_WORKERD_PATH=/path/to/matching-july-workerd \
node access_request_native_restore_5k.mjs /path/to/clean-old00888 /path/to/clean-target1084460
```

Local actual Native runtime proof only: hosted resource limits, production restore, release/merge/deployment and second-device execution remain unproven. Historical full unit suite still has integration failures. Root owns integration and release.
