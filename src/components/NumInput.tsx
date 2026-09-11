import { useEffect, useRef, useState } from 'react'
import { num } from '../lib/money'

interface Props {
  value: number
  onChange: (v: number) => void
  /** `numeric` para conteos enteros, `decimal` para dinero. */
  mode?: 'numeric' | 'decimal'
  /** Mostrar "0" en vez de dejar el campo vacío. */
  showZero?: boolean
  placeholder?: string
  className?: string
  'aria-label'?: string
}

/**
 * Campo numérico que deja escribir con calma: guarda el texto tal cual mientras el
 * usuario teclea y solo se resincroniza con el valor de fuera cuando no está enfocado
 * (así el reparto automático puede reacomodar los campos de los demás jugadores).
 */
export default function NumInput({
  value,
  onChange,
  mode = 'numeric',
  showZero = false,
  placeholder = '0',
  className = '',
  'aria-label': ariaLabel,
}: Props) {
  const asText = (v: number) => (v === 0 && !showZero ? '' : String(v))
  const [text, setText] = useState(() => asText(value))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current && num(text) !== value) setText(asText(value))
    // solo reaccionamos al valor de fuera; `text` es estado local del campo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input
      type="number"
      min="0"
      step={mode === 'numeric' ? '1' : 'any'}
      inputMode={mode}
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
      onFocus={() => {
        focused.current = true
      }}
      onBlur={() => {
        focused.current = false
        setText(asText(num(text)))
      }}
      onChange={(e) => {
        setText(e.target.value)
        onChange(mode === 'numeric' ? Math.max(0, Math.floor(num(e.target.value))) : num(e.target.value))
      }}
    />
  )
}
