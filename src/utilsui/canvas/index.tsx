"use client";

import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../styles.js";

export interface ViewportSize {
  /** Visible size in CSS pixels. */
  width: number;
  height: number;
  pixelRatio: number;
  /** Suggested backing-store dimensions for a 2D canvas. */
  pixelWidth: number;
  pixelHeight: number;
}

const initialSize: ViewportSize = { width: 0, height: 0, pixelRatio: 1, pixelWidth: 0, pixelHeight: 0 };
type ClientPoint = { clientX: number; clientY: number };

/** Observes a container; pointer positions are relative CSS pixels, independent of canvas resolution. */
export function useCanvasViewport<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<ViewportSize>(initialSize);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      const width = rect.width, height = rect.height;
      setSize((previous) => previous.width === width && previous.height === height && previous.pixelRatio === pixelRatio
        ? previous : { width, height, pixelRatio, pixelWidth: Math.round(width * pixelRatio), pixelHeight: Math.round(height * pixelRatio) });
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : undefined;
    observer?.observe(element);
    window.addEventListener("resize", update);
    let resolution: MediaQueryList | undefined;
    const watchResolution = () => {
      resolution?.removeEventListener("change", watchResolution);
      update();
      resolution = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      resolution?.addEventListener("change", watchResolution);
    };
    watchResolution();
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      resolution?.removeEventListener("change", watchResolution);
    };
  }, []);
  const get_point = useCallback((event: ClientPoint) => {
    const rect = ref.current?.getBoundingClientRect();
    return rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : null;
  }, []);
  return { ref, size, get_point };
}

/** A sized container for Canvas 2D, WebGL or React Three Fiber content. */
export function CanvasViewport({ children, className, ...props }: Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: (viewport: Pick<ReturnType<typeof useCanvasViewport>, "size" | "get_point">) => ReactNode;
}) {
  const { ref, size, get_point } = useCanvasViewport();
  return <div {...props} ref={ref} className={cn("relative min-h-0 min-w-0", className)}>
    {children({ size, get_point })}
  </div>;
}
