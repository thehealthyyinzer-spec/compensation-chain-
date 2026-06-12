/**
 * PDF generation for scan session summaries.
 * Uses a simple HTML-to-text approach since we can't use native PDF libraries in the deploy runtime.
 * Generates a styled HTML document that can be printed to PDF from the browser.
 */

import { CHECKPOINTS } from "../shared/types";

interface PdfSessionData {
  clientName: string;
  program: string;
  checkpoint: string;
  week: number;
  date: string;
  results: Array<{ key: string; vals: Record<string, number> }>;
  note: string;
}

/**
 * Generate an HTML string suitable for printing as a PDF summary.
 */
export function generatePdfHtml(data: PdfSessionData): string {
  const dateStr = new Date(data.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Chain Check — ${data.clientName} — ${data.checkpoint}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, sans-serif; background: #1A1F3A; color: #F8F6F0; padding: 40px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2A3050; }
  .brand { font-family: 'Barlow Condensed', sans-serif; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
  .brand span { color: #00B4D8; }
  .meta { text-align: right; font-size: 12px; color: #9aa3c0; }
  .meta .name { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 700; color: #F8F6F0; }
  .badge { display: inline-block; font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; padding: 3px 10px; border-radius: 999px; border: 1px solid #F97316; color: #F97316; }
  h2 { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #E6B84A; margin: 24px 0 12px; }
  .note { background: #1A1F3A; border-left: 3px solid #00B4D8; padding: 16px; margin: 16px 0; font-size: 13px; line-height: 1.8; color: #c8cee6; border-radius: 0 8px 8px 0; }
  .sig { font-family: 'Barlow Condensed', sans-serif; color: #00B4D8; text-transform: uppercase; font-weight: 700; margin-top: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9aa3c0; border-bottom: 1px solid #2A3050; }
  td { padding: 8px; font-size: 13px; border-bottom: 1px dashed #2c3358; }
  .good { color: #34D399; }
  .warn { color: #FBBF24; }
  .bad { color: #F87171; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #2A3050; font-size: 11px; color: #7c85a8; text-align: center; }
  @media print { body { background: white; color: #1A1F3A; } .note { background: #f5f5f5; } }
</style>
</head>
<body>
<div class="header">
  <div class="brand">CHAIN <span>CHECK</span></div>
  <div class="meta">
    <div class="name">${data.clientName}</div>
    <span class="badge">${data.program}</span>
    <div style="margin-top:4px">${data.checkpoint} · Week ${data.week} · ${dateStr}</div>
  </div>
</div>

<h2>Coach Note</h2>
<div class="note">
  ${data.note.replace(/<br><br>/g, "<br><br>")}
  <div class="sig">— Coach Nick</div>
</div>

<h2>Scan Results</h2>
<table>
  <tr><th>Movement</th><th>Metric</th><th>Reading</th></tr>
  ${data.results.map(r => {
    return Object.entries(r.vals).map(([metricId, val]) => {
      const absVal = Math.abs(val as number);
      return `<tr><td>${r.key}</td><td>${metricId}</td><td>${absVal.toFixed(1)}</td></tr>`;
    }).join("");
  }).join("")}
</table>

<div class="footer">
  <p>Chain Check by The Healthy Yinzer · Not medical advice · Generated ${dateStr}</p>
</div>
</body>
</html>`;
}
