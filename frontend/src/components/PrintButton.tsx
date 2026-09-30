import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Printer } from 'lucide-react'

interface PrintButtonProps {
    title?: string
    className?: string
}

export const PrintButton = memo(({ title, className = '' }: PrintButtonProps) => {
    const { t } = useTranslation()

    const handlePrint = useCallback(() => {
        // Add print header if title is provided
        if (title) {
            const printHeader = document.getElementById('print-header')
            if (printHeader) {
                printHeader.textContent = title
            }
        }

        // Trigger browser print
        window.print()
    }, [title])

    return (
        <button
            onClick={handlePrint}
            className={`btn btn-secondary no-print ${className}`}
            title={t('reports.print')}
        >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">{t('reports.print')}</span>
        </button>
    )
})

PrintButton.displayName = 'PrintButton'

export default PrintButton
