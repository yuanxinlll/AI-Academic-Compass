"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const motionQuery = "(prefers-reduced-motion: reduce)";

function subscribeMotion(callback: () => void) {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

const getReducedMotion = () => window.matchMedia(motionQuery).matches;
const getServerMotion = () => true;

type Point = {
  x: number;
  y: number;
  shade: number;
};

type Fish = {
  points: Point[];
  phase: number;
  x: number;
  y: number;
  size: number;
  direction: number;
  angle: number;
};

// 独立实现的鱼形、点阵和运动逻辑。
function triangle(
  x: number,
  y: number,
  a: number[],
  b: number[],
  c: number[],
) {
  const cross = (p: number[], q: number[]) =>
    (x - q[0]) * (p[1] - q[1]) -
    (p[0] - q[0]) * (y - q[1]);

  const values = [cross(a, b), cross(b, c), cross(c, a)];

  return !(
    values.some((value) => value < 0) &&
    values.some((value) => value > 0)
  );
}

function makePoints(seed: number): Point[] {
  const points: Point[] = [];
  let value = seed;

  const random = () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };

  for (let x = -1.65; x <= 1; x += 0.035) {
    for (let y = -0.85; y <= 0.85; y += 0.035) {
      const body =
        ((x + 0.02) / 0.98) ** 2 +
          (y / 0.245) ** 2 <=
        1;

      const fins =
        triangle(x, y, [0.35, 0.06], [-0.48, 0.8], [-0.24, 0.1]) ||
        triangle(x, y, [0.35, -0.06], [-0.48, -0.8], [-0.24, -0.1]);

      const tail =
        triangle(x, y, [-0.86, 0], [-1.6, 0.49], [-1.36, 0]) ||
        triangle(x, y, [-0.86, 0], [-1.6, -0.49], [-1.36, 0]);

      const shade = random();

      if ((body || fins || tail) && shade > (body ? 0.15 : 0.35)) {
        points.push({
          x: x + random() * 0.022,
          y: y + random() * 0.022,
          shade,
        });
      }
    }
  }

  return points;
}

