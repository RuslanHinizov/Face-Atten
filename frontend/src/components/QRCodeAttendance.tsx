import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  QrCode,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Copy,
  Download,
  Smartphone,
  Users,
  X
} from 'lucide-react'

interface QRCodeAttendanceProps {
  sessionId?: string
  sessionName?: string
  onClose?: () => void
}

interface QRScanResult {
  studentId: string
  studentName: string
  timestamp: Date
  status: 'success' | 'late' | 'already_marked' | 'invalid'
}

export function QRCodeAttendance({ sessionId = 'demo', sessionName = 'Demo Session', onClose }: QRCodeAttendanceProps) {
  const { t } = useTranslation()
  const [qrCode, setQrCode] = useState<string>('')
  const [expiresIn, setExpiresIn] = useState(300) // 5 minutes
  const [scanResults, setScanResults] = useState<QRScanResult[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<'generate' | 'scan' | 'results'>('generate')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Generate QR code
  const generateQRCode = async () => {
    setIsGenerating(true)
    
    // Create unique attendance code
    const attendanceCode = `ATT-${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Generate QR code using canvas
    const qrData = JSON.stringify({
      type: 'attendance',
      sessionId,
      code: attendanceCode,
      expires: Date.now() + 300000, // 5 minutes
      url: `${window.location.origin}/attend/${attendanceCode}`
    })

    // Simple QR code generation (in production, use a library like qrcode)
    setQrCode(qrData)
    setExpiresIn(300)
    setIsGenerating(false)
  }

  // Countdown timer
  useEffect(() => {
    if (expiresIn > 0 && qrCode) {
      const timer = setInterval(() => {
        setExpiresIn(prev => {
          if (prev <= 1) {
            setQrCode('')
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [expiresIn, qrCode])

  // Draw QR code on canvas
  useEffect(() => {
    if (qrCode && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const size = 200
      canvas.width = size
      canvas.height = size

      // Simple QR-like pattern (in production, use proper QR library)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)

      ctx.fillStyle = '#000000'
      const cellSize = size / 25

      // Generate pattern based on qrCode hash
      for (let i = 0; i < 25; i++) {
        for (let j = 0; j < 25; j++) {
          const hash = (qrCode.charCodeAt((i * 25 + j) % qrCode.length) + i + j) % 3
          if (hash === 0 || (i < 7 && j < 7) || (i < 7 && j > 17) || (i > 17 && j < 7)) {
            ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize)
          }
        }
      }

      // Draw position markers
      const drawMarker = (x: number, y: number) => {
        ctx.fillStyle = '#000000'
        ctx.fillRect(x, y, 7 * cellSize, 7 * cellSize)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(x + cellSize, y + cellSize, 5 * cellSize, 5 * cellSize)
        ctx.fillStyle = '#000000'
        ctx.fillRect(x + 2 * cellSize, y + 2 * cellSize, 3 * cellSize, 3 * cellSize)
      }

      drawMarker(0, 0)
      drawMarker(0, 18 * cellSize)
      drawMarker(18 * cellSize, 0)
    }
  }, [qrCode])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const copyToClipboard = () => {
    if (qrCode) {
      const data = JSON.parse(qrCode)
      navigator.clipboard.writeText(data.url)
    }
  }

  const downloadQR = () => {
    if (canvasRef.current) {
      const link = document.createElement('a')
      link.download = `attendance-qr-${sessionId}.png`
      link.href = canvasRef.current.toDataURL()
      link.click()
    }
  }

  // Simulate scan result (in production, this would come from WebSocket)
  const simulateScan = () => {
    const mockStudents = [
      { id: '1', name: 'Асанов Нұрлан' },
      { id: '2', name: 'Бекова Айгүл' },
      { id: '3', name: 'Сәрсенов Арман' },
    ]
    const student = mockStudents[Math.floor(Math.random() * mockStudents.length)]
    const statuses: QRScanResult['status'][] = ['success', 'late', 'already_marked']
    
    setScanResults(prev => [{
      studentId: student.id,
      studentName: student.name,
      timestamp: new Date(),
      status: statuses[Math.floor(Math.random() * statuses.length)]
    }, ...prev].slice(0, 20))
  }

  const getStatusIcon = (status: QRScanResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />
      case 'late':
        return <Clock className="w-4 h-4 text-amber-500" />
      case 'already_marked':
        return <XCircle className="w-4 h-4 text-blue-500" />
      case 'invalid':
        return <XCircle className="w-4 h-4 text-red-500" />
    }
  }

  const getStatusText = (status: QRScanResult['status']) => {
    switch (status) {
      case 'success':
        return t('qr.statusSuccess')
      case 'late':
        return t('qr.statusLate')
      case 'already_marked':
        return t('qr.statusAlreadyMarked')
      case 'invalid':
        return t('qr.statusInvalid')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-lg border border-[var(--color-border)] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[var(--color-border)] bg-gradient-to-r from-indigo-500 to-purple-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <QrCode className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{t('qr.title')}</h2>
                <p className="text-sm text-white/80">{sessionName}</p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-border)]">
          {(['generate', 'scan', 'results'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {tab === 'generate' && t('qr.tabGenerate')}
              {tab === 'scan' && t('qr.tabScan')}
              {tab === 'results' && `${t('qr.tabResults')} (${scanResults.length})`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'generate' && (
            <div className="text-center space-y-4">
              {qrCode ? (
                <>
                  <div className="inline-block p-4 bg-white rounded-2xl shadow-lg">
                    <canvas ref={canvasRef} className="mx-auto" />
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 text-[var(--color-text-muted)]">
                    <Clock className="w-4 h-4" />
                    <span className={`font-mono ${expiresIn < 60 ? 'text-red-500' : ''}`}>
                      {t('qr.expiresIn')}: {formatTime(expiresIn)}
                    </span>
                  </div>

                  <div className="flex justify-center gap-2">
                    <button
                      onClick={copyToClipboard}
                      className="btn btn-secondary"
                    >
                      <Copy className="w-4 h-4" />
                      {t('qr.copyLink')}
                    </button>
                    <button
                      onClick={downloadQR}
                      className="btn btn-secondary"
                    >
                      <Download className="w-4 h-4" />
                      {t('qr.download')}
                    </button>
                  </div>

                  <button
                    onClick={generateQRCode}
                    className="btn btn-primary w-full"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t('qr.regenerate')}
                  </button>
                </>
              ) : (
                <>
                  <div className="w-48 h-48 mx-auto bg-[var(--color-bg)] rounded-2xl flex items-center justify-center border-2 border-dashed border-[var(--color-border)]">
                    <QrCode className="w-16 h-16 text-[var(--color-text-muted)]" />
                  </div>
                  <p className="text-[var(--color-text-muted)]">
                    {t('qr.generateDescription')}
                  </p>
                  <button
                    onClick={generateQRCode}
                    disabled={isGenerating}
                    className="btn btn-primary w-full"
                  >
                    {isGenerating ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <QrCode className="w-4 h-4" />
                    )}
                    {t('qr.generate')}
                  </button>
                </>
              )}
            </div>
          )}

          {activeTab === 'scan' && (
            <div className="text-center space-y-4">
              <div className="w-full aspect-square bg-[var(--color-bg)] rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-[var(--color-border)]">
                <Smartphone className="w-16 h-16 text-[var(--color-text-muted)] mb-4" />
                <p className="text-[var(--color-text-muted)] text-sm px-4">
                  {t('qr.scanInstructions')}
                </p>
              </div>
              
              {/* Demo button */}
              <button
                onClick={simulateScan}
                className="btn btn-secondary w-full"
              >
                <Users className="w-4 h-4" />
                {t('qr.simulateScan')}
              </button>
            </div>
          )}

          {activeTab === 'results' && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {scanResults.length === 0 ? (
                <div className="text-center py-8 text-[var(--color-text-muted)]">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>{t('qr.noScans')}</p>
                </div>
              ) : (
                scanResults.map((result, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-[var(--color-bg)] rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(result.status)}
                      <div>
                        <p className="font-medium text-[var(--color-text)]">
                          {result.studentName}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {result.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                      result.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                      result.status === 'late' ? 'bg-amber-100 text-amber-700' :
                      result.status === 'already_marked' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {getStatusText(result.status)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
