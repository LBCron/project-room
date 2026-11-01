# Compare entry models on the same useful work

Source review: integration `414e60ffa1e0948e7640c41113f7ba5b92ac6c4f`. This turns the peer's new product question into a controlled experiment; it is not a claim of completed user research or native-host qualification.

## Decision to make

Should an external collaborator primarily work through their existing agent, through a headless client, or in the Room workspace? Keep one project/work/evidence authority underneath. Do not let the choice of entry UI distract from the canonical writer overhaul, which all three models still require.

The comparison must also include completing the same task with a strong single agent and no Room collaboration. If Room adds setup and coordination without improving accepted output, recovery, collaboration or owner visibility, the extra machinery has not earned its place.

## What the pinned source establishes

- `docs/AGENT-ONBOARDING-ACCEPTANCE.md` specifies a friend's existing Dot as the first collaborator and makes Room human signup optional. A replacement local Codex process is not proof of that journey.
- `client/request-runner.mjs` has a durable intent/result boundary, current request context and saved-result redelivery. Its executed host receives selected context rather than the connection secret. The design already supports separating the control plane from a local execution adapter.
- `docs/FOCUSED-DELIVERY-PLAN.md` now explicitly compares primary-agent, headless and workspace entry against the same result/recovery criteria. This memo defines that test rather than proposing another product plan.
- `relay/README.md` describes a separate machine transport and says it is off until deployed; default passthrough is off. Source existence is not evidence of a currently available remote execution service.
- `machine/README.md` requires explicit machine enablement and separately enabling its bot. These are substantial setup and authority choices; do not silently enable them to run a user trial.

These are repository contracts. Verify the actual deployment, host tools and consent separately before any external trial. This run uses the existing Room and Git channels and does not install a relay, bot, monitor or new agent.

## Four comparison arms

| Arm | Entry and work path | Likely benefit to test | Cost or failure to expose |
| --- | --- | --- | --- |
| Single-agent baseline | Owner gives one strong existing agent the task and source/evidence directly. | Least setup and coordination for independent work. | Result handoff, second reviewer, interrupted-session recovery and owner visibility may be manual. |
| Existing primary agent + Room | Friend uses their own agent; Room records bounded access, task, evidence and review. | Familiar conversation with durable collaboration and optional workspace inspection. | Plugin/consent and idle-wake reliability; memory/controller identity cannot be substituted. |
| Headless client + Room | Existing authenticated API/CLI client reads selected work, runs a bounded host and submits evidence. | Scriptable execution, local resource use and durable retries without opening a dashboard. | Installation/configuration, process lifetime, revocation, ambiguous side effects and usable failure reporting. |
| Room workspace | Human uses invite, current work, progress, result and review in the browser. | Shared visibility and direct inspection/decision. | Excess navigation, signup/setup, noisy controls and stale/duplicated summaries. |

## Fixed task packet

Use a bounded real repository repair rather than an open-ended demo. Provide an exact base revision, failing observation, permitted files, expected behavior, evidence requirements and a completion criterion. The #5491 manifest/rollback investigation is an example of an already completed task packet; do not rerun it as fake new work. Choose the next genuine regression for a future trial.

Every arm receives equivalent source, task facts and allowed capabilities. Match execution/model budgets where controllable and record differences where not. Keep success criteria identical: correct diagnosis or repair, inspectable exact artifact, meaningful verification, no duplicate side effects, and a reviewer able to accept or request correction.

## Trial sequence

1. Start from an appropriate clean or documented existing account/host state; record which. Include setup as work rather than hiding maintainer rescue.
2. Deliver the same task and source packet. Observe the first successful authorized read and the first useful action.
3. Require a clarification or correction on an actual ambiguity. Confirm it reaches the right current actor and changes the result appropriately.
4. Interrupt the host after it saves an outcome but before delivery acknowledgment. Resume and verify the saved result is delivered without re-executing work.
5. Revoke or change access before another action. Verify old tokens/cursors/listeners cannot continue unauthorized work.
6. Ask a second actor to inspect the exact result. Confirm they receive sufficient evidence without unrelated private context.
7. End with an owner decision and a durable reference to the accepted artifact or explicit remaining defect.

Steps involving live installation, consent or external participants require the real supported host and the participant's own authorization. This memo does not pretend those steps occurred during local unit testing.

## Measurements and evidence

Record setup actions, owner/friend interventions, failed attempts, task-to-first-useful-action, task-to-reviewed-result, correction cycles, recovery success, duplicate-execution count and available usage cost. Record actual wall-clock boundaries and distinguish host execution from delivery receipts. Do not add phase times from unsynchronized laptop clocks as if exact.

For output quality, have a reviewer assess the same acceptance rubric before knowing the entry arm when practical. Record defects and evidence gaps; do not substitute a polished UI screenshot for a correct result. Small trials are qualitative evidence, not a statistically ranked winner.

Reject an entry model as the default if it needs maintainer rescue to complete the primary journey, obscures whether work actually ran, loses results on interruption, requires unrelated infrastructure, or makes routine correction materially harder without compensating collaboration value. Retain it as an optional specialist route if it still serves a clear use case.

## Immediate recommendation from current evidence

Continue the existing-agent path as the leading external-collaborator hypothesis, retain the workspace for inspection/review, and keep a headless adapter as an explicit execution route. This is a reversible hypothesis grounded in the documented primary journey, not a verdict from user trials.

Do not deploy the machine relay or invent another dashboard merely to compare models. First validate the next real task through the existing connections, then test the real friend-host setup when its native deployment/consent boundaries are ready. The two-laptop work in this chat already demonstrates useful Room/Git coordination and local qualification; it does not establish native friend-host wake or unassisted onboarding.
