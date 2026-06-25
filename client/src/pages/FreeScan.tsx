import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { getCitationsForResults } from "@/lib/progressionLogic";
import ResearchPanel from "@/components/ResearchPanel";

/**
 * Free Chain Check — public lead magnet
 * 3 movements: Standing, Squat, Split Squat
 * No login required. Gate after scan. Result card + Book a Call CTA.
 */

const BOOKING_URL = "https://calendly.com/thehealthyyinzer/transformation-call-with-nickv";

const EMA_ALPHA = 0.4;
const SCAN_CONSTANTS = {
  DOWN_MULTIPLIER: 0.30,
  DOWN_FLOOR: 0.016,
  UP_MULTIPLIER: 0.15,
  UP_FLOOR: 0.010,
  INITIAL_AMP: 0.10,
  SHOULDER_EMA_ALPHA: 0.45,
};

const FREE_STEPS = [
  {
    key: "standing",
    label: "Standing",
    type: "hold" as const,
    holdSec: 5,
    instruction: "<strong>Step 1 · Standing</strong>Face the camera. Feet hip-width, arms relaxed. Don't fix anything ... stand how you actually stand. Hold still for 5 seconds.",
    holdHint: "Stand tall. Hold still…",
    metrics: [
      { id: "shoulderTilt", name: "Shoulder level", unit: "°", warn: 2, bad: 4, region: "shoulders" },
      { id: "hipTilt", name: "Hip level", unit: "°", warn: 2, bad: 4, region: "hips" },
      { id: "headLean", name: "Head lean", unit: "°", warn: 3, bad: 6, region: "shoulders" },
      { id: "weightShift", name: "Weight shift", unit: "%", warn: 4, bad: 8, region: "core" },
    ],
  },
  {
    key: "squat",
    label: "Squat",
    type: "reps" as const,
    phases: [
      { view: "front" as const, reps: 5, instruction: "<strong>Step 2 · Squat · part 1 of 2</strong>Face the camera. Do 5 squats at your own pace ... however deep is comfortable. Move how you normally would.", hint: "5 squats facing me…" },
      { view: "side" as const, reps: 5, instruction: "<strong>Step 2 · Squat · part 2 of 2</strong>Turn so your SIDE faces the camera. 5 more squats the same way.", hint: "5 squats from the side…" },
    ],
    metrics: [
      { id: "kneeCave", name: "Knee cave-in", unit: "", warn: 0.04, bad: 0.08, region: "knees" },
      { id: "weightShift", name: "Weight shift", unit: "%", warn: 5, bad: 10, region: "hips" },
      { id: "torsoLean", name: "Forward lean", unit: "°", warn: 30, bad: 45, region: "core" },
      { id: "depth", name: "Squat depth", unit: "%", info: true, region: "hips" },
      { id: "fatigueCave", name: "Fatigue: knees caving more", unit: "", warn: 0.03, bad: 0.06, region: "hips" },
    ],
  },
  {
    key: "balanceL",
    label: "Balance",
    type: "hold" as const,
    holdSec: 8,
    instruction: "<strong>Step 3 · Single-Leg Balance</strong>Face the camera. Lift one foot off the ground and balance on the other leg for 8 seconds. Arms out if you need them. Then switch sides.",
    holdHint: "Hold still on one leg…",
    metrics: [
      { id: "sway", name: "Lateral sway", unit: "%", warn: 3, bad: 6, region: "hips" },
      { id: "hipDrop", name: "Hip drop", unit: "°", warn: 3, bad: 6, region: "hips" },
      { id: "swayFatigue", name: "Sway fatigue", unit: "%", warn: 1.5, bad: 3, region: "hips" },
    ],
  },
];

const REGION_COPY: Record<string, { headline: string; color: string; recs: string }> = {
  hips: {
    headline: "your hips and pelvis",
    color: "#F97316",
    recs: "<strong>What the scan noticed:</strong> your hips or pelvis looked like they may be doing extra work to keep you stable. That can show up as shifting, hip drop, or control changing as you fatigue. <strong>Why it matters:</strong> if the hips are not giving you a steady base, your back, knees, or ankles may start helping more than they should. <strong>What to try:</strong> glute bridges with a 3-second hold, slow side-lying leg raises, and single-leg balance. Start with control before adding load.",
  },
  knees: {
    headline: "your knee tracking",
    color: "#F87171",
    recs: "<strong>What the scan noticed:</strong> your knee tracking changed under load or fatigue. That does not mean your knees are damaged. It means this is a link worth looking at. <strong>Why it matters:</strong> knee tracking often reflects what is happening above at the hips or below at the ankles. <strong>What to try:</strong> lateral band walks, slow tempo squats at a comfortable depth, and ankle mobility work. If this matches pain, swelling, or giving-way, get a clinician involved.",
  },
  shoulders: {
    headline: "your shoulders and head position",
    color: "#A78BFA",
    recs: "<strong>What the scan noticed:</strong> your head or shoulder position drifted enough to flag as a watch area. <strong>Why it matters:</strong> this can reflect desk posture, breathing mechanics, upper-back stiffness, or how your body organizes tension. <strong>What to try:</strong> band pull-aparts, slow wall slides, and a quick audit of how you sit, carry bags, and hold your phone. If numbness, tingling, or sharp pain is involved, get evaluated.",
  },
  core: {
    headline: "your trunk control",
    color: "#FBBF24",
    recs: "<strong>What the scan noticed:</strong> your trunk appeared to lean or shift while you moved. <strong>Why it matters:</strong> trunk control is one of the ways your body keeps load from spilling into the back, hips, or knees. <strong>What to try:</strong> slow dead bugs with a full exhale, bird dogs, and light suitcase carries where the goal is staying tall without leaning.",
  },
  ankles: {
    headline: "your ankle mobility",
    color: "#34D399",
    recs: "<strong>What the scan noticed:</strong> your ankle motion may be limiting how the rest of the chain organizes. <strong>Why it matters:</strong> when the ankle does not move well, the body often borrows motion from the knees, hips, or low back. <strong>What to try:</strong> knee-to-wall ankle rocks, full-range calf raises, and slow squats where the goal is control, not depth.",
  },
  none: {
    headline: "no major watch area",
    color: "#34D399",
    recs: "<strong>What the scan noticed:</strong> your movement held up well across the free screen. That is a good sign. <strong>Why it matters:</strong> a camera can read visible patterns, but it cannot feel pain, history, confidence, or how your body responds under real training load. <strong>What to try:</strong> keep building gradually, and if something still feels off, that is worth a conversation.",
  },
};

