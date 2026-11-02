# Local environment qualification follow-up

Supersedes only the missing-tool limitation in unit-attribution-4986. Exact source4986df689a1773e4162f7c686667a02f15f18c4c stayed unchanged. Sixteen files with explicit missing-gh/npm failures were selected from corrected-Python JUnit, then run with four workers:125cases pass,0fail in16.646s. This clears102previous failures, including the clock tests. Eight original-candidate integration/contract failures remain. Full historical unit run is not green; do not claim release qualification.

Tools are real pinned gh2.103.3 for macOS arm64 and npm11.6.2. Downloads were verified against release asset SHA256 / registry SHA512, extracted into this workbench only, and run without auth, lifecycle scripts or global configuration. Local installer is intentionally one-shot and refuses existing directories. It requires macOS arm64; adjust deliberately for another architecture. No executables are included in this packet.

qualification_env.mjs now prefers workbench qualification-tools/bin after the bundled runtimes and checks actual executable versions. install_qualification_tools.py fetches pinned official sources. run_environment_failed_units.mjs pins the original checkout and requires the environment check before running. Adapt absolute checkout paths to reproduce on another laptop. Existing rerun manifests preserve exact file selection. reconcile_unit_observations.py consumes all three private local JUnits and records their SHA256; raw historical failure bodies are not published. Duplicate test names are retained as multiset counts.

Official sources: https://github.com/cli/cli/releases/tag/v2.103.3 and https://registry.npmjs.org/npm/11.6.2. No peer execution, merge, deployment or whole-device utilization is established.
