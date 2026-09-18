"use client";

// Single source of truth for the guest print flow. Steps read and write here;
// adding/removing a step never touches another step's code.
import {
  createContext,
  MutableRefObject,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Effect,
  Frame,
  Orientation,
  PhotoTransform,
  PrintInfo,
  SessionInfo,
} from "@/core/models";
import type { ProcessedPhoto } from "./photo";

// The step sequence. Insert/remove entries here to change the flow.
export const FLOW_STEPS = ["welcome", "editor", "confirm", "printing"] as const;
export type StepId = (typeof FLOW_STEPS)[number];

const INITIAL_TRANSFORM: PhotoTransform = { x: 0, y: 0, scale: 1.5, rotation: 0 };

interface FlowState {
  step: StepId;
  session: SessionInfo | null;
  photo: ProcessedPhoto | null;
  orientation: Orientation;
  frameIndex: number;
  effect: Effect;
  transform: PhotoTransform;
  clientId: string;
  print: PrintInfo | null;

  /** measured on-screen width of the preview sheet (compositor scale basis) */
  previewWidth: MutableRefObject<number>;

  frames: Frame[];
  currentFrame: Frame | null;

  setSession: (session: SessionInfo) => void;
  setEffect: (effect: Effect) => void;
  setTransform: (transform: PhotoTransform) => void;
  setClientId: (clientId: string) => void;
  setPrint: (print: PrintInfo) => void;

  next: () => void;
  back: () => void;
  /** Called when a (new) photo is chosen: pick preferred orientation, reset placement. */
  setPhoto: (photo: ProcessedPhoto) => void;
  /** Step through ALL frames (both orientations); the layout follows the frame. */
  cycleFrame: (stepBy: number) => void;
  rememberClientId: () => void;
}

const FlowContext = createContext<FlowState | null>(null);

export function FlowProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<StepId>("welcome");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [photo, setPhotoState] = useState<ProcessedPhoto | null>(null);
  const [preferred, setPreferred] = useState<Orientation>("vertical");
  const [frameIndex, setFrameIndex] = useState(0);
  const [effect, setEffect] = useState<Effect>("normal");
  const [transform, setTransform] = useState<PhotoTransform>({ ...INITIAL_TRANSFORM });
  const [clientId, setClientId] = useState("");
  const [print, setPrint] = useState<PrintInfo | null>(null);

  const previewWidth = useRef(320);
  const clientIdRef = useRef(clientId);
  clientIdRef.current = clientId;

  // localStorage isn't available while the static page is prerendered
  useEffect(() => {
    setClientId(localStorage.getItem("clientID") ?? "");
  }, []);

  // one list for the arrows: frames matching the photo first, then the other layout
  const frames = useMemo<Frame[]>(() => {
    const other: Orientation = preferred === "vertical" ? "horizontal" : "vertical";
    return [...(session?.frames[preferred] ?? []), ...(session?.frames[other] ?? [])];
  }, [session, preferred]);
  const currentFrame = frames[frameIndex] ?? null;
  const orientation: Orientation = currentFrame?.orientation ?? preferred;

  const next = useCallback(() => {
    setStep((cur) => {
      const i = FLOW_STEPS.indexOf(cur);
      return i < FLOW_STEPS.length - 1 ? FLOW_STEPS[i + 1] : cur;
    });
  }, []);

  const back = useCallback(() => {
    setStep((cur) => {
      const i = FLOW_STEPS.indexOf(cur);
      return i > 0 ? FLOW_STEPS[i - 1] : cur;
    });
  }, []);

  const setPhoto = useCallback((next: ProcessedPhoto) => {
    setPhotoState(next);
    setTransform({ ...INITIAL_TRANSFORM });
    setFrameIndex(0);

    setPreferred(next.width > next.height ? "horizontal" : "vertical");
  }, []);

  const cycleFrame = useCallback(
    (stepBy: number) => {
      const n = frames.length;
      if (n === 0) return;
      const nextIndex = (frameIndex + stepBy + n) % n;
      // a different layout changes the sheet shape — re-centre the photo
      if (frames[nextIndex].orientation !== frames[frameIndex]?.orientation) {
        setTransform({ ...INITIAL_TRANSFORM });
      }
      setFrameIndex(nextIndex);
    },
    [frames, frameIndex]
  );

  const rememberClientId = useCallback(() => {
    localStorage.setItem("clientID", clientIdRef.current.trim());
  }, []);

  const value: FlowState = {
    step,
    session,
    photo,
    orientation,
    frameIndex,
    effect,
    transform,
    clientId,
    print,
    previewWidth,
    frames,
    currentFrame,
    setSession,
    setEffect,
    setTransform,
    setClientId,
    setPrint,
    next,
    back,
    setPhoto,
    cycleFrame,
    rememberClientId,
  };
  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow() {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error("useFlow outside FlowProvider");
  return ctx;
}
