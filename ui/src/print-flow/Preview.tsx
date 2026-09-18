"use client";

// The framed-photo preview. Used by the editor (interactive) and the confirm
// step (static). Its DOM mirrors the compositor math 1:1 — photo contain-fit
// in the sheet, user transform about the center, frame PNG on top.
import { ReactNode, RefObject, useRef } from "react";
import { asset } from "@/core/config";
import { EFFECT_FILTERS } from "@/core/models";
import { useFlow } from "./flow-state";
import { useGestures } from "./useGestures";
import "./preview.scss";

interface Props {
  interactive?: boolean;
  showHint?: boolean;
  /** lets the parent read the rendered sheet width (compositor's previewWidth) */
  sheetRef?: RefObject<HTMLDivElement | null>;
  children?: ReactNode;
}

export function Preview({ interactive = false, showHint = false, sheetRef, children }: Props) {
  const state = useFlow();
  const ownRef = useRef<HTMLDivElement>(null);
  const ref = sheetRef ?? ownRef;

  useGestures(ref, {
    transform: state.transform,
    onTransformChange: state.setTransform,
    disabled: !interactive,
    rotateEnabled: true,
  });

  const { photo, currentFrame, orientation, transform: t } = state;

  /** contain-fit: photo wider than the sheet window → fit by width */
  const sheetAspect = orientation === "vertical" ? 210 / 297 : 297 / 210;
  const photoIsWide = photo ? photo.width / photo.height > sheetAspect : false;

  return (
    <div className="snk-preview">
      <div ref={ref} className={`sheet ${orientation}`}>
        {photo && (
          <img
            className={`photo${photoIsWide ? " wide" : ""}`}
            src={photo.previewUrl}
            style={{
              filter: EFFECT_FILTERS[state.effect],
              transform: `translate(calc(-50% + ${t.x}px), calc(-50% + ${t.y}px)) rotate(${t.rotation}rad) scale(${t.scale})`,
            }}
            alt="your photo"
            draggable={false}
          />
        )}
        {currentFrame && (
          <img className="frame" src={asset(currentFrame.previewUrl)} alt="frame" draggable={false} />
        )}
        {interactive && showHint && (
          <img className="hint" src="/assets/images/dragToPosition.png" alt="drag to reposition" />
        )}
        {children}
      </div>
    </div>
  );
}
