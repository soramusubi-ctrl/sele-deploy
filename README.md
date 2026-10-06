# Quiet Atelier

React/Vite frontend with server-only Gemini image, video and Live audio APIs on Vercel.

## Security change / deployment gate

The browser never receives a Gemini API key. Do **not** put provider credentials in
`VITE_*`, `define`, browser code, public files, or a URL. The old `API_KEY` build-time
replacement is removed; server functions use only `GEMINI_API_KEY` at runtime.

This migration is intentionally **fail closed** until an operator completes the
configuration below. A static Vite preview alone does not run `/api/*`.
No cloud resources, credentials, provider calls, deployments or key rotations are
created by this code or its tests.

### Required operator configuration

Use Node.js 22+ and Vercel Fluid Compute. Native WebSocket Functions are currently in
public beta; verify that the project's runtime supports the exported Node HTTP
server at `/api/live` before enabling AI. `vercel.json` reserves 120 seconds per
function; the paid Live session itself has a 45-second server-enforced limit.

Set these variables **server-side**, separately for each approved environment:

- `AI_ENABLED=true` only after all configuration, tests and budgets are reviewed.
  Leave unset/false in untrusted preview deployments.
- `GEMINI_API_KEY`: a newly rotated provider key. Restrict it to the required Gemini
  API/project and review provider rate quotas and billing alerts. Never reuse an
  exposed key as the final mitigation.
- `APP_ORIGIN`: the exact HTTPS site origin, without trailing slash/path. Local
  testing may use `http://localhost:PORT` or `http://127.0.0.1:PORT`.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: an approved persistent
  Upstash Redis database. Only HTTPS `*.upstash.io` URLs are accepted. Disable
  eviction of the budget ledger and restrict Redis access to the server/operator.
- `AI_DAILY_UNITS`: integer 1–200.
- `AI_LIFETIME_UNITS`: integer at least the daily limit and at most 2000.

Provisioning Redis or creating/configuring credentials is a separate operator
step. This PR does not perform it. Use the same persistent ledger for every
instance/deployment sharing one paid budget. Never use a new namespace/database
to bypass a budget. Do not share the database with code that might flush it.

Before initial enablement, initialize the ledger **once**, through your trusted
Redis console, with this conditional script (no credentials are shown here):

```
EVAL "if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end; redis.call('HSET', KEYS[1], 'total', 0, 'day', 0, 'daily', 0); return 1" 1 'sele:{ai}:budget'
```

Do not assign an expiry. Result `0` means an existing ledger was left unchanged.
A missing/corrupt/expiring ledger fails closed; it is never recreated by requests.
If the database is lost or flushed, reconcile actual provider usage before any
manual recovery; resetting this ledger resets the lifetime protection. When the
lifetime budget is reached, an operator must review consumption before any change.

### Bounded spend and trust model

No passphrase, sign-in or user-entered provider key is required. The browser first
POSTs JSON to `/api/session` and receives a random 256-bit anonymous ownership
cookie. On HTTPS it is `__Host-sele-session`, with Secure, HttpOnly, SameSite=Strict,
Path=/, no Domain, and a 24-hour lifetime. Only loopback HTTP development uses an
unprefixed non-Secure cookie. JavaScript never reads the cookie; no session signing
secret, account, provider credential or extra service is created.

Every paid REST request and WebSocket upgrade requires the cookie and exact
Origin; cross-site Fetch Metadata and duplicate/malformed cookies are rejected.
Origin is CSRF defense, not authentication. The cookie is an unguessable video
ownership capability, **not a verified person or trusted user**. Any anonymous
visitor or script can establish a session and consume the shared budget. Clearing
cookies, opening new browsers, reconnecting Live or changing instances does not
reset the global daily/lifetime ledger. There is no claim of per-person rate
limiting. Anonymous budget exhaustion remains an accepted availability risk;
these changes do not make the endpoint a private service or a complete DDoS defense.

Video jobs use a hash of the ownership cookie. Other anonymous sessions cannot
poll/download those jobs. Global request IDs with owner-bound fingerprints prevent
an uncertain create from being billed again after cookie loss. Clearing/expiring
cookies loses access to existing jobs; the UI fails closed rather than silently
regenerating. Session storage keeps only pending request/job IDs, never cookies or
provider credentials. Bootstrap uses Web Locks to serialize first visits across
tabs where supported; simultaneous first visits in older browsers may replace the
shared cookie and lose job access, but never reset the global budget. Pending jobs created under the old shared-code version
cannot be recovered through anonymous sessions. A legacy pending record in the
same tab blocks new creation until an operator reconciles it. Closing the tab or
clearing browser storage loses that safeguard; do not re-submit uncertain old jobs.

Removing the access-code UI alone **does not enable AI**. The rotated server-only
Gemini key, exact origin, approved existing Redis connection, initialized durable
ledger, explicit budgets and `AI_ENABLED=true` are still required. A missing or
incorrect server configuration returns 503; missing/corrupt Redis fails closed.
No Vercel settings, credentials or production deployment are changed by this PR.

