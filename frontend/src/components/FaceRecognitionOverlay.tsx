import { useEffect, useRef, MutableRefObject } from 'react'
import { IdentifiedFace } from '../store/attendanceStore'

interface Props {
  facesRef: MutableRefObject<IdentifiedFace[]>
  resolutionRef: MutableRefObject<{ width: number; height: number }>
}

/**
 * Canvas-based face overlay — 30 FPS via requestAnimationFrame.
 * Reads from refs → zero React re-renders, no lag.
 */
export function FaceRecognitionOverlay({ facesRef, resolutionRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const faces = facesRef.current
      const res = resolutionRef.current
      const dpr = window.devicePixelRatio || 1
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight

      if (W === 0 || H === 0) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      // Resize canvas backing store if needed
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr)
        canvas.height = Math.round(H * dpr)
        ctx.scale(dpr, dpr)
      }

      ctx.clearRect(0, 0, W, H)

      if (faces.length === 0 || res.width === 0) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      const scaleX = W / res.width
      const scaleY = H / res.height

      for (const face of faces) {
        const [x1, y1, x2, y2] = face.bbox
        const bx = x1 * scaleX
        const by = y1 * scaleY
        const bw = (x2 - x1) * scaleX
        const bh = (y2 - y1) * scaleY
        const color = face.role === 'teacher' ? '#10b981' : '#3b82f6'
        const cs = Math.max(8, Math.min(16, bw * 0.15)) // corner size

        // Corner brackets
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.beginPath()
        // Top-left
        ctx.moveTo(bx, by + cs); ctx.lineTo(bx, by); ctx.lineTo(bx + cs, by)
        // Top-right
        ctx.moveTo(bx + bw - cs, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + cs)
        // Bottom-left
        ctx.moveTo(bx, by + bh - cs); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + cs, by + bh)
        // Bottom-right
        ctx.moveTo(bx + bw - cs, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - cs)
        ctx.stroke()

        // Label
        const confText = face.confidence > 0 ? ` ${Math.round(face.confidence * 100)}%` : ''
        const label = face.personName + confText
        const fontSize = Math.max(9, Math.min(13, bw / 7))
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`
        const textW = ctx.measureText(label).width + 8
        const textH = fontSize + 7

        ctx.fillStyle = color
        ctx.fillRect(bx, by - textH, textW, textH)
        ctx.fillStyle = '#ffffff'
        ctx.fillText(label, bx + 4, by - 4)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [facesRef, resolutionRef])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  )
}
