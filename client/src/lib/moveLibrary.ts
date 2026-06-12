/**
 * Movement library — ported directly from the prototype.
 * Contains all movement definitions, metrics, benchmarks, and helper functions.
 */

export interface Metric {
  id: string;
  name: string;
  unit: string;
  warn?: number;
  bad?: number;
  region: string;
  info?: boolean;
  capacity?: boolean;
}

export interface MovePhase {
  view: string;
  hold?: number;
  reps?: number;
  leg?: string;
  instruction: string;
  holdHint?: string;
  hint?: string;
  trigger?: (v: any) => boolean;
  triggerMsg?: string;
  metrics?: Metric[];
}

export interface Move {
  name: string;
  view: string;
  type: string;
  region: string[];
  desc: string;
  hold?: number;
  balance?: boolean;
  stanceSide?: string;
  capacity?: boolean;
  instruction?: string;
  holdHint?: string;
  trigger?: (v: any) => boolean;
  triggerMsg?: string;
  metrics?: Metric[];
  phases?: MovePhase[];
  _phaseIdx?: number;
}

export const MOVES: Record<string, Move> = {
  standing: {
    name: "Standing",
    view: "both",
    type: "hold2",
    region: ["shoulders", "hips", "core"],
    desc: "Front 5s + side 5s. Full posture read — both planes.",
    phases: [
      {
        view: "front",
        hold: 5,
        instruction: "<strong>Standing · part 1 · face the camera</strong>Face the camera. Feet hip-width, arms relaxed. Don't fix anything ... stand how you actually stand. Hold still for 5 seconds.",
        holdHint: "Stand tall. Hold still…",
        trigger: () => true,
        metrics: [
          { id: "shoulderTilt", name: "Shoulder level", unit: "°", warn: 2, bad: 4, region: "shoulders" },
          { id: "hipTilt", name: "Hip level", unit: "°", warn: 2, bad: 4, region: "hips" },
          { id: "headLean", name: "Head lean side-to-side", unit: "°", warn: 3, bad: 6, region: "shoulders" },
          { id: "weightShift", name: "Weight shift", unit: "%", warn: 4, bad: 8, region: "core" },
        ],
      },
      {
        view: "side",
        hold: 5,
        instruction: "<strong>Standing · part 2 · turn sideways</strong>Turn 90° so your side faces the camera. Same stance, eyes forward. Don't pull anything back. Reads forward head and rounded shoulders.",
        holdHint: "Side-on, eyes forward… hold it",
        trigger: (v: any) => v.isSideOn,
        triggerMsg: "Turn sideways to the camera",
        metrics: [
          { id: "fwdHead", name: "Forward head", unit: "°", warn: 8, bad: 14, region: "shoulders" },
          { id: "shoulderRound", name: "Rounded shoulders", unit: "°", warn: 5, bad: 10, region: "shoulders" },
        ],
      },
    ],
  },
  squat: {
    name: "Squat",
    view: "both",
    type: "reps",
    region: ["knees", "hips", "core", "ankles"],
    desc: "5 front + 5 side reps. Reads cave-in, lean, and fatigue.",
    phases: [
      { view: "front", reps: 5, instruction: "<strong>Squat · part 1 of 2 · face the camera</strong>Face the camera. Do 5 squats at your own pace ... you don't need to go deep. Any knee bend and hip hinge counts — as soon as you hinge, we're reading. This part reads knee cave-in and weight shift.", hint: "5 squats facing the camera…" },
      { view: "side", reps: 5, instruction: "<strong>Squat · part 2 of 2 · turn sideways</strong>Now turn so your SIDE faces the camera. Do 5 more squats the same way — you don't need to go deep, just hinge and come back up. This part reads forward lean and depth.", hint: "5 squats from the side…" },
    ],
    metrics: [
      { id: "kneeCave", name: "Knee cave-in", unit: "", warn: 0.04, bad: 0.08, region: "knees" },
      { id: "weightShift", name: "Weight shift", unit: "%", warn: 5, bad: 10, region: "hips" },
      { id: "torsoLean", name: "Forward lean", unit: "°", warn: 30, bad: 45, region: "core" },
      { id: "depth", name: "Squat depth", unit: "%", info: true, region: "hips" },
      { id: "fatigueCave", name: "Fatigue: knees caving more", unit: "", warn: 0.03, bad: 0.06, region: "hips" },
    ],
  },
  splitLeft: {
    name: "Split Squat · Left Leg Back",
    view: "both",
    type: "reps",
    region: ["knees", "hips", "core"],
    desc: "Left leg back, right leg front. 5 front + 5 side.",
    phases: [
      { view: "front", reps: 5, instruction: "<strong>Split Squat · LEFT leg back · part 1 · face camera</strong>Face the camera. Step your LEFT foot back, right foot forward. Do 5 reps — you don't need to go deep, just sink and come back up. As soon as you sink, we're reading. Reads front knee drift.", hint: "5 facing the camera…" },
      { view: "side", reps: 5, instruction: "<strong>Split Squat · LEFT leg back · part 2 · turn sideways</strong>Turn sideways, keep your LEFT leg back. Do 5 more — same thing, any depth counts. Reads your lean, how far the front knee travels, and whether the back leg actually sinks.", hint: "5 from the side…" },
    ],
    metrics: [
      { id: "kneeCave", name: "Front knee drift", unit: "", warn: 0.04, bad: 0.08, region: "knees" },
      { id: "torsoLean", name: "Forward lean", unit: "°", warn: 30, bad: 45, region: "core" },
      { id: "kneeTravel", name: "Front knee travel", unit: "°", warn: 38, bad: 50, region: "knees" },
      { id: "sink", name: "Sink depth (back leg)", unit: "%", warn: 7, bad: 5, capacity: true, region: "hips" },
      { id: "dominance", name: "Front-knee dominance", unit: "x", warn: 4, bad: 6, region: "hips" },
    ],
  },
  splitRight: {
    name: "Split Squat · Right Leg Back",
    view: "both",
    type: "reps",
    region: ["knees", "hips", "core"],
    desc: "Right leg back, left leg front. 5 front + 5 side.",
    phases: [
      { view: "front", reps: 5, instruction: "<strong>Split Squat · RIGHT leg back · part 1 · face camera</strong>Face the camera. Step your RIGHT foot back, left foot forward. Do 5 reps — you don't need to go deep, just sink and come back up. As soon as you sink, we're reading. Reads front knee drift.", hint: "5 facing the camera…" },
      { view: "side", reps: 5, instruction: "<strong>Split Squat · RIGHT leg back · part 2 · turn sideways</strong>Turn sideways, keep your RIGHT leg back. Do 5 more — same thing, any depth counts. Reads your lean, front knee travel, and whether the back leg actually sinks.", hint: "5 from the side…" },
    ],
    metrics: [
      { id: "kneeCave", name: "Front knee drift", unit: "", warn: 0.04, bad: 0.08, region: "knees" },
      { id: "torsoLean", name: "Forward lean", unit: "°", warn: 30, bad: 45, region: "core" },
      { id: "kneeTravel", name: "Front knee travel", unit: "°", warn: 38, bad: 50, region: "knees" },
      { id: "sink", name: "Sink depth (back leg)", unit: "%", warn: 7, bad: 5, capacity: true, region: "hips" },
      { id: "dominance", name: "Front-knee dominance", unit: "x", warn: 4, bad: 6, region: "hips" },
    ],
  },
  balanceL: {
    name: "Balance · Left Leg",
    view: "front",
    type: "hold",
    hold: 8,
    region: ["hips"],
    balance: true,
    stanceSide: "L",
    desc: "Stand on your LEFT leg. The dead butt detector.",
    instruction: "<strong>Single-Leg Balance · Left</strong>Face the camera. Lift your RIGHT foot and stand on your left leg. Hands on hips or out for balance. The scanner reads hip drop and sway for 8 seconds ... wobbling is fine, that's the data.",
    holdHint: "Stay on that left leg…",
    trigger: (v: any) => v.raisedSide === "R",
    triggerMsg: "Lift your right foot — stand on the left leg",
    metrics: [
      { id: "hipTilt", name: "Hip drop (stance side)", unit: "°", warn: 3, bad: 6, region: "hips" },
      { id: "sway", name: "Sway", unit: "%", warn: 2, bad: 4, region: "hips" },
      { id: "torsoLean", name: "Torso lean", unit: "°", warn: 5, bad: 10, region: "core" },
    ],
  },
  balanceR: {
    name: "Balance · Right Leg",
    view: "front",
    type: "hold",
    hold: 8,
    region: ["hips"],
    balance: true,
    stanceSide: "R",
    desc: "Stand on your RIGHT leg. Compare sides.",
    instruction: "<strong>Single-Leg Balance · Right</strong>Face the camera. Lift your LEFT foot and stand on your right leg. 8 seconds. Wobbling is fine ... that's the data.",
    holdHint: "Stay on that right leg…",
    trigger: (v: any) => v.raisedSide === "L",
    triggerMsg: "Lift your left foot — stand on the right leg",
    metrics: [
      { id: "hipTilt", name: "Hip drop (stance side)", unit: "°", warn: 3, bad: 6, region: "hips" },
      { id: "sway", name: "Sway", unit: "%", warn: 2, bad: 4, region: "hips" },
      { id: "torsoLean", name: "Torso lean", unit: "°", warn: 5, bad: 10, region: "core" },
    ],
  },
  hinge: {
    name: "Hip Hinge",
    view: "side",
    type: "hold",
    hold: 5,
    region: ["hips", "core"],
    desc: "Turn sideways. Can you hinge without squatting it?",
    instruction: "<strong>Hip Hinge · Side View</strong>Stay sideways. Push your hips BACK and let your chest tip forward ... like closing a car door with your butt. Soft knees, not a squat. Hold the bottom of your hinge.",
    holdHint: "Hold the bottom of your hinge…",
    trigger: (v: any) => v.isSideOn && v.hingeTorso > 30,
    triggerMsg: "Sideways to camera — hips back, chest forward, and hold",
    metrics: [
      { id: "hingeTorso", name: "Hinge depth", unit: "°", warn: -1, bad: -1, info: true, region: "hips" },
      { id: "hingeKnee", name: "Knee bend (lower is cleaner)", unit: "°", warn: 40, bad: 60, region: "hips" },
    ],
  },
  ankle: {
    name: "Ankle Mobility",
    view: "both",
    type: "hold2",
    region: ["ankles"],
    capacity: true,
    desc: "Left ankle 5s + right ankle 5s. Wall optional — feet train-tracked.",
    phases: [
      {
        view: "side",
        hold: 6,
        leg: "Left",
        instruction: "<strong>Ankle · LEFT foot · turn sideways</strong>Turn sideways, LEFT foot forward. Feet train-tracked (parallel, hip-width). Wall optional — drive your front knee forward over your toes WITHOUT the heel lifting. Hold at your end range. 6 seconds.",
        holdHint: "Knee forward, heel down… hold it",
        trigger: (v: any) => v.isSideOn && v.shinAngle > 5,
        triggerMsg: "Sideways — drive that knee forward until the heel wants to lift, then hold",
        metrics: [
          { id: "shinAngle", name: "Dorsiflexion — left", unit: "°", warn: 25, bad: 15, capacity: true, region: "ankles" },
        ],
      },
      {
        view: "side",
        hold: 6,
        leg: "Right",
        instruction: "<strong>Ankle · RIGHT foot · turn sideways</strong>Now switch — RIGHT foot forward. Same train-tracked stance. Drive the knee forward, heel stays down. Hold your end range. 6 seconds.",
        holdHint: "Knee forward, heel down… hold it",
        trigger: (v: any) => v.isSideOn && v.shinAngle > 5,
        triggerMsg: "Sideways — RIGHT foot forward, drive the knee and hold",
        metrics: [
          { id: "shinAngle", name: "Dorsiflexion — right", unit: "°", warn: 25, bad: 15, capacity: true, region: "ankles" },
        ],
      },
    ],
  },
};

