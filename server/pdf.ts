/**
 * PDF generation for scan session summaries.
 * Generates a styled HTML document that can be printed to PDF from the browser.
 * White background, readable text, human-friendly output — no raw data dumps.
 */

interface PdfMetric {
  name: string;
  value: string;
  status: "good" | "warn" | "bad" | "info";
  region: string;
}

interface PdfSessionData {
  clientName: string;
  program: string;
  checkpoint: string;
  week: number;
  date: string;
  results: Array<{ key: string; vals: Record<string, number> }>;
  note: string;
}

// Human-readable movement names
const MOVE_NAMES: Record<string, string> = {
  standing: "Standing Posture",
  squat: "Squat",
  splitLeft: "Split Squat (Left Leg Back)",
  splitRight: "Split Squat (Right Leg Back)",
  balanceL: "Single-Leg Balance (Left)",
  balanceR: "Single-Leg Balance (Right)",
  hinge: "Hip Hinge",
  ankle: "Ankle Mobility",
};

// Human-readable metric names and formatting
const METRIC_META: Record<string, { name: string; unit: string; warn?: number; bad?: number; capacity?: boolean; info?: boolean; region: string }> = {
  shoulderTilt: { name: "Shoulder level", unit: "°", warn: 2, bad: 4, region: "Shoulders" },
  hipTilt: { name: "Hip level", unit: "°", warn: 2, bad: 4, region: "Hips" },
  headLean: { name: "Head lean", unit: "°", warn: 3, bad: 6, region: "Shoulders" },
  weightShift: { name: "Weight shift", unit: "%", warn: 4, bad: 8, region: "Core" },
  fwdHead: { name: "Forward head", unit: "°", warn: 8, bad: 14, region: "Shoulders" },
  shoulderRound: { name: "Rounded shoulders", unit: "°", warn: 5, bad: 10, region: "Shoulders" },
  kneeCave: { name: "Knee cave", unit: "%", warn: 0.03, bad: 0.07, region: "Knees" },
  torsoLean: { name: "Torso lean", unit: "°", warn: 10, bad: 18, region: "Core" },
  depth: { name: "Squat depth", unit: "%", capacity: true, region: "Hips", info: true },
  shinAngle: { name: "Ankle dorsiflexion", unit: "°", warn: 25, bad: 15, capacity: true, region: "Ankles" },
  sway: { name: "Balance sway", unit: "%", warn: 2, bad: 4, region: "Hips" },
  swayFatigue: { name: "Sway fatigue", unit: "%", warn: 1.5, bad: 3, region: "Hips" },
  hingeKnee: { name: "Hinge knee bend", unit: "°", warn: 40, bad: 60, region: "Hips" },
  hingeTorso: { name: "Hinge depth", unit: "°", info: true, region: "Hips" },
  fatigueCave: { name: "Knee cave fatigue", unit: "%", warn: 0.02, bad: 0.05, region: "Knees" },
};

function getLevel(meta: typeof METRIC_META[string], v: number): "good" | "warn" | "bad" | "info" {
  if (meta.info) return "info";
  const bad = meta.bad ?? 999;
  const warn = meta.warn ?? 999;
  if (meta.capacity) {
    return v <= bad ? "bad" : v <= warn ? "warn" : "good";
  }
  const mag = Math.abs(v);
  return mag >= bad ? "bad" : mag >= warn ? "warn" : "good";
}

function fmtVal(meta: typeof METRIC_META[string], v: number): string {
  const abs = Math.abs(v);
  if (meta.unit === "%") return Math.round(abs) + "%";
  if (meta.unit === "°") return abs.toFixed(1) + "°";
  return abs.toFixed(1);
}

const STATUS_LABEL: Record<string, string> = {
  good: "✓ Good",
  warn: "Watch",
  bad: "Flag",
  info: "—",
};

const STATUS_COLOR: Record<string, string> = {
  good: "#16a34a",
  warn: "#d97706",
  bad: "#dc2626",
  info: "#6b7280",
};

