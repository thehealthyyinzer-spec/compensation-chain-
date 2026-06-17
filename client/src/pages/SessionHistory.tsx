import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { MOVES, allMetrics, metricLevel, fmt, REGION_LABELS } from "@/lib/moveLibrary";
import { computeScanStatus, computeTrend, computeRegionStatus } from "@/lib/scanUtils";
import ChainMap from "@/components/ChainMap";

export default function SessionHistory() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [compareSel, setCompareSel] = useState<number[]>([]);
  const [selectedSession, setSelectedSession] = useState<number | null>(null);

  const { data: sessions, isLoading } = trpc.scan.mySessions.useQuery(undefined, {
    enabled: isAuthenticated,
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

  const sortedSessions = sessions ? [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) : [];

  const toggleSelect = (idx: number) => {
    setCompareSel((prev) => {
      if (prev.includes(idx)) return prev.filter((x) => x !== idx);
      const next = [...prev, idx];
      if (next.length > 2) next.shift();
      return next;
    });
  };

  const statusPill = (results: any[]) => {
    const status = computeScanStatus(results);
    const colors = {
      CLEAN: "bg-good/15 text-good",
      WATCH: "bg-warn/15 text-warn",
      FLAGS: "bg-bad/15 text-bad",
    };
    return (
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full font-display tracking-wider ${colors[status]}`}>
        {status}
      </span>
    );
  };

  // Compare view
  const renderCompare = () => {
    if (compareSel.length < 2) return null;
    const [aIdx, bIdx] = compareSel.sort((x, y) => x - y);
    const a = sortedSessions[aIdx];
    const b = sortedSessions[bIdx];
    if (!a || !b) return null;

    const aResults = a.results as any[];
    const bResults = b.results as any[];
    const aLabel = a.checkpoint || `Wk ${a.week}`;
    const bLabel = b.checkpoint || `Wk ${b.week}`;

    const rows: { name: string; aVal: string; bVal: string; aLv: string; bLv: string; trend: string }[] = [];

    bResults.forEach((rb: any) => {
      const ra = aResults.find((x: any) => x.key === rb.key);
      if (!ra) return;
      const mv = MOVES[rb.key];
      if (!mv) return;
      allMetrics(mv).forEach((m) => {
        if (m.info) return;
        const va = ra.vals[m.id];
        const vb = rb.vals[m.id];
        if (va == null || vb == null) return;
        const trend = computeTrend(m, va, vb);
        rows.push({
          name: `${mv.name} · ${m.name}`,
          aVal: fmt(m, va),
          bVal: fmt(m, vb),
          aLv: metricLevel(m, va),
          bLv: metricLevel(m, vb),
          trend,
        });
      });
    });

    return (
      <div className="bg-card rounded-xl p-5 border border-border">
        <h3 className="font-display text-lg font-extrabold uppercase tracking-wide text-gold mb-3">
          {aLabel} vs {bLabel}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 text-xs text-muted-foreground uppercase tracking-wider">Metric</th>
                <th className="text-left py-2 px-2 text-xs text-muted-foreground uppercase tracking-wider">{aLabel}</th>
                <th className="text-left py-2 px-2 text-xs text-muted-foreground uppercase tracking-wider">{bLabel}</th>
                <th className="text-left py-2 px-2 text-xs text-muted-foreground uppercase tracking-wider">Trend</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="py-2 px-2 text-foreground/80">{row.name}</td>
                  <td className="py-2 px-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      row.aLv === "good" ? "bg-good/15 text-good" : row.aLv === "warn" ? "bg-warn/15 text-warn" : "bg-bad/15 text-bad"
                    }`}>{row.aVal}</span>
                  </td>
                  <td className="py-2 px-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      row.bLv === "good" ? "bg-good/15 text-good" : row.bLv === "warn" ? "bg-warn/15 text-warn" : "bg-bad/15 text-bad"
                    }`}>{row.bVal}</span>
                  </td>
                  <td className="py-2 px-2">
                    <span className={`font-display font-extrabold tracking-wide text-sm ${
                      row.trend === "clearing" ? "text-good" : row.trend === "watch" ? "text-bad" : "text-muted-foreground"
                    }`}>
                      {row.trend === "clearing" ? "▲ clearing" : row.trend === "watch" ? "▼ watch" : "— steady"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-4 py-3">
        <h1 className="font-display text-2xl font-extrabold tracking-wide uppercase">
          THE HEALTHY <span className="text-teal">YINZER</span>
        </h1>
      </header>

      <div className="container py-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Session list */}
          <div className="bg-card rounded-xl p-5 border border-border">
            <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-gold mb-2">
              Your Sessions
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Tap a session to view full results. Tap two to compare side by side.
            </p>
            <div className="space-y-2">
              {sortedSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scans yet. Your first one is your baseline ... run it from the New Scan tab.</p>
              ) : (
                sortedSessions.map((s, i) => {
                  const d = new Date(s.date);
                  const isSelected = compareSel.includes(i);
                  const isViewing = selectedSession === i;
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        if (isViewing) {
                          setSelectedSession(null);
                        } else {
                          setSelectedSession(i);
                          setCompareSel([]);
                        }
                      }}
                      className={`flex justify-between items-center rounded-xl p-3 border cursor-pointer transition-all ${
                        isViewing ? "border-primary bg-primary/10" :
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div>
                        <div className="font-display text-base font-extrabold tracking-wide">
                          {s.checkpoint || `Week ${s.week}`} · {d.toLocaleDateString([], { month: "short", day: "numeric" })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(s.results as any[]).length} movements · {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusPill(s.results as any[])}
                        {!isViewing && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleSelect(i); }}
                            className={`text-[10px] px-2 py-0.5 rounded border font-display uppercase tracking-wider transition-colors ${
                              isSelected ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                            }`}
                          >
                            Compare
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Detail / Compare panel */}
          <div>
            {selectedSession !== null ? (() => {
              const s = sortedSessions[selectedSession];
              if (!s) return null;
              const results = s.results as any[];
              const regionStatus = computeRegionStatus(results);
              const d = new Date(s.date);
              return (
                <div className="bg-card rounded-xl p-5 border border-primary/30 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-primary">
                        {s.checkpoint || `Week ${s.week}`}
                      </h3>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    {statusPill(results)}
                  </div>

                  {/* Chain map */}
                  <ChainMap regionStatus={regionStatus} />

                  {/* Coach note */}
                  {s.note && (
                    <div className="bg-background border-l-[3px] border-primary rounded-r-xl p-4 text-sm leading-relaxed text-muted-foreground">
                      <div dangerouslySetInnerHTML={{ __html: s.note }} />
                      <span className="font-display text-primary uppercase tracking-wider font-bold text-sm mt-2 block">— Coach Nick</span>
                    </div>
                  )}

                  {/* Metrics by movement */}
                  <div className="space-y-3">
                    {results.map((r: any) => {
                      const mv = MOVES[r.key];
                      if (!mv) return null;
                      const metrics = allMetrics(mv).filter((m: any) => !m.info && r.vals[m.id] != null);
                      if (!metrics.length) return null;
                      return (
                        <div key={r.key} className="bg-background rounded-xl p-4 border border-border">
                          <div className="font-display text-sm font-extrabold uppercase tracking-wider mb-2">{mv.name}</div>
                          <div className="space-y-1.5">
                            {metrics.map((m: any) => {
                              const v = r.vals[m.id];
                              const level = metricLevel(m, v);
                              const display = fmt(m, v);
                              return (
                                <div key={m.id} className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">{m.name}</span>
                                  <span className={`font-bold ${
                                    level === "good" ? "text-good" : level === "warn" ? "text-warn" : "text-bad"
                                  }`}>{display}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setSelectedSession(null)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Close
                  </button>
                </div>
              );
            })() : compareSel.length === 2 ? (
              renderCompare()
            ) : compareSel.length === 1 ? (
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-display text-lg font-extrabold uppercase tracking-wide text-gold mb-2">Select one more</h3>
                <p className="text-sm text-muted-foreground">Tap Compare on another session to compare side by side.</p>
              </div>
            ) : (
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-display text-lg font-extrabold uppercase tracking-wide text-gold mb-2">Your Results</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Tap any session on the left to see the full results from that checkpoint — exact numbers, chain map, and coach note. Hit Compare on two sessions to see what's clearing and what's not.
                </p>
              </div>
            )}
          </div>
        </div>

        <Button variant="outline" onClick={() => navigate("/dashboard")} className="font-display uppercase tracking-wider font-bold">
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
