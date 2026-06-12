import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { CHECKPOINTS } from "@shared/types";
import ChainMap from "@/components/ChainMap";
import Roadmap from "@/components/Roadmap";
import { computeRegionStatus, computeScanStatus } from "@/lib/scanUtils";

export default function ClientDashboard() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const { data: clientProfile, isLoading: profileLoading } = trpc.clientProfile.me.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: sessions, isLoading: sessionsLoading } = trpc.scan.mySessions.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (authLoading || profileLoading || sessionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  const doneCount = sessions?.length || 0;
  const cpIdx = Math.min(doneCount, CHECKPOINTS.length - 1);
  const currentCp = CHECKPOINTS[cpIdx];
  const allDone = doneCount >= CHECKPOINTS.length;

  const programWeek = clientProfile?.startDate
    ? Math.max(0, Math.min(16, Math.floor((Date.now() - new Date(clientProfile.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000))))
    : 0;

  const latestSession = sessions && sessions.length > 0 ? sessions[0] : null;
  const regionStatus = latestSession ? computeRegionStatus(latestSession.results as any) : {};

  const latestNote = latestSession?.note || "No scan yet. Your first one is your baseline ... that's the reading every future checkpoint gets compared against. Don't judge it, just own it.";

  const scanBtnLabel = doneCount === 0
    ? "Run My Baseline Scan"
    : allDone
    ? "Run an Extra Scan"
    : `Run My ${currentCp.label} Check`;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-wide uppercase">
            THE HEALTHY <span className="text-teal">YINZER</span>
          </h1>
          <p className="text-xs text-muted-foreground tracking-wide">
            Your Chain Dashboard ... rebuild it link by link
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-bold tracking-wide">
            {clientProfile?.name || user?.name || "Client"}
          </span>
          {clientProfile?.program && (
            <span className={`font-display text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full border ${
              clientProfile.program === "rebuild"
                ? "border-orange text-orange bg-orange/10"
                : "border-primary text-primary bg-primary/10"
            }`}>
              {clientProfile.program}
            </span>
          )}
        </div>
      </header>

      <div className="container py-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="font-display text-3xl font-extrabold text-teal">
              {doneCount} / {CHECKPOINTS.length}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
              Checkpoints done
            </div>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="font-display text-3xl font-extrabold text-teal">
              Wk {programWeek}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
              Program week
            </div>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className={`font-display text-3xl font-extrabold ${allDone ? "text-teal" : "text-orange"}`}>
              {allDone ? "DONE" : doneCount === 0 ? "BASE" : currentCp.label.replace("Week ", "Wk ")}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
              Up next
            </div>
          </div>
        </div>

        {/* Roadmap */}
        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-gold mb-3">
            Your {clientProfile?.program === "restart" ? "Restart" : "Rebuild"} Roadmap
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            It starts with a baseline ... the reading we measure everything against. Then we re-scan every two weeks to watch the chain rebuild.
          </p>
          <Roadmap doneCount={doneCount} currentIdx={cpIdx} allDone={allDone} />
        </div>

        {/* Chain Map + Coach Note */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card rounded-xl p-5 border border-border">
            <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-gold mb-3">
              Your Chain Map
            </h3>
            <ChainMap regionStatus={regionStatus} />
            <div className="flex gap-4 justify-center mt-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-good" /> Holding strong
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-warn" /> Watch this link
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-bad" /> Chain breakdown
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-muted" /> Not scanned yet
              </span>
            </div>
          </div>

          <div className="bg-card rounded-xl p-5 border border-border">
            <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-gold mb-3">
              Latest Note From Coach Nick
            </h3>
            <div className="bg-background border-l-[3px] border-primary rounded-r-xl p-4 text-sm leading-relaxed text-muted-foreground">
              <div dangerouslySetInnerHTML={{ __html: latestNote }} />
              <span className="font-display text-primary uppercase tracking-wider font-bold text-sm mt-2 block">
                — Coach Nick
              </span>
            </div>
            <Button
              onClick={() => navigate("/scan")}
              className="w-full mt-4 font-display text-lg font-extrabold uppercase tracking-wider"
            >
              {scanBtnLabel}
            </Button>
          </div>
        </div>

        {/* Social Proof — results-based client stories */}
        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-display text-base font-extrabold uppercase tracking-wide text-muted-foreground mb-4">
            What the Chain Looks Like When It Clears
          </h3>
          <div className="space-y-4">
            <div className="border-l-2 border-primary/40 pl-4">
              <p className="text-sm text-foreground leading-relaxed">
                "11 years of knee pain. Doctors said it was the knee. Coach Nick traced it to my ankles in the first scan. Four checkpoints in, the knee pain is gone."
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 font-semibold">Rebuild client · Week 8</p>
            </div>
            <div className="border-l-2 border-primary/40 pl-4">
              <p className="text-sm text-foreground leading-relaxed">
                "I thought my lower back was the problem. It wasn't. My hips weren't loading. Six weeks of the protocol and I'm back to deadlifting without pain."
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 font-semibold">Rebuild client · Week 6</p>
            </div>
            <div className="border-l-2 border-primary/40 pl-4">
              <p className="text-sm text-foreground leading-relaxed">
                "I'd been told to stretch my hamstrings for years. Turns out my ankles were the problem the whole time. The chain made it obvious."
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 font-semibold">Restart client · Week 4</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-4 italic">
            Results are specific to each client's compensation pattern. The scan reads your chain, not a generic template.
          </p>
        </div>

        {/* Navigation */}
        <div className="flex gap-3 flex-wrap">
          <Button variant="outline" onClick={() => navigate("/scan")} className="font-display uppercase tracking-wider font-bold">
            New Scan
          </Button>
          <Button variant="outline" onClick={() => navigate("/history")} className="font-display uppercase tracking-wider font-bold">
            History & Compare
          </Button>
        </div>
      </div>
    </div>
  );
}