export default function OceanBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elapsedRef = useRef(0);
  const [paused, setPaused] = useState(false);

  const reduced = useSyncExternalStore(
    subscribeMotion,
    getReducedMotion,
    getServerMotion,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const ctx = context;
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastFrame = 0;
    let previousTime = 0;

    const fish: Fish[] = [
      {
        points: makePoints(17),
        phase: 0.2,
        x: 0.19,
        y: 0.17,
        size: 1.35,
        direction: 1,
        angle: -0.3,
      },
      {
        points: makePoints(43),
        phase: 2.1,
        x: 0.81,
        y: 0.42,
        size: 1.13,
        direction: -1,
        angle: 0.46,
      },
      {
        points: makePoints(79),
        phase: 4.2,
        x: 0.28,
        y: 0.88,
        size: 0.94,
        direction: 1,
        angle: -0.55,
      },
      {
        points: makePoints(109),
        phase: 1.3,
        x: 0.88,
        y: 0.95,
        size: 0.7,
        direction: -1,
        angle: -0.15,
      },
    ];

    const bits = [
      [1, 8],
      [2, 16],
      [4, 32],
      [64, 128],
    ];

    let fishColor = "";
    let schoolColor = "";
    function syncColors() {
      const style = getComputedStyle(document.documentElement);
      fishColor = style.getPropertyValue("--fish").trim();
      schoolColor = style.getPropertyValue("--school").trim();
      draw();
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      const time = elapsedRef.current;
      const mobile = width < 640;
      const baseSize = Math.min(
        width * (mobile ? 0.26 : 0.145),
        220,
      );

      const cellWidth = 7;
      const cellHeight = 12;
      const columns = Math.ceil(width / cellWidth);
      const rows = Math.ceil(height / cellHeight);
      const cells = new Map<number, number>();

      for (const f of fish.slice(0, mobile ? 3 : 4)) {
        const scale = baseSize * f.size;
        const margin = scale * 2;
        const span = width + margin * 2;

        const originX =
          ((f.x * width +
            margin +
            time * 11 * f.direction +
            span * 100) %
            span) -
          margin;

        const originY =
          f.y * height +
          Math.sin(time * 0.16 + f.phase) * 24;

        const angle =
          f.angle + Math.sin(time * 0.1 + f.phase) * 0.09;

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        for (const point of f.points) {
          const sway =
            Math.sin(time * 1.15 + point.x * 3 + f.phase) *
            (0.012 + Math.max(0, -point.x) ** 2 * 0.055);

          const localX = point.x * scale * f.direction;
          const localY = (point.y + sway) * scale;

          const px = originX + localX * cos - localY * sin;
          const py = originY + localX * sin + localY * cos;

          if (px < 0 || py < 0 || px >= width || py >= height) {
            continue;
          }

          const col = Math.floor(px / cellWidth);
          const row = Math.floor(py / cellHeight);

          const dx = Math.min(
            1,
            Math.floor(
              (px - col * cellWidth) / (cellWidth / 2),
            ),
          );

          const dy = Math.min(
            3,
            Math.floor(
              (py - row * cellHeight) / (cellHeight / 4),
            ),
          );

          const key = row * columns + col;

          if (point.shade > 0.24) {
            cells.set(
              key,
              (cells.get(key) ?? 0) | bits[dy][dx],
            );
          }
        }
      }

      ctx.fillStyle = fishColor;
      ctx.font = '12px "Courier New", monospace';
      ctx.textBaseline = "top";

      for (const [key, mask] of cells) {
        ctx.fillText(
          String.fromCharCode(0x2800 + mask),
          (key % columns) * cellWidth,
          Math.floor(key / columns) * cellHeight,
        );
      }

      ctx.fillStyle = schoolColor;

      for (let school = 0; school < 5; school++) {
        for (let i = 0; i < (mobile ? 11 : 23); i++) {
          const drift = time * (school % 2 ? -7 : 7);

          const px =
            (((school * 347 + i * 29 + drift) %
              (width + 160) +
              width +
              160) %
              (width + 160)) -
            80;

          const py =
            (school * 173 +
              Math.sin(i * 2.31) * 55 +
              i * 3) %
            height;

          if (py > 0 && py < rows * cellHeight) {
            ctx.fillRect(px, py, 2.6, 1);
          }
        }
      }
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;

      const ratio = Math.min(
        window.devicePixelRatio || 1,
        1.5,
      );

      canvas!.width = Math.round(width * ratio);
      canvas!.height = Math.round(height * ratio);

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    }

    function animate(now: number) {
      if (previousTime) {
        elapsedRef.current += Math.min(
          (now - previousTime) / 1000,
          0.1,
        );
      }

      previousTime = now;

      if (now - lastFrame >= (width < 640 ? 80 : 50)) {
        draw();
        lastFrame = now;
      }

      frame = window.requestAnimationFrame(animate);
    }

    function syncAnimation() {
      window.cancelAnimationFrame(frame);
      previousTime = 0;

      if (!document.hidden && !paused && !reduced) {
        frame = window.requestAnimationFrame(animate);
      }
    }

    syncColors();
    resize();
    syncAnimation();
    const themeObserver = new MutationObserver(syncColors);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    window.addEventListener("resize", resize);
    document.addEventListener(
      "visibilitychange",
      syncAnimation,
    );

    return () => {
      themeObserver.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener(
        "visibilitychange",
        syncAnimation,
      );
    };
  }, [paused, reduced]);

  return (
    <>
      <div className="compass-ocean" aria-hidden="true">
        <canvas ref={canvasRef} />
      </div>

      <button
        type="button"
        className="compass-motion"
        aria-label={
          reduced
            ? "Background motion reduced by system preference"
            : paused
              ? "Resume background animation"
              : "Pause background animation"
        }
        aria-pressed={paused || reduced}
        disabled={reduced}
        onClick={() => setPaused((value) => !value)}
      >
        {reduced
          ? "Reduced motion"
          : paused
            ? "Resume ocean"
            : "Pause ocean"}
      </button>
    </>
  );
}