/**
 * Progression Logic Engine — Evidence-Based Compensation Chain Detection
 *
 * Screening ranges and chain patterns are informed by biomechanics literature.
 * Citations are embedded per pattern and surfaced in the app UI.
 *
 * Dysfunction can enter the chain at any joint — ankles, knees, hips, shoulders, wherever.
 * The framework is always: "where does YOUR chain break down?"
 * Pain rarely stays where it started. That's the concept.
 * — Nick Venuti, The Healthy Yinzer
 */

import type { ScanResult } from "@shared/types";
import { MOVES, allMetrics, metricLevel } from "./moveLibrary";

// ============================================================
// CITATION REGISTRY
// All sources used to derive thresholds and chain patterns.
// ============================================================
export interface Citation {
  id: string;
  authors: string;
  title: string;
  journal: string;
  year: number;
  doi?: string;
  pmcid?: string;
  finding: string; // one-sentence research note used in the app
}

export const CITATIONS: Citation[] = [
  {
    id: "taylor2021",
    authors: "Taylor JB, Wright ES, Waxman JP, et al.",
    title: "Ankle Dorsiflexion Affects Hip and Knee Biomechanics During Landing",
    journal: "Sports Health",
    year: 2021,
    pmcid: "PMC9112706",
    doi: "10.1177/19417381211019683",
    finding: "Every 1° less of ankle dorsiflexion is associated with a 1.2° decrease in peak knee flexion and a 1.0° decrease in hip flexion excursion during dynamic loading.",
  },
  {
    id: "rabin2016",
    authors: "Rabin A, Portnoy S, Kozol Z.",
    title: "The Association of Ankle Dorsiflexion Range of Motion With Hip and Knee Kinematics During the Lateral Step-down Test",
    journal: "Journal of Orthopaedic & Sports Physical Therapy",
    year: 2016,
    doi: "10.2519/jospt.2016.6621",
    finding: "Individuals with lower ankle dorsiflexion exhibited greater peak hip adduction and knee external rotation during a lateral step-down task.",
  },
  {
    id: "lima2018",
    authors: "Lima YL, Ferreira VMLM, de Paula Lima PO, et al.",
    title: "The association of ankle dorsiflexion and dynamic knee valgus: A systematic review and meta-analysis",
    journal: "Physical Therapy in Sport",
    year: 2018,
    doi: "10.1016/j.ptsp.2017.08.076",
    finding: "Restricted ankle dorsiflexion in weight-bearing position is significantly associated with increased dynamic knee valgus (SMD −1.25, 95% CI −2.24 to −0.25).",
  },
  {
    id: "cook2014",
    authors: "Cook G, Burton L, Hoogenboom BJ, Voight M.",
    title: "Functional Movement Screening: The Use of Fundamental Movements as an Assessment of Function — Part 1",
    journal: "International Journal of Sports Physical Therapy",
    year: 2014,
    pmcid: "PMC4060319",
    finding: "Functional movement screens can help identify asymmetries and compensatory movement patterns that may guide exercise selection.",
  },
  {
    id: "almansoof2023",
    authors: "Almansoof HS, et al.",
    title: "Role of kinetic chain in sports performance and injury risk",
    journal: "PMC",
    year: 2023,
    pmcid: "PMC10893580",
    finding: "Kinetic-chain limitations can shift demand to other regions, which is why movement screens often look beyond the painful area.",
  },
  {
    id: "donati2024",
    authors: "Donati D, Giorgi F, Farì G, et al.",
    title: "The influence of pelvic tilt and femoral torsion on hip biomechanics: implications for clinical assessment and treatment",
    journal: "Applied Sciences",
    year: 2024,
    doi: "10.3390/app14209564",
    finding: "Pelvic and hip alignment can influence lower-extremity mechanics, which makes hip control useful to review when knee tracking changes.",
  },
  {
    id: "hodel2023",
    authors: "Hodel S, Flury A, Hoch A, et al.",
    title: "The relationship between pelvic tilt, frontal, and axial leg alignment in healthy subjects",
    journal: "Journal of Orthopaedic Research",
    year: 2023,
    doi: "10.1016/j.orthres.2022.09.027",
    finding: "Lateral pelvic tilt has been associated with knee valgus and relative hip rotation, supporting a hip-to-knee screening lens.",
  },
  {
    id: "fhp2020",
    authors: "Mahmoud NF, Hassan KA, Abdelmajeed SF, et al.",
    title: "The Relationship Between Forward Head Posture and Neck Pain: A Systematic Review and Meta-Analysis",
    journal: "Current Reviews in Musculoskeletal Medicine",
    year: 2019,
    doi: "10.1007/s12178-019-09594-y",
    finding: "Forward head posture has been associated with neck symptoms in adults and may increase mechanical demand on the cervical spine.",
  },
  {
    id: "vicenzino2010",
    authors: "Vicenzino B, Branjerdporn M, Teys P, Jordan K.",
    title: "Initial changes in posterior talar glide and dorsiflexion of the ankle after mobilization with movement in individuals with recurrent ankle sprain",
    journal: "Journal of Orthopaedic & Sports Physical Therapy",
    year: 2006,
    doi: "10.2519/jospt.2006.36.7.464",
    finding: "Weight-bearing dorsiflexion measures are commonly used as a functional ankle mobility screen.",
  },
];

