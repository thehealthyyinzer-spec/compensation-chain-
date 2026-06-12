import { CHECKPOINTS } from "@shared/types";

interface RoadmapProps {
  doneCount: number;
  currentIdx: number;
  allDone: boolean;
}

export default function Roadmap({ doneCount, currentIdx, allDone }: RoadmapProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-2 px-0.5">
      {CHECKPOINTS.map((c, i) => {
        let state: "done" | "current" | "locked";
        let stateTxt: string;
        let mark: string;

        if (i < doneCount) {
          state = "done";
          stateTxt = "Done";
          mark = "✓";
        } else if (i === currentIdx && !allDone) {
          state = "current";
          stateTxt = "You're here";
          mark = "●";
        } else {
          state = "locked";
          stateTxt = `Wk ${c.targetWeek}`;
          mark = String(i + 1);
        }

        return (
          <div
            key={c.id}
            className={`flex-shrink-0 min-w-[96px] rounded-xl p-3 text-center border ${
              state === "done"
                ? "border-green-400"
                : state === "current"
                ? "border-orange shadow-[0_0_0_1px] shadow-orange"
                : "border-border opacity-50"
            } bg-background`}
          >
            <div className={`font-display text-sm font-extrabold uppercase tracking-wider ${
              c.baseline ? "text-gold" : ""
            }`}>
              {c.baseline ? "Base" : c.label.replace("Week ", "Wk ")}
            </div>
            <div className={`text-[10px] uppercase tracking-wider font-bold mt-1 ${
              state === "done"
                ? "text-good"
                : state === "current"
                ? "text-orange"
                : "text-muted-foreground"
            }`}>
              {stateTxt}
            </div>
            <div className={`w-5 h-5 rounded-full mx-auto mt-2 flex items-center justify-center text-xs font-extrabold font-display ${
              state === "done"
                ? "bg-good text-background"
                : state === "current"
                ? "bg-orange text-white"
                : "bg-muted text-muted-foreground"
            }`}>
              {mark}
            </div>
          </div>
        );
      })}
    </div>
  );
}
