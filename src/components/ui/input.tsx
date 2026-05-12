import * as React from "react"
import { cn } from "@/lib/utils"
import { sanitizeInput } from "@/lib/utils/sanitize"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  sanitize?: boolean
  maxLength?: number
  validateInput?: (value: string) => string | null
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onChange, sanitize = false, maxLength, validateInput, ...props }, ref) => {
    const [error, setError] = React.useState<string | null>(null)
    const [touched, setTouched] = React.useState(false)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null)
      
      if (!e || !e.target) {
        return
      }
      
      // Sanitize if requested and for text inputs
      if (sanitize && (type === 'text' || type === 'email' || type === 'search' || type === 'url' || !type) && e.target.value) {
        try {
          e.target.value = sanitizeInput(e.target.value)
        } catch (sanitizeError) {
          console.error('Error sanitizing input:', sanitizeError)
          setError('Entrada inválida detectada')
          return
        }
      }
      
      // Apply max length if specified
      if (maxLength && e.target.value.length > maxLength) {
        e.target.value = e.target.value.substring(0, maxLength)
      }
      
      // Validate input if validator provided
      if (validateInput && e.target.value) {
        try {
          const validationError = validateInput(e.target.value)
          if (validationError) {
            setError(validationError)
          }
        } catch (validationError) {
          console.error('Error validating input:', validationError)
          setError('Erro de validação')
        }
      }
      
      try {
        onChange?.(e)
      } catch (changeError) {
        console.error('Error in onChange handler:', changeError)
        setError('Erro ao processar entrada')
      }
    }

    const handleBlur = () => {
      setTouched(true)
    }

    // Bloqueia alteração via scroll do mouse em inputs numéricos.
    // Caso contrário, o usuário foca no campo, digita "1000", e ao rolar a
    // página o navegador interpreta o wheel como step (-1) e o valor cai
    // para 999. Tirar o foco no wheel anula esse comportamento.
    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      if (type === 'number') {
        e.currentTarget.blur()
      }
    }

    return (
      <div className="w-full">
        <input
          type={type}
          maxLength={maxLength}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            error && touched && "border-red-500",
            className
          )}
          onChange={handleChange}
          onBlur={handleBlur}
          onWheel={handleWheel}
          ref={ref}
          {...props}
        />
        {error && touched && (
          <p className="text-sm text-red-500 mt-1">{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }