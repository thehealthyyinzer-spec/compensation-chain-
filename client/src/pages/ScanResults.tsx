import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { MOVES, allMetrics, metricLevel, fmt, BENCHMARKS, REGION_ORDER, REGION_LABELS, BODY_REGIONS } from "@/lib/moveLibrary";
import { computeRegionStatus } from "@/lib/scanUtils";
import { getSingleSessionProtocol, getCitationsForResults } from "@/lib/progressionLogic";
import ResearchPanel from "@/components/ResearchPanel";
import { toast } from "sonner";

export default function ScanResults() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ sessionId: string }>();
  const sessionId = parseInt(params.sessionId || "0");
  const [ageBracket, setAgeBracket] = useState(30);
  const [feedback, setFeedback] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);

  const { data: session, isLoading } = trpc.scan.getById.useQuery(
    { id: sessionId },
    { enabled: !!sessionId }
  );

  const submitFeedback = trpc.scan.submitFeedback.useMutation({
    onSuccess: () => {
      setFeedbackSent(true);
      toast.success("Feedback sent to Coach Nick.");
    },
  });

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Session not found.</p>
      </div>
    );
  }

  const results = session.results as any[];
  const regionStatus = computeRegionStatus(results);

  // Group metrics by region
  const byRegion: Record<string, { m: any; v: number; mvName: string }[]> = {};
  results.forEach((r: any) => {
    const mv = MOVES[r.key];
    if (!mv) return;
    allMetrics(mv).forEach((m) => {
      const v = r.vals[m.id];
      if (v == null) return;
      const reg = m.region || "core";
      if (!byRegion[reg]) byRegion[reg] = [];
      byRegion[reg].push({ m, v, mvName: mv.name });
    });
  });

  const col = (r: string) => {
    const status = regionStatus[r];
    if (status === undefined) return "#4a5178";
    if (status === 0) return "#34D399";
    if (status === 1) return "#FBBF24";
    return "#F87171";
  };

  // Find the single worst metric for the plain-language callout
  const worstMetric = (() => {
    let worst: { m: any; v: number; mvName: string; reg: string } | null = null;
    let worstRank = 0;
    REGION_ORDER.forEach((reg) => {
      (byRegion[reg] || []).forEach(({ m, v, mvName }) => {
        if (m.info) return;
        const lv = metricLevel(m, v);
        const rank = lv === "bad" ? 2 : lv === "warn" ? 1 : 0;
        if (rank > worstRank) { worstRank = rank; worst = { m, v, mvName, reg }; }
      });
    });
    return worst as { m: any; v: number; mvName: string; reg: string } | null;
  })();

  // Single-session protocol suggestion with citations
  const suggestedProtocol = getSingleSessionProtocol(results);
  const scanCitations = getCitationsForResults(results);

  const PLAIN_LANGUAGE: Record<string, (v: string, age: number) => string> = {
    shinAngle: (v, age) => `Your ankle mobility read ${v}. For your selected age range, this is below the screen's target range of about ${age <= 40 ? 40 : age <= 50 ? 38 : 32}°. That does not diagnose a problem, but it does tell us the ankle is worth checking because limited ankle motion can change how the knee and hip share load.`,
    cave: () => `Your knees appeared to drift inward during loading. That does not mean your knees are damaged. It means the scan noticed a tracking pattern we should connect to hip control, ankle mobility, and how your body handles fatigue.`,
    kneeCave: () => `Your knees appeared to drift inward during loading. That does not mean your knees are damaged. It means the scan noticed a tracking pattern we should connect to hip control, ankle mobility, and how your body handles fatigue.`,
    kneeValgusL: () => `Your left knee appeared to drift inward during loading. That is a movement pattern to review, not a diagnosis. The next step is looking at hip control, ankle motion, and whether it matches what you feel day to day.`,
    kneeValgusR: () => `Your right knee appeared to drift inward during loading. That is a movement pattern to review, not a diagnosis. The next step is looking at hip control, ankle motion, and whether it matches what you feel day to day.`,
    fwdHead: (v) => `Your head position read ${v} in this screen. Research connects forward head posture with higher neck loading and neck symptoms for some people, but camera position matters here. Treat this as a watch area for posture, breathing, and upper-back control.`,
    shoulderRound: (v) => `Your shoulder position read ${v}. This can reflect desk posture, upper-back stiffness, breathing mechanics, or how you organize tension. The useful question is whether this pattern matches neck, shoulder, or overhead movement limitations.`,
    hipTilt: (v) => `Your pelvis showed ${v} of side-to-side difference in this screen. That is not automatically bad, but it can be a clue that one side is taking or avoiding more load. We use it as a starting point for single-leg control and hip stability work.`,
    weightShift: (v) => `Your scan showed about ${v} of weight shift. That can happen when the body is protecting a side, favoring an old injury, or simply choosing its strongest strategy. The next step is seeing whether that shift repeats across movements and sessions.`,
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-4 py-3">
        <h1 className="font-display text-2xl font-extrabold tracking-wide uppercase">
          THE HEALTHY <span className="text-teal">YINZER</span>
        </h1>
      </header>

      <div className="container py-6 space-y-5">
        {/* Age bracket selector */}
        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-gold mb-2">
            Results · {session.checkpoint}
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Select your age so we can compare your readings to research-informed screening ranges.
          </p>
          <div className="flex gap-2 flex-wrap">
            {[20, 30, 40, 50, 60].map((age) => (
              <button
                key={age}
                onClick={() => setAgeBracket(age)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                  ageBracket === age
                    ? "bg-primary/15 border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {age === 60 ? "60+" : `${age}–${age + 10}`}
              </button>
            ))}
          </div>
        </div>

        {/* Plain-language gap callout */}
        {worstMetric && PLAIN_LANGUAGE[(worstMetric as any).m.id] && (
          <div className="rounded-xl p-5 border-l-4 border-orange bg-card border border-border">
            <h4 className="font-display text-base font-extrabold uppercase tracking-wider text-gold mb-2">
              What This Means For You
            </h4>
            <p className="text-sm text-foreground leading-relaxed">
              {PLAIN_LANGUAGE[(worstMetric as any).m.id](fmt((worstMetric as any).m, (worstMetric as any).v), ageBracket)}
            </p>
          </div>
        )}

        {/* Body figure + metrics */}
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4">
          {/* Body figure */}
          <div className="bg-card rounded-xl p-5 border border-border flex flex-col items-center gap-2">
            <h3 className="font-display text-lg font-extrabold uppercase tracking-wide text-gold self-start">
              Compensation Map
            </h3>
            <svg viewBox="0 0 200 400" width="160" className="cursor-pointer">
              <circle cx="100" cy="22" r="18" fill={col("shoulders")} opacity="0.85" />
              {REGION_ORDER.map((r) => {
                const reg = BODY_REGIONS[r];
                return (
                  <g key={r}>
                    <path d={reg.path} fill={col(r)} opacity="0.82" />
                    <text x={reg.cx} y={reg.cy + 4} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,.7)" fontFamily="Inter">
                      {r.toUpperCase()}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="flex gap-3 flex-wrap text-xs text-muted-foreground justify-center">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-good" />Good</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warn" />Watch</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-bad" />Flag</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted" />No data</span>
            </div>
          </div>

          {/* Metric cards */}
          <div className="flex flex-col gap-3">
            {REGION_ORDER.map((reg) => {
              const items = byRegion[reg];
              if (!items || !items.length) return null;
              const lv = regionStatus[reg];
              const dotCol = lv === 0 ? "#34D399" : lv === 1 ? "#FBBF24" : lv === 2 ? "#F87171" : "#4a5178";

              return (
                <div key={reg} className="bg-card rounded-xl p-4 border border-border">
                  <h4 className="font-display text-lg font-extrabold uppercase tracking-wide flex items-center gap-2 mb-3">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: dotCol }} />
                    {REGION_LABELS[reg] || reg}
                  </h4>
                  <div className="space-y-3">
                    {items.map(({ m, v, mvName }, idx) => {
                      const lv2 = metricLevel(m, v);
                      const bm = BENCHMARKS[m.id];
                      const bmAge = bm ? bm[ageBracket] || bm[30] : null;
                      const display = fmt(m, v);

                      return (
                        <div key={`${m.id}-${idx}`} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-sm text-foreground/80">{m.name}</span>
                            <span className={`font-display text-xl font-extrabold tracking-wide ${
                              m.info ? "text-muted-foreground" : lv2 === "good" ? "text-good" : lv2 === "warn" ? "text-warn" : "text-bad"
                            }`}>
                              {display}
                            </span>
                          </div>
                          {bm && bmAge && !m.info && (
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 bg-muted rounded-full relative overflow-visible">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.min(Math.abs(v) / (bm.max || 90) * 100, 100)}%`,
                                    background: lv2 === "good" ? "#34D399" : lv2 === "warn" ? "#FBBF24" : "#F87171",
                                  }}
                                />
                                <div
                                  className="absolute top-[-3px] w-0.5 h-3 bg-white/60 rounded"
                                  style={{ left: `${Math.min(bmAge.good / (bm.max || 90) * 100, 100)}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{bmAge.label}</span>
                            </div>
                          )}
                          {bm && !m.info && (
                            <p className="text-[10px] text-muted-foreground/60 italic mt-0.5">{bm.source}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coach Note */}
        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-gold mb-3">
            Note From Coach Nick
          </h3>
          <div className="bg-background border-l-[3px] border-primary rounded-r-xl p-4 text-sm leading-relaxed text-muted-foreground">
            <div dangerouslySetInnerHTML={{ __html: session.note || "" }} />
            <span className="font-display text-primary uppercase tracking-wider font-bold text-sm mt-2 block">
              — Coach Nick
            </span>
          </div>
        </div>

        {/* Protocol Suggestion */}
        {suggestedProtocol && (
          <div className="bg-card rounded-xl p-5 border border-primary/30">
            <h3 className="font-display text-lg font-extrabold uppercase tracking-wide text-primary mb-1">
              What To Work On Next
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Based on your scan, Coach Nick's framework points here first.</p>
            <div className="space-y-3">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-sm font-bold text-foreground mb-0.5">{suggestedProtocol.title}</p>
                <p className="text-xs text-muted-foreground italic leading-relaxed">"{suggestedProtocol.cue}"</p>
              </div>
              {(suggestedProtocol as any).rationale && (
                <div className="bg-background rounded-lg px-3 py-2 border border-border">
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">Why this is the first focus: </span>
                    {(suggestedProtocol as any).rationale}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Focus block:</p>
                <ul className="space-y-1">
                  {suggestedProtocol.exercises.map((ex, i) => (
                    <li key={i} className="text-xs text-foreground flex items-start gap-2">
                      <span className="text-primary mt-0.5">›</span>
                      {ex}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Client Feedback */}
        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-gold mb-3">
            Send to Coach Nick
          </h3>
          {!feedbackSent ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                What did you feel? Any pain or tightness?
              </p>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tell Coach Nick what you noticed during the scan..."
                className="min-h-[100px]"
              />
              <Button
                onClick={() => submitFeedback.mutate({ sessionId, feedback })}
                disabled={!feedback.trim() || submitFeedback.isPending}
                className="font-display uppercase tracking-wider font-bold"
              >
                {submitFeedback.isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    Sending...
                  </span>
                ) : "Send to Coach Nick"}
              </Button>
            </div>
          ) : (
            <div className="bg-good/10 border border-good/30 rounded-xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-good/15 border border-good/40 flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-good">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="text-good font-bold text-sm font-display uppercase tracking-wider">Sent to Coach Nick</p>
                <p className="text-muted-foreground text-xs mt-0.5">He'll review this with your scan data before your next session.</p>
              </div>
            </div>
          )}
        </div>

        {/* Research Citations */}
        <ResearchPanel citations={scanCitations} />

        {/* Navigation */}
        <div className="flex gap-3 flex-wrap">
          <Button variant="outline" onClick={() => navigate("/history")} className="font-display uppercase tracking-wider font-bold">
            See My Progress
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              // Open PDF in new window for printing
              const pdfWindow = window.open("", "_blank");
              if (pdfWindow) {
                pdfWindow.document.write(`<html><head><title>Loading PDF...</title></head><body><p>Generating PDF summary...</p></body></html>`);
                fetch(`/api/trpc/scan.getPdf?batch=1&input=${encodeURIComponent(JSON.stringify({"0":{"json":{"sessionId":sessionId}}}))}`, { credentials: "include" })
                  .then(r => r.json())
                  .then(data => {
                    const html = data[0]?.result?.data?.json?.html;
                    if (html) {
                      pdfWindow.document.open();
                      pdfWindow.document.write(html);
                      pdfWindow.document.close();
                      setTimeout(() => pdfWindow.print(), 500);
                    }
                  })
                  .catch(() => { pdfWindow.document.write("<p>Error generating PDF.</p>"); });
              }
            }}
            className="font-display uppercase tracking-wider font-bold"
          >
            Download PDF
          </Button>
          <Button variant="outline" onClick={() => navigate("/dashboard")} className="font-display uppercase tracking-wider font-bold">
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
