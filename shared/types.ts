// Chain Check shared types used by both client and server

export type Program = "rebuild" | "restart" | "perform";

export type ScanStatus = "CLEAN" | "WATCH" | "FLAGS";

export type TrendLabel = "clearing" | "watch" | "steady";

export type MetricLevel = "good" | "warn" | "bad";

export type RegionName = "shoulders" | "core" | "hips" | "knees" | "ankles";

export interface Checkpoint {
  id: string;
  label: string;
  targetWeek: number;
  baseline?: boolean;
}

export const CHECKPOINTS: Checkpoint[] = [
  { id: "baseline", label: "Baseline", targetWeek: 0, baseline: true },
  { id: "wk2", label: "Week 2", targetWeek: 2 },
  { id: "wk4", label: "Week 4", targetWeek: 4 },
  { id: "wk6", label: "Week 6", targetWeek: 6 },
  { id: "wk8", label: "Week 8", targetWeek: 8 },
  { id: "wk10", label: "Week 10", targetWeek: 10 },
  { id: "wk12", label: "Week 12", targetWeek: 12 },
  { id: "wk14", label: "Week 14", targetWeek: 14 },
  { id: "wk16", label: "Week 16", targetWeek: 16 },
];

export interface ScanResult {
  key: string;
  vals: Record<string, number>;
}

export interface SessionPayload {
  date: string;
  week: number;
  checkpoint: string;
  checkpointId: string;
  isBaseline: boolean;
  results: ScanResult[];
  note: string;
  clientFeedback?: string;
}

export const REGION_ORDER: RegionName[] = ["shoulders", "core", "hips", "knees", "ankles"];

export const REGION_LABELS: Record<RegionName, string> = {
  shoulders: "Shoulders & Head",
  core: "Core & Torso",
  hips: "Hips & Pelvis",
  knees: "Knees",
  ankles: "Ankles",
};
