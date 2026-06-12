import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { MOVES, allMetrics, metricLevel, fmt } from "@/lib/moveLibrary";
import { computeScanStatus, computeTrend } from "@/lib/scanUtils";

export default function SessionHistory() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [compareSel, setCompareSel] = useState<number[]>([]);

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
              Tap two sessions to compare them side by side.
            </p>
            <div className="space-y-2">
              {sortedSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scans yet. Your first one is your baseline ... run it from the New Scan tab.</p>
              ) : (
                sortedSessions.map((s, i) => {
                  const d = new Date(s.date);
                  const isSelected = compareSel.includes(i);
                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleSelect(i)}
                      className={`flex justify-between items-center rounded-xl p-3 border cursor-pointer transition-all ${
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
                      {statusPill(s.results as any[])}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Compare panel */}
          <div>
            {compareSel.length === 2 ? (
              renderCompare()
            ) : compareSel.length === 1 ? (
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-display text-lg font-extrabold uppercase tracking-wide text-gold mb-2">
                  Select one more
                </h3>
                <p className="text-sm text-muted-foreground">
                  Tap another session to compare side by side.
                </p>
              </div>
            ) : (
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-display text-lg font-extrabold uppercase tracking-wide text-gold mb-2">
                  Compare
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Select two sessions on the left. You'll see every shared metric with a trend arrow ... green means the chain is clearing, red means a link needs attention.
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
