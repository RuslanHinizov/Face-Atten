import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, FileSpreadsheet, Loader2 } from 'lucide-react'
import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'
import { useAttendanceStore } from '../store/attendanceStore'

export function ExportButtons() {
  const { t } = useTranslation()
  const { attendanceRecords, currentSession } = useAttendanceStore()
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isExportingExcel, setIsExportingExcel] = useState(false)

  const formatTime = (date: Date | undefined) => {
    if (!date) return '—'
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (minutes: number) => {
    if (minutes === 0) return '—'
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'present':
        return t('reports.present')
      case 'late':
        return t('reports.late')
      case 'absent':
        return t('reports.absent')
      default:
        return status
    }
  }

  const exportToPdf = async () => {
    setIsExportingPdf(true)

    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()

      // Title
      doc.setFontSize(20)
      doc.setTextColor(100, 100, 100)
      doc.text(t('reports.title'), pageWidth / 2, 20, { align: 'center' })

      // Session info
      if (currentSession) {
        doc.setFontSize(12)
        doc.setTextColor(120, 120, 120)
        doc.text(currentSession.name, pageWidth / 2, 30, { align: 'center' })
        doc.text(
          `${formatTime(currentSession.startTime)} - ${formatTime(currentSession.endTime)}`,
          pageWidth / 2,
          38,
          { align: 'center' }
        )
      }

      // Summary stats
      const studentRecords = attendanceRecords.filter((r) => r.person.role === 'student')
      const present = studentRecords.filter((r) => r.status === 'present').length
      const late = studentRecords.filter((r) => r.status === 'late').length
      const absent = studentRecords.filter((r) => r.status === 'absent').length

      doc.setFontSize(10)
      doc.setTextColor(80, 80, 80)
      doc.text(`${t('reports.present')}: ${present}`, 20, 55)
      doc.text(`${t('reports.late')}: ${late}`, 70, 55)
      doc.text(`${t('reports.absent')}: ${absent}`, 120, 55)

      // Table header
      let yPos = 70
      doc.setFillColor(240, 240, 240)
      doc.rect(15, yPos - 5, pageWidth - 30, 10, 'F')
      doc.setFontSize(9)
      doc.setTextColor(60, 60, 60)
      doc.text(t('reports.name'), 20, yPos)
      doc.text(t('reports.status'), 80, yPos)
      doc.text(t('reports.entryTime'), 120, yPos)
      doc.text(t('reports.totalTime'), 160, yPos)

      // Table rows
      yPos += 10
      doc.setTextColor(80, 80, 80)

      studentRecords.forEach((record, index) => {
        if (yPos > 270) {
          doc.addPage()
          yPos = 20
        }

        // Alternate row background
        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250)
          doc.rect(15, yPos - 4, pageWidth - 30, 8, 'F')
        }

        doc.text(record.person.name.substring(0, 25), 20, yPos)
        doc.text(getStatusText(record.status), 80, yPos)
        doc.text(formatTime(record.firstEntry), 120, yPos)
        doc.text(formatDuration(record.totalTimeMinutes), 160, yPos)

        yPos += 8
      })

      // Footer
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(
        `Generated on ${new Date().toLocaleString()}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      )

      // Save
      const fileName = `attendance-report-${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)
    } catch (error) {
      console.error('Error exporting PDF:', error)
    } finally {
      setIsExportingPdf(false)
    }
  }

  const exportToExcel = async () => {
    setIsExportingExcel(true)

    try {
      // Prepare data
      const studentRecords = attendanceRecords.filter((r) => r.person.role === 'student')

      const data = studentRecords.map((record) => ({
        [t('reports.name')]: record.person.name,
        [t('reports.status')]: getStatusText(record.status),
        [t('reports.entryTime')]: formatTime(record.firstEntry),
        [t('reports.exitTime')]: record.events.filter((e) => e.eventType === 'exit').length > 0
          ? formatTime(record.events.filter((e) => e.eventType === 'exit').pop()?.timestamp)
          : '—',
        [t('reports.totalTime')]: formatDuration(record.totalTimeMinutes),
        [`${t('reports.late')} (min)`]: record.lateByMinutes > 0 ? Math.round(record.lateByMinutes) : 0,
      }))

      // Create workbook
      const wb = XLSX.utils.book_new()

      // Students sheet
      const ws = XLSX.utils.json_to_sheet(data)

      // Set column widths
      ws['!cols'] = [
        { wch: 25 }, // Name
        { wch: 12 }, // Status
        { wch: 12 }, // Entry Time
        { wch: 12 }, // Exit Time
        { wch: 12 }, // Total Time
        { wch: 12 }, // Late
      ]

      XLSX.utils.book_append_sheet(wb, ws, t('reports.students'))

      // Summary sheet
      const present = studentRecords.filter((r) => r.status === 'present').length
      const late = studentRecords.filter((r) => r.status === 'late').length
      const absent = studentRecords.filter((r) => r.status === 'absent').length

      const summaryData = [
        { Metric: t('reports.present'), Value: present },
        { Metric: t('reports.late'), Value: late },
        { Metric: t('reports.absent'), Value: absent },
        { Metric: 'Total', Value: studentRecords.length },
        { Metric: 'Attendance %', Value: `${Math.round(((present + late) / studentRecords.length) * 100)}%` },
      ]

      const summaryWs = XLSX.utils.json_to_sheet(summaryData)
      summaryWs['!cols'] = [{ wch: 20 }, { wch: 15 }]
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

      // Save
      const fileName = `attendance-report-${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)
    } catch (error) {
      console.error('Error exporting Excel:', error)
    } finally {
      setIsExportingExcel(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* PDF Export */}
      <button
        onClick={exportToPdf}
        disabled={isExportingPdf || attendanceRecords.length === 0}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExportingPdf ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileText className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">{t('reports.exportPdf')}</span>
        <span className="sm:hidden">PDF</span>
      </button>

      {/* Excel Export */}
      <button
        onClick={exportToExcel}
        disabled={isExportingExcel || attendanceRecords.length === 0}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExportingExcel ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">{t('reports.exportExcel')}</span>
        <span className="sm:hidden">Excel</span>
      </button>
    </div>
  )
}
