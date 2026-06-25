# Chain Check — Compensation Chain Movement Assessment

**Built by The Healthy Yinzer · Nick Venuti, Exercise Physiologist**

Chain Check is a full-stack web application for movement screening and coaching. It uses real-time pose detection (MediaPipe) to assess compensation patterns in the kinetic chain. Dysfunction can enter the chain at any joint — ankles, knees, hips, shoulders, wherever. The framework is always: **where does YOUR chain break down?** Pain rarely stays where it started. That's the concept.

The screening ranges, chain patterns, and protocol recommendations are informed by biomechanics research and intended to guide coaching conversations.

> "Pain rarely stays where it started. We work the pattern, not the symptom."
> — Coach Nick

---

## What It Does

### Client-Facing (Paid Program)

- **Magic link authentication** — clients log in via a one-click email link, no passwords
- **16-week checkpoint roadmap** — Baseline through Week 16, stored in the cloud
- **Live movement scan** — MediaPipe pose engine runs in the browser camera, detecting rep patterns and hold stability across 8 movements:
  - Standing posture (front + side)
  - Squat (5 front + 5 side reps)
  - Split squat left and right
  - Single-leg balance (left and right, 8s hold)
  - Hip hinge
  - Ankle mobility (knee-to-wall, 4s hold each side)
- **Post-scan results** — chain map, age-bracket benchmarks, coach note in Nick's voice, plain-language gap callout, protocol suggestion
- **"Send to Coach Nick"** — guided feedback form with GHL webhook
- **PDF export** — white-background summary with human-friendly metric names and Good/Watch/Flag labels
- **Session history** — side-by-side comparison of any two sessions with trend arrows (clearing / watch / steady)

### Coach Dashboard (Admin)

- **Priority queue** — clients sorted into Needs Attention / Scan Due / On Track
- **Send magic link** — one click fires a login link to any client
- **Per-client trend charts** — 16-week metric trends, one line per measurement
- **GHL trigger** — manually apply a tag or fire a workflow from within the dashboard
- **Progression flags** — after Week 4+, persistent compensation patterns surface specific activation protocols with research-informed rationale and citations

### Free Scan Lead Magnet (`/free-scan`)

- **No login required** — public page, 3-movement battery (Standing, Squat, Split Squat)
- **Email gate** — name, email, and Rebuild vs Restart quiz before results are shown
- **Result card** — worst region identified, plain-language recommendations, "Your reading vs Normal" comparison
- **Book a call CTA** — links directly to Calendly
- **GHL integration** — contact upserted and tagged (`free-chain-check`, `quiz-rebuild` or `quiz-restart`) on submission

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Express 4, tRPC 11, Superjson |
| Database | MySQL / TiDB (Drizzle ORM) |
| Auth | Manus OAuth (admin) + Magic link (clients) |
| Pose Detection | MediaPipe Tasks Vision (`@mediapipe/tasks-vision`) |
| PDF Generation | Server-side HTML → browser print |
| CRM Integration | HighLevel MCP connector (contacts_upsert, contacts_add-tags) |
| File Storage | S3-compatible (Manus built-in) |
| Routing | Wouter |
| Testing | Vitest |

---

## Project Structure

