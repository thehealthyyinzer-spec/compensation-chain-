import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

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
    key: "splitsquat",
    label: "Split Squat",
    type: "reps" as const,
    phases: [
      { view: "front" as const, reps: 5, instruction: "<strong>Step 3 · Split Squat · part 1 of 2</strong>Face the camera. Step one foot forward into a split stance. 5 reps ... drop down and back up. Move how you naturally move.", hint: "5 facing me…" },
      { view: "side" as const, reps: 5, instruction: "<strong>Step 3 · Split Squat · part 2 of 2</strong>Turn sideways, same split stance. 5 more reps.", hint: "5 from the side…" },
    ],
    metrics: [
      { id: "kneeCave", name: "Front knee drift", unit: "", warn: 0.04, bad: 0.08, region: "knees" },
      { id: "weightShift", name: "Weight shift", unit: "%", warn: 5, bad: 10, region: "hips" },
      { id: "torsoLean", name: "Forward lean", unit: "°", warn: 30, bad: 45, region: "core" },
      { id: "depth", name: "Depth reached", unit: "%", info: true, region: "hips" },
      { id: "fatigueCave", name: "Fatigue: form drift", unit: "", warn: 0.03, bad: 0.06, region: "hips" },
    ],
  },
];

const REGION_COPY: Record<string, { headline: string; color: string; recs: string }> = {
  hips: {
    headline: "the hips",
    color: "#F97316",
    recs: "Your hips are where I'd start. When you lean further forward or lose depth as the set goes on, it usually means the glutes are fading and the rest of the body is picking up the slack ... what I call dead butt syndrome. <strong>What I'd recommend:</strong> wake those glutes up before any real load. Glute bridges with a 3-second hold at the top. Side-lying leg raises, slow. Single-leg balance, 30 seconds a side, daily. Activation before load ... always.",
  },
  knees: {
    headline: "the knees",
    color: "#F87171",
    recs: "Your knees are doing more than their share ... a lot of forward knee travel and form that slips under fatigue. The knee is almost never the real problem though. It's the victim. The breakdown usually starts at the hip above it or the ankle below it. <strong>What I'd recommend:</strong> lateral band walks to wake up the glute med, slow tempo squats at half your normal depth, and check that ankle mobility ... tight ankles force the knees to take over.",
  },
  shoulders: {
    headline: "the shoulders",
    color: "#A78BFA",
    recs: "One shoulder sits lower, or your head drifts off center ... usually a sign the upper back is compensating for something further down the chain. <strong>What I'd recommend:</strong> band pull-aparts daily, 2 sets of 15. Wall slides, slow. And notice which side you carry bags, lean at your desk, or hold your phone. The pattern shows up in the scan because it shows up in your day.",
  },
  core: {
    headline: "the core",
    color: "#FBBF24",
    recs: "Your trunk is leaning or drifting to compensate ... and it gets worse as you fatigue, which means the core isn't bracing the way it should under load. <strong>What I'd recommend:</strong> dead bugs, slow and controlled, exhaling hard every rep. Suitcase carries ... a weight in ONE hand, walking tall without leaning. The core's job is to resist movement, not create it.",
  },
  ankles: {
    headline: "the ankles",
    color: "#34D399",
    recs: "Your ankles look stiff ... limited travel forces the knees and hips to compensate higher up the chain. <strong>What I'd recommend:</strong> knee-to-wall ankle stretches daily, calf raises through a full range, and slow tempo squats focusing on keeping the heels down. Free up the ankle and watch the knees stop taking the hit.",
  },
  none: {
    headline: "... nowhere major",
    color: "#34D399",
    recs: "Honestly? Your movement held up well across all three ... even as you fatigued. That's worth something. But a single camera only sees so much ... it can't feel how your body actually moves under real load, day after day. <strong>What I'd recommend:</strong> keep training, and if something still doesn't feel right even though the scan looks clean ... that's exactly the conversation worth having.",
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
  value: string;
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

  const scanResultsRef = useRef<ScanResult[]>([]);
  const capRef = useRef<any>(null);

  // Gate form state
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [lane, setLane] = useState<"rebuild" | "restart" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Result state
  const [resultRegion, setResultRegion] = useState<string>("none");
  const [findings, setFindings] = useState<Finding[]>([]);

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
    if (stable) {
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
      setHoldProgress(null);
      setStatus("Hold still to start the 5-second capture");
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

      const step = FREE_STEPS[0];
      setStepIndex(0);
      stepIndexRef.current = 0;
      setInstruction(step.instruction || "");
      setMovePill(`1 / ${FREE_STEPS.length} · ${step.label}`);
      setHoldProgress(null);
      capRef.current = { mode: "hold", holdStart: null, samples: [], lastHipX: null };
      setPhase("scanning");
      requestAnimationFrame(loopWithStep);
    } catch (e) {
      setStatus("Camera error — allow access (HTTPS required)");
    }
  };

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
        foundFindings.push({ stepLabel: step.label, metricName: m.name, value: display, level });
      });
    });
    const top = Object.entries(regionScores).sort((a, b) => b[1] - a[1])[0];
    const region = top && top[1] > 0 ? top[0] : "none";
    setResultRegion(region);
    setFindings(foundFindings.filter((f) => f.level !== "good").sort((a, b) => (b.level === "bad" ? 1 : 0) - (a.level === "bad" ? 1 : 0)).slice(0, 5));
    setSubmitting(false);
    setPhase("result");
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
              The Chain Check ... a free 3-minute scan of where your chain breaks down
            </div>
          </div>
          <div className="font-display font-bold text-orange text-base tracking-widest">#COMPENSATIONCHAIN</div>
        </header>

        <div className="max-w-xl mx-auto px-5 py-10 text-center space-y-6">
          <h1 className="font-display text-4xl font-extrabold uppercase tracking-wide leading-tight">
            Find Out Where Your<br /><span className="text-teal">Chain Breaks Down</span>
          </h1>
          <p className="text-[#aab3cf] text-sm leading-relaxed max-w-md mx-auto">
            Three movements. A few minutes. The scanner watches how your body actually moves and shows you where your chain breaks down ... for free.
            <br /><br />
            You'll need room to stand 6–8 feet back from your phone, and space to turn sideways.
          </p>
          <div className="flex justify-center gap-6 text-sm text-[#9aa3c0]">
            {FREE_STEPS.map((s, i) => (
              <div key={s.key} className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-full bg-[#2A3050] flex items-center justify-center font-display font-bold text-sm">{i + 1}</div>
                <span className="font-display text-xs uppercase tracking-wider">{s.label}</span>
              </div>
            ))}
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
                The scanner watched all three movements ... including what shifted as you got tired. Tell me where to send your result and I'll show you where your chain breaks down, plus what I'd recommend based on what it found.
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
                    Coming back from an injury or surgery. Discharged, but not back to normal.
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

            <Button
              onClick={handleGateSubmit}
              disabled={!firstName.trim() || !email.trim() || !lane || submitting}
              className="w-full font-display text-xl font-extrabold uppercase tracking-widest py-4 bg-orange hover:bg-orange/90 text-white"
            >
              {submitting ? "One sec…" : "Show Me My Result"}
            </Button>
            <p className="text-[10px] text-[#7c85a8] leading-relaxed">
              You'll also get my best rebuilding content by email. No spam. Unsubscribe anytime.
            </p>
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
              {firstName}, your chain breaks down at{" "}
              <span style={{ color: copy.color }}>{copy.headline}</span>
            </h2>
          </div>

          {/* Findings */}
          {findings.length > 0 && (
            <div className="space-y-2">
              {findings.map((f, i) => (
                <div key={i} className="bg-[#1A1F3A] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{f.metricName}</div>
                    <div className="text-xs text-[#9aa3c0] mt-0.5">{f.stepLabel}</div>
                  </div>
                  <span className={`font-display text-xs font-bold px-3 py-1 rounded-full tracking-wider ${
                    f.level === "bad" ? "bg-bad/15 text-bad" : "bg-warn/15 text-warn"
                  }`}>
                    {f.level === "bad" ? "BREAKDOWN" : "WATCH"} · {f.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          <div className="bg-[#1A1F3A] border-l-[3px] border-orange rounded-r-xl p-5 text-sm leading-relaxed text-[#c8cee6]">
            <div dangerouslySetInnerHTML={{ __html: copy.recs }} />
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
        </div>
      </div>

      <p className="text-center text-xs text-[#7c85a8] px-5 pb-8 leading-relaxed">
        The Chain Check is a screening aid, not a diagnosis. Readings depend on camera angle, lighting, and clothing. © The Healthy Yinzer
      </p>
    </div>
  );
}
