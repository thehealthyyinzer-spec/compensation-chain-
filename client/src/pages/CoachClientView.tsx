import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { MOVES, allMetrics, metricLevel, fmt, REGION_ORDER, REGION_LABELS } from "@/lib/moveLibrary";
import { computeScanStatus, computeRegionStatus } from "@/lib/scanUtils";
import { detectProgressionFlags } from "@/lib/progressionLogic";
import ChainMap from "@/components/ChainMap";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function CoachClientView() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ clientId: string }>();
  const clientId = parseInt(params.clientId || "0");

  const { data: clientDetail, isLoading: clientLoading } = trpc.admin.clientDetail.useQuery(
    { clientId },
    { enabled: isAuthenticated && user?.role === "admin" && !!clientId }
  );

  const { data: sessions, isLoading: sessionsLoading } = trpc.admin.clientSessions.useQuery(
    { clientId },
    { enabled: isAuthenticated && user?.role === "admin" && !!clientId }
  );

  if (authLoading || clientLoading || sessionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    navigate("/login");
    return null;
  }

  if (!clientDetail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Client not found.</p>
      </div>
    );
  }

  const sortedSessions = sessions ? [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) : [];
  const latestSession = sortedSessions.length > 0 ? sortedSessions[sortedSessions.length - 1] : null;
  const regionStatus = latestSession ? computeRegionStatus(latestSession.results as any[]) : {};

  // Build trend data for charts
  const buildTrendData = () => {
    if (!sortedSessions.length) return [];
    const metricKeys = new Set<string>();
    sortedSessions.forEach((s) => {
      (s.results as any[]).forEach((r: any) => {
        const mv = MOVES[r.key];
        if (!mv) return;
        allMetrics(mv).forEach((m) => {
          if (!m.info && r.vals[m.id] != null) {
            metricKeys.add(`${r.key}:${m.id}`);
          }
        });
      });
    });

    return sortedSessions.map((s) => {
      const point: Record<string, any> = { label: s.checkpoint || `Wk ${s.week}` };
      (s.results as any[]).forEach((r: any) => {
        const mv = MOVES[r.key];
        if (!mv) return;
        allMetrics(mv).forEach((m) => {
          if (!m.info && r.vals[m.id] != null) {
            point[`${mv.name} · ${m.name}`] = Math.abs(r.vals[m.id]);
          }
        });
      });
      return point;
    });
  };

  const trendData = buildTrendData();
  const metricNames = trendData.length > 0 ? Object.keys(trendData[0]).filter((k) => k !== "label") : [];

  const COLORS = ["#00B4D8", "#F97316", "#34D399", "#FBBF24", "#F87171", "#A78BFA", "#EC4899", "#6EE7B7"];

  // Progression flags — detect persistent patterns across sessions
  const progressionFlags = detectProgressionFlags(
    sortedSessions.map((s) => ({
      results: s.results as any[],
      checkpointId: s.checkpointId,
      week: s.week,
    }))
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-wide uppercase">
            CHAIN CHECK <span className="text-teal">COACH</span>
          </h1>
        </div>
        <Button variant="outline" onClick={() => navigate("/coach")} className="font-display text-xs uppercase tracking-wider font-bold">
          ← All Clients
        </Button>
      </header>

      <div className="container py-6 space-y-5">
        {/* Client header */}
        <div className="bg-card rounded-xl p-5 border border-border flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-wide">{clientDetail.name}</h2>
            <p className="text-sm text-muted-foreground">
              {clientDetail.program.toUpperCase()} · {clientDetail.email} · {sortedSessions.length} scans
            </p>
          </div>
          {latestSession && (
            <span className={`text-sm font-bold px-3 py-1.5 rounded-full font-display tracking-wider ${
              computeScanStatus(latestSession.results as any[]) === "CLEAN"
                ? "bg-good/15 text-good"
                : computeScanStatus(latestSession.results as any[]) === "WATCH"
                ? "bg-warn/15 text-warn"
                : "bg-bad/15 text-bad"
            }`}>
              {computeScanStatus(latestSession.results as any[])}
            </span>
          )}
        </div>

        {/* Progression Flags — Protocol Suggestions */}
        {progressionFlags.length > 0 && (
          <div className="bg-card rounded-xl p-5 border border-orange/40">
            <h3 className="font-display text-lg font-extrabold uppercase tracking-wide text-orange mb-1">
              Program Adjustment Needed
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              These patterns have persisted across {sortedSessions.length} scans. Time to adjust the block.
            </p>
            <div className="space-y-4">
              {progressionFlags.map((flag) => (
                <div key={flag.pattern} className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full font-display tracking-wider ${
                          flag.protocol.priority === "high" ? "bg-bad/15 text-bad" : "bg-warn/15 text-warn"
                        }`}>
                          {flag.protocol.priority === "high" ? "HIGH PRIORITY" : "MONITOR"}
                        </span>
                        <span className="text-xs text-muted-foreground">{flag.sessionCount} scans</span>
                      </div>
                      <h4 className="font-display text-base font-extrabold uppercase tracking-wide">
                        {flag.protocol.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{flag.label}</p>
                    </div>
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground italic leading-relaxed">
                      "{flag.protocol.cue}"
                    </p>
                    <p className="text-xs text-primary font-semibold mt-1">— Coach Nick</p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Assign this block:</p>
                    <ul className="space-y-1">
                      {flag.protocol.exercises.map((ex, i) => (
                        <li key={i} className="text-xs text-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">›</span>
                          {ex}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chain Map */}
        {latestSession && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl p-5 border border-border">
              <h3 className="font-display text-lg font-extrabold uppercase tracking-wide text-gold mb-2">
                Latest Chain Map
              </h3>
              <ChainMap regionStatus={regionStatus} />
            </div>
            <div className="bg-card rounded-xl p-5 border border-border">
              <h3 className="font-display text-lg font-extrabold uppercase tracking-wide text-gold mb-2">
                Latest Note
              </h3>
              <div className="bg-background border-l-[3px] border-primary rounded-r-xl p-4 text-sm leading-relaxed text-muted-foreground">
                <div dangerouslySetInnerHTML={{ __html: latestSession.note || "" }} />
                <span className="font-display text-primary uppercase tracking-wider font-bold text-sm mt-2 block">
                  — Coach Nick
                </span>
              </div>
              {latestSession.clientFeedback && (
                <div className="mt-3 bg-accent/10 border border-accent/30 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Client Feedback:</p>
                  <p className="text-sm text-foreground/80">{latestSession.clientFeedback}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Trend Charts */}
        {trendData.length > 1 && (
          <div className="bg-card rounded-xl p-5 border border-border">
            <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-gold mb-4">
              16-Week Trends
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="label" tick={{ fill: "#8a93b5", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#8a93b5", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#1A1F3A", border: "1px solid #2A3050", borderRadius: "8px" }}
                    labelStyle={{ color: "#F8F6F0", fontFamily: "Barlow Condensed", fontWeight: 700 }}
                  />
                  {metricNames.slice(0, 8).map((name, i) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name={name}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-3">
              {metricNames.slice(0, 8).map((name, i) => (
                <span key={name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Session History */}
        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-gold mb-3">
            All Sessions
          </h3>
          <div className="space-y-2">
            {sortedSessions.map((s) => {
              const d = new Date(s.date);
              const status = computeScanStatus(s.results as any[]);
              return (
                <div key={s.id} className="flex justify-between items-center rounded-xl p-3 border border-border">
                  <div>
                    <div className="font-display text-base font-bold tracking-wide">
                      {s.checkpoint || `Week ${s.week}`} · {d.toLocaleDateString([], { month: "short", day: "numeric" })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(s.results as any[]).length} movements · {s.isBaseline ? "Baseline" : `Week ${s.week}`}
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full font-display tracking-wider ${
                    status === "CLEAN" ? "bg-good/15 text-good" : status === "WATCH" ? "bg-warn/15 text-warn" : "bg-bad/15 text-bad"
                  }`}>
                    {status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
