/**
 * Progression Logic Engine
 *
 * After Week 4+ checkpoints, detects persistent compensation patterns
 * across multiple sessions and surfaces specific activation protocols
 * Nick can assign directly from the coach dashboard.
 *
 * Compensation Chain always starts at the ankles. Always.
 */

import type { ScanResult } from "@shared/types";
import { MOVES, allMetrics, metricLevel } from "./moveLibrary";

export interface Protocol {
  id: string;
  title: string;
  target: string; // body region
  trigger: string; // what pattern triggered this
  exercises: string[]; // specific exercises to assign
  cue: string; // one-line coaching cue in Nick's voice
  priority: "high" | "medium";
}

export interface ProgressionFlag {
  pattern: string; // e.g. "ankle_knee_chain"
  label: string; // human label
  sessionCount: number; // how many sessions this has persisted
  protocol: Protocol;
}

// Activation protocol library — Nick's actual methodology
const PROTOCOLS: Record<string, Protocol> = {
  ankle_mobility: {
    id: "ankle_mobility",
    title: "Ankle Mobility Protocol",
    target: "ankles",
    trigger: "Restricted dorsiflexion persisting across checkpoints",
    exercises: [
      "Banded ankle mobilization — 2×15 each side",
      "Half-kneeling ankle rock — 3×10 each side",
      "Calf raise with pause at top — 3×12",
      "Wall ankle stretch — 60s each side",
    ],
    cue: "The ankle is the foundation. Until it moves, the knee and hip are compensating on every rep.",
    priority: "high",
  },
  glute_activation: {
    id: "glute_activation",
    title: "Glute Activation Protocol",
    target: "hips",
    trigger: "Hip asymmetry or knee cave persisting — dead glute pattern",
    exercises: [
      "Glute bridge with 2s pause at top — 3×12",
      "Clamshell — 2×15 each side",
      "Single-leg glute bridge — 3×8 each side",
      "Band walk lateral — 2×10 each direction",
    ],
    cue: "Dead glutes push load to the knees and lower back. We wake them up before we load them.",
    priority: "high",
  },
  hip_hinge_pattern: {
    id: "hip_hinge_pattern",
    title: "Hip Hinge Re-patterning",
    target: "hips",
    trigger: "Squat pattern compensating — hinging instead of loading",
    exercises: [
      "Romanian deadlift with dowel on spine — 3×10",
      "Good morning — 3×12 bodyweight",
      "Hip hinge wall drill — 2×10",
      "Single-leg RDL bodyweight — 3×8 each side",
    ],
    cue: "Hip hinge and squat are two different patterns. Most people hinge when they think they're squatting. We separate them first.",
    priority: "medium",
  },
  thoracic_mobility: {
    id: "thoracic_mobility",
    title: "Thoracic Mobility Protocol",
    target: "shoulders",
    trigger: "Forward head and rounded shoulders persisting",
    exercises: [
      "Thoracic extension over foam roller — 2×60s",
      "Wall angel — 3×10",
      "Cat-cow with chin tuck — 2×10",
      "Doorway chest stretch — 60s each arm angle",
    ],
    cue: "Desk body is a position problem, not a structural one. We restore the range before we load the pattern.",
    priority: "medium",
  },
  core_bracing: {
    id: "core_bracing",
    title: "Core Bracing Protocol",
    target: "core",
    trigger: "Torso lean or weight shift persisting — core not stabilizing",
    exercises: [
      "Dead bug — 3×8 each side",
      "Pallof press — 3×10 each side",
      "Plank with shoulder tap — 3×8 each side",
      "Bird dog — 3×8 each side",
    ],
    cue: "The core is a stabilizer, not a mover. We train it to hold position under load, not to crunch.",
    priority: "medium",
  },
  single_leg_stability: {
    id: "single_leg_stability",
    title: "Single-Leg Stability Protocol",
    target: "hips",
    trigger: "Balance sway or hip drop persisting on single-leg holds",
    exercises: [
      "Single-leg stance with eyes closed — 3×20s each side",
      "Single-leg deadlift to box — 3×8 each side",
      "Step-up with pause — 3×10 each side",
      "Lateral step-down — 3×8 each side",
    ],
    cue: "Everything in life happens on one leg. If you can't stabilize it, you can't load it.",
    priority: "high",
  },
};

