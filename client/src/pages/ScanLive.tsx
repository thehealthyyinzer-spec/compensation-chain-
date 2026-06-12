import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { MOVES, FULL_BATTERY, allMetrics, SCAN_CONSTANTS } from "@/lib/moveLibrary";
import { generateCoachNote } from "@/lib/scanUtils";
import { CHECKPOINTS } from "@shared/types";

/**
 * ScanLive — the full MediaPipe pose engine ported from the prototype.
 * Handles camera, pose detection, rep counting, hold timers, skeleton overlay, and audio ding.
 */
export default function ScanLive() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { data: clientProfile } = trpc.clientProfile.me.useQuery(undefined, { enabled: isAuthenticated });
  const { data: existingSessions } = trpc.scan.mySessions.useQuery(undefined, { enabled: isAuthenticated });
  const saveScan = trpc.scan.save.useMutation({
    onSuccess: (data) => {
      navigate(`/results/${data.sessionId}`);
    },
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<any>(null);
  const runningRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [status, setStatus] = useState("Loading model…");
  const [movePill, setMovePill] = useState("");
  const [holdProgress, setHoldProgress] = useState<number | null>(null);
  const [holdLabel, setHoldLabel] = useState("");
  const [instruction, setInstruction] = useState("");
  const [scanProgress, setScanProgress] = useState<{ name: string; state: "done" | "active" | "pending" }[]>([]);
  const [repFlash, setRepFlash] = useState(false); // brief green flash on rep
  // Fullscreen mode — always on for mobile (< 768px), toggleable on desktop
  const [isFullscreen, setIsFullscreen] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  // Scan state refs (mutable, not triggering re-renders)
  const queueRef = useRef<string[]>([]);
  const qiRef = useRef(0);
  const sessionResultsRef = useRef<any[]>([]);
  const smoothRef = useRef<Record<string, number>>({});
  const holdStartRef = useRef<number | null>(null);
  const holdSamplesRef = useRef<any[]>([]);
  const swayBufRef = useRef<number[]>([]);
  const lastMidHipRef = useRef<{ x: number; y: number } | null>(null);
  const dynRef = useRef<any>(null);

  // Get selected battery from sessionStorage
  const selectedMoves = JSON.parse(sessionStorage.getItem("chaincheck-battery") || JSON.stringify(FULL_BATTERY));

  // Initialize audio context
  const initAudio = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
    } catch (e) { /* silent */ }
  }, []);

  // Audio ding on rep count
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

  // Compute pose metrics from landmarks
  const compute = useCallback((lm: any[]) => {
    const g = (i: number) => lm[i];
    const L = { nose: 0, lEar: 7, rEar: 8, lSh: 11, rSh: 12, lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnk: 27, rAnk: 28 };
    const deg = (a: number) => a * 180 / Math.PI;
    const tilt = (p: any, q: any) => deg(Math.atan2(q.y - p.y, q.x - p.x));
    const ema = (id: string, v: number, a = SCAN_CONSTANTS.EMA_ALPHA) => {
      smoothRef.current[id] = smoothRef.current[id] == null ? v : smoothRef.current[id] + (v - smoothRef.current[id]) * a;
      return smoothRef.current[id];
    };

    const lSh = g(L.lSh), rSh = g(L.rSh), lHip = g(L.lHip), rHip = g(L.rHip);
    const lKnee = g(L.lKnee), rKnee = g(L.rKnee), lAnk = g(L.lAnk), rAnk = g(L.rAnk);
    const nose = g(L.nose), lEar = g(L.lEar), rEar = g(L.rEar);

    const midSh = { x: (lSh.x + rSh.x) / 2, y: (lSh.y + rSh.y) / 2 };
    const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
    const midAnk = { x: (lAnk.x + rAnk.x) / 2, y: (lAnk.y + rAnk.y) / 2 };
    const midEar = { x: (lEar.x + rEar.x) / 2, y: (lEar.y + rEar.y) / 2 };
    const midKnee = { x: (lKnee.x + rKnee.x) / 2, y: (lKnee.y + rKnee.y) / 2 };

    const shoulderWidth = Math.abs(rSh.x - lSh.x);
    const stance = Math.max(Math.abs(rAnk.x - lAnk.x), 0.05);

    const val = (hip: any, knee: any, ank: any, side: string) => {
      const t = (knee.y - hip.y) / Math.max(ank.y - hip.y, 0.01);
      const lineX = hip.x + (ank.x - hip.x) * t;
      const d = knee.x - lineX;
      return side === "L" ? Math.max(d, 0) : Math.max(-d, 0);
    };

    const ankDiff = lAnk.y - rAnk.y;
    const raisedSide = Math.abs(ankDiff) > 0.07 ? (ankDiff > 0 ? "R" : "L") : null;

    swayBufRef.current.push(midHip.x);
    if (swayBufRef.current.length > 40) swayBufRef.current.shift();
    const mean = swayBufRef.current.reduce((a, b) => a + b, 0) / swayBufRef.current.length;
    const sway = Math.sqrt(swayBufRef.current.reduce((a, b) => a + (b - mean) ** 2, 0) / swayBufRef.current.length) / Math.max(shoulderWidth, 0.05) * 100;

    const isSideOn = shoulderWidth < 0.10;
    const fwdHead = deg(Math.atan2(Math.abs(midEar.x - midSh.x), Math.max(midSh.y - midEar.y, 0.01)));
    const shoulderRound = deg(Math.atan2(Math.abs(midSh.x - midHip.x), Math.max(midHip.y - midSh.y, 0.01)));
    const hingeTorso = deg(Math.atan2(Math.abs(midSh.x - midHip.x), Math.max(midHip.y - midSh.y, 0.001)));

    const kneeAngle = (() => {
      const a = { x: midHip.x - midKnee.x, y: midHip.y - midKnee.y };
      const b = { x: midAnk.x - midKnee.x, y: midAnk.y - midKnee.y };
      const dot = a.x * b.x + a.y * b.y;
      const ma = Math.hypot(a.x, a.y), mb = Math.hypot(b.x, b.y);
      return deg(Math.acos(Math.min(Math.max(dot / (ma * mb || 1), -1), 1)));
    })();

    const shinAngle = deg(Math.atan2(Math.abs(midKnee.x - midAnk.x), Math.max(midAnk.y - midKnee.y, 0.01)));
    const kneeY = (lKnee.y + rKnee.y) / 2;

    return {
      shoulderTilt: ema("shoulderTilt", tilt(lSh, rSh)),
      hipTilt: ema("hipTilt", tilt(lHip, rHip)),
      headLean: ema("headLean", deg(Math.atan2(nose.x - midSh.x, Math.max(midSh.y - nose.y, 0.01)))),
      weightShift: ema("weightShift", ((midHip.x - midAnk.x) / stance) * 100),
      torsoLean: ema("torsoLean", deg(Math.atan2(midSh.x - midHip.x, Math.max(midHip.y - midSh.y, 0.01)))),
      torsoLeanSag: deg(Math.atan2(Math.abs(midSh.x - midHip.x), Math.max(midHip.y - midSh.y, 0.01))),
      kneeValgusL: ema("kneeValgusL", val(lHip, lKnee, lAnk, "L")),
      kneeValgusR: ema("kneeValgusR", val(rHip, rKnee, rAnk, "R")),
      cave: Math.max(val(lHip, lKnee, lAnk, "L"), val(rHip, rKnee, rAnk, "R")),
      depth: Math.min(Math.max((midHip.y - (kneeY - 0.18)) / 0.18, 0), 1) * 100,
      sway, raisedSide, isSideOn,
      fwdHead: ema("fwdHead", fwdHead),
      shoulderRound: ema("shoulderRound", shoulderRound),
      hingeTorso, hingeKnee: ema("hingeKnee", 180 - kneeAngle),
      shinAngle: ema("shinAngle", shinAngle),
      kneeTravel: shinAngle,
      hipY: midHip.y,
      shoulderY: ((lSh.visibility ?? 1) >= (rSh.visibility ?? 1) ? lSh.y : rSh.y),
      shoulderVis: Math.max(lSh.visibility ?? 1, rSh.visibility ?? 1),
      midHip,
    };
  }, []);

  // Draw skeleton overlay
  const drawSkel = useCallback((ctx: CanvasRenderingContext2D, lm: any[], W: number, H: number, capturing: boolean, flash?: boolean) => {
    const CONN = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    // flash = green rep confirmed, capturing = blue active hold/rep, else white idle
    ctx.strokeStyle = flash ? "#34D399" : capturing ? "#00B4D8" : "rgba(255,255,255,0.5)";
    CONN.forEach(([a, b]) => {
      const p = lm[a], q = lm[b];
      if ((p.visibility ?? 1) < 0.4 || (q.visibility ?? 1) < 0.4) return;
      ctx.beginPath();
      ctx.moveTo(p.x * W, p.y * H);
      ctx.lineTo(q.x * W, q.y * H);
      ctx.stroke();
    });
    const dotColor = flash ? "#34D399" : capturing ? "#00B4D8" : "rgba(255,255,255,0.7)";
    lm.forEach((p, i) => {
      if ((p.visibility ?? 1) < 0.4 || i < 11) return;
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }, []);

  // Finish session and save
  const finishSession = useCallback(() => {
    runningRef.current = false;
    const video = videoRef.current;
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }

    const sessions = existingSessions || [];
    const doneCount = sessions.length;
    const storedCpId = sessionStorage.getItem("chaincheck-checkpoint");
    const cpIdx = storedCpId
      ? Math.max(0, CHECKPOINTS.findIndex(c => c.id === storedCpId))
      : Math.min(doneCount, CHECKPOINTS.length - 1);
    const cp = CHECKPOINTS[cpIdx];
    const programWeek = clientProfile?.startDate
      ? Math.max(0, Math.min(16, Math.floor((Date.now() - new Date(clientProfile.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000))))
      : 0;

    const prevResults = sessions.length > 0 ? (sessions[0].results as any[]) : null;
    const note = generateCoachNote(
      clientProfile?.name || "Client",
      sessionResultsRef.current,
      cp.label,
      prevResults
    );

    saveScan.mutate({
      date: new Date().toISOString(),
      week: programWeek,
      checkpoint: cp.label,
      checkpointId: cp.id,
      isBaseline: !!cp.baseline,
      results: sessionResultsRef.current,
      note,
    });
  }, [clientProfile, existingSessions, saveScan]);

  // Start scan
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    initAudio();

    const queue = [...selectedMoves].sort((a: string, b: string) =>
      (MOVES[a]?.view === "side" ? 1 : 0) - (MOVES[b]?.view === "side" ? 1 : 0)
    );
    queueRef.current = queue;
    qiRef.current = 0;
    sessionResultsRef.current = [];

    const startScan = async () => {
      try {
        // Load MediaPipe
        const vision_module = await import("@mediapipe/tasks-vision");
        const { PoseLandmarker, FilesetResolver } = vision_module;
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });

        // Start camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 960, height: 720, facingMode: "user" },
          audio: false,
        });
        const video = videoRef.current!;
        video.srcObject = stream;
        await new Promise((r) => { video.onloadedmetadata = r; });

        const canvas = canvasRef.current!;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        runningRef.current = true;
        startMove();
        loop();
      } catch (e: any) {
        setStatus("Camera error — allow access (HTTPS required)");
      }
    };

    startScan();

    return () => {
      runningRef.current = false;
      const video = videoRef.current;
      if (video?.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startMove = () => {
    smoothRef.current = {};
    holdStartRef.current = null;
    holdSamplesRef.current = [];
    swayBufRef.current = [];
    lastMidHipRef.current = null;

    const queue = queueRef.current;
    const qi = qiRef.current;
    const mv = MOVES[queue[qi]];

    setScanProgress(queue.map((k, n) => ({
      name: MOVES[k].name,
      state: n < qi ? "done" : n === qi ? "active" : "pending",
    })));

    if (mv.type === "reps") {
      dynRef.current = { phaseIdx: 0, repState: "up", sm: null, top: null, bottom: 0, bottomSnap: null, amp: SCAN_CONSTANTS.INITIAL_AMP, downStartT: 0, front: [], side: [], startT: null };
      setHoldProgress(null);
      setInstruction(mv.phases![0].instruction);
      setMovePill(`FRONT 0/${mv.phases![0].reps}`);
    } else if (mv.type === "hold2") {
      (mv as any)._phaseIdx = 0;
      dynRef.current = null;
      const ph = mv.phases![0];
      setInstruction(ph.instruction);
      setMovePill(`${qi + 1} / ${queue.length} · ${mv.name}${ph.leg ? " · " + ph.leg + " leg" : ""}`);
      setHoldProgress(null);
      holdStartRef.current = null;
      holdSamplesRef.current = [];
    } else {
      dynRef.current = null;
      setInstruction(mv.instruction || "");
      setMovePill(`${qi + 1} / ${queue.length} · ${mv.name}`);
      setHoldProgress(null);
      holdStartRef.current = null;
      holdSamplesRef.current = [];
    }
  };

  const nextMove = () => {
    holdStartRef.current = null;
    setHoldProgress(null);
    if (qiRef.current < queueRef.current.length - 1) {
      qiRef.current++;
      startMove();
    } else {
      finishSession();
    }
  };

  const loop = () => {
    if (!runningRef.current) return;
    const now = performance.now();
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !landmarkerRef.current) {
      requestAnimationFrame(loop);
      return;
    }

    const ctx = canvas.getContext("2d")!;
    const res = landmarkerRef.current.detectForVideo(video, now);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (res.landmarks && res.landmarks.length) {
      const lm = res.landmarks[0];
      const vals = compute(lm);
      const mv = MOVES[queueRef.current[qiRef.current]];
      let capturing = false;

      if (mv.type === "reps") {
        capturing = handleReps(vals, now, mv);
      } else {
        capturing = handleHold(vals, now, mv);
      }

      drawSkel(ctx, lm, canvas.width, canvas.height, capturing, repFlash);
    } else {
      setStatus("No body detected — step back");
      holdStartRef.current = null;
      setHoldProgress(null);
    }

    requestAnimationFrame(loop);
  };

  // Handle hold movements
  const handleHold = (vals: any, now: number, mv: any): boolean => {
    const ph = mv.type === "hold2" ? mv.phases[(mv as any)._phaseIdx || 0] : mv;
    const thresh = mv.balance ? SCAN_CONSTANTS.BAL_STABILITY : SCAN_CONSTANTS.STABILITY;
    let stable = false;

    if (lastMidHipRef.current) {
      stable = Math.hypot(vals.midHip.x - lastMidHipRef.current.x, vals.midHip.y - lastMidHipRef.current.y) < thresh;
    }
    lastMidHipRef.current = { ...vals.midHip };

    const ready = stable && ph.trigger(vals);
    if (ready) {
      if (!holdStartRef.current) {
        holdStartRef.current = now;
        holdSamplesRef.current = [];
        swayBufRef.current = [];
      }
      holdSamplesRef.current.push({ ...vals });
      const elapsed = (now - holdStartRef.current) / 1000;
      const remain = Math.max(ph.hold - elapsed, 0);
      setHoldProgress(1 - remain / ph.hold);
      setHoldLabel(ph.holdHint || "Hold still…");
      setStatus("Capturing… hold it");

      if (elapsed >= ph.hold) {
        finishHold(mv, ph);
      }
      return true;
    } else {
      holdStartRef.current = null;
      holdSamplesRef.current = [];
      setHoldProgress(null);
      setStatus(ph.trigger(vals) ? "Hold still to start the countdown" : (ph.triggerMsg || "Get into position"));
      return false;
    }
  };

  const finishHold = (mv: any, ph: any) => {
    const avg: Record<string, number> = {};
    const meanArr = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    ph.metrics.forEach((m: any) => {
      if (m.id === "sway") {
        avg[m.id] = holdSamplesRef.current[holdSamplesRef.current.length - 1]?.sway || 0;
      } else if (m.id === "swayFatigue") {
        // Computed below
      } else {
        avg[m.id] = meanArr(holdSamplesRef.current.map((x: any) => x[m.id]));
      }
    });

    // Sway fatigue: difference between last-third and first-third average
    if (mv.balance && holdSamplesRef.current.length >= 6) {
      const samples = holdSamplesRef.current;
      const third = Math.floor(samples.length / 3);
      const earlyMean = samples.slice(0, third).reduce((a: number, b: any) => a + b.sway, 0) / third;
      const lateMean = samples.slice(-third).reduce((a: number, b: any) => a + b.sway, 0) / third;
      avg["swayFatigue"] = lateMean - earlyMean;
    }

    if (mv.type === "hold2") {
      const key = queueRef.current[qiRef.current];
      let entry = sessionResultsRef.current.find((r) => r.key === key);
      if (!entry) {
        entry = { key, vals: {} };
        sessionResultsRef.current.push(entry);
      }
      Object.assign(entry.vals, avg);

      const nextIdx = ((mv as any)._phaseIdx || 0) + 1;
      if (nextIdx < mv.phases.length) {
        (mv as any)._phaseIdx = nextIdx;
        const np = mv.phases[nextIdx];
        holdStartRef.current = null;
        holdSamplesRef.current = [];
        ding();
        setHoldProgress(null);
        setInstruction(np.instruction);
        setMovePill(`${qiRef.current + 1} / ${queueRef.current.length} · ${mv.name}${np.leg ? " · " + np.leg + " leg" : ""}`);
        setStatus(np.leg ? `Switch to your ${np.leg} leg and get into position` : "Turn and get into position");
      } else {
        (mv as any)._phaseIdx = 0;
        nextMove();
      }
    } else {
      sessionResultsRef.current.push({ key: queueRef.current[qiRef.current], vals: avg });
      nextMove();
    }
  };

  // Handle rep movements (adaptive detection with updated thresholds)
  const handleReps = (vals: any, now: number, mv: any): boolean => {
    const dyn = dynRef.current;
    if (!dyn) return false;
    const ph = mv.phases[dyn.phaseIdx];

    if (dyn.startT == null) dyn.startT = now;

    if (vals.shoulderVis < 0.4) {
      setStatus("Get your full upper body in frame");
      return dyn.repState === "down";
    }

    // Smooth shoulder height
    dyn.sm = dyn.sm == null ? vals.shoulderY : dyn.sm + (vals.shoulderY - dyn.sm) * SCAN_CONSTANTS.SHOULDER_EMA_ALPHA;

    // Adaptive standing top
    if (dyn.top == null) dyn.top = dyn.sm;
    else if (dyn.sm < dyn.top) dyn.top = dyn.sm;
    else if (dyn.repState === "up") dyn.top += (dyn.sm - dyn.top) * 0.03;

    const depth = dyn.sm - dyn.top;
    if (dyn.amp == null) dyn.amp = SCAN_CONSTANTS.INITIAL_AMP;

    // Updated thresholds (shallow squat fix)
    const DOWN = Math.max(dyn.amp * SCAN_CONSTANTS.DOWN_MULTIPLIER, SCAN_CONSTANTS.DOWN_FLOOR);
    const UP = Math.max(dyn.amp * SCAN_CONSTANTS.UP_MULTIPLIER, SCAN_CONSTANTS.UP_FLOOR);

    const snap = {
      torso: vals.torsoLeanSag,
      knee: vals.kneeTravel,
      cave: vals.cave,
      weightShift: vals.weightShift,
      depth,
    };

    if (dyn.repState === "up") {
      if (depth > DOWN) {
        dyn.repState = "down";
        dyn.bottom = depth;
        dyn.bottomSnap = snap;
        dyn.downStartT = now;
      }
    } else {
      if (depth > dyn.bottom) {
        dyn.bottom = depth;
        dyn.bottomSnap = snap;
      }
      if (depth < UP) {
        // REP COMPLETE
        dyn.repState = "up";
        dyn.amp = dyn.amp * 0.5 + dyn.bottom * 0.5;
        if (dyn.bottomSnap) dyn[ph.view].push(dyn.bottomSnap);
        ding();
        setRepFlash(true);
        setTimeout(() => setRepFlash(false), 400);

        const count = dyn[ph.view].length;
        setMovePill(`${ph.view.toUpperCase()} ${count}/${ph.reps}`);

        if (count >= ph.reps) {
          if (dyn.phaseIdx < mv.phases.length - 1) {
            dyn.phaseIdx++;
            dyn.repState = "up";
            dyn.sm = null;
            dyn.top = null;
            dyn.bottom = 0;
            dyn.bottomSnap = null;
            dyn.startT = now;
            const np = mv.phases[dyn.phaseIdx];
            setInstruction(np.instruction);
            setMovePill(`${np.view.toUpperCase()} 0/${np.reps}`);
          } else {
            finishReps(mv);
            return false;
          }
        }
      } else if (now - dyn.downStartT > 4500) {
        dyn.repState = "up";
        dyn.top = dyn.sm;
        dyn.bottom = 0;
      }
    }

    const count = dyn[ph.view].length;
    if (ph.view === "side" && !vals.isSideOn) {
      setStatus("Turn sideways ... reps still counting");
    } else if (count === 0) {
      setStatus(ph.view === "front" ? "Face the camera and start squatting..." : "Sideways now — start squatting...");
    } else {
      setStatus(ph.hint || "Keep going…");
    }
    return dyn.repState === "down";
  };

  const finishReps = (mv: any) => {
    const dyn = dynRef.current;
    if (!dyn) return;
    const key = queueRef.current[qiRef.current];
    const front = dyn.front;
    const side = dyn.side;

    const meanArr = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const caveVals = front.map((r: any) => r.cave);
    const shiftVals = front.map((r: any) => Math.abs(r.weightShift));
    const leanVals = side.map((r: any) => r.torso);
    const depthVals = side.map((r: any) => r.depth * 100);
    const kneeVals = side.map((r: any) => r.knee);

    const nF = caveVals.length;
    const third = Math.max(1, Math.round(nF / 3));
    const fatigueCave = nF >= 2 ? meanArr(caveVals.slice(-third)) - meanArr(caveVals.slice(0, third)) : 0;
    const sink = meanArr(depthVals);
    const kneeTravel = meanArr(kneeVals);
    const dominance = kneeTravel / Math.max(sink, 1);

    const agg: Record<string, number> = {
      kneeCave: meanArr(caveVals),
      weightShift: meanArr(shiftVals),
      torsoLean: meanArr(leanVals),
      depth: sink,
      sink,
      kneeTravel,
      dominance,
      fatigueCave,
    };

    sessionResultsRef.current.push({ key, vals: agg });
    nextMove();
  };

  const handleAbort = () => {
    runningRef.current = false;
    const video = videoRef.current;
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
    navigate("/scan");
  };

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        {/* Full-screen camera */}
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />

        {/* Top overlay: movement + status */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 pt-safe pt-3 pb-2 bg-gradient-to-b from-black/70 to-transparent">
          <div className="bg-black/60 px-3 py-1.5 rounded-full text-xs font-semibold text-white border border-white/20 max-w-[55%] truncate">
            {status}
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-black/60 px-3 py-1.5 rounded-full text-sm font-bold font-display tracking-wider border border-gold/60 text-gold">
              {movePill}
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="w-8 h-8 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white text-lg"
              aria-label="Exit fullscreen"
            >
              ⧁
            </button>
          </div>
        </div>

        {/* Hold ring centered */}
        {holdProgress !== null && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="w-24 h-24 relative">
              <svg width="96" height="96" className="-rotate-90">
                <circle cx="48" cy="48" r="40" stroke="rgba(42,48,80,0.8)" strokeWidth="8" fill="rgba(26,31,58,.7)" />
                <circle cx="48" cy="48" r="40" stroke="#00B4D8" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray="251.3" strokeDashoffset={251.3 * (1 - holdProgress)} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-display text-3xl font-extrabold text-white">
                {Math.ceil((1 - holdProgress) * 8)}
              </div>
            </div>
          </div>
        )}

        {/* Bottom overlay: instruction + cancel */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-safe pb-4 pt-2 bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-xs text-white/80 text-center leading-snug mb-2 line-clamp-2" dangerouslySetInnerHTML={{ __html: instruction.replace(/<strong>[^<]*<\/strong>/g, "") }} />
          <button onClick={handleAbort} className="w-full text-xs text-white/50 hover:text-white/80 transition-colors">
            Cancel Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-4 py-3">
        <h1 className="font-display text-2xl font-extrabold tracking-wide uppercase">
          THE HEALTHY <span className="text-teal">YINZER</span>
        </h1>
      </header>

      <div className="container py-4 space-y-4">
        {/* Scan progress pills */}
        <div className="flex gap-1.5 flex-wrap">
          {scanProgress.map((p, i) => (
            <span
              key={i}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider font-display ${
                p.state === "active"
                  ? "bg-primary text-primary-foreground"
                  : p.state === "done"
                  ? "text-good border border-good/50 bg-transparent"
                  : "bg-card text-muted-foreground"
              }`}
            >
              {p.name}
            </span>
          ))}
        </div>

        {/* Video stage */}
        <div className="relative bg-black rounded-xl overflow-hidden aspect-[4/3] sm:aspect-video border border-border">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          />

          {/* Status pill */}
          <div className="absolute top-3 left-3 z-10 bg-background/90 px-3 py-1.5 rounded-full text-xs font-semibold border border-border max-w-[65%]">
            {status}
          </div>

          {/* Move pill + fullscreen toggle */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            <div className="bg-background/90 px-3 py-1.5 rounded-full text-sm font-bold font-display tracking-wider border border-gold text-gold">
              {movePill}
            </div>
            <button
              onClick={() => setIsFullscreen(true)}
              className="w-8 h-8 rounded-full bg-background/90 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Enter fullscreen"
            >
              ⧂
            </button>
          </div>

          {/* Hold ring */}
          {holdProgress !== null && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5">
              <div className="w-20 h-20 relative">
                <svg width="80" height="80" className="-rotate-90">
                  <circle cx="40" cy="40" r="34" stroke="rgba(42,48,80,0.8)" strokeWidth="7" fill="rgba(26,31,58,.7)" />
                  <circle
                    cx="40" cy="40" r="34"
                    stroke="#00B4D8" strokeWidth="7" fill="none"
                    strokeLinecap="round"
                    strokeDasharray="213.6"
                    strokeDashoffset={213.6 * (1 - holdProgress)}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-display text-2xl font-extrabold">
                  {Math.ceil((1 - holdProgress) * 8)}
                </div>
              </div>
              <div className="bg-background/90 px-3 py-1 rounded-full text-xs font-semibold border border-border">
                {holdLabel}
              </div>
            </div>
          )}
        </div>

        {/* Instruction */}
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="text-sm leading-relaxed text-muted-foreground" dangerouslySetInnerHTML={{ __html: instruction }} />
        </div>

        {/* Abort button */}
        <Button variant="outline" onClick={handleAbort} className="font-display uppercase tracking-wider font-bold">
          Cancel Session
        </Button>
      </div>
    </div>
  );
}