export function generatePdfHtml(data: PdfSessionData): string {
  const dateStr = new Date(data.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build human-friendly metric rows grouped by movement
  const moveSections: string[] = [];
  data.results.forEach((r) => {
    const moveName = MOVE_NAMES[r.key] || r.key;
    const rows: string[] = [];

    Object.entries(r.vals).forEach(([metricId, val]) => {
      const meta = METRIC_META[metricId];
      if (!meta) return; // skip unknown/internal metrics
      const level = getLevel(meta, val);
      const display = fmtVal(meta, val);
      const color = STATUS_COLOR[level];
      const label = STATUS_LABEL[level];
      rows.push(`
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">${meta.name}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;text-align:right;font-weight:600;">${display}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:right;font-weight:700;color:${color};">${label}</td>
        </tr>`);
    });

    if (rows.length === 0) return;

    moveSections.push(`
      <div style="margin-bottom:20px;">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#1e3a5f;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid #1e3a5f;">
          ${moveName}
        </div>
        <table style="width:100%;border-collapse:collapse;">
          ${rows.join("")}
        </table>
      </div>`);
  });

  // Determine overall status
  let overallStatus = "CLEAN";
  let overallColor = "#16a34a";
  data.results.forEach((r) => {
    Object.entries(r.vals).forEach(([metricId, val]) => {
      const meta = METRIC_META[metricId];
      if (!meta || meta.info) return;
      const level = getLevel(meta, val);
      if (level === "bad") { overallStatus = "FLAGS"; overallColor = "#dc2626"; }
      else if (level === "warn" && overallStatus !== "FLAGS") { overallStatus = "WATCH"; overallColor = "#d97706"; }
    });
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Chain Check — ${data.clientName} — ${data.checkpoint}</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, sans-serif; background: #ffffff; color: #111827; padding: 40px; max-width: 760px; margin: 0 auto; }
  @media print {
    body { padding: 20px; }
    .no-print { display: none; }
  }
</style>
</head>
<body>

<!-- Header -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #1e3a5f;">
  <div>
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#1e3a5f;">
      CHAIN <span style="color:#0891b2;">CHECK</span>
    </div>
    <div style="font-size:11px;color:#6b7280;margin-top:2px;text-transform:uppercase;letter-spacing:1px;">Movement Screen</div>
  </div>
  <div style="text-align:right;">
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;color:#111827;">${data.clientName}</div>
    <div style="font-size:12px;color:#6b7280;margin-top:2px;">${data.program.toUpperCase()} · ${data.checkpoint} · Week ${data.week}</div>
    <div style="font-size:12px;color:#6b7280;">${dateStr}</div>
    <div style="display:inline-block;margin-top:6px;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;padding:3px 12px;border-radius:999px;border:2px solid ${overallColor};color:${overallColor};">${overallStatus}</div>
  </div>
</div>

<!-- Coach Note -->
<div style="margin-bottom:28px;">
  <div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#d97706;margin-bottom:10px;">Coach Note</div>
  <div style="background:#f8fafc;border-left:4px solid #0891b2;padding:16px 20px;border-radius:0 8px 8px 0;font-size:13px;line-height:1.9;color:#1f2937;">
    ${data.note.replace(/<br><br>/g, "<br><br>")}
    <div style="font-family:'Barlow Condensed',sans-serif;color:#0891b2;font-weight:700;text-transform:uppercase;font-size:13px;margin-top:10px;">— Coach Nick</div>
  </div>
</div>

<!-- Scan Results -->
<div style="margin-bottom:28px;">
  <div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#d97706;margin-bottom:14px;">Movement Findings</div>
  ${moveSections.join("")}
</div>

<!-- Legend -->
<div style="display:flex;gap:20px;margin-bottom:24px;padding:12px 16px;background:#f9fafb;border-radius:8px;font-size:12px;">
  <span style="color:#16a34a;font-weight:700;">✓ Good — no watch flag</span>
  <span style="color:#d97706;font-weight:700;">Watch — monitor this pattern</span>
  <span style="color:#dc2626;font-weight:700;">Flag — review this pattern</span>
</div>

<!-- Footer -->
<div style="padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
  Chain Check by The Healthy Yinzer · This is a movement screen, not medical advice · ${dateStr}
</div>

</body>
</html>`;
}
