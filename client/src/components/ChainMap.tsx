interface ChainMapProps {
  regionStatus: Record<string, number>;
}

export default function ChainMap({ regionStatus }: ChainMapProps) {
  const col = (r: string) => {
    const status = regionStatus[r];
    if (status === undefined) return "#4a5178";
    if (status === 0) return "#34D399";
    if (status === 1) return "#FBBF24";
    return "#F87171";
  };

  return (
    <div className="flex justify-center py-2">
      <svg width="170" height="320" viewBox="0 0 170 320">
        <circle cx="85" cy="32" r="20" fill="none" stroke={col("shoulders")} strokeWidth="5" />
        <line x1="50" y1="72" x2="120" y2="72" stroke={col("shoulders")} strokeWidth="8" strokeLinecap="round" />
        <line x1="85" y1="72" x2="85" y2="140" stroke={col("core")} strokeWidth="8" strokeLinecap="round" />
        <line x1="55" y1="148" x2="115" y2="148" stroke={col("hips")} strokeWidth="8" strokeLinecap="round" />
        <line x1="62" y1="148" x2="58" y2="215" stroke={col("knees")} strokeWidth="7" strokeLinecap="round" />
        <line x1="108" y1="148" x2="112" y2="215" stroke={col("knees")} strokeWidth="7" strokeLinecap="round" />
        <circle cx="58" cy="220" r="6" fill={col("knees")} />
        <circle cx="112" cy="220" r="6" fill={col("knees")} />
        <line x1="58" y1="226" x2="56" y2="290" stroke={col("ankles")} strokeWidth="7" strokeLinecap="round" />
        <line x1="112" y1="226" x2="114" y2="290" stroke={col("ankles")} strokeWidth="7" strokeLinecap="round" />
        <line x1="56" y1="295" x2="44" y2="295" stroke={col("ankles")} strokeWidth="7" strokeLinecap="round" />
        <line x1="114" y1="295" x2="126" y2="295" stroke={col("ankles")} strokeWidth="7" strokeLinecap="round" />
        <text x="135" y="76" fill="#8a93b5" fontSize="9" fontFamily="Inter">SHOULDERS</text>
        <text x="95" y="110" fill="#8a93b5" fontSize="9" fontFamily="Inter">CORE</text>
        <text x="122" y="152" fill="#8a93b5" fontSize="9" fontFamily="Inter">HIPS</text>
        <text x="122" y="222" fill="#8a93b5" fontSize="9" fontFamily="Inter">KNEES</text>
        <text x="130" y="285" fill="#8a93b5" fontSize="9" fontFamily="Inter">ANKLES</text>
      </svg>
    </div>
  );
}
