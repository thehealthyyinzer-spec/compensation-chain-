import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FULL_BATTERY, MOVES } from "@/lib/moveLibrary";
import { trpc } from "@/lib/trpc";

export default function ScanPage() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedMoves, setSelectedMoves] = useState<string[]>([...FULL_BATTERY]);
  const [showTutorial, setShowTutorial] = useState(false);

  // Check if client has completed at least one scan (returning client)
  const { data: sessions } = trpc.scan.mySessions.useQuery(undefined, { enabled: isAuthenticated });
  const hasCompletedScan = (sessions?.length || 0) > 0;

  // localStorage flag for manual "don't show again" preference
  const [skipPref, setSkipPref] = useState(() => localStorage.getItem("chaincheck-skip-tutorial") === "true");

  const shouldSkipTutorial = hasCompletedScan || skipPref;

  // Wait for auth to load before deciding
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  const toggleMove = (key: string) => {
    setSelectedMoves((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const startScan = () => {
    sessionStorage.setItem("chaincheck-battery", JSON.stringify(selectedMoves));
    navigate("/scan/live");
  };

  // Pre-scan tutorial screen
  if (showTutorial) {
    return (
      <div className="min-h-screen">
        <header className="border-b border-border px-4 py-3">
          <h1 className="font-display text-2xl font-extrabold tracking-wide uppercase">
            THE HEALTHY <span className="text-teal">YINZER</span>
          </h1>
        </header>

        <div className="container py-6 max-w-lg mx-auto">
          <div className="bg-card rounded-xl p-6 border border-border space-y-6">
            <div className="text-center">
              <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-gold mb-2">
                Before You Start
              </h2>
              <p className="text-sm text-muted-foreground">
                Get set up right and the scan takes care of itself.
              </p>
            </div>

            {/* Phone positioning */}
            <div className="space-y-4">
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
                  <span className="font-display text-lg font-extrabold text-primary">1</span>
                </div>
                <div>
                  <h3 className="font-display text-base font-bold uppercase tracking-wide mb-1">
                    Prop your phone up
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Lean it against a wall, a water bottle, or a stack of books. Camera at about hip height works best. Landscape or portrait ... either works.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
                  <span className="font-display text-lg font-extrabold text-primary">2</span>
                </div>
                <div>
                  <h3 className="font-display text-base font-bold uppercase tracking-wide mb-1">
                    Step back 6–8 feet
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The scanner needs to see your full body from head to feet. If it says "no body detected" ... step back a little more.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
                  <span className="font-display text-lg font-extrabold text-primary">3</span>
                </div>
                <div>
                  <h3 className="font-display text-base font-bold uppercase tracking-wide mb-1">
                    Face the camera first
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Most movements start facing the camera. When it's time to turn sideways, the screen will tell you. You'll hear a ding each time a rep counts.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center flex-shrink-0">
                  <span className="font-display text-lg font-extrabold text-orange">!</span>
                </div>
                <div>
                  <h3 className="font-display text-base font-bold uppercase tracking-wide mb-1">
                    Move how you actually move
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Don't try to look good. Don't fix anything. The whole point is to read your real patterns ... that's what gives Coach Nick the map.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick checklist */}
            <div className="bg-background rounded-xl p-4 border border-border">
              <h4 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Quick checklist
              </h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Good lighting ... the scanner needs to see you clearly
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Fitted clothes or shorts ... baggy stuff hides the joints
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Shoes off if you can ... especially for ankle mobility
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Clear space around you ... no furniture in the way
                </li>
              </ul>
            </div>

            <Button
              onClick={startScan}
              className="w-full font-display text-lg font-extrabold uppercase tracking-wider"
            >
              I'm Ready — Start Camera
            </Button>

            {!hasCompletedScan && (
              <label className="flex items-center justify-center gap-2 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipPref}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setSkipPref(val);
                    localStorage.setItem("chaincheck-skip-tutorial", val ? "true" : "false");
                  }}
                  className="w-4 h-4 rounded border-border accent-primary"
                />
                <span className="text-xs text-muted-foreground">Don't show this next time</span>
              </label>
            )}

            <button
              onClick={() => setShowTutorial(false)}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
            >
              ← Back to battery selection
            </button>
          </div>
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

      <div className="container py-6">
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-4">
            <h3 className="font-display text-lg font-extrabold uppercase tracking-wider text-primary">
              This is your Baseline
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mt-1">
              This first scan is the reading we measure everything against for the next 16 weeks. Don't fix anything or try to look good ... move how you actually move. That's the whole point.
            </p>
          </div>

          <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-gold mb-2">
            Build Your Session
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            The full battery keeps your history clean and comparable ... every checkpoint should run the same movements. Tap to toggle if Coach Nick told you to focus on specific ones.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FULL_BATTERY.map((key) => {
              const mv = MOVES[key];
              const isSelected = selectedMoves.includes(key);
              return (
                <div
                  key={key}
                  onClick={() => toggleMove(key)}
                  className={`rounded-xl p-4 border cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="font-display text-base font-extrabold uppercase tracking-wide">
                      {mv.name}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      mv.view === "front" || mv.view === "both"
                        ? "bg-primary/15 text-primary"
                        : "bg-gold/15 text-gold"
                    }`}>
                      {mv.view}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {mv.type === "reps" ? "5 front + 5 side reps" : mv.hold ? `${mv.hold}s hold` : "Multi-phase hold"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {mv.desc}
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            onClick={() => {
              if (shouldSkipTutorial) {
                sessionStorage.setItem("chaincheck-battery", JSON.stringify(selectedMoves));
                navigate("/scan/live");
              } else {
                setShowTutorial(true);
              }
            }}
            disabled={selectedMoves.length === 0}
            className="w-full mt-5 font-display text-lg font-extrabold uppercase tracking-wider"
          >
            Begin Session
          </Button>

          {shouldSkipTutorial && (
            <button
              onClick={() => setShowTutorial(true)}
              className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Show setup instructions
            </button>
          )}
        </div>

        <Button
          variant="outline"
          onClick={() => navigate("/dashboard")}
          className="mt-4 font-display uppercase tracking-wider font-bold"
        >
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
