# Twilio Messaging Setup

Cho's app is currently a static Vite prototype. It can queue SMS work and record Twilio-ready delivery metadata, but live SMS must be sent by a trusted server or serverless function. Do not put `TWILIO_AUTH_TOKEN`, API key secrets, webhook signing secrets, or other Twilio credentials in React, Vite env vars exposed to the browser, localStorage, or GitHub Pages assets.

## Twilio Account Checklist

1. Create or use a Twilio account.
2. Buy and verify an SMS-capable Twilio phone number, or create a Messaging Service.
3. Choose the production sender path and complete the required compliance approval before live US traffic:
   - 10DLC long code senders need approved A2P 10DLC Brand and Campaign registration.
   - Toll-free senders need completed and approved toll-free verification.
   - Short code senders need the approved short code provisioning/compliance path for the intended use case.
4. Configure the server runtime with these private environment variables:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_API_KEY` and `TWILIO_API_KEY_SECRET` for production API authentication, recommended, or `TWILIO_AUTH_TOKEN` for local fallback.
   - `TWILIO_MESSAGING_SERVICE_SID`, recommended for scale, or `TWILIO_FROM_NUMBER` for an approved direct sender.
5. Add a private app/server auth layer before accepting send requests from managers.
6. Add rate limits, audit logs, opt-out handling, sender compliance checks, and recipient consent checks before production use.

## Twilio Account Launch Profile

The manager Messages page includes **Twilio Account Launch Profile** inside Twilio Delivery Setup. This is a credential-free production handoff form, not a secret manager. It can save:

- Twilio Messaging Service SID.
- Approved SMS sender or phone number.
- Inbound webhook URL.
- Status callback base URL.
- Relay health check URL.
- Manager auth mode for the private relay, such as same-site secure cookie, server-managed session, or OAuth proxy session.
- Messaging compliance sender type: A2P 10DLC long code, verified toll-free, approved short code, or not selected.
- A2P Brand registration status and A2P Campaign registration status.
- Toll-free verification status.
- Non-secret compliance notes for the relay handoff.

The saved launch profile is stored in `chos.operations.twilioLaunchProfile.v1` and is included in **Export Integration Manifest** under `twilio.accountProfile`. It intentionally stores non-secret identifiers and URLs only. Do not paste Twilio Auth Tokens, API secrets, account passwords, webhook signing secrets, VAPID private keys, or private push credentials into this form.

Managers can click **Check Relay Health** after entering a Relay health check URL. The browser sends a credentialed `GET` with `credentials: "include"` and `Accept: application/json`, so the private relay can verify the manager session, server-held Twilio environment variables, sender compliance, and webhook configuration without returning secret values. The app validates that response with `validateTwilioRelayHealthResponseForBrowser`; a simple `{ "status": "ready" }` or `{ "ok": true }` response is intentionally rejected because it does not prove the production relay checked the required server-side gates. Private server code can use `buildChoMessagingServerHealthResponse` from `src/messagingServerContract.ts` to create the browser-safe response shape.

A browser-safe health response must include a `status` of `ready`, `degraded`, `not-ready`, or `unauthorized`, plus credential-free boolean readiness checks:

```json
{
  "status": "ready",
  "checkedAt": "2026-06-03T15:00:00.000Z",
  "readinessChecks": {
    "managerAuth": true,
    "twilioCredentials": true,
    "senderConfigured": true,
    "complianceReady": true,
    "webhookSignatureValidation": true,
    "relayCanSend": true
  }
}
```

If `status` is `ready`, every readiness check must be `true`. A `degraded`, `not-ready`, or `unauthorized` response can report failed checks without leaking secrets. The health route should never echo Auth Tokens, API keys, webhook secrets, VAPID private keys, account passwords, Account SIDs, or any secret-valued fields; if the app sees a credential-shaped health response field such as `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY`, `API_SECRET`, `WEBHOOK_SECRET`, `PASSWORD`, `ACCOUNT_SID`, or `PRIVATE_KEY`, it marks the response unsafe instead of ready.

## Messaging Compliance Readiness

The launch profile also tracks a credential-free `twilio.complianceProfile` handoff. This profile records the selected sender path, A2P Brand status, A2P Campaign status, toll-free verification status, non-secret compliance notes, whether A2P 10DLC is required for the selected sender, and whether the manager-visible profile is marked ready for live US traffic.

Twilio's A2P 10DLC docs state that application-to-person traffic to US users over 10DLC long-code numbers must be registered through A2P 10DLC, with Brand and Campaign information used to identify the sender, consent path, opt-out behavior, help flow, and message purpose. Twilio's toll-free verification docs state that toll-free numbers cannot send SMS to the United States and Canada until toll-free verification is completed and approved.

This app only stores the manager's non-secret readiness record. The production relay must still verify the official Twilio status server-side before live sends, because localStorage and exported manifests are not authoritative compliance records.

## Manager Live Readiness Panel

The manager Messages page includes **Live Twilio Readiness** inside Twilio Delivery Setup. It is an operational preflight, not a credential validator. It reports:

- The required private server secrets for the relay.
- The current count of relay-ready queued texts and stale queued texts blocked from export.
- Active local SMS opt-out records and consent guard status.
- Device notification preference and browser permission status for app-message alerts.
- Device Web Push subscription readiness for private push server sync.
- Relay result import, status callback import, and inbound webhook import availability.
- Webhook signature helper availability and the remaining private-relay enforcement requirement.

This checklist is intentionally based on app state the manager can act on before export. A production server still has to validate credentials, manager auth, consent, rate limits, and Twilio signatures with the server-held Auth Token before live sends or webhook persistence.

The browser blocks direct **Send to Twilio Relay** attempts until the launch profile marks the sender compliance path ready. Export-only handoff files can still be downloaded for setup and review, but a live relay POST requires an approved 10DLC profile, approved toll-free sender, or approved short-code path in the non-secret launch profile. The private relay must repeat this check against authoritative Twilio/account records before sending.

## Production Integration Manifest

The manager can click **Export Integration Manifest** in Twilio Delivery Setup to download `chos-production-messaging-integration-YYYY-MM-DD.json`. This artifact is safe to hand to the private relay or push-server implementer because it contains configuration names and routes, not secret values.

The manifest includes:

- The app base URL, `/messages` notification target, and service worker URL.
- Manager identity metadata from the current prototype session.
- Twilio relay endpoint, relay payload schema version, browser credential mode, batch/segment guardrails, required server environment variable names, and optional server environment variable names.
- Credential-free Twilio account launch profile values such as Messaging Service SID, sender, webhook URLs, relay health URL, and manager-auth mode.
- Credential-free Twilio compliance profile values such as selected sender type, A2P Brand status, A2P Campaign status, toll-free verification status, and production-readiness flag.
- Inbound SMS and status callback route templates, including the `X-Twilio-Signature` requirement that the private server must enforce before persistence, plus shared webhook signature and normalization helper names.
- Web Push subscription sync endpoint, subscription schema version, notification payload schema version, reusable server contract helper names, supported Cho account roles, required VAPID server environment variable names, current subscription endpoint readiness, and notification URL.
- The shared private server adapter contract in `src/messagingServerContract.ts`, including manager request gating, relay plan and dispatch gating, push subscription sync ownership checks, health response shaping, and Twilio webhook signature enforcement.
- Server-auth requirements: authenticated staff/manager sessions, `credentials: "include"` browser requests, server-only secret storage, server-side consent checks, rate limits, and push-subscription cleanup.

The manifest intentionally does not include Twilio Auth Tokens, Account passwords, VAPID private keys, raw PushSubscription key material, or live provider message SIDs. It is a deployment handoff contract, not a credential file.

## Messaging Server Adapter Contract

The dependency-free shared contract in `src/messagingServerContract.ts` is the private server entry layer that ties the lower-level Twilio and Web Push helpers to authenticated Cho requests:

- `buildChoMessagingServerHealthResponse(input)` creates credential-free health responses that the browser can validate before showing the relay as ready.
- `validateChoMessagingServerRequestGate(input)` requires `POST`, credentialed browser/session requests, CSRF verification, an authenticated Cho account, and optional staff/message access for manager-only routes.
- `buildChoMessagingServerRelayPlan(input)` combines the request gate with `buildTwilioRelayExecutionPlan`, `buildTwilioRelayDispatchPlan`, and `buildTwilioRelaySendPolicyPlan`; rejects relay sends when the browser payload `requestedBy` manager does not match the authenticated server session; and returns replay/send/reservation/policy details for durable relay storage.
- `buildChoMessagingServerPushSubscriptionSyncPlan(input)` validates Web Push subscription handoffs and rejects storage when the payload `requestedBy` account does not match the authenticated Cho account.
- `buildChoMessagingServerTwilioWebhookPlan(input)` verifies the `X-Twilio-Signature` input before normalizing inbound SMS, planning START/STOP consent updates, or normalizing delivery-status callbacks.

Use this adapter before provider calls or persistence. It still does not replace real server auth, CSRF middleware, durable storage, rate limits, account lookup, or authoritative consent/compliance records; it gives those server pieces a tested contract boundary that matches the prototype export files.

## Operations Backup Coverage

The Reports page **Export operations backup** action includes a single `messagingSetup` record when non-secret production messaging setup exists. That record can restore the Twilio relay endpoint, private push-server endpoint, public VAPID key, and credential-free Twilio launch profile values such as Messaging Service SID, sender, webhook URLs, relay health URL, manager-auth mode, and compliance status.

Operations backups intentionally exclude Twilio Auth Tokens, Account passwords, VAPID private keys, webhook secrets, and raw browser PushSubscription key material. A restored backup can update the public VAPID key and non-secret endpoint/profile setup, but it does not replace the current device's PushSubscription JSON or private subscription keys.

## Device Notification Behavior

The manager Messages page includes a **Notification Center** for unread app-message replies from students or guardians. Managers can mark app messages seen and can request browser notification permission with **Enable Device Notifications**.

Current local behavior:

- When browser notifications are enabled and permission is granted, the newest unread direct app message can show a device notification.
- Managers can use **Send Test Notification** after enabling device notifications to verify that the current device can display `/messages` alerts.
- Operations Notification Center preferences, unread seen timestamps, and browser PushSubscription metadata are scoped to the signed-in manager or staff account on this browser. The built-in manager can still read the older `chos.operations.notificationSettings.v1` key for migration, but created staff logins do not inherit that manager device state.
- Student Profile message feeds include **Enable Message Notifications**, **Send Student Test Notification**, **Connect Student Device**, and **Sync Student Push Subscription** so student-side devices can receive browser alerts now and can hand a `role: "student"` PushSubscription to the private push server for background delivery.
- Parent Profile message feeds include **Enable Parent Message Notifications**, **Send Parent Test Notification**, **Connect Parent Device**, and **Sync Parent Push Subscription** so guardian devices can receive family app-message alerts and can hand a `role: "guardian"` PushSubscription to the private push server for background delivery.
- The installed app badge count follows the unread app-message count through the browser Badging API when the browser supports `navigator.setAppBadge` and `navigator.clearAppBadge`.
- The service worker handles notification clicks and opens the app-scoped `/messages` route.
- The service worker also includes a `push` event handler for future Web Push payloads. A server push payload can provide `title`, `body`, `url`, `tag`, `threadId`, `icon`, `badge`, `unreadCount`, or `badgeCount`; missing values fall back to a Cho's message notification that opens `/messages`. The worker resolves relative URLs against the service-worker registration scope, which preserves GitHub Pages subpath hosting, and rejects off-scope notification, icon, or badge URLs by falling back to safe app-scoped defaults. When `unreadCount` or `badgeCount` is a non-negative number and the browser supports worker badging, the service worker sets or clears the installed-app badge while still showing the notification.
- Managers can paste a public VAPID key into **Web Push public key**, click **Connect This Device**, and either click **Sync Push Subscription** to POST the subscription to a **Private push server URL** or export **Push Subscription JSON** as a fallback. Student and parent message feeds use the same public-key and private-server flow with student/guardian-specific button labels. All paths use `schemaVersion: "chos-web-push-subscription.v1"` and include the browser subscription, signed-in Cho account identity metadata, a supported account role, and an app-scoped notification URL. Staff/manager subscriptions target `/messages`; student and guardian profile subscriptions target the app home route for their profile message feed.

The private push server POST uses browser credentials/cookies through `credentials: "include"` so the server can authenticate the signed-in user/device with its own session layer. The shared subscription validator accepts only Cho's supported `staff`, `student`, and `guardian` roles, and the exported manifests list those roles under `webPush.serverContract.supportedAccountRoles`. The server adapter helper `buildChoMessagingServerPushSubscriptionSyncPlan` additionally checks that the subscription payload belongs to the authenticated Cho account before storage. True cross-device background push still requires a private server to create and store browser push subscriptions, hold VAPID private keys, authenticate the user/device, remove expired subscriptions, and send Web Push payloads. Do not store VAPID private keys or subscription-management secrets in this static Vite app. The browser only receives the public VAPID key needed by `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`.

## Web Push Server Contract

The dependency-free shared contract in `src/webPushContract.ts` gives the private push server the same kind of handoff guardrails as the Twilio relay contract:

- `validateWebPushSubscriptionPayloadForServer(payload, options)` validates `chos-web-push-subscription.v1` subscription exports before storing them. It rejects credential-like fields such as VAPID private keys, requires authenticated Cho account identity metadata with a supported `staff`, `student`, or `guardian` role, requires an HTTPS PushSubscription endpoint, requires `keys.p256dh` and `keys.auth`, and keeps the notification URL inside the configured app origin and path prefix.
- `buildChoWebPushNotificationPayload(input, options)` builds `chos-web-push-notification.v1` service-worker payloads with safe defaults for title, body, tag, URL, optional thread id, and optional unread count. Unsafe notification, icon, or badge URLs fall back to the configured app-scoped `/messages` path so the service worker does not open off-app locations.
- `buildChoWebPushDeliveryPlan(subscriptionPayloads, input, options)` gives the private push server a server-only delivery plan for stored subscriptions. It validates each stored subscription, checks that the subscription belongs to an optional target Cho account, rejects expired subscriptions, builds the sanitized notification payload JSON, and marks HTTP `404` and `410` responses as subscription-removal signals.
- `buildChoWebPushResultFromProviderResponse(input)` normalizes each push provider HTTP response into `sent`, `failed`, or `expired` without echoing VAPID/private fields.
- `buildChoWebPushDeliveryReconciliationPlan(results)` separates sent notifications, failed deliveries, and `subscriptionsToRemove` so the private push server can delete gone `404`/`410` endpoints instead of retrying dead devices.

The production push server should store the validated subscription against the authenticated user/device and supported Cho role, then use its server-held VAPID private key to send payloads shaped by `buildChoWebPushDeliveryPlan` when new app messages arrive. After provider calls, it should normalize responses with `buildChoWebPushResultFromProviderResponse`, persist sent/failed status for audit, and remove endpoints listed by `buildChoWebPushDeliveryReconciliationPlan`. The generated production and automation manifests include this contract metadata under `webPush.serverContract`, plus `supportedAccountRoles: ["staff", "student", "guardian"]`, `subscriptionSchemaVersion: "chos-web-push-subscription.v1"`, and `notificationPayloadSchemaVersion: "chos-web-push-notification.v1"`.

## Consent And Opt-Out Handling

The manager Messages page includes an **SMS consent guard** in Twilio Delivery Setup. Managers can enter a phone number and use **Mark SMS Opt-Out** for STOP-style requests or **Clear SMS Opt-Out** for START/UNSTOP-style requests. Student, parent/guardian, and staff contacts need a recorded SMS opt-in timestamp before the browser queues live-relay SMS work. Opted-out contacts and contacts with missing consent evidence are suppressed from:

- New marketing blasts.
- Scheduled promotional text queues.
- Automated reminder/follow-up queues.
- Existing queued text delivery checks.
- Twilio relay JSON exports.

The Marketing Tool also shows a selected-audience delivery preview before queueing a blast. The preview uses the same local recipient rules as the queueing path and shows total ready contacts plus student, parent, and staff counts. Inactive contacts, missing phone numbers, duplicate phone numbers, local SMS opt-outs, and contacts without SMS consent evidence are excluded before texts are queued.

The local prototype stores opt-in and opt-out timestamps on the matching student phone, guardian phone, or staff account phone. The bundled seed contacts include prototype consent timestamps so the local demo can exercise the workflow. A production relay must also enforce consent server-side before calling Twilio because client-side filtering is not a security boundary.

Managers can click **Export Consent Evidence** to download `chos-sms-consent-evidence-YYYY-MM-DD.json`. The export uses `schemaVersion: "chos-sms-consent-evidence.v1"` and includes active student, parent/guardian, and staff contacts with normalized phone numbers, `opt-in`, `opt-out`, or `unknown` consent state, consent timestamps, opt-out timestamps, and evidence-source labels. The file intentionally excludes account passwords, Twilio Auth Tokens, API keys, VAPID private keys, and webhook secrets.

The private relay should treat `unknown` consent contacts as not sendable until valid opt-in proof exists, then sync consent state to Twilio Consent Management or an equivalent server-side consent store before live sends. Twilio guidance says senders should obtain recipient opt-in consent before sending and store evidence of consent events; Twilio's Consent Management API can manage opt-in, opt-out, and re-opt-in states across messaging channels.

## SMS And Compliance Preflight

The marketing and scheduled-promotion composers show **SMS preflight** and **Compliance preflight** text before managers queue a blast. The SMS estimate detects GSM-7 versus UCS-2 encoding, counts GSM-7 extended characters as two units, and estimates message segments with the common SMS thresholds:

- GSM-7: 160 units for one segment, then 153 units per multipart segment.
- UCS-2: 70 characters for one segment, then 67 characters per multipart segment.

The compliance preflight flags whether copy includes simple opt-out language such as `Reply STOP to opt out`, `unsubscribe`, or `opt out`. This helps managers spot long, Unicode-heavy, or compliance-risky campaigns before they are billed by segment. It is still a client-side estimate and warning; the private relay and Twilio delivery/usage records remain the source of truth after live sending.

## Inbound Webhook Handling

Twilio inbound SMS webhooks include sender and body fields such as `From`, `Body`, and `MessageSid`. The manager can paste a captured inbound webhook into **Twilio inbound webhook JSON** and click **Apply Twilio Inbound**.

- Regular replies from known student or guardian phone numbers are imported into the app direct-message feed for the manager.
- Imported direct messages reuse the Notification Center, so unread inbound SMS replies can trigger the same app/device notification path as in-app messages.
- STOP-style keywords (`STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT`) record an SMS opt-out and do not create chat noise.
- START-style keywords (`START`, `YES`, `UNSTOP`) clear an SMS opt-out and do not create chat noise.

In production, configure the Twilio phone number or Messaging Service inbound webhook to POST to a private server route. That server should verify Twilio request signatures with `X-Twilio-Signature`, apply the same keyword/contact mapping rules, and then persist the result through the real app backend. The shared `validateTwilioFormWebhookSignature` helper covers the form-encoded SMS webhook shape handled by this prototype; if the deployed server uses `twilio-node`, prefer Twilio's official `validateRequest` utility for the final production enforcement.

The shared `normalizeTwilioInboundSmsWebhookForServer` helper accepts Twilio form fields such as `MessageSid`, `SmsSid`, `From`, `To`, and `Body`, then returns a normalized inbound SMS record with START/STOP keyword classification. The shared `buildTwilioInboundConsentUpdatePlanForServer` helper turns signed inbound START/STOP keywords into credential-free consent updates for matching student, parent, or staff contacts, plus a phone-level suppression/update record so unmatched STOP numbers can still be blocked from future sends. `buildChoMessagingServerTwilioWebhookPlan` can expose that consent plan only after the private route verifies `X-Twilio-Signature`. Twilio's inbound-message docs list those fields as standard request parameters and warn that Twilio can add fields over time, so the private server must preserve signature validation against the complete received parameter set even if the app only consumes a smaller normalized subset.

## Server Relay Contract

The manager can export the current deliverable queue with **Export Twilio Relay JSON** from Message Settings, or enter a **Private Twilio relay URL** and click **Send to Twilio Relay**. Both paths use the same payload shape:

```http
POST /api/messages/send
Authorization: Bearer <manager-session-token>
Content-Type: application/json
```

```json
{
  "schemaVersion": "chos-twilio-relay.v1",
  "provider": "twilio",
  "deliveryMode": "server-relay",
  "generatedAt": "2026-06-03T12:00:00.000Z",
  "requestedBy": {
    "email": "manager123@chos.prototype",
    "role": "staff"
  },
  "messages": [
    {
      "id": "message-123",
      "to": "+12625550101",
      "body": "Reminder: class starts at 5:00 PM.",
      "recipientName": "Ari Nguyen",
      "recipientRole": "student",
      "recipientId": "student-ari",
      "kind": "reminder",
      "createdAt": "2026-06-03T11:58:00.000Z",
      "smsEncoding": "GSM-7",
      "smsUnitCount": 45,
      "smsSegmentCount": 1,
      "optOutLanguageDetected": true,
      "idempotencyKey": "chos-message-123-12625550101",
      "statusCallbackPath": "/api/messages/status/message-123"
    }
  ]
}
```

The browser POST uses `credentials: "include"` so a private relay can authenticate with same-site cookies or another server-managed session. Do not put Twilio credentials or long-lived relay secrets in the browser. The app runs a client-side relay contract self-check before export or direct POST, but the private relay must repeat that validation server-side because browser checks are not a security boundary. The shared `validateTwilioRelayPayloadForServer` helper now rejects payloads unless `requestedBy.role` is `staff`; the private relay must still independently prove that role from its authenticated session before trusting the browser-provided payload. The relay should validate manager/staff auth, validate recipient consent, enforce rate limits, review `smsEncoding` and `smsSegmentCount` for cost/audit preflight, review `optOutLanguageDetected` for outbound compliance checks, reserve each message's `idempotencyKey` in durable storage before calling Twilio, then call Twilio's Messages API with `To`, `Body`, `MessagingServiceSid` or `From`, and optionally `StatusCallback`. The shared `validateTwilioRelayConsentEvidenceForServer` helper requires every live relay recipient to match a credential-free consent evidence contact by role and contact id, with E.164 phone match, `consentStatus: "opt-in"`, and a consent timestamp. Missing, unknown, opted-out, mismatched, malformed, or secret-bearing evidence blocks the execution plan before provider requests are built. The shared `buildTwilioRelayExecutionPlan` helper is for private server use only; it validates the batch, validates consent evidence, builds Twilio form POST requests, attaches a server-only Basic auth header, and carries each Cho relay idempotency key. The shared `buildTwilioRelayDispatchPlan` helper then compares those planned requests with the relay's durable attempt ledger, replays completed results, prepares new reservation records that intentionally omit authorization headers/request bodies/secrets, and blocks in-flight duplicate keys before Twilio is called. The shared `buildTwilioRelaySendPolicyPlan` helper applies final outbound policy gates such as allowed local send windows, per-phone daily message limits, and batch segment ceilings to the requests that still need provider sends after dispatch replay. The lower-level `buildTwilioMessageRequest` helper supports a Messaging Service sender, an approved direct `From` sender, or both. The shared `buildTwilioBasicAuthHeader` helper prefers `TWILIO_API_KEY` plus `TWILIO_API_KEY_SECRET` over local `TWILIO_AUTH_TOKEN` fallback. Twilio's Message Resource docs describe create-message response fields such as `sid`, `status`, `date_sent`, `error_code`, and `error_message`, with possible statuses including `accepted`, `scheduled`, `queued`, `sending`, `sent`, `failed`, `delivered`, `undelivered`, and `canceled`; they also warn that error fields can change, so treat them as audit/display details rather than business control flow. The shared `normalizeTwilioMessageCreateResponseForServer` and `buildTwilioRelayResultFromProviderResponse` helpers turn those provider responses or REST error responses into the app's relay-result shape. Return per-message results:

```json
{
  "results": [
    {
      "id": "message-123",
      "deliveryStatus": "queued",
      "deliveryProviderMessageId": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    },
    {
      "id": "message-124",
      "deliveryStatus": "failed",
      "deliveryProviderMessageId": "SMyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
      "errorCode": "30007",
      "errorMessage": "Carrier violation."
    }
  ]
}
```

Managers can paste that response into **Twilio relay results JSON** and click **Apply Twilio Results**. Accepted provider statuses such as `accepted`, `scheduled`, `queued`, `sending`, `sent`, or `delivered` become app `sent` logs with `deliveryMode: "live"`. Provider failures such as `failed`, `undelivered`, or `canceled` become app `failed` logs with the Twilio SID and error details preserved.

When **Send to Twilio Relay** receives the same result payload directly from the private endpoint, the app applies it immediately and clears no credentials because no Twilio credentials are stored in the app.

Relay messages include a deterministic `idempotencyKey` derived from the Cho message id and normalized recipient phone. The private relay should enforce uniqueness per key, persist the outbound attempt/result against that key, and return the existing stored result if the same manager export, direct POST, retry, cron run, or automation job is submitted again. The shared server validator rejects missing or duplicate idempotency keys within a batch.

## Status Callback Handling

Twilio delivery status callbacks are asynchronous updates after the relay send attempt. The manager can paste a captured status callback into **Twilio status callback JSON** and click **Apply Twilio Status**. The prototype accepts JSON objects, arrays, `results` or `callbacks` wrappers, and URL-encoded callback bodies when they include a Cho message id or a Twilio SID that matches an existing log.

Supported callback fields include:

```json
{
  "messageId": "message-123",
  "MessageSid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "MessageStatus": "delivered",
  "ErrorCode": "",
  "ErrorMessage": ""
}
```

The private relay should configure `statusCallback` from each exported `statusCallbackPath`, verify the Twilio webhook signature with the exact callback URL and all received form parameters, extract the message id from `/api/messages/status/:messageId`, and persist the provider status through the real app backend. Accepted statuses keep the app log `sent` with `deliveryMode: "live"`. Failed statuses such as `failed`, `undelivered`, or `canceled` mark the app log failed and preserve Twilio error details.

The shared `normalizeTwilioStatusCallbackForServer` helper accepts Twilio status callback fields such as `MessageSid`, `MessageStatus`, `SmsStatus`, `ErrorCode`, and `ErrorMessage`, plus the Cho message id from the callback route, then returns the same `TwilioRelayResult` shape used by the app's relay-result importer. Twilio's outbound status-callback docs describe these as form-encoded POST callbacks and note that callback properties can vary by channel/event, so production code must accept evolving parameters and validate the full signature input before normalization.

## Scheduled Promotions And Automation

The manager Messages page includes **Promotion Automation** for scheduling a promotional text by audience and local send date/time. Scheduled promotions are stored in `chos.operations.scheduledCampaigns.v1` and are included in operations backups. When the manager clicks **Run Text Automations**, promotions with `scheduledFor` and `scheduledTime` on or before the current local time become Twilio-ready queued marketing logs. Future promotions stay pending, and canceled promotions are skipped.

This prototype queues due promotions locally instead of calling Twilio directly. In production, a trusted server job should run the same due-date, due-time, and consent checks. If the server chooses Twilio native scheduling instead of queue-on-due-time, Twilio scheduled messages require a Messaging Service and scheduling parameters such as `ScheduleType: fixed` and `SendAt`; Twilio's scheduling window and opt-out behavior still need to be enforced server-side.

Each **Run Text Automations** click writes a local `chos.operations.automationRuns.v1` audit record, including run time, queued/no-due status, total queued count, Twilio SMS delivery contract metadata, and per-automation breakdown counts. The Messages page shows the latest run history so managers can distinguish an empty scheduler check from a broken automation.

The manager can click **Export Automation Manifest** in Follow-Up Automation to download `chos-text-automation-manifest-YYYY-MM-DD.json`. This credential-free artifact describes the private schedule runner contract:

- Recommended cron cadence (`*/15 * * * *`), authenticated manager run path, server-job auth expectations, local timezone, and dry-run/idempotency requirements.
- The automation keys handled by **Run Text Automations**, including missed-class follow-ups, attendance gaps, trials, new students, paused reactivation, celebrations, profile updates, class reminders, milestones, belt test invites, event reminders, and scheduled promotions.
- Non-canceled scheduled promotion records with audience, due date, due time, status, SMS segment preflight, and opt-out-language preflight so prototype data can be migrated or compared against a backend schedule runner.
- Recent local automation run audit records, without Twilio credentials or provider secrets, so production setup can compare due/no-op scheduler behavior during rollout.
- Twilio relay and Web Push endpoint names, Twilio relay/Web Push server contract helper names, the shared messaging server adapter contract helper names, plus required server environment variable names, without Twilio Auth Tokens, Account passwords, VAPID private keys, raw PushSubscription key material, or browser-stored secrets.
- Twilio compliance profile metadata so the schedule runner can block live automation traffic unless sender approval is confirmed server-side.

The automation manifest is a deployment handoff contract. The production server still has to read authoritative backend records, re-check sender compliance, consent and opt-outs, enforce rate limits, dedupe repeated cron runs, validate relay payloads server-side, and persist queued/sent/failed delivery state before Twilio or push sends become live.

The dependency-free shared `buildTextAutomationExecutionPlan` helper in `src/textAutomationContract.ts` gives that private cron/manual runner a tested server-only handoff. It classifies scheduled promotions as due, future, queued, canceled, or invalid; creates stable scheduled-promotion due keys for idempotency; calls `buildTwilioRelayExecutionPlan` so relay payload, Basic auth, SMS consent evidence, idempotency keys, and segment limits are checked together; calls `buildTwilioRelayDispatchPlan` so repeated cron runs replay completed results, reserve new keys, or block in-flight duplicate SMS work before provider calls; calls `buildTwilioRelaySendPolicyPlan` so quiet-hour, per-recipient daily limit, and batch segment policy can block live sends before reservations or provider requests; and can call `buildChoWebPushDeliveryPlan` so manager devices receive an app-message notification when automation work is ready for review. A blocked automation plan should not call Twilio or Web Push until the reported errors are resolved.

## Minimal Relay Handler Shape

Server code must run outside the Vite app. The dependency-free shared contract in `src/twilioRelayContract.ts` validates the Cho payload and builds the `application/x-www-form-urlencoded` Twilio Messages request body. A Node/serverless handler can use that contract shape like this:

In the example, `relayStore` represents private durable storage for idempotency reservations and send results, such as a database table keyed by `idempotencyKey`, and `consentStore` represents the server-side consent table or Twilio Consent Management sync layer. Do not trust browser-exported consent evidence as the authority for live sending; use the exported evidence to migrate or compare records, then read authoritative server consent immediately before sending.

```js
import {
  buildTwilioRelayDispatchPlan,
  buildTwilioRelayExecutionPlan,
  buildTwilioRelayResultFromProviderResponse,
  validateTwilioRelayConsentEvidenceForServer,
  validateTwilioRelayHealthResponseForBrowser,
  validateTwilioFormWebhookSignature
} from "./twilioRelayContract.js";