// Pattern detection rules — map persistent metric flags to protocols
const PATTERN_RULES: Array<{
  id: string;
  label: string;
  detect: (results: ScanResult[]) => boolean;
  protocolId: string;
}> = [
  {
    id: "ankle_knee_chain",
    label: "Ankle restriction driving knee compensation",
    detect: (results) => {
      const ankleFlag = hasFlag(results, ["shinAngle"]);
      const kneeFlag = hasFlag(results, ["kneeCave", "kneeValgusL", "kneeValgusR", "cave"]);
      return ankleFlag && kneeFlag;
    },
    protocolId: "ankle_mobility",
  },
  {
    id: "dead_glute_pattern",
    label: "Dead glute pattern — hip/knee compensation",
    detect: (results) => {
      const hipFlag = hasFlag(results, ["hipTilt", "weightShift"]);
      const kneeFlag = hasFlag(results, ["kneeCave", "cave", "fatigueCave"]);
      return hipFlag && kneeFlag;
    },
    protocolId: "glute_activation",
  },
  {
    id: "balance_deficit",
    label: "Single-leg stability deficit persisting",
    detect: (results) => {
      return hasFlag(results, ["sway", "swayFatigue", "torsoLean"]);
    },
    protocolId: "single_leg_stability",
  },
  {
    id: "desk_body_pattern",
    label: "Forward head + rounded shoulders — desk body",
    detect: (results) => {
      const headFlag = hasFlag(results, ["fwdHead"]);
      const shoulderFlag = hasFlag(results, ["shoulderRound", "shoulderTilt"]);
      return headFlag || shoulderFlag;
    },
    protocolId: "thoracic_mobility",
  },
  {
    id: "core_instability",
    label: "Core not stabilizing under load",
    detect: (results) => {
      return hasFlag(results, ["torsoLean", "weightShift"]);
    },
    protocolId: "core_bracing",
  },
  {
    id: "ankle_restriction_isolated",
    label: "Ankle dorsiflexion restricted",
    detect: (results) => {
      return hasFlag(results, ["shinAngle"]);
    },
    protocolId: "ankle_mobility",
  },
];

function hasFlag(results: ScanResult[], metricIds: string[]): boolean {
  for (const r of results) {
    const mv = MOVES[r.key];
    if (!mv) continue;
    for (const m of allMetrics(mv)) {
      if (!metricIds.includes(m.id)) continue;
      const v = r.vals[m.id];
      if (v == null) continue;
      if (metricLevel(m, v) === "bad") return true;
    }
  }
  return false;
}

/**
 * Analyze multiple sessions to detect persistent patterns.
 * Only fires after the client has 2+ sessions (Week 4+ context).
 * Returns the top 2 most actionable protocols.
 */
export function detectProgressionFlags(
  sessions: Array<{ results: ScanResult[]; checkpointId: string; week: number }>
): ProgressionFlag[] {
  if (sessions.length < 2) return []; // Need at least 2 scans to detect persistence
  // Only surface protocols if client has reached Week 4+ (at least one scan at wk4 or beyond)
  const hasWeek4Plus = sessions.some((s) => s.week >= 4 || ["wk4","wk6","wk8","wk10","wk12","wk14","wk16"].includes(s.checkpointId));
  if (!hasWeek4Plus) return [];

  const flags: ProgressionFlag[] = [];
  const seen = new Set<string>();

  for (const rule of PATTERN_RULES) {
    if (seen.has(rule.protocolId)) continue; // Only one protocol per type

    // Count how many sessions this pattern appears in
    let persistCount = 0;
    for (const session of sessions) {
      if (rule.detect(session.results as ScanResult[])) {
        persistCount++;
      }
    }

    if (persistCount >= 2) {
      seen.add(rule.protocolId);
      flags.push({
        pattern: rule.id,
        label: rule.label,
        sessionCount: persistCount,
        protocol: PROTOCOLS[rule.protocolId],
      });
    }
  }

  // Sort by priority (high first) and return top 2
  return flags
    .sort((a, b) => (a.protocol.priority === "high" ? -1 : 1))
    .slice(0, 2);
}

/**
 * Get a single most urgent protocol for a single session (no history needed).
 * Used on the results screen.
 */
export function getSingleSessionProtocol(results: ScanResult[]): Protocol | null {
  for (const rule of PATTERN_RULES) {
    if (rule.detect(results)) {
      return PROTOCOLS[rule.protocolId];
    }
  }
  return null;
}

export { PROTOCOLS };
