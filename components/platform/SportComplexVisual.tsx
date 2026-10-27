"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { HomeSportTheme, HomeSportVisual } from "@/lib/platform/homeHeroTheme";
import { Icon } from "@/components/ui/Icon";

type Props = {
  theme: HomeSportTheme;
  isNight: boolean;
  onSportChange?: (sportSlug: string) => void;
  courtCounts?: Record<string, number>;
};

type CameraInteraction = {
  panX: number;
  panY: number;
  zoom: number;
  orbit: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
  startOrbit: number;
  mode: "orbit" | "pan";
};

type TouchPoint = { x: number; y: number };

type PinchState = {
  distance: number;
  midpointX: number;
  midpointY: number;
  zoom: number;
  panX: number;
  panY: number;
};

const INITIAL_CAMERA: CameraInteraction = { panX: 0, panY: 0, zoom: 1, orbit: 0 };

const visualToSlug: Partial<Record<HomeSportVisual, string>> = {
  football: "futbol",
  volleyball: "voley",
  basketball: "basquet",
  futsal: "futsal",
};

const visualLabels: Partial<Record<HomeSportVisual, string>> = {
  football: "Fútbol",
  volleyball: "Vóley",
  basketball: "Básquet",
  futsal: "Futsal",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function countForVisual(counts: Record<string, number> | undefined, visual: HomeSportVisual) {
  if (!counts) return undefined;
  const slug = visualToSlug[visual];
  if (!slug) return undefined;
  return counts[slug] ?? counts[visual] ?? 0;
}

export function SportComplexVisual({ theme, isNight, onSportChange, courtCounts }: Props) {
  const [camera, setCamera] = useState<CameraInteraction>(INITIAL_CAMERA);
  const [sceneVisible, setSceneVisible] = useState(true);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const touchPointsRef = useRef(new Map<number, TouchPoint>());
  const pinchRef = useRef<PinchState | null>(null);

  useEffect(() => {
    setCamera(INITIAL_CAMERA);
  }, [theme.visual]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setSceneVisible(Boolean(entry?.isIntersecting)),
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const sceneStyle = {
    "--manual-pan-x": `${camera.panX}px`,
    "--manual-pan-y": `${camera.panY}px`,
    "--manual-zoom": camera.zoom,
    "--manual-orbit": `${camera.orbit}deg`,
  } as CSSProperties;

  function resetManualCamera() {
    setCamera(INITIAL_CAMERA);
  }

  function showGeneralView() {
    resetManualCamera();
    onSportChange?.("");
  }

  function selectSport(visual: HomeSportVisual) {
    const slug = visualToSlug[visual];
    if (!slug) return;
    onSportChange?.(slug);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.button !== 2) return;
    if ((event.target as HTMLElement).closest("[data-sport-button='true'],[data-camera-control='true']")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.pointerType === "touch") {
      touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const points = [...touchPointsRef.current.values()];
      if (points.length === 2) {
        const [a, b] = points;
        const distance = Math.hypot(b.x - a.x, b.y - a.y);
        pinchRef.current = {
          distance: Math.max(distance, 1),
          midpointX: (a.x + b.x) / 2,
          midpointY: (a.y + b.y) / 2,
          zoom: camera.zoom,
          panX: camera.panX,
          panY: camera.panY,
        };
        dragRef.current = null;
        return;
      }
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: camera.panX,
      startPanY: camera.panY,
      startOrbit: camera.orbit,
      mode: event.button === 2 || event.shiftKey ? "pan" : "orbit",
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" && touchPointsRef.current.has(event.pointerId)) {
      touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const points = [...touchPointsRef.current.values()];
      const pinch = pinchRef.current;
      if (points.length >= 2 && pinch) {
        const [a, b] = points;
        const distance = Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1);
        const midpointX = (a.x + b.x) / 2;
        const midpointY = (a.y + b.y) / 2;
        setCamera((current) => ({
          ...current,
          zoom: clamp(pinch.zoom * (distance / pinch.distance), .82, 1.42),
          panX: clamp(pinch.panX + (midpointX - pinch.midpointX) * .28, -86, 86),
          panY: clamp(pinch.panY + (midpointY - pinch.midpointY) * .24, -62, 62),
        }));
        return;
      }
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (drag.mode === "pan") {
      setCamera((current) => ({
        ...current,
        panX: clamp(drag.startPanX + dx * 0.42, -86, 86),
        panY: clamp(drag.startPanY + dy * 0.34, -62, 62),
      }));
      return;
    }
    setCamera((current) => ({
      ...current,
      orbit: clamp(drag.startOrbit + dx * 0.055, -12, 12),
      panY: clamp(drag.startPanY + dy * 0.08, -26, 26),
    }));
  }

  function releasePointer(event: ReactPointerEvent<HTMLDivElement>) {
    touchPointsRef.current.delete(event.pointerId);
    if (touchPointsRef.current.size < 2) pinchRef.current = null;
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    setCamera((current) => ({ ...current, zoom: clamp(current.zoom + delta, 0.82, 1.42) }));
  }

  const court = (visual: "football" | "volleyball" | "basketball" | "futsal", content: React.ReactNode) => {
    const count = countForVisual(courtCounts, visual);
    const active = theme.visual === visual;
    return (
      <button
        className={`platform-sport-diorama__court-zone platform-sport-diorama__court-zone--${visual}`}
        data-sport={visual}
        data-sport-button="true"
        data-offer-state={count === undefined ? "unknown" : count > 0 ? "active" : "empty"}
        type="button"
        aria-label={`Enfocar ${visualLabels[visual]}${count === undefined ? "" : count > 0 ? `, ${count} ${count === 1 ? "cancha disponible" : "canchas disponibles"}` : ", sin oferta activa todavía"}`}
        aria-pressed={active}
        onClick={() => selectSport(visual)}
      >
        {content}
        <span className="platform-sport-diorama__court-label">
          {visualLabels[visual]}
          {count !== undefined ? <small>{count > 0 ? `${count} activa${count === 1 ? "" : "s"}` : "próximamente"}</small> : null}
        </span>
      </button>
    );
  };

  return (
    <div
      ref={rootRef}
      className={`platform-sport-diorama${isNight ? " is-night" : " is-day"}`}
      data-active-sport={theme.visual}
      data-scene={theme.visual}
      data-camera-focus={theme.visual}
      data-render-engine="dom-css-3d"
      data-scene-persistence="single"
      data-scene-visible={sceneVisible ? "true" : "false"}
      role="group"
      aria-label={`Complejo deportivo 3D de Caxas SportCenter, enfoque en ${theme.sceneLabel}, modo ${isNight ? "noche con reflectores" : "día"}`}
      style={sceneStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
      onWheel={handleWheel}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="platform-sport-diorama__ambient" aria-hidden="true" />
      <div className="platform-sport-diorama__skyline" aria-hidden="true">
        <span className="platform-sport-diorama__mountain platform-sport-diorama__mountain--a" />
        <span className="platform-sport-diorama__mountain platform-sport-diorama__mountain--b" />
        <span className="platform-sport-diorama__city-glow" />
        <span className="platform-sport-diorama__city-lights"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></span>
      </div>

      <div className="platform-sport-diorama__scene" data-render-fallback="architectural-dom">
        <div className="platform-sport-diorama__camera">
          <div className="platform-sport-diorama__orbit">
            <div className="platform-sport-diorama__world">
              <span className="platform-sport-diorama__ground" />
              <span className="platform-sport-diorama__road platform-sport-diorama__road--a" />
              <span className="platform-sport-diorama__road platform-sport-diorama__road--b" />
              <span className="platform-sport-diorama__walkway platform-sport-diorama__walkway--north" />
              <span className="platform-sport-diorama__walkway platform-sport-diorama__walkway--east" />

              <div className="platform-sport-diorama__building platform-sport-diorama__building--north"><span>CAXAS SPORT CENTER</span><i /><i /><i /><i /><i /></div>
              <div className="platform-sport-diorama__building platform-sport-diorama__building--east"><span>CLUB</span><i /><i /><i /></div>
              <div className="platform-sport-diorama__building platform-sport-diorama__building--locker"><span>VESTIDORES</span><i /><i /><i /></div>
              <div className="platform-sport-diorama__social-zone"><span>LOUNGE</span><i /><i /><i /></div>

              <div className="platform-sport-diorama__parking" aria-hidden="true">
                <span /><span /><span /><span /><span /><span /><span /><span />
              </div>

              {court("football", (
                <>
                  <span className="platform-sport-diorama__fence" />
                  <div className="platform-sport-diorama__court platform-sport-diorama__court--football">
                    <span className="platform-sport-diorama__center-line" />
                    <span className="platform-sport-diorama__center-circle" />
                    <span className="platform-sport-diorama__penalty platform-sport-diorama__penalty--a" />
                    <span className="platform-sport-diorama__penalty platform-sport-diorama__penalty--b" />
                  </div>
                  <span className="platform-sport-diorama__goal platform-sport-diorama__goal--a"><i /></span>
                  <span className="platform-sport-diorama__goal platform-sport-diorama__goal--b"><i /></span>
                </>
              ))}

              {court("volleyball", (
                <>
                  <span className="platform-sport-diorama__fence" />
                  <div className="platform-sport-diorama__court platform-sport-diorama__court--volleyball">
                    <span className="platform-sport-diorama__center-line" />
                    <span className="platform-sport-diorama__attack-line platform-sport-diorama__attack-line--a" />
                    <span className="platform-sport-diorama__attack-line platform-sport-diorama__attack-line--b" />
                  </div>
                  <span className="platform-sport-diorama__net"><i /></span>
                  <span className="platform-sport-diorama__bench platform-sport-diorama__bench--a" />
                  <span className="platform-sport-diorama__bench platform-sport-diorama__bench--b" />
                </>
              ))}

              {court("basketball", (
                <>
                  <span className="platform-sport-diorama__fence" />
                  <div className="platform-sport-diorama__court platform-sport-diorama__court--basketball">
                    <span className="platform-sport-diorama__center-line" />
                    <span className="platform-sport-diorama__center-circle" />
                    <span className="platform-sport-diorama__key platform-sport-diorama__key--a" />
                    <span className="platform-sport-diorama__key platform-sport-diorama__key--b" />
                    <span className="platform-sport-diorama__three-point platform-sport-diorama__three-point--a" />
                    <span className="platform-sport-diorama__three-point platform-sport-diorama__three-point--b" />
                  </div>
                  <span className="platform-sport-diorama__hoop platform-sport-diorama__hoop--a"><i /></span>
                  <span className="platform-sport-diorama__hoop platform-sport-diorama__hoop--b"><i /></span>
                </>
              ))}

              {court("futsal", (
                <>
                  <span className="platform-sport-diorama__fence" />
                  <div className="platform-sport-diorama__court platform-sport-diorama__court--futsal">
                    <span className="platform-sport-diorama__center-line" />
                    <span className="platform-sport-diorama__center-circle" />
                    <span className="platform-sport-diorama__futsal-area platform-sport-diorama__futsal-area--a" />
                    <span className="platform-sport-diorama__futsal-area platform-sport-diorama__futsal-area--b" />
                  </div>
                  <span className="platform-sport-diorama__goal platform-sport-diorama__goal--a"><i /></span>
                  <span className="platform-sport-diorama__goal platform-sport-diorama__goal--b"><i /></span>
                </>
              ))}

              <div className="platform-sport-diorama__stand platform-sport-diorama__stand--west"><i /><i /><i /><i /></div>
              <div className="platform-sport-diorama__stand platform-sport-diorama__stand--south"><i /><i /><i /><i /><i /></div>

              <div className="platform-sport-diorama__trees" aria-hidden="true">
                {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="platform-sport-diorama__lights" aria-hidden="true">
        <span><i /></span><span><i /></span><span><i /></span><span><i /></span>
        <span><i /></span><span><i /></span><span><i /></span><span><i /></span>
      </div>

      <div className="platform-sport-diorama__controls" data-camera-control="true" aria-label="Controles de la vista 3D">
        <button type="button" onClick={showGeneralView} disabled={!onSportChange && theme.visual === "multi"}>Vista general</button>
        <button type="button" onClick={() => setCamera((current) => ({ ...current, zoom: clamp(current.zoom + .1, .82, 1.42) }))} aria-label="Acercar">+</button>
        <button type="button" onClick={() => setCamera((current) => ({ ...current, zoom: clamp(current.zoom - .1, .82, 1.42) }))} aria-label="Alejar">−</button>
        <button type="button" onClick={resetManualCamera} aria-label="Restablecer cámara"><Icon name="court" size={14} /></button>
      </div>

      <div className="platform-sport-diorama__caption">
        <span><Icon name={theme.icon} size={14} /> {theme.label}</span>
        <small>{isNight ? "Reflectores activos · hora real de Cajamarca" : "Día · iluminación natural"}</small>
      </div>
      <p className="platform-sport-diorama__hint">Arrastra para orbitar · rueda para zoom · Shift + arrastre para desplazar</p>
    </div>
  );
}