const requiredEnv = [
  "TWILIO_ACCOUNT_SID"
];

export async function sendChoMessages(payload, { origin, fetch }) {
  for (const name of requiredEnv) {
    if (!process.env[name]) throw new Error(`Missing ${name}.`);
  }
  const hasApiKeyPair = Boolean(process.env.TWILIO_API_KEY && process.env.TWILIO_API_KEY_SECRET);
  const hasLocalAuthToken = Boolean(process.env.TWILIO_AUTH_TOKEN);
  if (!hasApiKeyPair && !hasLocalAuthToken) {
    throw new Error("Missing Twilio API key pair or local Auth Token fallback.");
  }
  if (!process.env.TWILIO_MESSAGING_SERVICE_SID && !process.env.TWILIO_FROM_NUMBER) {
    throw new Error("Missing Twilio Messaging Service SID or approved From sender.");
  }

  const consentEvidence = await consentStore.buildEvidenceForRelayPayload(payload);
  const consentValidation = validateTwilioRelayConsentEvidenceForServer(payload, consentEvidence);
  if (!consentValidation.ok) {
    throw new Error(`Cho relay consent validation failed: ${[
      ...consentValidation.errors,
      ...consentValidation.rejected.map((item) => `${item.id}: ${item.reasons.join(", ")}`)
    ].join("; ")}`);
  }

  const plan = buildTwilioRelayExecutionPlan(payload, {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    apiKeySid: process.env.TWILIO_API_KEY,
    apiKeySecret: process.env.TWILIO_API_KEY_SECRET,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
    consentEvidence,
    origin,
    maxMessages: 100,
    maxSegmentsPerMessage: 3
  });
  if (!plan.ok) throw new Error(`Cho relay execution plan failed: ${plan.errors.join("; ")}`);

  const existingAttempts = await relayStore.findManyByIdempotencyKeys(
    plan.requests.map((planned) => planned.relayIdempotencyKey)
  );
  const dispatchPlan = buildTwilioRelayDispatchPlan(plan, {
    existingAttempts,
    reservedAt: new Date().toISOString()
  });
  if (!dispatchPlan.ok) {
    const blocked = dispatchPlan.blocked.flatMap((entry) => entry.reasons).join("; ");
    throw new Error(`Cho relay dispatch plan failed: ${[...dispatchPlan.errors, blocked].filter(Boolean).join("; ")}`);
  }

  await relayStore.reserveAttempts(dispatchPlan.attemptsToReserve);

  const results = [...dispatchPlan.replayResults];
  for (const planned of dispatchPlan.requestsToSend) {
    const { request } = planned;
    await relayStore.markSending(planned.relayIdempotencyKey);
    const response = await fetch(request.url, {
      method: request.method,
      headers: {
        ...request.headers,
        Authorization: planned.authorizationHeader
      },
      body: request.body
    });
    const sent = await response.json();
    const result = buildTwilioRelayResultFromProviderResponse({
      messageId: planned.messageId,
      httpStatus: response.status,
      responseBody: sent
    });
    await relayStore.saveResultForIdempotencyKey(planned.relayIdempotencyKey, result);
    results.push(result);
  }
  return { results };
}

