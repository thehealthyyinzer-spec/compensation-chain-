import { useState } from "react";
import type { Citation } from "@/lib/progressionLogic";

interface ResearchPanelProps {
  citations: Citation[];
}

/**
 * Displays research citations relevant to the scan's watch areas.
 * Used on both the paid ScanResults and the free scan result screen.
 */
export default function ResearchPanel({ citations }: ResearchPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!citations || citations.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <div>
            <div className="font-display text-sm font-extrabold uppercase tracking-wider">
              Research Behind This Screen
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {citations.length} research {citations.length === 1 ? "source" : "sources"} · Evidence-informed, not a diagnosis
            </div>
          </div>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          className={`text-muted-foreground transition-transform duration-200 flex-shrink-0 ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            The screening ranges and chain-pattern logic are informed by biomechanics and sports medicine research. These studies help guide the conversation, but they do not diagnose an injury or replace a clinician's assessment.
          </p>
          <div className="space-y-3">
            {citations.map((c) => (
              <div key={c.id} className="bg-background rounded-xl p-4 border border-border">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="font-display text-xs font-bold uppercase tracking-wider text-primary">
                    {c.journal} · {c.year}
                  </div>
                  {(c.doi || c.pmcid) && (
                    <a
                      href={c.pmcid ? `https://pmc.ncbi.nlm.nih.gov/articles/${c.pmcid}/` : `https://doi.org/${c.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary hover:underline flex-shrink-0 font-semibold"
                    >
                      View →
                    </a>
                  )}
                </div>
                <p className="text-xs font-semibold text-foreground mb-1 leading-snug">{c.title}</p>
                <p className="text-[10px] text-muted-foreground mb-2">{c.authors}</p>
                <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-foreground leading-relaxed italic">
                    "{c.finding}"
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
            This is a movement screen, not a diagnosis. Readings depend on camera angle, lighting, clothing, and how you felt that day. Consult a qualified clinician for pain, injury, numbness, tingling, swelling, or medical advice.
          </p>
        </div>
      )}
    </div>
  );
}