type ScanPhase = "intro" | "scanning" | "gate" | "result";

interface ScanResult {
  key: string;
  type: "hold" | "reps";
  vals: Record<string, number>;
}

interface Finding {
  stepLabel: string;
  metricName: string;
  metricId: string;
  value: string;
  rawValue: number;
  unit: string;
  norm: string; // e.g. "Target < 2°"
  level: "good" | "warn" | "bad";
}

export default function FreeScan() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<any>(null);
  const runningRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const smoothRef = useRef<Record<string, number>>({});

  const [phase, setPhase] = useState<ScanPhase>("intro");
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState("Camera off");
  const [movePill, setMovePill] = useState("");
  const [holdProgress, setHoldProgress] = useState<number | null>(null);
  const [holdLabel, setHoldLabel] = useState("");
  const [instruction, setInstruction] = useState("");
  const [repFlash, setRepFlash] = useState(false);
  const [setupCountdown, setSetupCountdown] = useState<number | null>(null);

  const scanResultsRef = useRef<ScanResult[]>([]);
  const capRef = useRef<any>(null);
  const setupStartRef = useRef<number | null>(null);

  // Gate form state
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [lane, setLane] = useState<"rebuild" | "restart" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Result state
  const [resultRegion, setResultRegion] = useState<string>("none");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scanCitations, setScanCitations] = useState<ReturnType<typeof getCitationsForResults>>([]);
  const [showCitations, setShowCitations] = useState(false);

  const submitFree = trpc.freeChainCheck.submit.useMutation();

  const ema = useCallback((id: string, v: number, alpha = EMA_ALPHA) => {
    const s = smoothRef.current;
    s[id] = s[id] == null ? v : s[id] + (v - s[id]) * alpha;
    return s[id];
  }, []);

  const ding = useCallback(() => {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(660, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.08);
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
      o.start();
      o.stop(ctx.currentTime + 0.24);
    } catch (e) { /* silent */ }
  }, []);

  const compute = useCallback((lm: any[]) => {
    const g = (i: number) => lm[i];
    const L = { nose: 0, lSh: 11, rSh: 12, lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnk: 27, rAnk: 28 };
    const deg = (a: number) => a * 180 / Math.PI;
    const tilt = (p: any, q: any) => deg(Math.atan2(q.y - p.y, q.x - p.x));

    const lSh = g(L.lSh), rSh = g(L.rSh), lHip = g(L.lHip), rHip = g(L.rHip);
    const lKnee = g(L.lKnee), rKnee = g(L.rKnee), lAnk = g(L.lAnk), rAnk = g(L.rAnk), nose = g(L.nose);
    const midSh = { x: (lSh.x + rSh.x) / 2, y: (lSh.y + rSh.y) / 2 };
    const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
    const midAnk = { x: (lAnk.x + rAnk.x) / 2, y: (lAnk.y + rAnk.y) / 2 };
    const midKnee = { x: (lKnee.x + rKnee.x) / 2, y: (lKnee.y + rKnee.y) / 2 };
    const stance = Math.max(Math.abs(rAnk.x - lAnk.x), 0.05);
    const shoulderWidth = Math.abs(rSh.x - lSh.x);

    const val = (hip: any, knee: any, ank: any, side: string) => {
      const t = (knee.y - hip.y) / Math.max(ank.y - hip.y, 0.01);
      const lineX = hip.x + (ank.x - hip.x) * t;
      const d = knee.x - lineX;
      return side === "L" ? Math.max(d, 0) : Math.max(-d, 0);
    };

    return {
      shoulderTilt: ema("shoulderTilt", tilt(lSh, rSh)),
      hipTilt: ema("hipTilt", tilt(lHip, rHip)),
      headLean: ema("headLean", deg(Math.atan2(nose.x - midSh.x, Math.max(midSh.y - nose.y, 0.01)))),
      weightShift: ema("weightShift", ((midHip.x - midAnk.x) / stance) * 100),
      torsoLean: ema("torsoLean", deg(Math.atan2(Math.abs(midSh.x - midHip.x), Math.max(midHip.y - midSh.y, 0.01)))),
      cave: Math.max(val(lHip, lKnee, lAnk, "L"), val(rHip, rKnee, rAnk, "R")),
      hipY: midHip.y,
      shoulderY: ((lSh.visibility ?? 1) >= (rSh.visibility ?? 1) ? lSh.y : rSh.y),
      shoulderVis: Math.max(lSh.visibility ?? 1, rSh.visibility ?? 1),
      midHipX: midHip.x,
      shoulderWidth,
      isSideOn: shoulderWidth < 0.10,
    };
  }, [ema]);

  const drawSkel = useCallback((ctx2d: CanvasRenderingContext2D, lm: any[], W: number, H: number, capturing: boolean, flash: boolean) => {
    const CONN = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
    ctx2d.lineWidth = flash ? 9 : 5;
    ctx2d.lineCap = "round";
    ctx2d.strokeStyle = flash ? "#34D399" : capturing ? "#00B4D8" : "rgba(255,255,255,0.5)";
    if (flash) { ctx2d.shadowColor = "#34D399"; ctx2d.shadowBlur = 18; }
    CONN.forEach(([a, b]) => {
      const p = lm[a], q = lm[b];
      if ((p.visibility ?? 1) < 0.4 || (q.visibility ?? 1) < 0.4) return;
      ctx2d.beginPath();
      ctx2d.moveTo(p.x * W, p.y * H);
      ctx2d.lineTo(q.x * W, q.y * H);
      ctx2d.stroke();
    });
    ctx2d.shadowBlur = 0;
    const dotColor = flash ? "#34D399" : capturing ? "#00B4D8" : "rgba(255,255,255,0.7)";
    lm.forEach((p, i) => {
      if ((p.visibility ?? 1) < 0.4 || i < 11) return;
      ctx2d.fillStyle = dotColor;
      ctx2d.beginPath();
      ctx2d.arc(p.x * W, p.y * H, 4, 0, Math.PI * 2);
      ctx2d.fill();
    });
  }, []);

  const advanceStep = useCallback((currentIdx: number) => {
    if (currentIdx < FREE_STEPS.length - 1) {
      const nextIdx = currentIdx + 1;
      setStepIndex(nextIdx);
      smoothRef.current = {};
      const step = FREE_STEPS[nextIdx];
      if (step.type === "hold") {
        setInstruction(step.instruction);
        setMovePill(`${nextIdx + 1} / ${FREE_STEPS.length} · ${step.label}`);
        setHoldProgress(null);
        capRef.current = { mode: "hold", holdStart: null, samples: [], lastHipX: null };
      } else {
        const ph = step.phases![0];
        setInstruction(ph.instruction);
        setMovePill(`FRONT 0/${ph.reps}`);
        setHoldProgress(null);
        capRef.current = { mode: "reps", phaseIdx: 0, repState: "up", sm: null, top: null, bottom: 0, bottomSnap: null, amp: SCAN_CONSTANTS.INITIAL_AMP, downStartT: 0, front: [], side: [], startT: null };
      }
    } else {
      // All steps done — show gate
      runningRef.current = false;
      const video = videoRef.current;
      if (video?.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      }
      setPhase("gate");
    }
  }, []);

  const finishHold = useCallback((stepIdx: number) => {
    const step = FREE_STEPS[stepIdx];
    const cap = capRef.current;
    const avg: Record<string, number> = {};
    const meanArr = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    step.metrics.forEach((m) => {
      avg[m.id] = meanArr(cap.samples.map((x: any) => x[m.id] ?? 0));
    });
    scanResultsRef.current.push({ key: step.key, type: "hold", vals: avg });
    advanceStep(stepIdx);
  }, [advanceStep]);

  const finishReps = useCallback((stepIdx: number) => {
    const cap = capRef.current;
    const front = cap.front as any[];
    const side = cap.side as any[];
    const meanArr = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const caveVals = front.map((r) => r.cave);
    const shiftVals = front.map((r) => Math.abs(r.weightShift));
    const leanVals = side.map((r) => r.torso);
    const depthVals = side.map((r) => r.depth * 100);
    const nF = caveVals.length;
    const third = Math.max(1, Math.round(nF / 3));
    const fatigueCave = nF >= 2 ? meanArr(caveVals.slice(-third)) - meanArr(caveVals.slice(0, third)) : 0;
    const agg = {
      kneeCave: meanArr(caveVals),
      weightShift: meanArr(shiftVals),
      torsoLean: meanArr(leanVals),
      depth: meanArr(depthVals),
      fatigueCave,
    };
    scanResultsRef.current.push({ key: FREE_STEPS[stepIdx].key, type: "reps", vals: agg });
    advanceStep(stepIdx);
  }, [advanceStep]);

  const handleHold = useCallback((vals: any, now: number, stepIdx: number): boolean => {
    const step = FREE_STEPS[stepIdx];
    const cap = capRef.current;
    const stable = cap.lastHipX != null && Math.abs(vals.midHipX - cap.lastHipX) < 0.012;
    cap.lastHipX = vals.midHipX;
    const s = {
      shoulderTilt: ema("shoulderTilt", vals.shoulderTilt),
      hipTilt: ema("hipTilt", vals.hipTilt),
      headLean: ema("headLean", vals.headLean),
      weightShift: ema("weightShift", vals.weightShift),
    };
    const SETUP_DELAY = 3;
    if (stable) {
      // Phase 1: Setup countdown (3 seconds before capture)
      if (!setupStartRef.current) setupStartRef.current = now;
      const setupElapsed = (now - setupStartRef.current) / 1000;
      const setupRemain = Math.max(SETUP_DELAY - setupElapsed, 0);
      if (setupRemain > 0) {
        setSetupCountdown(Math.ceil(setupRemain));
        setStatus(`Get ready… ${Math.ceil(setupRemain)}`);
        setHoldProgress(null);
        return false;
      }
      // Phase 2: Actual capture
      setSetupCountdown(null);
      if (!cap.holdStart) { cap.holdStart = now; cap.samples = []; }
      cap.samples.push(s);
      const elapsed = (now - cap.holdStart) / 1000;
      const rem = Math.max(step.holdSec! - elapsed, 0);
      setHoldProgress(1 - rem / step.holdSec!);
      setHoldLabel(step.holdHint!);
      setStatus("Capturing… hold it");
      if (elapsed >= step.holdSec!) finishHold(stepIdx);
      return true;
    } else {
      cap.holdStart = null;
      setupStartRef.current = null;
      setSetupCountdown(null);
      setHoldProgress(null);
      setStatus("Hold still to start the countdown");
      return false;
    }
  }, [ema, finishHold]);

  const handleReps = useCallback((vals: any, now: number, stepIdx: number): boolean => {
    const step = FREE_STEPS[stepIdx];
    const cap = capRef.current;
    const ph = step.phases![cap.phaseIdx];
    if (cap.startT == null) cap.startT = now;
    if (vals.shoulderVis < 0.4) {
      setStatus("Get your full upper body in frame");
      return cap.repState === "down";
    }
    cap.sm = cap.sm == null ? vals.shoulderY : cap.sm + (vals.shoulderY - cap.sm) * SCAN_CONSTANTS.SHOULDER_EMA_ALPHA;
    if (cap.top == null) cap.top = cap.sm;
    else if (cap.sm < cap.top) cap.top = cap.sm;
    else if (cap.repState === "up") cap.top += (cap.sm - cap.top) * 0.03;
    const depth = cap.sm - cap.top;
    const DOWN = Math.max(cap.amp * SCAN_CONSTANTS.DOWN_MULTIPLIER, SCAN_CONSTANTS.DOWN_FLOOR);
    const UP = Math.max(cap.amp * SCAN_CONSTANTS.UP_MULTIPLIER, SCAN_CONSTANTS.UP_FLOOR);
    const snap = { torso: vals.torsoLean, cave: vals.cave, weightShift: vals.weightShift, depth };
    if (cap.repState === "up") {
      if (depth > DOWN) { cap.repState = "down"; cap.bottom = depth; cap.bottomSnap = snap; cap.downStartT = now; }
    } else {
      if (depth > cap.bottom) { cap.bottom = depth; cap.bottomSnap = snap; }
      if (depth < UP) {
        cap.repState = "up";
        cap.amp = cap.amp * 0.5 + cap.bottom * 0.5;
        if (cap.bottomSnap) cap[ph.view].push(cap.bottomSnap);
        ding();
        setRepFlash(true);
        setTimeout(() => setRepFlash(false), 400);
        const count = cap[ph.view].length;
        setMovePill(`${ph.view.toUpperCase()} ${count}/${ph.reps}`);
        if (count >= ph.reps) {
          if (cap.phaseIdx < step.phases!.length - 1) {
            cap.phaseIdx++;
            cap.repState = "up"; cap.sm = null; cap.top = null; cap.bottom = 0; cap.bottomSnap = null; cap.startT = now;
            const np = step.phases![cap.phaseIdx];
            setInstruction(np.instruction);
            setMovePill(`${np.view.toUpperCase()} 0/${np.reps}`);
          } else {
            finishReps(stepIdx);
            return false;
          }
        }
      } else if (now - cap.downStartT > 4500) {
        cap.repState = "up"; cap.top = cap.sm; cap.bottom = 0;
      }
    }
    const count = cap[ph.view].length;
    if (ph.view === "side" && !vals.isSideOn) setStatus("Turn sideways ... reps still counting");
    else if (count === 0) setStatus(ph.view === "front" ? "Face me and start squatting..." : "Sideways now — start squatting...");
    else setStatus(ph.hint || "Keep going…");
    return cap.repState === "down";
  }, [ding, finishReps]);

  const loop = useCallback((currentStepIdx: number) => {
    if (!runningRef.current) return;
    const now = performance.now();
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !landmarkerRef.current) {
      requestAnimationFrame(() => loop(currentStepIdx));
      return;
    }
    const ctx2d = canvas.getContext("2d")!;
    const res = landmarkerRef.current.detectForVideo(video, now);
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    if (res.landmarks && res.landmarks.length) {
      const lm = res.landmarks[0];
      const vals = compute(lm);
      const step = FREE_STEPS[currentStepIdx];
      let capturing = false;
      if (step.type === "hold") {
        capturing = handleHold(vals, now, currentStepIdx);
      } else {
        capturing = handleReps(vals, now, currentStepIdx);
      }
      drawSkel(ctx2d, lm, canvas.width, canvas.height, capturing, repFlash);
    } else {
      setStatus("No body detected — step back");
    }
    requestAnimationFrame(() => loop(currentStepIdx));
  }, [compute, handleHold, handleReps, drawSkel, repFlash]);

  const startScan = async () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();

      if (!landmarkerRef.current) {
        const { PoseLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
        landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 960, height: 720, facingMode: "user" }, audio: false });
      const video = videoRef.current!;
      video.srcObject = stream;
      await new Promise((r) => { video.onloadedmetadata = r; });
      const canvas = canvasRef.current!;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      scanResultsRef.current = [];
      smoothRef.current = {};
      runningRef.current = true;

      // Init first step
      const step = FREE_STEPS[0];
      setStepIndex(0);
      setInstruction(step.instruction || "");
      setMovePill(`1 / ${FREE_STEPS.length} · ${step.label}`);
      setHoldProgress(null);
      capRef.current = { mode: "hold", holdStart: null, samples: [], lastHipX: null };

      setPhase("scanning");
      requestAnimationFrame(() => loop(0));
    } catch (e) {
      setStatus("Camera error — allow access (HTTPS required)");
    }
  };

  // Re-run loop when stepIndex changes
  useEffect(() => {
    if (phase !== "scanning") return;
    const step = FREE_STEPS[stepIndex];
    if (!step) return;
    // loop is already running via requestAnimationFrame chain
  }, [stepIndex, phase]);

  // Override loop to use current stepIndex
  const loopWithStep = useCallback(() => {
    if (!runningRef.current) return;
    const now = performance.now();
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !landmarkerRef.current) {
      requestAnimationFrame(loopWithStep);
      return;
    }
    const ctx2d = canvas.getContext("2d")!;
    const res = landmarkerRef.current.detectForVideo(video, now);
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    const currentStepIdx = stepIndexRef.current;
    if (res.landmarks && res.landmarks.length) {
      const lm = res.landmarks[0];
      const vals = compute(lm);
      const step = FREE_STEPS[currentStepIdx];
      if (!step) return;
      let capturing = false;
      if (step.type === "hold") {
        capturing = handleHold(vals, now, currentStepIdx);
      } else {
        capturing = handleReps(vals, now, currentStepIdx);
      }
      const flash = repFlashRef.current;
      drawSkel(ctx2d, lm, canvas.width, canvas.height, capturing, flash);
    } else {
      setStatus("No body detected — step back");
    }
    requestAnimationFrame(loopWithStep);
  }, [compute, handleHold, handleReps, drawSkel]);

  const stepIndexRef = useRef(0);
  const repFlashRef = useRef(false);

  useEffect(() => { stepIndexRef.current = stepIndex; }, [stepIndex]);
  useEffect(() => { repFlashRef.current = repFlash; }, [repFlash]);

  const startScanFinal = async () => {
    // First switch to scanning phase so video/canvas refs mount in the DOM
    const step = FREE_STEPS[0];
    setStepIndex(0);
    stepIndexRef.current = 0;
    setInstruction(step.instruction || "");
    setMovePill(`1 / ${FREE_STEPS.length} · ${step.label}`);
    setHoldProgress(null);
    capRef.current = { mode: "hold", holdStart: null, samples: [], lastHipX: null };
    scanResultsRef.current = [];
    smoothRef.current = {};
    setStatus("Loading scanner...");
    setPhase("scanning");
    // Camera init happens in useEffect after phase change mounts the video element
  };

  // Start camera after scanning phase mounts video/canvas
  useEffect(() => {
    if (phase !== "scanning") return;
    const initCamera = async () => {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();

        if (!landmarkerRef.current) {
          const { PoseLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
          const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
          landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
          });
        }

        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 960, height: 720, facingMode: "user" }, audio: false });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await new Promise((r) => { video.onloadedmetadata = r; });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        runningRef.current = true;
        setStatus("Get into position");
        requestAnimationFrame(loopWithStep);
      } catch (e) {
        setStatus("Camera error — allow access (HTTPS required)");
      }
    };
    initCamera();
    return () => {
      runningRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleGateSubmit = async () => {
    if (!firstName.trim() || !email.trim() || !lane) return;
    setSubmitting(true);
    try {
      await submitFree.mutateAsync({
        email: email.trim(),
        firstName: firstName.trim(),
        quizResult: lane,
        scanData: scanResultsRef.current as any,
      });
    } catch (e) { /* silent — still show result */ }
    // Compute result
    const regionScores: Record<string, number> = { hips: 0, knees: 0, shoulders: 0, core: 0, ankles: 0 };
    const foundFindings: Finding[] = [];
    scanResultsRef.current.forEach((r) => {
      const step = FREE_STEPS.find((s) => s.key === r.key);
      if (!step) return;
      step.metrics.forEach((m: any) => {
        if (m.info) return;
        const v = r.vals[m.id];
        if (v == null) return;
        const mag = Math.abs(v);
        const bad = m.bad ?? 999;
        const warn = m.warn ?? 999;
        const level: "good" | "warn" | "bad" = mag >= bad ? "bad" : mag >= warn ? "warn" : "good";
        if (level !== "good") regionScores[m.region] = (regionScores[m.region] || 0) + (level === "bad" ? 2 : 1);
        const display = m.unit === "%" ? Math.round(mag) + "%" : m.unit === "°" ? mag.toFixed(1) + "°" : (mag * 100).toFixed(0);
        // Compute reference label for context
        const normLabel = (() => {
          if (m.unit === "°" && m.bad != null) {
            return m.capacity ? `Target ≥${m.warn}°` : `Target < ${m.warn}°`;
          }
          if (m.unit === "%" && m.bad != null) {
            return m.capacity ? `Target ≥${m.warn}%` : `Target < ${m.warn}%`;
          }
          return "";
        })();
        foundFindings.push({ stepLabel: step.label, metricName: m.name, metricId: m.id, value: display, rawValue: mag, unit: m.unit || "", norm: normLabel, level });
      });
    });
    const top = Object.entries(regionScores).sort((a, b) => b[1] - a[1])[0];
    const region = top && top[1] > 0 ? top[0] : "none";
    setResultRegion(region);
    setFindings(foundFindings.filter((f) => f.level !== "good").sort((a, b) => (b.level === "bad" ? 1 : 0) - (a.level === "bad" ? 1 : 0)).slice(0, 5));
    setScanCitations(getCitationsForResults(scanResultsRef.current as any[]));
    setSubmitting(false);
    setSubmitted(true);
    // Brief success flash before transitioning to result
    setTimeout(() => setPhase("result"), 1200);
  };

  const copy = REGION_COPY[resultRegion] || REGION_COPY.none;

  // ==================== RENDER ====================

  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-[#1A1F3A] text-[#F8F6F0]">
        <header className="flex items-center justify-between px-5 py-4 border-b border-[#2A3050] flex-wrap gap-2">
          <div>
            <div className="font-display text-2xl font-extrabold uppercase tracking-wide">
              THE HEALTHY <span className="text-teal">YINZER</span>
            </div>
            <div className="text-xs text-[#9aa3c0] tracking-wide mt-0.5">
              The Chain Check ... a free 3-minute movement screen
            </div>
          </div>
          <div className="font-display font-bold text-orange text-base tracking-widest">#COMPENSATIONCHAIN</div>
        </header>

        <div className="max-w-xl mx-auto px-5 py-10 text-center space-y-6">
          <h1 className="font-display text-4xl font-extrabold uppercase tracking-wide leading-tight">
            See What Your<br /><span className="text-teal">Movement Suggests</span>
          </h1>
          <p className="text-[#aab3cf] text-sm leading-relaxed max-w-md mx-auto">
            Three movements. A few minutes. The screen looks for visible patterns that may explain where your body is protecting or compensating.
            <br /><br />
            You'll need room to stand 6–8 feet back from your phone, and space to turn sideways.
          </p>
          {/* FREE vs LOCKED movement grid */}
          <div className="w-full max-w-md mx-auto">
            <p className="text-xs text-[#9aa3c0] uppercase tracking-wider font-bold mb-3">What's included in your free preview</p>
            <div className="grid grid-cols-2 gap-2 text-left">
              {/* FREE movements */}
              {["Standing", "Squat", "Single-Leg Balance"].map((name) => (
                <div key={name} className="flex items-center gap-2 bg-[#00B4D8]/10 border border-[#00B4D8]/30 rounded-lg px-3 py-2">
                  <span className="text-[#00B4D8] text-xs font-bold font-display uppercase tracking-wider">FREE</span>
                  <span className="text-[#F8F6F0] text-xs">{name}</span>
                </div>
              ))}
              {/* LOCKED movements */}
              {["Hip Hinge", "Shoulder Posture", "Ankle Mobility", "Full Chain Score"].map((name) => (
                <div key={name} className="flex items-center gap-2 bg-[#2A3050] border border-[#3a4060] rounded-lg px-3 py-2 relative overflow-hidden">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span className="text-[#6b7280] text-xs">{name}</span>
                </div>
              ))}
            </div>
          </div>
          <Button
            onClick={startScanFinal}
            className="w-full max-w-sm font-display text-xl font-extrabold uppercase tracking-widest py-4 bg-teal text-[#1A1F3A] hover:bg-teal/90"
          >
            Start My Chain Check
          </Button>
          <p className="text-xs text-[#7c85a8]">Free. No login required. Results in under 5 minutes.</p>
        </div>
      </div>
    );
  }

  if (phase === "scanning") {
    return (
      <div className="min-h-screen bg-[#1A1F3A] text-[#F8F6F0]">
        <header className="flex items-center justify-between px-5 py-3 border-b border-[#2A3050]">
          <div className="font-display text-xl font-extrabold uppercase tracking-wide">
            THE HEALTHY <span className="text-teal">YINZER</span>
          </div>
          <div className="flex gap-1.5">
            {FREE_STEPS.map((s, i) => (
              <div key={s.key} className={`px-3 py-1.5 rounded-lg font-display text-xs font-bold uppercase tracking-wider border transition-all ${
                i === stepIndex ? "bg-teal text-[#1A1F3A] border-teal" :
                i < stepIndex ? "text-good border-good/50 bg-transparent" :
                "text-[#8a93b5] bg-[#2A3050] border-transparent"
              }`}>
                {i + 1} · {s.label}
              </div>
            ))}
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          {/* Camera stage — fullscreen on mobile */}
          <div className="fixed inset-0 z-50 bg-black md:relative md:inset-auto md:rounded-xl md:overflow-hidden md:aspect-[4/3] md:border md:border-[#2A3050]">
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />

            {/* Top overlay */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 pt-3 pb-2 bg-gradient-to-b from-black/70 to-transparent">
              <div className="bg-black/60 px-3 py-1.5 rounded-full text-xs font-semibold text-white border border-white/20 max-w-[55%] truncate">
                {status}
              </div>
              <div className="bg-black/60 px-3 py-1.5 rounded-full text-sm font-bold font-display tracking-wider border border-[#E6B84A]/60 text-[#E6B84A]">
                {movePill}
              </div>
            </div>

            {/* Hold ring */}
            {/* Setup countdown ring — 3-2-1 before capture */}
            {setupCountdown !== null && holdProgress === null && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <div className="w-28 h-28 relative">
                  <svg width="112" height="112" className="-rotate-90">
                    <circle cx="56" cy="56" r="46" stroke="rgba(42,48,80,0.8)" strokeWidth="8" fill="rgba(26,31,58,.85)" />
                    <circle cx="56" cy="56" r="46" stroke="#E6B84A" strokeWidth="8" fill="none" strokeLinecap="round"
                      strokeDasharray="289.0"
                      strokeDashoffset={289.0 * (1 - (3 - setupCountdown + 1) / 3)}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-4xl font-extrabold text-[#E6B84A]">{setupCountdown}</span>
                    <span className="text-[10px] text-white/60 uppercase tracking-wider mt-0.5">get ready</span>
                  </div>
                </div>
              </div>
            )}

            {holdProgress !== null && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <div className="w-24 h-24 relative">
                  <svg width="96" height="96" className="-rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="rgba(42,48,80,0.8)" strokeWidth="8" fill="rgba(26,31,58,.7)" />
                    <circle cx="48" cy="48" r="40" stroke="#00B4D8" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray="251.3" strokeDashoffset={251.3 * (1 - holdProgress)} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-display text-3xl font-extrabold text-white">
                    {Math.ceil((1 - holdProgress) * (FREE_STEPS[stepIndex] as any).holdSec || 5)}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom overlay */}
            <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-4 pt-2 bg-gradient-to-t from-black/80 to-transparent md:hidden">
              <p className="text-xs text-white/80 text-center leading-snug line-clamp-2" dangerouslySetInnerHTML={{ __html: instruction.replace(/<strong>[^<]*<\/strong>/g, "") }} />
            </div>
          </div>

          {/* Instruction — desktop only */}
          <div className="hidden md:block bg-[#2A3050] rounded-xl p-4">
            <div className="text-sm leading-relaxed text-[#c8cee6]" dangerouslySetInnerHTML={{ __html: instruction }} />
          </div>
        </div>
      </div>
    );
  }

  if (phase === "gate") {
    return (
      <div className="min-h-screen bg-[#1A1F3A] text-[#F8F6F0]">
        <header className="flex items-center px-5 py-4 border-b border-[#2A3050]">
          <div className="font-display text-2xl font-extrabold uppercase tracking-wide">
            THE HEALTHY <span className="text-teal">YINZER</span>
          </div>
        </header>

        <div className="max-w-md mx-auto px-5 py-8">
          <div className="bg-[#2A3050] rounded-2xl p-7 space-y-5">
            <div>
              <h2 className="font-display text-3xl font-extrabold uppercase tracking-wide">
                Your scan is <span className="text-teal">done</span>.
              </h2>
              <p className="text-[#aab3cf] text-sm leading-relaxed mt-2">
                The screen watched all three movements ... including what shifted as you got tired. Tell me where to send your result and I'll show you the pattern it noticed, why it matters, and what I'd try first.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#9aa3c0] mb-1.5">First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="w-full px-4 py-3 rounded-xl border border-[#3a4060] bg-[#1A1F3A] text-[#F8F6F0] text-sm focus:outline-none focus:border-teal"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#9aa3c0] mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full px-4 py-3 rounded-xl border border-[#3a4060] bg-[#1A1F3A] text-[#F8F6F0] text-sm focus:outline-none focus:border-teal"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#9aa3c0] mb-2">Which sounds more like you?</label>
                <div className="space-y-2">
                  <div
                    onClick={() => setLane("rebuild")}
                    className={`p-4 rounded-xl border cursor-pointer transition-all text-sm ${lane === "rebuild" ? "border-teal bg-teal/8" : "border-[#3a4060] bg-[#1A1F3A] hover:border-teal/50"}`}
                  >
                    <div className="font-display text-base font-bold uppercase tracking-wide text-orange mb-1">Finished PT but still stuck</div>
                    Coming back from an injury or surgery. Discharged, but not fully confident yet.
                  </div>
                  <div
                    onClick={() => setLane("restart")}
                    className={`p-4 rounded-xl border cursor-pointer transition-all text-sm ${lane === "restart" ? "border-teal bg-teal/8" : "border-[#3a4060] bg-[#1A1F3A] hover:border-teal/50"}`}
                  >
                    <div className="font-display text-base font-bold uppercase tracking-wide text-teal mb-1">Keep restarting every few months</div>
                    Life got in the way. Starting over again and trying to make it stick this time.
                  </div>
                </div>
              </div>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-14 h-14 rounded-full bg-[#34D399]/15 border-2 border-[#34D399] flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="font-display text-lg font-bold uppercase tracking-wider text-[#34D399]">
                  Got it. Loading your result...
                </p>
              </div>
            ) : (
              <>
                <Button
                  onClick={handleGateSubmit}
                  disabled={!firstName.trim() || !email.trim() || !lane || submitting}
                  className="w-full font-display text-xl font-extrabold uppercase tracking-widest py-4 bg-orange hover:bg-orange/90 text-white"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-3">
                      <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                      Sending your data...
                    </span>
                  ) : "Show Me My Result"}
                </Button>
                <p className="text-[10px] text-[#7c85a8] leading-relaxed">
                  You'll also get my best rebuilding content by email. No spam. Unsubscribe anytime.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Result screen
  return (
    <div className="min-h-screen bg-[#1A1F3A] text-[#F8F6F0]">
      <header className="flex items-center px-5 py-4 border-b border-[#2A3050]">
        <div className="font-display text-2xl font-extrabold uppercase tracking-wide">
          THE HEALTHY <span className="text-teal">YINZER</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-8">
        <div className="bg-[#2A3050] rounded-2xl p-7 space-y-5">
          {/* Result hero */}
          <div className="text-center pb-2">
            <div className="font-display text-base font-bold uppercase tracking-widest text-[#E6B84A] mb-2">Chain Check Result</div>
            <h2 className="font-display text-4xl font-extrabold uppercase tracking-wide leading-tight">
              {resultRegion === "none" ? (
                <>
                  {firstName}, your scan shows{" "}
                  <span style={{ color: copy.color }}>{copy.headline}</span>
                </>
              ) : (
                <>
                  {firstName}, your scan suggests a watch area around{" "}
                  <span style={{ color: copy.color }}>{copy.headline}</span>
                </>
              )}
            </h2>
          </div>

          {/* Findings with comparison context */}
          {findings.length > 0 && (
            <div className="space-y-2">
              {findings.map((f, i) => (
                <div key={i} className={`bg-[#1A1F3A] rounded-xl px-4 py-3 border-l-2 ${
                  f.level === "bad" ? "border-[#F87171]" : "border-[#FBBF24]"
                }`}>
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div>
                      <div className="text-sm font-semibold">{f.metricName}</div>
                      <div className="text-xs text-[#9aa3c0]">{f.stepLabel}</div>
                    </div>
                    <span className={`font-display text-xs font-bold px-3 py-1 rounded-full tracking-wider flex-shrink-0 ${
                      f.level === "bad" ? "bg-[#F87171]/15 text-[#F87171]" : "bg-[#FBBF24]/15 text-[#FBBF24]"
                    }`}>
                      {f.level === "bad" ? "FLAG" : "WATCH"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[#9aa3c0]">Your reading:</span>
                      <span className={`text-sm font-bold ${
                        f.level === "bad" ? "text-[#F87171]" : "text-[#FBBF24]"
                      }`}>{f.value}</span>
                    </div>
                    {f.norm && (
                      <>
                        <span className="text-[#4a5178]">vs</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[#9aa3c0]">Reference:</span>
                          <span className="text-sm font-bold text-[#34D399]">{f.norm}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          <div className="bg-[#1A1F3A] border-l-[3px] border-orange rounded-r-xl p-5 text-sm leading-relaxed text-[#c8cee6]">
            <div dangerouslySetInnerHTML={{ __html: copy.recs }} />
          </div>

          {/* LOCKED: What this means for your chain */}
          <div className="rounded-xl border border-[#3a4060] bg-[#1A1F3A] overflow-hidden">
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span className="font-display text-sm font-extrabold uppercase tracking-wider text-[#F8F6F0]">
                  What this means for your chain
                </span>
              </div>
              <div className="relative">
                <div className="text-sm text-[#9aa3c0] leading-relaxed blur-[3px] select-none pointer-events-none">
                  Your results point to a specific breakdown pattern. The full Chain Check maps exactly which link broke first, what's compensating, and the order you need to rebuild in. That protocol is inside the program.
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
              </div>
            </div>
            <div className="border-t border-[#3a4060] px-5 py-4 space-y-3">
              <button
                onClick={() => window.open(BOOKING_URL, "_blank")}
                className="w-full py-3.5 rounded-xl font-display text-base font-extrabold uppercase tracking-widest bg-[#F97316] hover:bg-[#F97316]/90 text-white transition-colors"
              >
                Book a Free Discovery Call
              </button>
              <p className="text-xs text-[#9aa3c0] text-center leading-relaxed">
                Full access is included in Rebuild and Restart.{" "}
                <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#F8F6F0]">
                  Book a free 20-min call to find out which is right for you.
                </a>
              </p>
            </div>
          </div>

          <div className="bg-[#1A1F3A] rounded-xl p-4 text-xs text-[#8a93b5] leading-relaxed">
            This isn't medical advice ... and honestly, it's hard to say much for certain without a chance to talk to you and learn how your body's actually feeling. A camera reads angles. It doesn't read your history. That part takes a conversation.
          </div>

          <Button
            onClick={() => window.open(BOOKING_URL, "_blank")}
            className="w-full font-display text-xl font-extrabold uppercase tracking-widest py-4 bg-orange hover:bg-orange/90 text-white"
          >
            Book a Free 20-Minute Call With Me
          </Button>

          <div className="font-display text-base font-bold uppercase tracking-widest text-teal text-center">
            — Coach Nick
          </div>

          {/* Research Citations */}
          {scanCitations.length > 0 && (
            <div className="rounded-xl border border-[#3a4060] bg-[#1A1F3A]">
              <button
                onClick={() => setShowCitations((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#00B4D8]/10 border border-[#00B4D8]/30 flex items-center justify-center flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00B4D8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-display text-sm font-extrabold uppercase tracking-wider text-[#F8F6F0]">
                      Research Behind This Screen
                    </div>
                    <div className="text-xs text-[#9aa3c0] mt-0.5">
                      {scanCitations.length} research {scanCitations.length === 1 ? "source" : "sources"} · Evidence-informed, not a diagnosis
                    </div>
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa3c0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform duration-200 flex-shrink-0 ${showCitations ? "rotate-180" : ""}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showCitations && (
                <div className="px-5 pb-5 space-y-3 border-t border-[#3a4060] pt-4">
                  <p className="text-xs text-[#9aa3c0] leading-relaxed">
                    The screening ranges and chain-pattern logic are informed by biomechanics research. These studies help guide the conversation, but they do not diagnose an injury or replace a clinician's assessment.
                  </p>
                  {scanCitations.map((c) => (
                    <div key={c.id} className="bg-[#2A3050] rounded-xl p-4 border border-[#3a4060]">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="font-display text-xs font-bold uppercase tracking-wider text-[#00B4D8]">
                          {c.journal} · {c.year}
                        </div>
                        {(c.doi || c.pmcid) && (
                          <a href={c.pmcid ? `https://pmc.ncbi.nlm.nih.gov/articles/${c.pmcid}/` : `https://doi.org/${c.doi}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-[10px] text-[#00B4D8] hover:underline flex-shrink-0 font-semibold">
                            View →
                          </a>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-[#F8F6F0] mb-1 leading-snug">{c.title}</p>
                      <p className="text-[10px] text-[#9aa3c0] mb-2">{c.authors}</p>
                      <div className="bg-[#1A1F3A] border border-[#3a4060] rounded-lg px-3 py-2">
                        <p className="text-xs text-[#c8cee6] leading-relaxed italic">"{c.finding}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-[#7c85a8] px-5 pb-8 leading-relaxed">
        The Chain Check is a screening aid, not a diagnosis. Readings depend on camera angle, lighting, clothing, and how you felt that day. © The Healthy Yinzer
      </p>
    </div>
  );
}
