# Chain Check — Project TODO

## Foundation
- [x] Database schema (clients, sessions, scan_results, magic_links tables)
- [x] Global theming (dark navy theme, Barlow Condensed + Inter fonts, teal/orange/gold palette)
- [x] Responsive layout system (mobile-first, fluid across all breakpoints)

## Authentication
- [x] Magic link auth — client enters email, receives one-click login link
- [x] Admin auth via Manus OAuth for Coach Nick
- [x] Role-based access (admin vs client)

## Client Dashboard
- [x] Home view with 16-week checkpoint roadmap (Baseline → Wk 16)
- [x] Scan status stats (checkpoints done, program week, up next)
- [x] Chain Map SVG colored by region status (shoulders, core, hips, knees, ankles)
- [x] Latest coach note display

## Scan Engine
- [x] Movement battery picker (Squat, Single-leg balance, Overhead reach, Hip hinge, Lunge)
- [x] Ability to deselect movements before each scan
- [x] Full MediaPipe pose engine (rep detection, EMA smoothing, hold timers, skeleton overlay)
- [x] Audio ding feedback on rep count
- [x] Front + side phase separation for dynamic movements
- [x] Adaptive rep detection with fatigue tracking
- [x] Lower DOWN threshold (amp*0.30, floor 0.016) for shallow squat detection
- [x] Updated squat/split squat instructions — "you don't need to go deep"

## Post-Scan Results
- [x] Auto-generated coach note in Nick's voice
- [x] Age-bracket benchmark tabs with peer-reviewed sources
- [x] Chain map SVG colored by region status
- [x] Metric cards with benchmark bars (good/warn/bad)

## Client Feedback & Sharing
- [x] "Send to Coach Nick" button with guided questions ("What did you feel? Any pain or tightness?")
- [x] GHL webhook fires with full session payload (webhook_logs table + pending queue; actual HTTP POST deferred until GHL URL configured)
- [x] Downloadable PDF summary (metrics, coach note, chain map)

## Coach Dashboard (Admin Only)
- [x] All clients list with latest scan status (CLEAN / WATCH / FLAGS)
- [x] Per-client trend charts over 16 weeks (one line per metric)
- [x] Ability to manually apply GHL tag or trigger workflow (notifies owner; actual GHL POST deferred until URL configured)
- [x] View individual client scan details

## Session History
- [x] Session list with date, checkpoint label, and status pill
- [x] Single-session detail view
- [x] Side-by-side comparison of any two sessions
- [x] Trend arrows: clearing, watch, steady

## Data Layer
- [x] Cloud database persistence (replace localStorage)
- [x] Scan data stored per client per session
- [x] Webhook retry logic for GHL (pending queue + attempts tracking; actual retry worker deferred until GHL URL configured)

## UX Enhancements
- [x] Pre-scan tutorial screen before camera loads (phone positioning + body placement)
- [x] Skip tutorial toggle for returning clients (auto-bypass after first scan)

## Claude's 7-Task Batch
- [x] Task 1: Checkpoint selector on ScanPage + sessionStorage handoff to ScanLive (already done)
- [x] Task 2: Compensation chain patterns in generateCoachNote (ankle→knee, hip→knee, shoulder→core, fwd head→shoulder)
- [x] Task 3: Fatigue curve on balance holds (swayFatigue = lateMean - earlyMean) + swayFatigue metric in moveLibrary
- [x] Task 4: Coach dashboard priority queue (Needs Attention / Scan Due / On Track sections)
- [x] Task 5: Plain-language gap callout banner in ScanResults (worst metric with orange border + gold headline)
- [x] Task 6: Fullscreen scan mode on mobile (fixed inset-0, minimal overlay, auto-enable on mobile)
- [x] Task 7: Free scan GHL funnel endpoint + free_scan_submissions DB table
- [x] Send magic link button on coach dashboard (fires login link directly to client email)

## Phone Test Bugs (real scan feedback)
- [x] Camera fullscreen UX — auto-fullscreen on mobile (< 768px), fills screen with gradient overlays
- [x] Skeleton color feedback — white idle, blue while capturing, green flash on rep confirm
- [x] Audio ding confirmation — ding fires on rep complete + green flash
- [x] Ankle test simplified — knee-to-wall style, 4s hold, lower trigger threshold, cleaner instructions
- [x] PDF text invisible — white background, dark text, fully readable
- [x] PDF raw data — human-friendly metric names, Good/Watch/Flag status labels, no raw numbers

## Progression Logic & Social Proof
- [x] Progression logic engine — detect persistent patterns after Week 4+, surface activation protocol suggestions
- [x] Protocol assignment UI on coach dashboard — Nick assigns a protocol from scan result
- [x] Social proof module — results-based client stories in client dashboard

## Free Scan Lead Magnet (/free-scan)
- [x] /free-scan public page — 3-movement scan (Standing, Squat, Split Squat), no login
- [x] Email/name/quiz gate after scan completes
- [x] Result card with region finding, plain-language copy, and protocol recommendation
- [x] Book a Call CTA wired to freeChainCheck.submit endpoint

## UI Fixes
- [x] Free scan camera not showing after Start button — fixed by mounting video/canvas before assigning stream
- [x] Chain map SVG — rebuilt as dynamic interactive body figure with hover states, region tooltips, glow effects, and status colors

## Evidence-Based Upgrades
- [x] Upgrade progressionLogic.ts with peer-reviewed clinical thresholds and citation metadata
- [x] Add research citations panel to ScanResults page (paid) and FreeScan result screen (free)

## GHL Email Integration
- [x] Auto-send magic link via GHL email when coach hits "Send Link" on dashboard

## Coach Dashboard Additions
- [x] Free scan submissions view on coach dashboard (name, email, quiz result, date)

## Self-Registration (Temporary Beta Access)
- [x] Self-registration form on login page — name + email, auto-creates client account and sends magic link email

## Live Scan UX
- [x] Skip movement button during live scan — lets client skip a movement and move to the next one

## Session History
- [x] Single-session detail view — tap any past checkpoint in history to see exact metrics, chain map, and coach note from that session
