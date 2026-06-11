import * as React from 'react'
import { cn } from '@/lib/utils'

interface CurrencyInputProps {
  value: number | undefined | null
  onChange: (value: number | undefined) => void
  placeholder?: string
  className?: string
  id?: string
  disabled?: boolean
  autoFocus?: boolean
  showPrefix?: boolean
}

function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, placeholder = '0,00', className, id, disabled, autoFocus, showPrefix = true }, ref) => {
    const display =
      value === undefined || value === null || isNaN(value as number)
        ? ''
        : formatBRL(value as number)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, '')
      if (digits === '') {
        onChange(undefined)
        return
      }
      onChange(parseInt(digits, 10) / 100)
    }

    const input = (
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        autoFocus={autoFocus}
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          showPrefix && 'pl-9',
          className
        )}
      />
    )

    if (!showPrefix) return input

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
          R$
        </span>
        {input}
      </div>
    )
  }
)
CurrencyInput.displayName = 'CurrencyInput'
