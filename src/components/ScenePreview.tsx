import { useEffect, useRef } from "react";
import { drawFrame, VIDEO_HEIGHT, VIDEO_WIDTH } from "@/lib/video/renderer";
import type { Timeline } from "@/lib/video/timeline";

/** Looping silent preview of a timeline, drawn with the same engine as the export. */
export function ScenePreview({
  title,
  timeline,
  subcategory,
  className,
}: {
  title: string;
  timeline: Timeline;
  subcategory?: string;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || timeline.segments.length === 0) return;
    let raf = 0;
    let disposed = false;
    let solid: import("@/lib/video/solid-scenes").SolidScenes | undefined;
    const started = performance.now();
    const loop = () => {
      const t = ((performance.now() - started) / 1000) % timeline.totalSec;
      drawFrame(ctx, title, timeline, t, solid, subcategory);
      raf = requestAnimationFrame(loop);
    };
    import("@/lib/video/solid-scenes")
      .then(({ createSolidScenes, supportsWebGL }) => {
        if (disposed || !supportsWebGL()) return;
        solid = createSolidScenes(VIDEO_WIDTH, VIDEO_HEIGHT);
      })
      .catch(() => {
        /* Legacy canvas fallback on devices without WebGL. */
      });
    raf = requestAnimationFrame(loop);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      solid?.dispose();
    };
  }, [title, timeline, subcategory]);

  return (
    <canvas
      ref={ref}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      className={className}
      style={{ aspectRatio: "9 / 16" }}
      aria-label="3D 장면 미리보기"
    />
  );
}
