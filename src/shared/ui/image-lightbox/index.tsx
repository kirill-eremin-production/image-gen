"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, RotateCcw, X } from "lucide-react";

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.5;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ pointerX: number; pointerY: number } | null>(null);

  const changeZoom = useCallback(
    (delta: number) => {
      const nextZoom = clampZoom(zoom + delta);
      setZoom(nextZoom);
      if (nextZoom === 1) setPosition({ x: 0, y: 0 });
    },
    [zoom],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "+" || event.key === "=") {
        changeZoom(ZOOM_STEP);
      }
      if (event.key === "-") {
        changeZoom(-ZOOM_STEP);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [changeZoom, onClose]);

  function resetView() {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Полноэкранный просмотр изображения"
      className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white"
    >
      <div className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-black/60 px-4 backdrop-blur">
        <div className="min-w-0 truncate pr-4 text-sm text-zinc-300">{alt}</div>
        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 p-1">
          <button
            type="button"
            onClick={() => changeZoom(-ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Уменьшить"
            className="rounded-md p-2 hover:bg-white/10 disabled:opacity-30"
          >
            <Minus size={18} />
          </button>
          <button
            type="button"
            onClick={resetView}
            className="min-w-16 rounded-md px-2 py-2 text-xs font-semibold hover:bg-white/10"
            title="Сбросить масштаб"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => changeZoom(ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Увеличить"
            className="rounded-md p-2 hover:bg-white/10 disabled:opacity-30"
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            onClick={resetView}
            aria-label="Сбросить масштаб и позицию"
            className="rounded-md p-2 hover:bg-white/10"
          >
            <RotateCcw size={17} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="ml-1 rounded-md p-2 hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div
        className={`relative flex flex-1 items-center justify-center overflow-hidden ${
          zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
        }`}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        onDoubleClick={() => {
          if (zoom === 1) setZoom(2);
          else resetView();
        }}
        onWheel={(event) => {
          event.preventDefault();
          changeZoom(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
        }}
        onPointerDown={(event) => {
          if (zoom <= 1) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { pointerX: event.clientX, pointerY: event.clientY };
        }}
        onPointerMove={(event) => {
          if (!dragRef.current) return;
          const deltaX = event.clientX - dragRef.current.pointerX;
          const deltaY = event.clientY - dragRef.current.pointerY;
          dragRef.current = { pointerX: event.clientX, pointerY: event.clientY };
          setPosition((current) => ({
            x: current.x + deltaX,
            y: current.y + deltaY,
          }));
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-[calc(100vh-5rem)] max-w-[94vw] select-none object-contain will-change-transform"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${zoom})`,
          }}
        />
      </div>

      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 text-xs text-zinc-400 backdrop-blur">
        Колесо — масштаб · перетаскивание — обзор · Esc — закрыть
      </div>
    </div>,
    document.body,
  );
}
