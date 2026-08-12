import { useEffect, useRef } from 'react';
import { useTheme } from '@/hooks/useTheme';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
}

export function CursorGlow() {
  const { isDark } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

  useEffect(() => {
    if ('ontouchstart' in window) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    const particles: Particle[] = [];
    let mx = -100;
    let my = -100;
    let prevMx = -100;
    let prevMy = -100;
    let animId = 0;

    const onResize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };

    const onMove = (e: MouseEvent) => {
      prevMx = mx;
      prevMy = my;
      mx = e.clientX;
      my = e.clientY;

      // Spawn particles between previous and current position
      const dx = mx - prevMx;
      const dy = my - prevMy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.min(Math.floor(dist / 6), 12);

      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const px = prevMx + dx * t + (Math.random() - 0.5) * 6;
        const py = prevMy + dy * t + (Math.random() - 0.5) * 6;
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.2 + Math.random() * 1.2;
        const life = 60 + Math.random() * 80;
        particles.push({
          x: px,
          y: py,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life,
          maxLife: life,
          size: 1.5 + Math.random() * 2.5,
          hue: 170 + Math.random() * 20, // teal range
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, w, h);

      // Draw connecting trails between nearby particles
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]!;
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 50) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
           ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = isDarkRef.current
              ? `hsla(${a.hue}, 70%, 65%, ${0.12 * (1 - dist / 50)})`
              : `hsla(${a.hue}, 60%, 40%, ${0.06 * (1 - dist / 50)})`;
           ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        p.vy += 0.02;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        const alpha = p.life / p.maxLife;
        const size = p.size * alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 60%, 50%, ${alpha * 0.7})`;
        ctx.fill();
      }

      // Limit particles
      if (particles.length > 200) {
        particles.splice(0, particles.length - 200);
      }

      animId = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('resize', onResize);
    animId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9997] pointer-events-none"
      style={{ display: 'ontouchstart' in window ? 'none' : 'block' }}
    />
  );
}