export const FULL_BATTERY = ["standing", "squat", "splitLeft", "splitRight", "balanceL", "balanceR", "hinge", "ankle"];

/**
 * Get all metrics for a move (handles hold2 multi-phase moves).
 */
export function allMetrics(mv: Move): Metric[] {
  if (mv.type === "hold2" && mv.phases) {
    return mv.phases.flatMap((p) => p.metrics || []);
  }
  return mv.metrics || [];
}

/**
 * Determine metric level: good, warn, or bad.
 */
export function metricLevel(m: Metric, v: number): "good" | "warn" | "bad" {
  if (m.info) return "good";
  const bad = m.bad ?? 999;
  const warn = m.warn ?? 999;
  if (m.capacity) {
    return v <= bad ? "bad" : v <= warn ? "warn" : "good";
  }
  const mag = Math.abs(v);
  return mag >= bad ? "bad" : mag >= warn ? "warn" : "good";
}

/**
 * Format a metric value for display.
 */
export function fmt(m: Metric, v: number): string {
  if (m.unit === "x") return Math.abs(v).toFixed(1) + "x";
  if (m.info) return m.unit === "%" ? Math.round(v) + "%" : Math.round(Math.abs(v)) + "°";
  if (m.unit === "%") return Math.round(Math.abs(v)) + "%";
  if (m.unit === "°") return Math.abs(v).toFixed(1) + "°";
  return (Math.abs(v) * 100).toFixed(0);
}

