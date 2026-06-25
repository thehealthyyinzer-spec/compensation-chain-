import { useState } from "react";

interface ChainMapProps {
  regionStatus: Record<string, number>;
}

const REGION_LABELS: Record<string, string> = {
  shoulders: "Shoulders & Head",
  core: "Core & Torso",
  hips: "Hips & Pelvis",
  knees: "Knees",
  ankles: "Ankles",
};

const REGION_DESCRIPTIONS: Record<string, Record<number, string>> = {
  shoulders: {
    0: "Shoulders balanced. Head centered. Upper chain holding.",
    1: "Shoulder tilt or forward head detected. Watch this link.",
    2: "Significant shoulder imbalance or forward head posture. Chain breaking here.",
  },
  core: {
    0: "Torso stable. Core bracing under load.",
    1: "Some trunk lean or weight shift. Core not fully stabilizing.",
    2: "Core not bracing. Torso compensating for lower chain breakdown.",
  },
  hips: {
    0: "Hips loading evenly. Glutes firing.",
    1: "Hip asymmetry or weight shift detected. Watch this link.",
    2: "Hip imbalance flagged. Dead glute pattern likely. Chain breaks here.",
  },
  knees: {
    0: "Knees tracking clean. No cave-in detected.",
    1: "Some knee drift under load. Monitor this link.",
    2: "Knee cave-in detected. Almost never a knee problem — starts at hip or ankle.",
  },
  ankles: {
    0: "Ankle mobility within range. Foundation solid.",
    1: "Limited dorsiflexion. Knees and hips compensating.",
    2: "Ankle mobility watch area. When the ankle has less motion available, the knees and hips may change strategy.",
  },
};

const STATUS_COLORS = {
  none: { fill: "oklch(0.25 0.02 265)", stroke: "oklch(0.35 0.04 265)", glow: "none", label: "No data", labelColor: "#6b7280" },
  good: { fill: "oklch(0.75 0.17 160 / 0.15)", stroke: "oklch(0.75 0.17 160)", glow: "oklch(0.75 0.17 160 / 0.4)", label: "Holding strong", labelColor: "#34D399" },
  warn: { fill: "oklch(0.80 0.15 85 / 0.15)", stroke: "oklch(0.80 0.15 85)", glow: "oklch(0.80 0.15 85 / 0.4)", label: "Watch this link", labelColor: "#FBBF24" },
  bad: { fill: "oklch(0.70 0.19 25 / 0.15)", stroke: "oklch(0.70 0.19 25)", glow: "oklch(0.70 0.19 25 / 0.4)", label: "Chain breakdown", labelColor: "#F87171" },
};

function getStatus(val: number | undefined): "none" | "good" | "warn" | "bad" {
  if (val === undefined) return "none";
  if (val === 0) return "good";
  if (val === 1) return "warn";
  return "bad";
}

