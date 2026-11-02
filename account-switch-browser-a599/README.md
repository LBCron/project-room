# Cross-account browser session replacement

Sourcea599faa29ff65567e5c080609cb2d000acd33666 unchanged. Desktop1280 and phone390 each use one browser context/page: signupA202 -> legacy room/message -> actual signout200 -> signupB202 -> visible Create room form201 -> normalized room/message -> signout200 -> passwordloginA200 -> original legacy room. Session revisions1/3/5; logout checks authenticatedfalse. Exactly2fixture initializer interventions for initialA legacy rooms; no product code changes.

All6rendered account states show own synthetic message and no other-account message. Legacy Connect/settled Updates return afterA relogin; normalizedB hides Connect and explicitly marks Updates unavailable. ActualB-bound GET A-room403access_denied; oldA-bound GET B-room409session_binding_changed; both responses omit private markers. Zero pageerrors/external request attempts. PhoneB/A-return screenshots visuallyinspected.

Initial harness mistakes: releasing fixture legacy flag before room was created; assuming second signup auto-opens a room. Corrected by waiting for initial room and using actual visible Create room controls forB. Final receipt/screenshots are from completed corrected run with exact409 assertion. These are not product bug claims.

Scope: ordinary sequential signout/newsignup/relogin in local default no-mailer/no-provider environment. Not a delayed-response race, configured assistant/host, production account/mail delivery, Native/fullsuite/release or physical peer-device execution proof. Existing fresh normalized assistant/Updates limitation remains. Root retains implementation/integration/product/release ownership.

## Observed UI defect - not a fully green acceptance

At initialA, #account-status is hidden/empty. AtB and returnedA, #account-status remains visible with: You're not in that room yet. Ask a member for an invite, or request to join. Confirmed in4of6renderedstates across both widths even while valid own room GET200/message posting and own content render correctly. Source lead: src/app.js showRoomAccessNotice sets #account-status at1062; opening a valid room does not clear this prior account/list notice in this flow. This is an observed stale UI warning, not a demonstrated authorization bypass or wrong-account content leak. Root owns any sharedUI fix. Final driver records status visibility/text without disguising it as a pass.