/**
 * Benchmarks with age-bracket data (peer-reviewed sources).
 */
export const BENCHMARKS: Record<string, any> = {
  shinAngle: {
    20: { good: 42, warn: 30, label: "Norm ≥40°" },
    30: { good: 40, warn: 28, label: "Norm ≥38°" },
    40: { good: 38, warn: 26, label: "Norm ≥36°" },
    50: { good: 36, warn: 24, label: "Norm ≥34°" },
    60: { good: 32, warn: 20, label: "Norm ≥30°" },
    source: "McBride et al. 2026 · Vicenzino et al. 2010",
    capacity: true, unit: "°", max: 60,
  },
  shoulderTilt: {
    20: { good: 2, warn: 4, label: "Ideal <2°" }, 30: { good: 2, warn: 4, label: "Ideal <2°" },
    40: { good: 2, warn: 4, label: "Ideal <2°" }, 50: { good: 2, warn: 5, label: "Ideal <2°" },
    60: { good: 3, warn: 6, label: "Ideal <3°" },
    source: 'Kendall et al. "Muscles: Testing and Function" 5th ed.',
    capacity: false, unit: "°", max: 15,
  },
  hipTilt: {
    20: { good: 2, warn: 4, label: "Ideal <2°" }, 30: { good: 2, warn: 4, label: "Ideal <2°" },
    40: { good: 2, warn: 4, label: "Ideal <2°" }, 50: { good: 2, warn: 5, label: "Ideal <2°" },
    60: { good: 3, warn: 6, label: "Ideal <3°" },
    source: 'Kendall et al. "Muscles: Testing and Function" 5th ed.',
    capacity: false, unit: "°", max: 15,
  },
  headLean: {
    20: { good: 3, warn: 6, label: "Ideal <3°" }, 30: { good: 3, warn: 6, label: "Ideal <3°" },
    40: { good: 3, warn: 7, label: "Ideal <3°" }, 50: { good: 4, warn: 8, label: "Ideal <4°" },
    60: { good: 5, warn: 10, label: "Ideal <5°" },
    source: 'Kendall et al. "Muscles: Testing and Function" 5th ed.',
    capacity: false, unit: "°", max: 20,
  },
  fwdHead: {
    20: { good: 8, warn: 14, label: "Ideal <8°" }, 30: { good: 8, warn: 14, label: "Ideal <8°" },
    40: { good: 9, warn: 15, label: "Ideal <9°" }, 50: { good: 10, warn: 18, label: "Ideal <10°" },
    60: { good: 12, warn: 20, label: "Ideal <12°" },
    source: 'Kendall et al. "Muscles: Testing and Function" 5th ed.',
    capacity: false, unit: "°", max: 35,
  },
  shoulderRound: {
    20: { good: 5, warn: 10, label: "Ideal <5°" }, 30: { good: 5, warn: 10, label: "Ideal <5°" },
    40: { good: 6, warn: 12, label: "Ideal <6°" }, 50: { good: 7, warn: 14, label: "Ideal <7°" },
    60: { good: 8, warn: 16, label: "Ideal <8°" },
    source: 'Kendall et al. "Muscles: Testing and Function" 5th ed.',
    capacity: false, unit: "°", max: 35,
  },
  torsoLean: {
    20: { good: 30, warn: 45, label: "Acceptable <30°" }, 30: { good: 30, warn: 45, label: "Acceptable <30°" },
    40: { good: 32, warn: 47, label: "Acceptable <32°" }, 50: { good: 35, warn: 50, label: "Acceptable <35°" },
    60: { good: 38, warn: 55, label: "Acceptable <38°" },
    source: "Schoenfeld 2010, J Strength Cond Res",
    capacity: false, unit: "°", max: 90,
  },
  weightShift: {
    20: { good: 4, warn: 8, label: "Ideal <4%" }, 30: { good: 4, warn: 8, label: "Ideal <4%" },
    40: { good: 4, warn: 8, label: "Ideal <4%" }, 50: { good: 5, warn: 10, label: "Ideal <5%" },
    60: { good: 5, warn: 10, label: "Ideal <5%" },
    source: "ACSM Guidelines for Exercise Testing 10th ed.",
    capacity: false, unit: "%", max: 25,
  },
};