export default function ChainMap({ regionStatus }: ChainMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const s = (region: string) => STATUS_COLORS[getStatus(regionStatus[region])];
  const statusVal = (region: string) => regionStatus[region];

  const hoveredRegion = hovered;
  const hoveredStatus = hoveredRegion ? getStatus(statusVal(hoveredRegion)) : null;
  const hoveredDesc = hoveredRegion && hoveredStatus !== null
    ? REGION_DESCRIPTIONS[hoveredRegion]?.[statusVal(hoveredRegion) ?? -1] || ""
    : "";

  // Stroke width increases on hover
  const sw = (region: string) => hovered === region ? 11 : 8;
  const swSm = (region: string) => hovered === region ? 9 : 7;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg
          width="200"
          height="360"
          viewBox="0 0 200 360"
          style={{ filter: "drop-shadow(0 0 1px rgba(0,0,0,0.5))" }}
        >
          {/* Glow filter */}
          <defs>
            {["shoulders", "core", "hips", "knees", "ankles"].map((r) => (
              <filter key={r} id={`glow-${r}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation={hovered === r ? "4" : "2"} result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
          </defs>

          {/* HEAD */}
          <g
            onMouseEnter={() => setHovered("shoulders")}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer", transition: "all 0.2s" }}
            filter={`url(#glow-shoulders)`}
          >
            <circle
              cx="100" cy="36" r="22"
              fill={s("shoulders").fill}
              stroke={s("shoulders").stroke}
              strokeWidth={hovered === "shoulders" ? 4 : 3}
              style={{ transition: "all 0.2s" }}
            />
            {/* Face dots */}
            <circle cx="93" cy="33" r="2" fill={s("shoulders").stroke} opacity="0.6" />
            <circle cx="107" cy="33" r="2" fill={s("shoulders").stroke} opacity="0.6" />
            <path d="M 93 42 Q 100 47 107 42" fill="none" stroke={s("shoulders").stroke} strokeWidth="1.5" opacity="0.6" />
          </g>

          {/* NECK */}
          <line x1="100" y1="58" x2="100" y2="72"
            stroke={s("shoulders").stroke} strokeWidth="6" strokeLinecap="round"
            style={{ transition: "all 0.2s" }}
          />

          {/* SHOULDERS bar */}
          <g
            onMouseEnter={() => setHovered("shoulders")}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
            filter={`url(#glow-shoulders)`}
          >
            <line x1="48" y1="78" x2="152" y2="78"
              stroke={s("shoulders").stroke}
              strokeWidth={sw("shoulders")}
              strokeLinecap="round"
              style={{ transition: "all 0.2s" }}
            />
            {/* Shoulder joints */}
            <circle cx="48" cy="78" r="7" fill={s("shoulders").fill} stroke={s("shoulders").stroke} strokeWidth="2" style={{ transition: "all 0.2s" }} />
            <circle cx="152" cy="78" r="7" fill={s("shoulders").fill} stroke={s("shoulders").stroke} strokeWidth="2" style={{ transition: "all 0.2s" }} />
            {/* Arms */}
            <line x1="48" y1="78" x2="30" y2="130" stroke={s("shoulders").stroke} strokeWidth="5" strokeLinecap="round" style={{ transition: "all 0.2s" }} />
            <line x1="152" y1="78" x2="170" y2="130" stroke={s("shoulders").stroke} strokeWidth="5" strokeLinecap="round" style={{ transition: "all 0.2s" }} />
            <circle cx="30" cy="132" r="5" fill={s("shoulders").fill} stroke={s("shoulders").stroke} strokeWidth="2" style={{ transition: "all 0.2s" }} />
            <circle cx="170" cy="132" r="5" fill={s("shoulders").fill} stroke={s("shoulders").stroke} strokeWidth="2" style={{ transition: "all 0.2s" }} />
          </g>

          {/* TORSO / CORE */}
          <g
            onMouseEnter={() => setHovered("core")}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
            filter={`url(#glow-core)`}
          >
            <line x1="100" y1="78" x2="100" y2="158"
              stroke={s("core").stroke}
              strokeWidth={sw("core")}
              strokeLinecap="round"
              style={{ transition: "all 0.2s" }}
            />
          </g>

          {/* HIPS bar */}
          <g
            onMouseEnter={() => setHovered("hips")}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
            filter={`url(#glow-hips)`}
          >
            <line x1="62" y1="162" x2="138" y2="162"
              stroke={s("hips").stroke}
              strokeWidth={sw("hips")}
              strokeLinecap="round"
              style={{ transition: "all 0.2s" }}
            />
            {/* Hip joints */}
            <circle cx="62" cy="162" r="8" fill={s("hips").fill} stroke={s("hips").stroke} strokeWidth="2.5" style={{ transition: "all 0.2s" }} />
            <circle cx="138" cy="162" r="8" fill={s("hips").fill} stroke={s("hips").stroke} strokeWidth="2.5" style={{ transition: "all 0.2s" }} />
          </g>

          {/* UPPER LEGS / KNEES */}
          <g
            onMouseEnter={() => setHovered("knees")}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
            filter={`url(#glow-knees)`}
          >
            {/* Upper legs */}
            <line x1="62" y1="170" x2="60" y2="238"
              stroke={s("knees").stroke}
              strokeWidth={swSm("knees")}
              strokeLinecap="round"
              style={{ transition: "all 0.2s" }}
            />
            <line x1="138" y1="170" x2="140" y2="238"
              stroke={s("knees").stroke}
              strokeWidth={swSm("knees")}
              strokeLinecap="round"
              style={{ transition: "all 0.2s" }}
            />
            {/* Knee joints */}
            <circle cx="60" cy="240" r="9" fill={s("knees").fill} stroke={s("knees").stroke} strokeWidth="2.5" style={{ transition: "all 0.2s" }} />
            <circle cx="140" cy="240" r="9" fill={s("knees").fill} stroke={s("knees").stroke} strokeWidth="2.5" style={{ transition: "all 0.2s" }} />
          </g>

          {/* LOWER LEGS / ANKLES */}
          <g
            onMouseEnter={() => setHovered("ankles")}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
            filter={`url(#glow-ankles)`}
          >
            {/* Lower legs */}
            <line x1="60" y1="249" x2="58" y2="318"
              stroke={s("ankles").stroke}
              strokeWidth={swSm("ankles")}
              strokeLinecap="round"
              style={{ transition: "all 0.2s" }}
            />
            <line x1="140" y1="249" x2="142" y2="318"
              stroke={s("ankles").stroke}
              strokeWidth={swSm("ankles")}
              strokeLinecap="round"
              style={{ transition: "all 0.2s" }}
            />
            {/* Ankle joints */}
            <circle cx="58" cy="320" r="7" fill={s("ankles").fill} stroke={s("ankles").stroke} strokeWidth="2" style={{ transition: "all 0.2s" }} />
            <circle cx="142" cy="320" r="7" fill={s("ankles").fill} stroke={s("ankles").stroke} strokeWidth="2" style={{ transition: "all 0.2s" }} />
            {/* Feet */}
            <line x1="58" y1="327" x2="38" y2="330" stroke={s("ankles").stroke} strokeWidth="6" strokeLinecap="round" style={{ transition: "all 0.2s" }} />
            <line x1="142" y1="327" x2="162" y2="330" stroke={s("ankles").stroke} strokeWidth="6" strokeLinecap="round" style={{ transition: "all 0.2s" }} />
          </g>
        </svg>
      </div>

      {/* Hover tooltip */}
      <div
        className="w-full rounded-xl p-3 border transition-all duration-200 min-h-[72px] flex flex-col justify-center"
        style={{
          borderColor: hoveredRegion ? s(hoveredRegion).stroke : "oklch(0.25 0.02 265)",
          background: hoveredRegion ? `${s(hoveredRegion).fill}` : "transparent",
        }}
      >
        {hoveredRegion ? (
          <>
            <div className="flex items-center justify-between mb-1">
              <span className="font-display text-sm font-extrabold uppercase tracking-wider" style={{ color: s(hoveredRegion).stroke }}>
                {REGION_LABELS[hoveredRegion]}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full font-display tracking-wider"
                style={{ background: `${s(hoveredRegion).fill}`, color: s(hoveredRegion).labelColor, border: `1px solid ${s(hoveredRegion).stroke}` }}>
                {s(hoveredRegion).label}
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "#c8cee6" }}>
              {hoveredDesc || "Hover over a region to see your reading."}
            </p>
          </>
        ) : (
          <p className="text-xs text-center" style={{ color: "#6b7280" }}>
            Hover over any region to see your reading
          </p>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap justify-center text-xs" style={{ color: "#9aa3c0" }}>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#34D399" }} />
          Holding strong
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FBBF24" }} />
          Watch this link
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#F87171" }} />
          Chain breakdown
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#4a5178" }} />
          Not scanned yet
        </span>
      </div>
    </div>
  );
}
