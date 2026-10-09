"use client";

import { forwardRef, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { MediaPlayer, MediaProvider, Poster, Track, type MediaPlayerInstance, type MediaPlayerProps } from "@vidstack/react";
import { DefaultVideoLayout, defaultLayoutIcons, type DefaultVideoLayoutProps } from "@vidstack/react/player/layouts/default";
import { base64_to_blob } from "../../general/base64/index.js";
import { cn } from "../styles.js";

export type VideoTrack = ComponentProps<typeof Track>;
export type VideoInput = NonNullable<MediaPlayerProps["src"]> | ArrayBuffer | ArrayBufferView | Blob;

export interface VideoPlayerProps extends Omit<MediaPlayerProps, "src" | "title" | "children" | "ref"> {
  src: VideoInput;
  title: string;
  /** Required for byte arrays without a data URL's MIME type. */
  mimeType?: string;
  /** Hook for a host transcoding service when the browser cannot decode the input. */
  resolveSource?: (input: VideoInput, signal: AbortSignal) => Promise<VideoInput>;
  onInputError?: (error: unknown) => void;
  tracks?: readonly VideoTrack[];
  thumbnails?: string;
  layoutProps?: Partial<Omit<DefaultVideoLayoutProps, "thumbnails">>;
  children?: ReactNode;
}

/** One React player for files, HLS/DASH streams and supported hosted videos. */
export const VideoPlayer = forwardRef<MediaPlayerInstance, VideoPlayerProps>(function VideoPlayer({
  src, title, poster, tracks = [], thumbnails, layoutProps, children, className, playsInline = true,
  mimeType, resolveSource, onInputError,
  ...playerProps
}, ref) {
  const [loaded, setLoaded] = useState<{ input: VideoInput; source: NonNullable<MediaPlayerProps["src"]> } | null>(null);
  const [inputError, setInputError] = useState<unknown>(null);
  const errorRef = useRef(onInputError);
  errorRef.current = onInputError;
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setInputError(null);
    const prepare = async () => {
      const input = resolveSource ? await resolveSource(src, controller.signal) : src;
      if (controller.signal.aborted) return;
      if (typeof input === "string" && /^data:[^,]*;base64,/i.test(input)) {
        const blob = base64_to_blob(input, mimeType);
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ input: src, source: { src: objectUrl, type: blob.type } as NonNullable<MediaPlayerProps["src"]> });
      } else if (input instanceof Blob || input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
        const bytes = input instanceof Blob ? null : input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
        const blob = input instanceof Blob ? input : new Blob([new Uint8Array(bytes!).buffer], { type: mimeType || "video/mp4" });
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ input: src, source: { src: objectUrl, type: mimeType || blob.type || "video/mp4" } as NonNullable<MediaPlayerProps["src"]> });
      } else setLoaded({ input: src, source: input as NonNullable<MediaPlayerProps["src"]> });
    };
    void prepare().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setInputError(error);
      errorRef.current?.(error);
    });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src, mimeType, resolveSource]);

  const source = loaded?.input === src ? loaded.source : !resolveSource && typeof src === "string" && !/^data:[^,]*;base64,/i.test(src) ? src : undefined;
  if (inputError) return <div role="alert" className={cn("flex aspect-video items-center justify-center rounded-xl bg-muted p-4 text-sm text-destructive", className)}>无法加载视频输入</div>;
  return <MediaPlayer
    {...playerProps}
    ref={ref}
    src={source}
    title={title}
    poster={poster}
    playsInline={playsInline}
    className={cn("aspect-video w-full overflow-hidden rounded-xl bg-black text-white", className)}
  >
    <MediaProvider>
      {poster && <Poster className="vds-poster" />}
      {tracks.map((track, index) => <Track key={track.id ?? `${track.src ?? "inline"}-${track.lang ?? index}`} {...track} />)}
    </MediaProvider>
    <DefaultVideoLayout icons={defaultLayoutIcons} {...layoutProps} thumbnails={thumbnails} />
    {children}
  </MediaPlayer>;
});

export type { MediaPlayerInstance, MediaPlayerProps, DefaultVideoLayoutProps };