```
client/src/
  pages/          — All page-level components
    Home.tsx          — Entry point / redirect
    Login.tsx         — Magic link login
    ClientDashboard.tsx — Client home with roadmap + chain map
    ScanPage.tsx      — Battery selection + checkpoint picker + tutorial
    ScanLive.tsx      — Live MediaPipe scan engine
    ScanResults.tsx   — Post-scan results with benchmarks + citations
    SessionHistory.tsx — History list + side-by-side compare
    CoachDashboard.tsx — Admin priority queue + client management
    CoachClientView.tsx — Per-client trend charts + progression flags
    FreeScan.tsx      — Public lead magnet (/free-scan)
  components/
    ChainMap.tsx      — Interactive SVG body figure with hover tooltips
    ResearchPanel.tsx — Collapsible research citations panel
    Roadmap.tsx       — 16-week checkpoint progress track
  lib/
    moveLibrary.ts    — All movement definitions, metrics, benchmarks
    scanUtils.ts      — Coach note generator, status computation, trend logic
    progressionLogic.ts — Evidence-based chain pattern detection + protocols

server/
  routers.ts        — All tRPC procedures (auth, scan, admin, free funnel)
  db.ts             — Database query helpers
  ghl.ts            — HighLevel CRM integration via MCP connector
  pdf.ts            — PDF HTML generator

drizzle/
  schema.ts         — Database tables (users, clients, sessions, magic_links, etc.)
```

---

## Compensation Chain Science

The screen uses research-informed ranges and pattern rules. These are coaching aids, not medical cutoffs. Key sources:

- **Taylor et al. (2021)** — Every 1° of ankle dorsiflexion restriction = 1.2° less peak knee flexion. *Sports Health, PMC9112706*
- **Lima et al. (2018)** — Restricted ankle dorsiflexion was associated with dynamic knee valgus in a systematic review/meta-analysis. *Physical Therapy in Sport*
- **Rabin et al. (2016)** — Low dorsiflexion → greater peak hip adduction and knee external rotation. *JOSPT*
- **Hodel et al. (2023)** — Lateral pelvic tilt was associated with knee valgus and hip rotation. *Journal of Orthopaedic Research*
- **Donati et al. (2024)** — Hip asymmetry > 5° associated with altered knee mechanics and IT band compensation. *Applied Sciences*
- **Cook et al. (2014)** — FMS identifies compensatory movement patterns in the kinetic chain. *IJSPT, PMC4060319*
- **Mahmoud et al. (2019)** — Forward head posture increases cervical spine compressive loading. *Current Reviews in Musculoskeletal Medicine*

The full citation registry with DOI/PMC links is embedded in `progressionLogic.ts` and displayed in-app on every result screen.

---

## Running Locally

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Generate database migration
pnpm drizzle-kit generate
```

Requires a `DATABASE_URL` environment variable (MySQL/TiDB connection string). Production magic links also require `PUBLIC_BASE_URL` or `APP_URL` so login emails are generated from a trusted app URL instead of request headers. All other secrets are injected via the Manus platform environment.

---

## Key Routes

| Route | Description |
|---|---|
| `/` | Entry point — redirects based on role |
| `/login` | Magic link login for clients |
| `/verify?token=...` | Magic link verification |
| `/dashboard` | Client home dashboard |
| `/scan` | Battery selection + tutorial |
| `/scan/live` | Live camera scan |
| `/results/:sessionId` | Post-scan results |
| `/history` | Session history + compare |
| `/coach` | Coach dashboard (admin only) |
| `/coach/client/:id` | Per-client view with trend charts |
| `/free-scan` | Public lead magnet (no login) |

---

## GHL Integration

Scan events automatically upsert contacts and apply tags in HighLevel:

| Event | Tags Applied |
|---|---|
| Free scan submitted | `free-chain-check`, `quiz-rebuild` or `quiz-restart` |
| Paid scan completed | `scan-complete`, `program-rebuild/restart`, `baseline-complete` |
| Client feedback sent | `scan-feedback-received` |

Integration uses the HighLevel MCP connector via `manus-mcp-cli`. No webhook URL required.

---

## About

Built by [The Healthy Yinzer](https://thehealthyyinzer.com) — Nick Venuti, Exercise Physiologist, Pittsburgh PA.

The Compensation Chain framework asks one question: where does YOUR chain break down? Dysfunction can enter at any joint. Pain rarely stays where it started. We work the pattern, not the symptom.

---

*This is a movement screen, not a diagnosis. Readings depend on camera angle, lighting, clothing, and how the person felt that day.*
