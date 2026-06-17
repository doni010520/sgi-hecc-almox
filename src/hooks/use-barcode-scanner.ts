import { useEffect, useRef, useCallback } from 'react'

interface BarcodeScannerOptions {
  onScan: (barcode: string) => void
  enabled?: boolean
  minLength?: number
  /** ms máximo entre caracteres para ser considerado scanner (padrão: 40ms) */
  maxGap?: number
}

/**
 * Detecta input de leitores de código de barras BT/USB HID.
 * Scanners emitem caracteres em rajada (<40ms entre teclas) e finalizam com Enter.
 * Humanos digitam mais devagar (>80ms entre teclas) — o hook ignora digitação normal.
 *
 * Só intercede quando NENHUM input/textarea comum está focado
 * (a menos que seja um input com data-barcode-input="true").
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  minLength = 4,
  maxGap = 40,
}: BarcodeScannerOptions) {
  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return

      const target = e.target as HTMLElement
      const tagName = target.tagName.toLowerCase()
      const isScanInput = target.getAttribute('data-barcode-input') === 'true'

      // Ignora digitação em inputs comuns para não interferir
      if (
        (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) &&
        !isScanInput
      ) {
        return
      }

      const now = Date.now()
      const gap = now - lastKeyTimeRef.current
      lastKeyTimeRef.current = now

      // Gap grande = nova sequência; reseta buffer
      if (gap > maxGap && bufferRef.current.length > 0) {
        bufferRef.current = ''
      }

      if (e.key === 'Enter') {
        const barcode = bufferRef.current.trim()
        if (barcode.length >= minLength) {
          onScanRef.current(barcode)
          e.preventDefault()
        }
        bufferRef.current = ''
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        return
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key

        // Auto-reset após 500ms de inatividade (evita acúmulo de lixo)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          bufferRef.current = ''
        }, 500)
      }
    },
    [enabled, maxGap, minLength],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [handleKeyDown])
}
