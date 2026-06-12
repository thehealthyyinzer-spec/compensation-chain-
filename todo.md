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
