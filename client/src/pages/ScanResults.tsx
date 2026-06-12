import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { MOVES, allMetrics, metricLevel, fmt, BENCHMARKS, REGION_ORDER, REGION_LABELS, BODY_REGIONS } from "@/lib/moveLibrary";
import { computeRegionStatus } from "@/lib/scanUtils";
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
            Select your age so we can show how your numbers compare to peer-reviewed norms.
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
                {submitFeedback.isPending ? "Sending..." : "Send to Coach Nick"}
              </Button>
            </div>
          ) : (
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
              <p className="text-primary font-semibold text-sm">Sent. Coach Nick will review this with your scan data.</p>
            </div>
          )}
        </div>

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
