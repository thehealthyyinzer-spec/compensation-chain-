import type { MetricLevel, RegionName, ScanStatus, TrendLabel, ScanResult } from "@shared/types";
import { MOVES, allMetrics, metricLevel, fmt } from "./moveLibrary";

/**
 * Compute the worst status per body region from a session's results.
 */
export function computeRegionStatus(results: ScanResult[]): Record<string, number> {
  const status: Record<string, number> = {};
  results.forEach((r) => {
    const mv = MOVES[r.key];
    if (!mv) return;
    allMetrics(mv).forEach((m) => {
      const v = r.vals[m.id];
      if (v == null) return;
      const lv = metricLevel(m, v);
      const reg = m.region;
      const rank = { good: 0, warn: 1, bad: 2 }[lv] ?? 0;
      if (!(reg in status) || rank > status[reg]) status[reg] = rank;
    });
  });
  return status;
}

/**
 * Determine overall scan status label: CLEAN, WATCH, or FLAGS
 */
export function computeScanStatus(results: ScanResult[]): ScanStatus {
  let worst: ScanStatus = "CLEAN";
  results.forEach((r) => {
    const mv = MOVES[r.key];
    if (!mv) return;
    allMetrics(mv).forEach((m) => {
      if (m.info) return;
      const v = r.vals[m.id];
      if (v == null) return;
      const lv = metricLevel(m, v);
      if (lv === "bad") worst = "FLAGS";
      else if (lv === "warn" && worst !== "FLAGS") worst = "WATCH";
    });
  });
  return worst;
}

/**
 * Compute trend between two values for a metric.
 */
export function computeTrend(m: any, prevVal: number, currVal: number): TrendLabel {
  const better = m.capacity ? currVal > prevVal * 1.12 : Math.abs(currVal) < Math.abs(prevVal) * 0.85;
  const worse = m.capacity ? currVal < prevVal * 0.88 : Math.abs(currVal) > Math.abs(prevVal) * 1.18;
  if (better) return "clearing";
  if (worse) return "watch";
  return "steady";
}

/**
 * Generate the coach note in Nick's voice.
 */
export function generateCoachNote(
  clientName: string,
  results: ScanResult[],
  checkpoint: string,
  prevResults?: ScanResult[] | null
): string {
  const name = clientName.split(" ")[0];
  const lines: string[] = [];
  const flagged: { label: string; val: string }[] = [];
  const cleared: string[] = [];
  const regressed: { label: string; from: string; to: string }[] = [];
  const improved: { label: string; from: string; to: string; nowGood: boolean }[] = [];

  results.forEach((r) => {
    const mv = MOVES[r.key];
    if (!mv) return;
    const prevR = prevResults?.find((p) => p.key === r.key);

    allMetrics(mv).forEach((m) => {
      if (m.info) return;
      const v = r.vals[m.id];
      if (v == null) return;
      const lv = metricLevel(m, v);
      const label = `${mv.name} · ${m.name.toLowerCase()}`;

      if (prevR && prevR.vals[m.id] != null) {
        const pv = prevR.vals[m.id];
        const better = m.capacity ? v > pv * 1.12 : Math.abs(v) < Math.abs(pv) * 0.85;
        const worse = m.capacity ? v < pv * 0.88 : Math.abs(v) > Math.abs(pv) * 1.18;
        if (better && metricLevel(m, pv) !== "good") {
          improved.push({ label, from: fmt(m, pv), to: fmt(m, v), nowGood: lv === "good" });
        }
        if (worse && lv !== "good") {
          regressed.push({ label, from: fmt(m, pv), to: fmt(m, v) });
        }
        if (lv === "good" && metricLevel(m, pv) !== "good") cleared.push(label);
      }
      if (lv === "bad") flagged.push({ label, val: fmt(m, v) });
    });
  });

  // Compensation chain detection — fire the first matching pattern only
  const CHAIN_PATTERNS = [
    {
      condition: (flags: string[]) => flags.some(f => f.includes("ankle")) && flags.some(f => f.includes("knee")),
      message: "Your ankle restriction is driving compensation up the chain — your knees are picking up load they weren't designed to carry. That's where your chain breaks down. We address it here."
    },
    {
      condition: (flags: string[]) => flags.some(f => f.includes("hip")) && flags.some(f => f.includes("knee")),
      message: "Dead glutes push load down to your knees and up to your lower back. The knee isn't the problem — the hip is where the chain breaks."
    },
    {
      condition: (flags: string[]) => flags.some(f => f.includes("shoulder")) && flags.some(f => f.includes("core")),
      message: "When the core isn't bracing, the shoulders compensate to stabilize. You'll feel it as neck and upper back tension. We build from the center out."
    },
    {
      condition: (flags: string[]) => flags.some(f => f.includes("forward head")) && flags.some(f => f.includes("shoulder")),
      message: "Forward head and rounded shoulders travel together — that's desk body. One rarely resolves without the other."
    },
  ];
  const flagLabels = flagged.map(f => f.label.toLowerCase());
  const chainMatch = CHAIN_PATTERNS.find(p => p.condition(flagLabels));

  if (!prevResults || prevResults.length === 0) {
    lines.push(`${name}, baseline is locked in. This is the reading we measure everything against ... so don't judge it, just own it.`);
    if (flagged.length) {
      lines.push(`Right now the chain is breaking down at: ${flagged.slice(0, 3).map((f) => `${f.label} (${f.val})`).join(", ")}. That's not bad news. That's the map.`);
      if (chainMatch) lines.push(chainMatch.message);
      lines.push(`Remember ... pain rarely stays where it started. We work the pattern, not the symptom. Activation before load.`);
    } else {
      lines.push(`Clean baseline across the board. Good. Now we build capacity on top of it ... structure before motivation.`);
    }
    return lines.join("<br><br>");
  }

  if (improved.length) {
    const i = improved[0];
    lines.push(`${name}, ${checkpoint || "this check"} is in ... and the chain is clearing. ${cap(i.label)} went from ${i.from} to ${i.to}${i.nowGood ? " ... that link is holding now" : ""}. That's the work showing up.`);
    if (improved.length > 1) {
      lines.push(`Also moving the right direction: ${improved.slice(1, 3).map((x) => x.label).join(", ")}.`);
    }
  }
  if (regressed.length) {
    const r = regressed[0];
    lines.push(`Watch this one: ${r.label} slid from ${r.from} to ${r.to}. Not a crisis ... but the body's telling us something. Could be fatigue, could be load creeping up too fast. We'll adjust.`);
  }
  if (!improved.length && !regressed.length) {
    lines.push(`${name}, readings are holding steady from last scan. Steady isn't stalled ... consistency is what rebuilds the chain. Keep showing up.`);
  }
  if (flagged.length) {
    lines.push(`Still on the list: ${flagged.slice(0, 2).map((f) => f.label).join(" and ")}. That's where the next block focuses. Diagnose the pattern, not the goal.`);
    if (chainMatch) lines.push(chainMatch.message);
  }
  if (cleared.length) {
    lines.push(`Cleared this round: ${cleared.slice(0, 2).join(", ")}. Lock it in ... we don't give links back.`);
  }
  return lines.join("<br><br>");
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
