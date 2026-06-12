import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FULL_BATTERY, MOVES } from "@/lib/moveLibrary";

export default function ScanPage() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [selectedMoves, setSelectedMoves] = useState<string[]>([...FULL_BATTERY]);

  // Admin can also access scan page for testing
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
    // Store selected moves and navigate to the scan engine
    sessionStorage.setItem("chaincheck-battery", JSON.stringify(selectedMoves));
    navigate("/scan/live");
  };

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
            onClick={startScan}
            disabled={selectedMoves.length === 0}
            className="w-full mt-5 font-display text-lg font-extrabold uppercase tracking-wider"
          >
            Begin Session
          </Button>
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
