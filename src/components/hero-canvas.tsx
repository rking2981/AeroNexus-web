'use client';

import { useEffect, useRef } from 'react';

interface Node {
  x: number;
  y: number;
  label: string;
}

interface Arc {
  from: Node;
  to: Node;
  progress: number;
  speed: number;
  opacity: number;
}

interface Dot {
  arcIndex: number;
  t: number;
  speed: number;
}

// Fixed global airport nodes — scattered across the canvas
const NODES: Node[] = [
  { x: 0.12, y: 0.30, label: 'KSEA' },
  { x: 0.22, y: 0.55, label: 'KLAX' },
  { x: 0.35, y: 0.25, label: 'KORD' },
  { x: 0.45, y: 0.60, label: 'KJFK' },
  { x: 0.55, y: 0.35, label: 'EGLL' },
  { x: 0.65, y: 0.20, label: 'EDDF' },
  { x: 0.72, y: 0.50, label: 'RJTT' },
  { x: 0.82, y: 0.65, label: 'YSSY' },
  { x: 0.48, y: 0.75, label: 'FAOR' },
  { x: 0.28, y: 0.72, label: 'SBGR' },
];

const ROUTE_PAIRS: [number, number][] = [
  [0, 1], [0, 2], [2, 3], [3, 4], [4, 5],
  [5, 6], [6, 7], [1, 9], [9, 8], [4, 8],
  [2, 4], [5, 8], [6, 3],
];

export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let W = 0; let H = 0;

    function resize() {
      W = canvas!.offsetWidth;
      H = canvas!.offsetHeight;
      canvas!.width = W * window.devicePixelRatio;
      canvas!.height = H * window.devicePixelRatio;
      ctx!.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    resize();
    window.addEventListener('resize', resize);

    // Build arcs
    const arcs: Arc[] = ROUTE_PAIRS.map(([fi, ti]) => ({
      from: NODES[fi],
      to: NODES[ti],
      progress: Math.random(),
      speed: 0.0008 + Math.random() * 0.0006,
      opacity: 0.15 + Math.random() * 0.2,
    }));

    // Aircraft dots — one per arc
    const dots: Dot[] = arcs.map((_, i) => ({
      arcIndex: i,
      t: Math.random(),
      speed: 0.0012 + Math.random() * 0.001,
    }));

    // Radar sweep state
    let radarAngle = 0;

    function getArcPoint(from: Node, to: Node, t: number): [number, number] {
      const fx = from.x * W; const fy = from.y * H;
      const tx = to.x * W;   const ty = to.y * H;
      // Control point bows upward
      const mx = (fx + tx) / 2;
      const my = (fy + ty) / 2 - Math.hypot(tx - fx, ty - fy) * 0.25;
      const u = 1 - t;
      return [
        u * u * fx + 2 * u * t * mx + t * t * tx,
        u * u * fy + 2 * u * t * my + t * t * ty,
      ];
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // ── Radar rings ──────────────────────────────────────────────────────
      const cx = W * 0.5; const cy = H * 0.45;
      for (let r = 80; r <= 340; r += 80) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 209, 255, ${0.04 - r * 0.00008})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // ── Radar sweep ───────────────────────────────────────────────────────
      radarAngle = (radarAngle + 0.003) % (Math.PI * 2);

      // Draw sweep as a filled arc wedge with gradient opacity
      const sweepArc = Math.PI * 0.35;
      for (let i = 0; i < 24; i++) {
        const a = radarAngle - (i / 24) * sweepArc;
        const alpha = (1 - i / 24) * 0.06;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, 360, a, a + sweepArc / 24);
        ctx.closePath();
        ctx.fillStyle = `rgba(0, 209, 255, ${alpha})`;
        ctx.fill();
      }

      // ── Route arcs ────────────────────────────────────────────────────────
      arcs.forEach((arc) => {
        const fx = arc.from.x * W; const fy = arc.from.y * H;
        const tx = arc.to.x * W;   const ty = arc.to.y * H;
        const mx = (fx + tx) / 2;
        const my = (fy + ty) / 2 - Math.hypot(tx - fx, ty - fy) * 0.25;

        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.quadraticCurveTo(mx, my, tx, ty);
        ctx.strokeStyle = `rgba(0, 209, 255, ${arc.opacity * 0.5})`;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // ── Airport nodes ────────────────────────────────────────────────────
      NODES.forEach((node) => {
        const nx = node.x * W; const ny = node.y * H;

        // Outer ring
        ctx.beginPath();
        ctx.arc(nx, ny, 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 209, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner dot
        ctx.beginPath();
        ctx.arc(nx, ny, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 209, 255, 0.5)';
        ctx.fill();

        // Label
        ctx.fillStyle = 'rgba(0, 209, 255, 0.3)';
        ctx.font = '9px monospace';
        ctx.fillText(node.label, nx + 7, ny + 3);
      });

      // ── Aircraft dots ─────────────────────────────────────────────────────
      dots.forEach((dot) => {
        const arc = arcs[dot.arcIndex];
        const [x, y] = getArcPoint(arc.from, arc.to, dot.t);

        // Glow
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 209, 255, 0.08)';
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 209, 255, 0.85)';
        ctx.fill();

        // Trail
        const trailT = Math.max(0, dot.t - 0.04);
        const [tx2, ty2] = getArcPoint(arc.from, arc.to, trailT);
        ctx.beginPath();
        ctx.moveTo(tx2, ty2);
        ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(0, 209, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Advance
        dot.t += dot.speed;
        if (dot.t > 1) { dot.t = 0; }
      });

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none select-none"
      style={{ opacity: 0.6, cursor: 'default' }}
      aria-hidden
    />
  );
}