Redis Lua atomically reserves both daily and lifetime units before each paid
attempt, with at most two shared in-flight leases. Browser localStorage counters
are only UI guidance and cannot override this server gate. Reservations are never
refunded, including failures, timeouts, disconnects or ambiguous responses. No
paid operation automatically retries. Store errors fail closed.

Units are conservative **request weights, not a currency guarantee**:

| Operation | Units | Additional fixed bounds |
| --- | ---: | --- |
| Summarize / guide analysis | 1 | One candidate, 2048 output tokens, 12,000 conversation characters |
| Standard image / edit | 10 | One candidate, 1K output, 8192 output tokens |
| Pro image / edit | 40 / 80 / 160 | 1K / 2K / 4K, one candidate, 8192 output tokens |
| Video | 160 | One 720p eight-second Veo output, durable opaque job |
| Live audio | 40 | 45 seconds, paced/total PCM cap, bounded turns and output; drawing separately reserves image units |

For example, a lifetime limit of 200 allows at most 20 standard image attempts or
one video plus one Live session before operator review. Mixed workloads consume
the same ledger. Changing model prices can change actual currency spend; combine
these hard request/input/output ceilings with provider restrictions and alerts.
This protects Gemini usage; it is not a complete infrastructure DDoS/WAF defense.

### Preserved features and visible limits

- Image generation, editing, guide analysis and conversation summarization go
  through `/api/ai`. Standard/Pro/4K controls remain. Fixed image models use current
  GA successors `gemini-3.1-flash-image` / `gemini-3-pro-image` because the original
  image models' documented retirement dates have passed. Text uses the existing
  `gemini-3-flash-preview`; Live uses the supported December 2025 native-audio
  preview. Availability must be verified in the approved provider project.
- At most three reference images, at most 1 MiB each, and 3 MB request JSON. Large
  image copies can be prepared in-browser **only after confirmation showing the
  original and prepared dimensions**. Original downloads are unchanged. Requests
  that still exceed the bound show an actionable error before a paid call.
- Generated image responses use chunked streaming, with a 32 MB upstream JSON cap
  and a 24 MB base64 image cap, to preserve 4K output without the buffered Vercel
  4.5 MB limit. No untrusted provider JSON is forwarded. Oversized output fails
  safely and still consumes the already-reserved units.
- Video uses a durable owned job, non-expiring replay markers in the bounded lifetime ledger, ten-second poll spacing,
  bounded poll/download counts, and a server-mediated MP4 stream (64 MiB cap).
  Provider URLs and operation names are never accepted from the browser. Provider
  download URLs must match an exact HTTPS Google path; redirects are rejected
  rather than forwarding the key to another host. If Google changes the download
  format/redirect behavior, review and update the allowlist before enabling video.
  A lost/ambiguous start is shown as uncertain, never silently retried. Navigating
  away stops browser polling, not an already-submitted provider job.
- Live audio runs through the same-origin anonymous-session WebSocket relay. The long-lived key
  stays on the server; no ephemeral provider credential is issued to browsers.
  The server owns duration, pacing, byte/turn/output limits and tool configuration.
  A user can reconnect explicitly after the visible 45-second limit, subject to
  a new budget reservation. Provider connection loss is not automatically retried.

### Existing exposure requires separate response

Removing browser injection does not revoke a previously published credential or
remove old downloaded/cached deployment bundles. The owner must rotate/revoke the
old key, review provider usage, configure the replacement server-only key, and
retire/protect old deployments. Merge/deployment/key changes require separate
review. Do not paste a key into this repository, chat, screenshots or PR comments.

## Local checks

```
npm ci --ignore-scripts
npm test
npm run build
npm run lint:security
npm run lint
node tests/check-client-bundle.mjs
```

Tests use fake credentials and mocked upstreams; they never make billable calls.
Real Redis integration tests require an explicitly selected local test Redis via
`TEST_REDIS_PORT`; otherwise they report skipped. The PR workflow runs a disposable
Redis service and executes these tests, builds with inert secret sentinels and
checks that neither sentinels nor direct provider endpoints reach browser assets.
Do not point test Redis at a real budget database.

The inherited repo has lint findings outside this security migration; report them
separately rather than claiming the entire repo passes. The focused changed-file
lint, build and security tests should pass before review.

For a local full-stack check, run the approved Vercel development workflow with
server environment variables and a disposable Redis ledger. Plain `npm run dev`
serves only the frontend. Do not enable external network access or real billable
provider calls as part of automated tests.

## Required pre-release staging verification

An operator should verify automatic sessions and job isolation, missing-config denial, budget exhaustion,
concurrent requests, streamed 4K image output, opted-in image preparation,
generate→analyze/edit/video, uncertain video behavior, allowed MP4 download, and
Live connect/disconnect/reconnect/drawing in a protected staging environment with
a deliberately small approved budget. Mock/local checks cannot establish actual
Google project model access, Vercel beta WebSocket availability or live media
compatibility. Do not merge/deploy based only on these mocks.

References:
- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/deprecations
- https://ai.google.dev/gemini-api/docs/veo
- https://upstash.com/docs/redis/features/restapi
- https://vercel.com/changelog/websocket-support-is-now-in-public-beta
- https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections
- https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions
