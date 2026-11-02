# Managed connection recovery baseline

Exact production source `bb429d29c2839c5df788d15473eb19a5241ed6a8`, actual production Native constructor and existing supported owner/friend sponsorship + rotation + disconnect + revocation fixture. Four warm/cold populated cases pass. Only the measured verifier is included; seed/adoption/startup/cold constructor are excluded. Physical counters are adapter-observed; raw Native permit work is not separately counted. Wall-clock time is not CPU.

512 additional messages +16 real rotations:5 connections/22 operations;21 prefix replay queries return8398 rows/2739227 bytes.21602 adapter physical reads/663 statements; warm186ms/cold188ms. With1 rotation:10712 reads/288 statements,553 prefix rows/184382 bytes; warm20ms/cold23ms. This is the existing verifier baseline, not an optimization result or whole-recovery bound.

Fixture time advances2100ms between real message commands to respect the existing chat flood guard. Synthetic credentials stay in local fixture storage; no live accounts or services are used. First harness attempts exposed its too-short synthetic operator token and an unrealistically frozen chat clock; these were corrected before this baseline. No production behavior was changed.
