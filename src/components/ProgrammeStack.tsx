'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { PROGRAM_META, DEFAULT_PROGRAM_META as DEFAULT_META } from '@/lib/program-meta'
import { ENROLLMENT_OPEN } from '@/lib/enrollment'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

interface ProgramCard {
  id: string; slug: string; name: string; tagline: string | null; description: string | null
  price_inr: number | null; duration_label: string | null; learning_outcomes: string[]
}

// ─────────────────────────────────────────────────────────────
// ANIMATED CARD BACKGROUNDS — retinted to the Instrument palette
// (previously neon cyan/purple; now each programme's own muted
// accent, matching PROGRAM_META).
// ─────────────────────────────────────────────────────────────

function CloudLaunchpadAnim() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const W = 600, H = 340
    canvas.width = W * 2; canvas.height = H * 2
    ctx.scale(2, 2)
    let raf = 0; let t = 0
    const C = '111, 168, 184' // cloud-launchpad accent

    const nodes = Array.from({ length: 18 }, (_, i) => ({
      x: (i % 6) * 100 + 50 + Math.random() * 40 - 20,
      y: Math.floor(i / 6) * 100 + 60 + Math.random() * 40 - 20,
      r: Math.random() * 8 + 4,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.3 + 0.15,
      type: ['server', 'storage', 'network', 'cloud'][Math.floor(Math.random() * 4)] as string,
    }))

    const drawCloud = (x: number, y: number, s: number, alpha: number) => {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(x, y - s * 0.15, s * 0.6, 0, Math.PI * 2)
      ctx.arc(x - s * 0.45, y + s * 0.15, s * 0.4, 0, Math.PI * 2)
      ctx.arc(x + s * 0.45, y + s * 0.15, s * 0.45, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${C}, 0.15)`
      ctx.fill()
      ctx.strokeStyle = `rgba(${C}, 0.3)`
      ctx.lineWidth = 0.8
      ctx.stroke()
      ctx.restore()
    }

    const drawServer = (x: number, y: number, s: number, alpha: number) => {
      ctx.save(); ctx.globalAlpha = alpha
      const w = s * 1.2, h = s * 0.5
      for (let i = 0; i < 3; i++) {
        const ry = y - h * 1.5 + i * (h + 2)
        ctx.fillStyle = `rgba(${C}, ${0.08 + i * 0.03})`
        ctx.strokeStyle = `rgba(${C}, 0.25)`
        ctx.lineWidth = 0.6
        ctx.beginPath()
        ctx.roundRect(x - w / 2, ry, w, h, 2)
        ctx.fill(); ctx.stroke()
        ctx.fillStyle = i === 0 ? 'rgba(74, 222, 128, 0.6)' : `rgba(${C}, 0.3)`
        ctx.beginPath()
        ctx.arc(x - w / 2 + 4, ry + h / 2, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    const draw = () => {
      t += 0.008
      ctx.clearRect(0, 0, W, H)

      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7)
      bg.addColorStop(0, 'rgba(20, 26, 28, 0.6)')
      bg.addColorStop(1, 'rgba(11, 11, 13, 0.95)')
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

      ctx.strokeStyle = `rgba(${C}, 0.08)`
      ctx.lineWidth = 0.6
      nodes.forEach((n, i) => {
        nodes.forEach((m, j) => {
          if (j <= i) return
          const dx = n.x - m.x, dy = n.y - m.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 160) {
            const pulse = Math.sin(t * 2 + i * 0.5) * 0.5 + 0.5
            ctx.globalAlpha = (1 - dist / 160) * 0.4 * pulse
            ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y); ctx.stroke()
            if (dist < 120 && Math.sin(t * 3 + i) > 0.6) {
              const progress = (Math.sin(t * 2 + j) * 0.5 + 0.5)
              const px = n.x + (m.x - n.x) * progress
              const py = n.y + (m.y - n.y) * progress
              ctx.fillStyle = `rgba(${C}, 0.6)`
              ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI * 2); ctx.fill()
            }
          }
        })
      })
      ctx.globalAlpha = 1

      nodes.forEach((n, i) => {
        const yOff = Math.sin(t * n.speed + n.phase) * 6
        const nx = n.x, ny = n.y + yOff
        const alpha = 0.6 + Math.sin(t + i) * 0.2

        if (n.type === 'cloud') drawCloud(nx, ny, n.r * 1.8, alpha)
        else if (n.type === 'server') drawServer(nx, ny, n.r * 1.2, alpha)
        else {
          ctx.save()
          ctx.globalAlpha = alpha * 0.3
          ctx.fillStyle = `rgba(${C}, 0.15)`
          ctx.beginPath(); ctx.arc(nx, ny, n.r * 1.8, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = alpha
          const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, n.r)
          grad.addColorStop(0, `rgba(${C}, 0.7)`)
          grad.addColorStop(1, `rgba(${C}, 0.1)`)
          ctx.fillStyle = grad
          ctx.beginPath(); ctx.arc(nx, ny, n.r, 0, Math.PI * 2); ctx.fill()
          ctx.restore()
        }
      })

      ctx.font = '600 8px "Geist", sans-serif'
      ctx.fillStyle = `rgba(${C}, 0.25)`;
      ['S3', 'EC2', 'VPC', 'IAM', 'RDS', 'Lambda'].forEach((label, i) => {
        const x = 80 + i * 88
        const y = 28 + Math.sin(t + i * 1.2) * 5
        ctx.fillText(label, x, y)
      })

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}/>
}

function CloudArchitectAnim() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const W = 600, H = 340
    canvas.width = W * 2; canvas.height = H * 2
    ctx.scale(2, 2)
    let raf = 0; let t = 0

    // Layers graded from neutral graphite (base) to the brand's indigo
    // accent (top) — the same diagonal intensity ramp as the logo's
    // own cyan-to-indigo gradient, not a rainbow palette.
    const layers = [
      { y: 260, h: 40, label: 'Infrastructure',      color: '108, 110, 122', items: ['VPC', 'Subnets', 'NAT', 'IGW'] },
      { y: 200, h: 40, label: 'Compute & Storage',   color: '90, 98, 165',   items: ['EC2', 'ASG', 'S3', 'EBS'] },
      { y: 140, h: 40, label: 'Services',            color: '65, 82, 200',  items: ['Lambda', 'API GW', 'SQS', 'SNS'] },
      { y: 80,  h: 40, label: 'Application',         color: '74, 63, 224',  items: ['Route53', 'CloudFront', 'WAF'] },
    ]

    const draw = () => {
      t += 0.006
      ctx.clearRect(0, 0, W, H)

      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7)
      bg.addColorStop(0, 'rgba(18, 17, 28, 0.7)')
      bg.addColorStop(1, 'rgba(11, 11, 13, 0.95)')
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

      ctx.strokeStyle = 'rgba(74, 63, 224, 0.06)'
      ctx.lineWidth = 0.5
      for (let x = 0; x < W; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
      for (let y = 0; y < H; y += 30) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }

      layers.forEach((layer, li) => {
        const slideIn = Math.min(1, Math.max(0, (t * 1.5 - li * 0.3)))
        const xOffset = (1 - slideIn) * 100
        const alpha = slideIn * 0.8

        const lx = 60 + xOffset, ly = layer.y, lw = W - 120, lh = layer.h

        ctx.save()
        ctx.globalAlpha = alpha * 0.4
        ctx.fillStyle = `rgba(${layer.color}, 0.1)`
        ctx.strokeStyle = `rgba(${layer.color}, 0.3)`
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.roundRect(lx, ly, lw, lh, 4)
        ctx.fill(); ctx.stroke()

        ctx.globalAlpha = alpha * 0.6
        ctx.font = '700 9px "Geist", sans-serif'
        ctx.fillStyle = `rgba(${layer.color}, 0.8)`
        ctx.fillText(layer.label, lx + 10, ly + 15)

        const boxW = 52, boxH = 18, gap = 8
        const startX = lx + 10
        layer.items.forEach((item, i) => {
          const bx = startX + i * (boxW + gap)
          const by = ly + lh / 2 + 2
          const pulse = Math.sin(t * 2 + li * 1.5 + i * 0.8) * 0.5 + 0.5

          ctx.globalAlpha = alpha * (0.5 + pulse * 0.3)
          ctx.fillStyle = `rgba(${layer.color}, ${0.1 + pulse * 0.1})`
          ctx.strokeStyle = `rgba(${layer.color}, ${0.25 + pulse * 0.15})`
          ctx.lineWidth = 0.6
          ctx.beginPath()
          ctx.roundRect(bx, by, boxW, boxH, 3)
          ctx.fill(); ctx.stroke()

          ctx.globalAlpha = alpha * (0.5 + pulse * 0.3)
          ctx.font = '600 7.5px "Geist", sans-serif'
          ctx.fillStyle = `rgba(${layer.color}, 0.9)`
          ctx.fillText(item, bx + 5, by + 12)
        })

        ctx.restore()

        if (li < layers.length - 1) {
          const nextLayer = layers[li + 1]
          const arrowPulse = Math.sin(t * 3 + li * 2) * 0.5 + 0.5
          ctx.save()
          ctx.globalAlpha = alpha * arrowPulse * 0.5
          ctx.strokeStyle = `rgba(${layer.color}, 0.35)`
          ctx.lineWidth = 1
          ctx.setLineDash([4, 4])

          for (let ai = 0; ai < 3; ai++) {
            const ax = lx + lw * (0.25 + ai * 0.25)
            ctx.beginPath()
            ctx.moveTo(ax, ly)
            ctx.lineTo(ax, nextLayer.y + nextLayer.h)
            ctx.stroke()

            const progress = (t * 0.8 + ai * 0.33 + li * 0.5) % 1
            const py = nextLayer.y + nextLayer.h + (ly - nextLayer.y - nextLayer.h) * progress
            ctx.fillStyle = `rgba(${layer.color}, 0.7)`
            ctx.beginPath()
            ctx.arc(ax, py, 2, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.setLineDash([])
          ctx.restore()
        }
      })

      ctx.save()
      ctx.globalAlpha = 0.12
      ctx.font = '600 42px "Fraunces", serif'
      ctx.fillStyle = 'rgba(74, 63, 224, 0.4)'
      ctx.fillText('SAA', W - 140, 55)
      ctx.restore()

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}/>
}

// Shared dark radial backdrop used by every programme animation below —
// same treatment as Cloud LaunchPad/Architect, just tinted to each
// programme's own muted accent so every card reads as one family.
function paintBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number, colorRgb: string, alpha = 0.10) {
  const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7)
  bg.addColorStop(0, `rgba(${colorRgb}, ${alpha})`)
  bg.addColorStop(1, 'rgba(11,11,13,0.95)')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
}

// Data LaunchPad — a live analytics readout: bars breathing to a trend
// line, the vocabulary of the programme itself (Excel/SQL/Python/BI).
function DataLaunchpadAnim() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const W = 600, H = 340
    canvas.width = W * 2; canvas.height = H * 2
    ctx.scale(2, 2)
    let raf = 0; let t = 0
    const C = '90, 158, 116'
    const bars = Array.from({ length: 11 }, (_, i) => ({ x: 60 + i * 45, phase: i * 0.55 }))
    const labels = ['SQL', 'Excel', 'Python', 'Power BI']

    const draw = () => {
      t += 0.02
      ctx.clearRect(0, 0, W, H)
      paintBackdrop(ctx, W, H, C)

      const baseline = 260
      const points: [number, number][] = []
      bars.forEach(b => {
        const wave = Math.sin(t + b.phase) * 0.5 + 0.5
        const h = 36 + wave * 130
        ctx.fillStyle = `rgba(${C}, ${0.12 + wave * 0.12})`
        ctx.strokeStyle = `rgba(${C}, ${0.3 + wave * 0.2})`
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.roundRect(b.x, baseline - h, 24, h, 3)
        ctx.fill(); ctx.stroke()
        points.push([b.x + 12, baseline - h])
      })

      ctx.strokeStyle = `rgba(${C}, 0.55)`
      ctx.lineWidth = 1.2
      ctx.beginPath()
      points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
      ctx.stroke()
      points.forEach(([x, y]) => {
        ctx.fillStyle = `rgba(${C}, 0.85)`
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill()
      })

      ctx.font = '600 9px "Geist", sans-serif'
      ctx.fillStyle = `rgba(${C}, 0.35)`
      labels.forEach((label, i) => ctx.fillText(label, 60 + i * 130, 36 + Math.sin(t * 0.8 + i) * 4))

      ctx.save()
      ctx.globalAlpha = 0.12
      ctx.font = '600 42px "Fraunces", serif'
      ctx.fillStyle = `rgba(${C}, 0.6)`
      ctx.fillText('DATA', W - 150, 310)
      ctx.restore()

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}/>
}

// Data Architect — a pipeline: source feeding through ETL into a
// warehouse and out to a dashboard, with packets actually flowing.
function DataArchitectAnim() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const W = 600, H = 340
    canvas.width = W * 2; canvas.height = H * 2
    ctx.scale(2, 2)
    let raf = 0; let t = 0
    const C = '69, 125, 92'
    const stages = [
      { x: 80,  label: 'Source' },
      { x: 227, label: 'ETL' },
      { x: 374, label: 'Warehouse' },
      { x: 521, label: 'Dashboard' },
    ]
    const y = 170

    const draw = () => {
      t += 0.015
      ctx.clearRect(0, 0, W, H)
      paintBackdrop(ctx, W, H, C)

      ctx.strokeStyle = `rgba(${C}, 0.22)`
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(stages[0].x, y); ctx.lineTo(stages[stages.length - 1].x, y); ctx.stroke()

      for (let s = 0; s < stages.length - 1; s++) {
        for (let p = 0; p < 3; p++) {
          const progress = (t * 0.6 + p * 0.33 + s * 0.2) % 1
          const px = stages[s].x + (stages[s + 1].x - stages[s].x) * progress
          ctx.fillStyle = `rgba(${C}, ${0.85 - progress * 0.35})`
          ctx.beginPath(); ctx.arc(px, y, 2.4, 0, Math.PI * 2); ctx.fill()
        }
      }

      stages.forEach((s, i) => {
        const pulse = Math.sin(t * 2 + i) * 0.5 + 0.5
        ctx.fillStyle = `rgba(${C}, ${0.12 + pulse * 0.1})`
        ctx.strokeStyle = `rgba(${C}, 0.4)`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(s.x - 34, y - 20, 68, 40, 4)
        ctx.fill(); ctx.stroke()

        ctx.font = '600 9px "Geist", sans-serif'
        ctx.fillStyle = `rgba(${C}, 0.85)`
        ctx.textAlign = 'center'
        ctx.fillText(s.label, s.x, y + 3)
        ctx.textAlign = 'left'
      })

      ctx.save()
      ctx.globalAlpha = 0.12
      ctx.font = '600 42px "Fraunces", serif'
      ctx.fillStyle = `rgba(${C}, 0.6)`
      ctx.fillText('ETL', W - 110, 80)
      ctx.restore()

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}/>
}

// Dev LaunchPad — an editor typing itself out, line by line, cursor
// included — the most literal "hands-on building" visual of the set.
function DevLaunchpadAnim() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const W = 600, H = 340
    canvas.width = W * 2; canvas.height = H * 2
    ctx.scale(2, 2)
    let raf = 0; let t = 0
    const C = '201, 138, 59'
    const lines = [
      [0, 90], [20, 140], [20, 70], [40, 110], [20, 60], [0, 100],
      [0, 40], [20, 130], [40, 90], [20, 50], [0, 80], [0, 30],
    ]

    const draw = () => {
      t += 0.02
      ctx.clearRect(0, 0, W, H)
      paintBackdrop(ctx, W, H, C, 0.08)

      const fx = 60, fy = 40, fw = 480, fh = 260
      ctx.strokeStyle = `rgba(${C}, 0.3)`
      ctx.lineWidth = 1
      ctx.strokeRect(fx, fy, fw, fh)
      ;[0, 1, 2].forEach(i => {
        ctx.fillStyle = `rgba(${C}, 0.4)`
        ctx.beginPath(); ctx.arc(fx + 14 + i * 14, fy + 14, 3, 0, Math.PI * 2); ctx.fill()
      })

      const lineH = 17
      const activeLine = Math.floor(t * 1.2) % lines.length
      lines.forEach(([indent, width], i) => {
        const ly = fy + 34 + i * lineH
        const isActive = i === activeLine
        const revealed = isActive ? Math.min(1, (t * 1.2) % 1) : 1
        ctx.fillStyle = `rgba(${C}, ${isActive ? 0.55 : 0.16})`
        ctx.fillRect(fx + 12 + indent, ly, width * revealed, 6)
        if (isActive && revealed > 0.05) {
          ctx.fillStyle = `rgba(${C}, 0.9)`
          ctx.fillRect(fx + 12 + indent + width * revealed, ly - 1, 2, 8)
        }
      })

      ctx.save()
      ctx.globalAlpha = 0.1
      ctx.font = '600 42px "Fraunces", serif'
      ctx.fillStyle = `rgba(${C}, 0.6)`
      ctx.fillText('DEV', W - 130, 325)
      ctx.restore()

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}/>
}

// AI Dev Architect — a small neural net with signal actually
// travelling layer to layer, node brightness pulsing on arrival.
function AiDevArchitectAnim() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const W = 600, H = 340
    canvas.width = W * 2; canvas.height = H * 2
    ctx.scale(2, 2)
    let raf = 0; let t = 0
    const C = '176, 102, 140'
    const layers = [3, 5, 5, 2].map((n, li) => Array.from({ length: n }, (_, i) => ({
      x: 100 + li * 133,
      y: 170 + (i - (n - 1) / 2) * 42,
    })))

    const draw = () => {
      t += 0.015
      ctx.clearRect(0, 0, W, H)
      paintBackdrop(ctx, W, H, C)

      for (let li = 0; li < layers.length - 1; li++) {
        layers[li].forEach((a, ai) => {
          layers[li + 1].forEach((b, bi) => {
            const pulse = Math.sin(t * 2 + ai * 0.7 + bi * 0.4 + li) * 0.5 + 0.5
            ctx.strokeStyle = `rgba(${C}, ${0.05 + pulse * 0.13})`
            ctx.lineWidth = 0.6
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
          })
        })
      }

      layers.forEach((layer, li) => {
        layer.forEach((n, i) => {
          const pulse = Math.sin(t * 2.5 + li * 1.3 + i * 0.6) * 0.5 + 0.5
          const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 7)
          grad.addColorStop(0, `rgba(${C}, ${0.7 + pulse * 0.3})`)
          grad.addColorStop(1, `rgba(${C}, 0.05)`)
          ctx.fillStyle = grad
          ctx.beginPath(); ctx.arc(n.x, n.y, 6, 0, Math.PI * 2); ctx.fill()
        })
      })

      ctx.font = '600 9px "Geist", sans-serif'
      ctx.fillStyle = `rgba(${C}, 0.35)`;
      ['LLM', 'RAG', 'Agents', 'Prompt'].forEach((label, i) => ctx.fillText(label, 60 + i * 130, 305))

      ctx.save()
      ctx.globalAlpha = 0.12
      ctx.font = '600 42px "Fraunces", serif'
      ctx.fillStyle = `rgba(${C}, 0.6)`
      ctx.fillText('AI', W - 90, 60)
      ctx.restore()

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}/>
}

// DSA Mastery — a binary tree with a search path lighting up root to
// leaf on a loop, cycling through a few different paths.
function DsaMasteryAnim() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const W = 600, H = 340
    canvas.width = W * 2; canvas.height = H * 2
    ctx.scale(2, 2)
    let raf = 0; let t = 0
    const C = '94, 127, 176'

    interface TNode { x: number; y: number; children: number[] }
    const nodes: TNode[] = []
    const levelY = [50, 140, 230, 300]
    for (let level = 0; level < 4; level++) {
      const count = 2 ** level
      const spacing = W / (count + 1)
      for (let i = 0; i < count; i++) nodes.push({ x: spacing * (i + 1), y: levelY[level], children: [] })
    }
    let cursor = 1
    for (let i = 0; i < 7 && cursor < nodes.length; i++) {
      nodes[i].children.push(cursor++)
      if (cursor < nodes.length) nodes[i].children.push(cursor++)
    }
    const paths = [[0, 1, 3, 7], [0, 1, 4, 9], [0, 2, 5, 11], [0, 2, 6, 13]]

    const draw = () => {
      t += 0.012
      ctx.clearRect(0, 0, W, H)
      paintBackdrop(ctx, W, H, C)

      ctx.strokeStyle = `rgba(${C}, 0.18)`
      ctx.lineWidth = 1
      nodes.forEach(n => n.children.forEach(ci => {
        const c = nodes[ci]
        ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(c.x, c.y); ctx.stroke()
      }))

      const cycle = 3.5
      const pathIdx = Math.floor(t / cycle) % paths.length
      const path = paths[pathIdx]
      const progress = (t % cycle) / cycle
      const litCount = Math.floor(progress * path.length)

      ctx.strokeStyle = `rgba(${C}, 0.85)`
      ctx.lineWidth = 2
      for (let i = 0; i < Math.min(litCount, path.length - 1); i++) {
        const a = nodes[path[i]], b = nodes[path[i + 1]]
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      }

      nodes.forEach((n, i) => {
        const onPath = path.slice(0, litCount + 1).includes(i)
        ctx.fillStyle = onPath ? `rgba(${C}, 0.9)` : `rgba(${C}, 0.18)`
        ctx.strokeStyle = `rgba(${C}, 0.4)`
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(n.x, n.y, onPath ? 6 : 4.5, 0, Math.PI * 2)
        ctx.fill(); ctx.stroke()
      })

      ctx.save()
      ctx.globalAlpha = 0.12
      ctx.font = '600 42px "Fraunces", serif'
      ctx.fillStyle = `rgba(${C}, 0.6)`
      ctx.fillText('DSA', W - 140, 60)
      ctx.restore()

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}/>
}

// Neutral fallback header for programmes without a dedicated animation.
function GenericProgramAnim({ Icon, colorRgb }: { Icon: React.ComponentType<{ size?: number }>; colorRgb: string }) {
  return (
    <div style={{
      width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
      position:'relative', background:`radial-gradient(circle,rgba(${colorRgb},0.14) 0%,transparent 70%)`,
    }}>
      <Icon size={72}/>
    </div>
  )
}

// Every programme gets a bespoke animated visual tied to its own
// domain; any future slug without an entry here falls back to
// GenericProgramAnim automatically (a new DB row still renders fine).
const ANIM_BY_SLUG: Record<string, React.ComponentType> = {
  'cloud-launchpad':  CloudLaunchpadAnim,
  'cloud-architect':  CloudArchitectAnim,
  'data-launchpad':   DataLaunchpadAnim,
  'data-architect':   DataArchitectAnim,
  'dev-launchpad':    DevLaunchpadAnim,
  'ai-dev-architect': AiDevArchitectAnim,
  'dsa-mastery':      DsaMasteryAnim,
}

// ─────────────────────────────────────────────────────────────
// STACK — Apple-style pinned card sequence.
//
// A single tall section (one viewport per card) is pinned in place
// via ScrollTrigger while a scrubbed GSAP timeline drives the actual
// motion: each card starts translated fully below the frame, slides
// up to fill it, and the card it covers recedes (scaled down, dimmed,
// softly blurred) rather than just vanishing — that combination is
// what reads as "depth" instead of a flat crossfade.
//
// Below a 900px viewport, and whenever the user has requested reduced
// motion, the whole pin/scrub rig is skipped: cards render as a plain
// stacked list (see .stack-card default styles) so nothing scroll-jacks
// on phones or for anyone who's opted out of this kind of motion.
// ─────────────────────────────────────────────────────────────

export default function ProgrammeStack({ programmes }: { programmes: ProgramCard[] }) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const frameRef   = useRef<HTMLDivElement>(null)
  const cardRefs   = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (programmes.length < 2) return
    const section = sectionRef.current
    if (!section || !frameRef.current) return

    const cards = cardRefs.current.filter((el): el is HTMLDivElement => el !== null)
    if (cards.length !== programmes.length) return

    const mql = window.matchMedia('(min-width: 900px)')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!mql.matches || reduceMotion) return // static stacked fallback (default CSS)

    // Only reserve the tall N-viewport scroll track once the pin/scrub
    // rig is actually activating — on the static fallback path (mobile,
    // reduced motion) the section keeps its natural document height so
    // there's no leftover empty scroll space below the stacked cards.
    section.style.height = `${programmes.length * 100}vh`

    const ctx = gsap.context(() => {
      frameRef.current!.classList.add('stack-frame--active')
      cards.forEach(c => c.classList.add('stack-card--active'))

      gsap.set(cards[0], { yPercent: 0, scale: 1, opacity: 1, filter: 'blur(0px)' })
      for (let i = 1; i < cards.length; i++) {
        gsap.set(cards[i], { yPercent: 100 })
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1,
          pin: frameRef.current,
          pinSpacing: false,
          anticipatePin: 1,
          fastScrollEnd: true,
        },
      })

      // ease:'none' on the tweens — with a scrubbed timeline the scrub
      // value above is what supplies the actual smoothing (a bit of
      // inertia/lag as it catches up to scroll position); layering a
      // power-curve ease on top of that made the mapping from scroll
      // position to card position non-linear, which showed up as a
      // slight hitch right at the handoff between one card's tween and
      // the next's. Linear tweens + scrub-driven easing is the standard
      // GSAP recipe for a scrub timeline that tracks scroll smoothly.
      for (let i = 1; i < cards.length; i++) {
        const pos = i - 1
        tl.to(cards[i - 1], {
          scale: 0.92, opacity: 0.35, filter: 'blur(3px)',
          duration: 1, ease: 'none',
        }, pos)
        tl.to(cards[i], {
          yPercent: 0, duration: 1, ease: 'none',
        }, pos)
      }
    }, section)

    return () => {
      ctx.revert()
      section.style.height = ''
    }
  }, [programmes])

  if (programmes.length === 0) return null

  return (
    <div
      ref={sectionRef}
      className="stack-section"
      style={{ position: 'relative' }}
    >
      <div ref={frameRef} className="stack-frame">
        {programmes.map((p, i) => {
          const meta = PROGRAM_META[p.slug] ?? DEFAULT_META
          const Anim = ANIM_BY_SLUG[p.slug]
          const priceLabel = p.price_inr ? `₹${p.price_inr.toLocaleString('en-IN')}` : 'Revealing Soon'
          return (
            <div
              key={p.id}
              ref={el => { cardRefs.current[i] = el }}
              className="stack-card"
              style={{ zIndex: i + 1 }}
            >
              <div className="stack-card-panel">
                <div className="stack-card-copy">
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
                    <span style={{
                      fontFamily:'var(--font-mono), monospace', fontSize:'12px', color:'var(--muted2)',
                      letterSpacing:'0.08em',
                    }}>{String(i + 1).padStart(2, '0')} / {String(programmes.length).padStart(2, '0')}</span>
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:'6px',
                      padding:'3px 10px', borderRadius:'var(--radius-pill)', fontSize:'10px', fontWeight:700,
                      letterSpacing:'0.06em', textTransform:'uppercase', fontFamily:'var(--font-mono), monospace',
                      background:'var(--card2)', color: ENROLLMENT_OPEN ? meta.color : 'var(--muted2)',
                      border:'1px solid var(--border2)',
                    }}>
                      {ENROLLMENT_OPEN && <span className="pulse-dot pulse-green"/>}
                      {ENROLLMENT_OPEN ? 'Enrolling' : 'Coming Soon'}
                    </span>
                  </div>

                  <h3 style={{
                    fontFamily:'var(--font-serif), serif', fontWeight:600,
                    fontSize:'clamp(1.8rem,3.4vw,2.8rem)', color:'var(--text)',
                    letterSpacing:'-0.02em', lineHeight:1.05, marginBottom:'12px',
                  }}>
                    {p.name}
                  </h3>
                  {p.tagline && (
                    <div style={{ fontSize:'15px', color:'var(--muted)', marginBottom:'18px' }}>{p.tagline}</div>
                  )}
                  {p.description && (
                    <p style={{ fontSize:'14px', color:'var(--muted)', lineHeight:1.7, marginBottom:'22px', maxWidth:'440px' }}>
                      {p.description}
                    </p>
                  )}

                  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'24px' }}>
                    {[p.duration_label, priceLabel].filter(Boolean).map(t => (
                      <span key={t} style={{
                        fontSize:'11px', fontWeight:600, padding:'4px 12px', borderRadius:'var(--radius-pill)',
                        background:'var(--card2)', border:'1px solid var(--border)', color:meta.color,
                        fontFamily:'var(--font-mono), monospace',
                      }}>{t}</span>
                    ))}
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'28px' }}>
                    {p.learning_outcomes.slice(0, 4).map(f => (
                      <div key={f} style={{ display:'flex', gap:'8px', fontSize:'13px', color:'var(--muted)' }}>
                        <Check size={14} style={{ color:meta.color, flexShrink:0, marginTop:'2px' }}/>{f}
                      </div>
                    ))}
                  </div>

                  <Link href={`/programs/${p.slug}`} className="btn btn-primary">View Programme</Link>
                </div>

                <div className="stack-card-art">
                  {Anim ? <Anim/> : <GenericProgramAnim Icon={meta.icon} colorRgb={meta.colorRgb}/>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        .stack-frame { position: relative; }
        .stack-card {
          background: var(--bg);
          padding: 32px clamp(20px,4vw,48px);
          border-top: 1px solid var(--border);
        }
        .stack-card-panel {
          max-width: 1200px; margin: 0 auto;
          display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr);
          gap: clamp(32px,5vw,64px); align-items: center;
        }
        .stack-card-art {
          aspect-ratio: 16/10; border-radius: var(--radius);
          overflow: hidden; border: 1px solid var(--border);
          clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%);
        }

        @media (max-width: 767px) {
          .stack-card-panel { grid-template-columns: 1fr !important; }
          .stack-card-art { order: -1; }
        }

        /* Desktop, motion-enabled: pin + stack via GSAP */
        @media (min-width: 900px) {
          .stack-frame--active {
            height: 100vh; overflow: hidden;
          }
          .stack-card--active {
            position: absolute; inset: 0;
            display: flex; align-items: center;
            border-top: none;
            will-change: transform, opacity, filter;
          }
          .stack-card--active .stack-card-panel { width: 100%; }
        }
      `}</style>
    </div>
  )
}