// ============================================================
// PROTOCOL LIBRARY — Evidence-Based Activation Protocols
// ============================================================
export interface Protocol {
  id: string;
  title: string;
  target: string;
  trigger: string;
  exercises: string[];
  cue: string;
  priority: "high" | "medium";
  citationIds: string[]; // citation IDs
}

export const PROTOCOLS: Record<string, Protocol> = {
  ankle_mobility: {
    id: "ankle_mobility",
    title: "Ankle Mobility Protocol",
    target: "ankles",
    trigger: "Restricted dorsiflexion persisting across checkpoints",
    exercises: [
      "Knee-to-wall ankle mobilization — 2×15 each side (measure distance from wall)",
      "Half-kneeling ankle rock — 3×10 each side",
      "Calf raise with full range pause at top — 3×12",
      "Banded ankle distraction stretch — 60s each side",
    ],
    cue: "When ankle motion is limited, the knee and hip may have to change strategy. We start here because improving the first available link can make the rest of the movement easier to organize.",
    priority: "high",
    citationIds: ["taylor2021", "rabin2016", "lima2018", "vicenzino2010"],
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
      "Lateral band walk — 2×10 each direction",
    ],
    cue: "Hip control can influence what the knees and back have to manage. We wake the hips up before we load the pattern.",
    priority: "high",
    citationIds: ["hodel2023", "donati2024", "cook2014"],
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
    citationIds: ["cook2014", "almansoof2023"],
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
    cue: "Desk posture is usually a trainable position and control issue. We restore useful range before loading the pattern.",
    priority: "medium",
    citationIds: ["fhp2020"],
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
    citationIds: ["cook2014", "almansoof2023"],
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
    citationIds: ["cook2014", "almansoof2023"],
  },
};

// ============================================================
// RESEARCH-INFORMED PATTERN DETECTION RULES
// These thresholds are screening ranges, not medical cutoffs.
// ============================================================

interface PatternRule {
  id: string;
  label: string;
  chainDescription: string; // plain-language chain explanation
  rationale: string; // one-line research-informed rationale
  citationIds: string[];
  detect: (results: ScanResult[]) => boolean;
  protocolId: string;
}

