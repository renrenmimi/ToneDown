import { useEffect, useRef } from 'react'

// Hand-rolled celebration: ~120 particles, one self-terminating rAF loop,
// canvas removed after 2.4s. Brand colors only — never crimson (reserved
// for hostility). Reduced motion renders nothing; callers show a static
// banner instead.

const COLORS = ['#3ccfbc', '#fbbf24', '#7c8ce4', '#6fe0d0', '#f59e0b']
const PARTICLES = 120
const LIFE_MS = 2_400

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  size: number
  color: string
}

export function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return
    }
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      return
    }

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    ctx.scale(dpr, dpr)

    const particles: Particle[] = Array.from({ length: PARTICLES }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 160,
      y: window.innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 9,
      vy: -4 - Math.random() * 7,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      size: 5 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }))

    const startedAt = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const elapsed = now - startedAt
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      if (elapsed > LIFE_MS) {
        return
      }
      const fade = 1 - elapsed / LIFE_MS
      for (const p of particles) {
        p.vy += 0.12
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = fade
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50"
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}
