export type Orientation = "vertical" | "horizontal";

export interface Frame {
  id: number;
  orientation: Orientation;
  url: string;
  previewUrl: string;
  position: number;
}

export interface SessionInfo {
  id: number;
  clientName: string;
  eventDate: string | null;
  userMaxPrintCount: number;
  sessionPrintThreshold: number;
  breakMode: boolean;
  queuePaused: boolean;
  frames: { vertical: Frame[]; horizontal: Frame[] };
  queueLength: number;
}

export type PrintStatus =
  | "queued"
  | "submitted"
  | "completed"
  | "failed"
  | "canceled"
  | "needs_attention";

export interface PrintInfo {
  id: number;
  sessionId: number;
  clientId: string;
  url: string;
  layout: string | null;
  effect: string | null;
  copies: number;
  rating: number;
  status: PrintStatus;
  error: string | null;
  createdAt: string;
  printedAt: string | null;
  queuePosition?: number;
}

export interface ApiError {
  error: string;
  code?:
    | "NO_SESSION"
    | "BREAK_MODE"
    | "BANNED"
    | "SESSION_LIMIT"
    | "USER_LIMIT"
    | "BAD_NAME"
    | "BAD_IMAGE"
    | "BAD_DIMENSIONS"
    | "NO_IMAGE";
}

// The user-controlled placement of the photo inside the frame window.
// x/y are px in preview space; scale is unitless; rotation in radians
// (rotation ships disabled in the gesture layer for now — model supports it).
export interface PhotoTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export type Effect = "normal" | "grayscale" | "warm";

export const EFFECT_FILTERS: Record<Effect, string> = {
  normal: "none",
  grayscale: "grayscale(90%)",
  warm: "sepia(0.3) brightness(1.1) saturate(1.2) hue-rotate(-10deg)",
};