export function twilioRelayHealthResponse({
  managerSession,
  complianceReady,
  webhookSignatureValidationEnabled
}) {
  const readinessChecks = {
    managerAuth: Boolean(managerSession?.role === "staff"),
    twilioCredentials: Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      ((process.env.TWILIO_API_KEY && process.env.TWILIO_API_KEY_SECRET) || process.env.TWILIO_AUTH_TOKEN)
    ),
    senderConfigured: Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER),
    complianceReady: Boolean(complianceReady),
    webhookSignatureValidation: Boolean(webhookSignatureValidationEnabled),
    relayCanSend: false
  };
  readinessChecks.relayCanSend = Object.values(readinessChecks).every(Boolean);
  const response = {
    status: readinessChecks.relayCanSend ? "ready" : "not-ready",
    checkedAt: new Date().toISOString(),
    readinessChecks
  };
  const browserValidation = validateTwilioRelayHealthResponseForBrowser(response);
  if (!browserValidation.ok) throw new Error(`Unsafe relay health response: ${browserValidation.errors.join("; ")}`);
  return response;
}

export async function verifyTwilioWebhook({ authToken, signature, url, formParameters }) {
  return validateTwilioFormWebhookSignature({
    authToken,
    signature,
    url,
    parameters: formParameters
  });
}
```

## Current Prototype Behavior

- Queued text logs are tagged with `deliveryChannel: "sms"`, `deliveryProvider: "twilio"`, and `deliveryMode: "prototype"`.
- Clicking Send Queued Texts marks deliverable queued texts as sent locally and removes stale queued recipients.
- Export Twilio Relay JSON downloads only currently deliverable queued texts that pass the shared relay contract, normalizes local U.S. numbers to E.164, includes manager identity metadata and deterministic message idempotency keys, and excludes Twilio credentials and account passwords.
- Send to Twilio Relay self-checks the same credential-free payload, posts it to a configured private relay URL with cookie/session credentials included, then applies the relay response.
- The shared relay contract rejects payloads that are not requested by an authenticated staff account, and the private relay must enforce that role from server-side auth before live sends.
- Direct Send to Twilio Relay also requires the manager-visible sender compliance profile to be ready before the browser attempts the live relay POST.
- Twilio relay messages include SMS encoding, unit count, segment count, and opt-out-language detection so the private server can audit cost/compliance and reject unexpected campaign sizes before live sending.
- `buildTwilioRelayExecutionPlan` gives the private relay a tested server-only batch plan with validation output, Twilio request bodies, API-key Basic auth headers, recipient metadata, and durable idempotency keys.
- `buildTwilioRelayDispatchPlan` compares a valid execution plan with durable relay attempt records, replays completed results, reserves new keys with credential-free audit records, and blocks in-flight duplicates before any Twilio API call.
- `buildTwilioRelaySendPolicyPlan` applies final server-side outbound policy such as allowed local send windows, per-phone daily limits, and batch segment ceilings before manager blasts or automation runs call Twilio.
- `buildChoMessagingServerRelayPlan` exposes dispatch and send-policy plans through the authenticated server adapter, so private relay handlers can gate manager sessions, validate consent, reserve/replay idempotency keys, and enforce outbound policy from one server-side handoff.
- `buildTwilioRelayResultFromProviderResponse` maps Twilio create-message responses and REST errors back into app relay results, including scheduled statuses, Twilio SIDs, and display-only error details.
- `buildTwilioInboundConsentUpdatePlanForServer` maps signed inbound START/STOP replies into contact-level and phone-level consent updates so opt-outs can be enforced before future mass texts or automation sends.
- `buildChoWebPushResultFromProviderResponse` and `buildChoWebPushDeliveryReconciliationPlan` give the private push server a tested cleanup path for provider responses, failed sends, and expired browser subscriptions.
- Apply Twilio Results reconciles private relay responses back into the text log, preserving Twilio SIDs, live delivery status, and failed carrier/error details.
- Apply Twilio Status reconciles asynchronous Twilio delivery callbacks back into existing live text logs by Cho message id or matching Twilio SID.
- SMS consent guard can record or clear local opt-outs by phone number, and opted-out contacts are treated as non-deliverable.
- Export Consent Evidence downloads credential-free student, parent, and staff SMS consent state for private relay reconciliation.
- Apply Twilio Inbound can import captured inbound SMS webhooks, route known student/guardian replies into direct messages, and apply STOP/START keyword consent updates.
- Marketing and Promotion Automation composers show SMS encoding, segment estimates, and opt-out-language compliance warnings before queued texts are created.
- Marketing Tool delivery preview shows selected-audience student, parent, staff, and total ready counts before queueing mass texts.
- Twilio Account Launch Profile persists non-secret Messaging Service, sender, webhook, relay-health, manager-auth, and sender-compliance setup values for production handoff.
- Check Relay Health calls the configured private relay health URL with manager browser credentials and displays the returned non-secret readiness status only after the shared browser validator confirms structured readiness checks and no credential-like fields.
- Production and automation manifests distinguish the required `TWILIO_ACCOUNT_SID`, the production API key pair or local Auth Token fallback, and the Messaging Service or approved `From` sender choice.
- Live Twilio Readiness shows manager-visible preflight status for relay account/auth/sender requirements, deliverable queue size, consent guard, notification readiness, relay result import, status callback import, inbound import, and the webhook signature helper that the private relay must enforce.
- Export Integration Manifest downloads the credential-free production handoff contract for Twilio relay, webhook, Web Push, and manager-auth server work.
- Export Automation Manifest downloads the credential-free schedule-runner handoff contract for private cron/manual automation jobs, Twilio relay batching, scheduled promotions, and Web Push notification coordination.
- App-message notification badges sync unread counts on supported installed-app browsers, and the service worker can display future Web Push notifications from a private push server while applying `unreadCount` or `badgeCount` badge updates from push payloads.
- Notification Center includes a test notification action for current-device verification after browser notification permission is granted.
- Operations Notification Center state is account-scoped so created staff accounts do not inherit the built-in manager's unread seen timestamp or push device subscription on a shared browser.
- Student Profile message feeds persist per-session browser notification preferences and PushSubscription metadata, then can alert or server-push the signed-in student when staff sends an unread direct app message.
- Parent Profile message feeds persist per-session browser notification preferences and PushSubscription metadata, then can alert or server-push the signed-in parent when staff sends an unread family direct app message.
- Connect This Device creates a browser PushSubscription using a public VAPID key, Sync Push Subscription posts it to a configured private push server URL with cookie/session credentials included, and Export Push Subscription JSON preserves a credential-free fallback payload for staff/manager server storage. Student and parent profile feeds support the direct sync path with `student` and `guardian` roles.
- Operations backups include the portable `messagingSetup` handoff record and restore non-secret Twilio/Web Push setup without restoring raw PushSubscription key material.
- `src/webPushContract.ts` validates server-bound push subscriptions for supported staff, student, and guardian account roles and builds app-scoped `chos-web-push-notification.v1` payloads for private push-server sends.
- Audience blasts can target students, parents, staff, or everyone with localStorage-backed audit records.
- Promotion Automation stores future promotional blasts with local send date/time, queues only due promotions through Run Text Automations, and keeps scheduled promotion records plus automation run audit history in operations backups.
- Event reminder automation can queue family, student, or public event SMS reminders for the next 7 days and dedupes same-day recipient/body work.
- Run Text Automations queues the local prototype follow-up/reminder/promotional candidates in one manager action and records a run ledger for queued and no-op checks. A production version should move the schedule trigger to a trusted server job or cron worker and use `buildTextAutomationExecutionPlan` with relay attempt records so repeated jobs reserve, replay, or block idempotency keys before Twilio sends.
- Device notification controls use the browser Notification permission surface where supported, the browser Badging API where available, and service worker notification click/push handlers for app-scoped `/messages` URLs. True cross-device background push requires a push subscription server.

## Docs Consulted

- Twilio Node helper library: https://github.com/twilio/twilio-node
- Twilio Programmable Messaging docs: https://www.twilio.com/docs/messaging
- Twilio API authentication basics: https://www.twilio.com/docs/iam/api
- Twilio outbound message status callbacks: https://www.twilio.com/docs/messaging/guides/outbound-message-status-in-status-callbacks
- Twilio webhook security: https://www.twilio.com/docs/usage/webhooks/webhooks-security
- Twilio Message Scheduling docs: https://www.twilio.com/docs/messaging/features/message-scheduling
- Twilio error 21610 / opt-out behavior: https://www.twilio.com/docs/api/errors/21610
- Twilio Consent and Opt-in Policy: https://www.twilio.com/docs/verify/consent-opt-in
- Twilio Consent Management API: https://www.twilio.com/docs/messaging/features/consent-api
- Twilio SMS character limits: https://www.twilio.com/docs/glossary/what-sms-character-limit
- Twilio A2P 10DLC compliance: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc
- Twilio toll-free verification: https://www.twilio.com/docs/messaging/compliance/toll-free/console-onboarding
- Twilio incoming message webhook request parameters: https://www.twilio.com/docs/messaging/guides/webhook-request
- Twilio outbound message status callbacks: https://www.twilio.com/docs/messaging/guides/track-outbound-message-status
- MDN ServiceWorkerGlobalScope push event: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/push_event
- MDN ServiceWorkerGlobalScope notificationclick event: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/notificationclick_event
- MDN Badging API: https://developer.mozilla.org/en-US/docs/Web/API/Badging_API
- MDN ServiceWorkerRegistration pushManager: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/pushManager
- MDN PushManager.subscribe: https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe
