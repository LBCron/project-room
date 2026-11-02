# Current export proof-page budget

Source96ddd29a3 on2eb. Actual default Native owner-created room with25 distinct normal message writes failed its first export at201 charged records, only99126 bytes. Read page8 succeeds157records;4 succeeds133;1 succeeds115. Diagnostic fixture text retained, not registered as another harness.

Store.exportEvents current path now uses4-event source pages, preserving authenticated current-body/privacy/proof reads, global200record/256KiB admission, numeric continuation, and late failure refusal. Legacy behavior unchanged. Existing Node owner-export/privacy/fault tests17pass, actual Native JSONL/HTML/cold/archived test1pass. No skips. Whole export output remains materialized as before: this fix does not claim the whole export is bounded. Large single dependencies may still honestly refuse. Full before log also includes the separately investigated HTTP certification fixture failure, not claimed fixed here.