export const REGION_LABELS: Record<string, string> = {
  shoulders: "Shoulders & Head",
  hips: "Hips & Pelvis",
  knees: "Knees",
  core: "Core & Torso",
  ankles: "Ankles",
};

export const REGION_ORDER = ["shoulders", "core", "hips", "knees", "ankles"];

export const BODY_REGIONS: Record<string, { path: string; cx: number; cy: number }> = {
  shoulders: { path: "M70,45 Q100,35 130,45 L138,90 Q100,100 62,90 Z", cx: 100, cy: 67 },
  core: { path: "M62,90 Q100,100 138,90 L135,155 Q100,162 65,155 Z", cx: 100, cy: 125 },
  hips: { path: "M65,155 Q100,162 135,155 L130,210 Q100,218 70,210 Z", cx: 100, cy: 183 },
  knees: { path: "M70,210 Q85,218 100,218 Q115,218 130,210 L128,270 Q100,276 72,270 Z", cx: 100, cy: 243 },
  ankles: { path: "M72,270 Q100,276 128,270 L126,318 Q100,324 74,318 Z", cx: 100, cy: 294 },
};

/**
 * Scan engine constants — updated thresholds for shallow squat detection.
 * DOWN threshold: amp * 0.30 (floor 0.016) — triggers earlier in descent.
 * Initial amplitude guess: 0.08 (was 0.10) — calibrates to shallow movers.
 * These values are used by the scan engine when it's ported to the React component.
 */
export const SCAN_CONSTANTS = {
  REP_TARGET: 10,
  DYN_TIMEOUT: 22,
  STABILITY: 0.012,
  BAL_STABILITY: 0.05,
  // Updated thresholds (from prototype fix)
  DOWN_MULTIPLIER: 0.30,   // was 0.45
  DOWN_FLOOR: 0.016,       // was 0.028
  UP_MULTIPLIER: 0.20,
  UP_FLOOR: 0.012,
  INITIAL_AMP: 0.08,       // was 0.10
  EMA_ALPHA: 0.3,
  SHOULDER_EMA_ALPHA: 0.45,
};