const PATTERN_RULES: PatternRule[] = [
  {
    id: "ankle_knee_chain",
    label: "Ankle restriction driving knee compensation",
    chainDescription: "Your ankle mobility may be asking your knees and hips to change strategy. We start here because the ankle is one of the first places load has to move through.",
    rationale: "Dorsiflexion has been associated with hip and knee mechanics during dynamic loading tasks (Taylor et al. 2021; Lima et al. 2018).",
    citationIds: ["taylor2021", "lima2018", "rabin2016"],
    detect: (results) => {
      // Screening threshold: use this as a coaching flag, not a diagnosis.
      // Combined with any knee cave detection
      const ankleRestricted = hasMetricBelow(results, ["shinAngle"], 25);
      const kneeCave = hasFlag(results, ["kneeCave", "kneeValgusL", "kneeValgusR", "cave"]);
      return ankleRestricted && kneeCave;
    },
    protocolId: "ankle_mobility",
  },
  {
    id: "ankle_restriction_isolated",
    label: "Ankle mobility watch area",
    chainDescription: "Your ankle reading suggests this is a useful place to start. If the ankle does not move well, the body may borrow motion from the knee, hip, or back.",
    rationale: "Weight-bearing dorsiflexion is commonly used as a functional ankle mobility screen and has been tied to lower-extremity movement strategy.",
    citationIds: ["vicenzino2010", "taylor2021"],
    detect: (results) => hasMetricBelow(results, ["shinAngle"], 25),
    protocolId: "ankle_mobility",
  },
  {
    id: "dead_glute_pattern",
    label: "Dead glute pattern — hip/knee compensation",
    chainDescription: "Your scan suggests the hips may not be giving the knees a steady base. This is where activation-before-load work can be useful.",
    rationale: "Pelvic and hip mechanics have been associated with knee tracking and lower-extremity movement strategy (Hodel et al. 2023; Donati et al. 2024).",
    citationIds: ["hodel2023", "donati2024", "cook2014"],
    detect: (results) => {
      // Hip tilt > 5° (Donati 2024 threshold) combined with any knee flag
      const hipAsymmetry = hasMetricAbove(results, ["hipTilt"], 5);
      const kneeFlag = hasFlag(results, ["kneeCave", "cave", "fatigueCave"]);
      return hipAsymmetry && kneeFlag;
    },
    protocolId: "glute_activation",
  },
  {
    id: "balance_deficit",
    label: "Single-leg stability watch area",
    chainDescription: "Single-leg control is worth watching because walking, stairs, and most real-life movement spend time on one leg.",
    rationale: "Single-leg balance and fatigue changes can reveal how well the body controls position under a simple load.",
    citationIds: ["cook2014", "almansoof2023"],
    detect: (results) => hasFlag(results, ["sway", "swayFatigue"]),
    protocolId: "single_leg_stability",
  },
  {
    id: "desk_body_pattern",
    label: "Forward head + rounded shoulders — desk body",
    chainDescription: "Forward head and rounded shoulders often show up together, especially for people who sit, drive, or work at screens. We treat this as a position and control pattern to rebuild.",
    rationale: "Forward head posture has been associated with neck symptoms in adults and may increase mechanical demand on the cervical spine (Mahmoud et al. 2019).",
    citationIds: ["fhp2020"],
    detect: (results) => {
      // fwdHead > 14° = screen flag threshold.
      const headFlag = hasFlag(results, ["fwdHead"]);
      const shoulderFlag = hasFlag(results, ["shoulderRound"]);
      return headFlag || shoulderFlag;
    },
    protocolId: "thoracic_mobility",
  },
  {
    id: "core_instability",
    label: "Core not stabilizing under load",
    chainDescription: "Your trunk may be shifting to help you complete the movement. We use that as a clue for bracing, balance, and load progression.",
    rationale: "Trunk lean and weight shift during functional movement can be useful screening clues for movement control (Cook et al. 2014).",
    citationIds: ["cook2014", "almansoof2023"],
    detect: (results) => hasFlag(results, ["torsoLean", "weightShift"]),
    protocolId: "core_bracing",
  },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

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

function hasMetricBelow(results: ScanResult[], metricIds: string[], threshold: number): boolean {
  for (const r of results) {
    for (const id of metricIds) {
      const v = r.vals[id];
      if (v != null && Math.abs(v) < threshold) return true;
    }
  }
  return false;
}

function hasMetricAbove(results: ScanResult[], metricIds: string[], threshold: number): boolean {
  for (const r of results) {
    for (const id of metricIds) {
      const v = r.vals[id];
      if (v != null && Math.abs(v) > threshold) return true;
    }
  }
  return false;
}

// ============================================================
// PUBLIC API
// ============================================================

export interface ProgressionFlag {
  pattern: string;
  label: string;
  chainDescription: string;
  rationale: string;
  sessionCount: number;
  protocol: Protocol;
  citations: Citation[];
}

/**
 * Detect persistent compensation chain patterns across multiple sessions.
 * Only fires after Week 4+ with 2+ sessions showing the same pattern.
 * Returns top 2 most actionable protocols with full citation data.
 */
export function detectProgressionFlags(
  sessions: Array<{ results: ScanResult[]; checkpointId: string; week: number }>
): ProgressionFlag[] {
  if (sessions.length < 2) return [];

  // Only surface protocols after Week 4+ (at least one scan at wk4 or beyond)
  const hasWeek4Plus = sessions.some(
    (s) => s.week >= 4 || ["wk4", "wk6", "wk8", "wk10", "wk12", "wk14", "wk16"].includes(s.checkpointId)
  );
  if (!hasWeek4Plus) return [];

  const flags: ProgressionFlag[] = [];
  const seen = new Set<string>();

  for (const rule of PATTERN_RULES) {
    if (seen.has(rule.protocolId)) continue;

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
        chainDescription: rule.chainDescription,
        rationale: rule.rationale,
        sessionCount: persistCount,
        protocol: PROTOCOLS[rule.protocolId],
        citations: rule.citationIds.map((id) => CITATIONS.find((c) => c.id === id)!).filter(Boolean),
      });
    }
  }

  return flags
    .sort((a, b) => (a.protocol.priority === "high" ? -1 : 1))
    .slice(0, 2);
}

/**
 * Get the single most urgent protocol for a single session (no history needed).
 * Used on the results screen immediately after a scan.
 */
export function getSingleSessionProtocol(results: ScanResult[]): (Protocol & { citations: Citation[]; rationale: string }) | null {
  for (const rule of PATTERN_RULES) {
    if (rule.detect(results)) {
      return {
        ...PROTOCOLS[rule.protocolId],
        citations: rule.citationIds.map((id) => CITATIONS.find((c) => c.id === id)!).filter(Boolean),
        rationale: rule.rationale,
      };
    }
  }
  return null;
}

/**
 * Get all citations relevant to a scan's flagged patterns.
 * Used to display the research panel on the results screen.
 */
export function getCitationsForResults(results: ScanResult[]): Citation[] {
  const citationIds = new Set<string>();
  for (const rule of PATTERN_RULES) {
    if (rule.detect(results)) {
      rule.citationIds.forEach((id) => citationIds.add(id));
    }
  }
  // Always include the foundational FMS citation
  citationIds.add("cook2014");
  return Array.from(citationIds)
    .map((id) => CITATIONS.find((c) => c.id === id)!)
    .filter(Boolean);
}
