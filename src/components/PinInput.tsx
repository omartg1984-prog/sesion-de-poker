import { useRef, useState } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  largo?: number
  label: string
  /** Envía el formulario al completar el último dígito. */
  onCompleto?: () => void
  autoFocus?: boolean
}

/**
 * Casillas de PIN. Por dentro es un solo campo numérico invisible —así el teclado del
 * teléfono, el pegar y el autocompletar funcionan normal— y las casillas son puro
 * dibujo de lo que lleva escrito.
 */
export default function PinInput({
  value,
  onChange,
  largo = 6,
  label,
  onCompleto,
  autoFocus = false,
}: Props) {
  const campo = useRef<HTMLInputElement>(null)
  const [enfocado, setEnfocado] = useState(false)

  return (
    <div
      className="relative"
      onClick={() => campo.current?.focus()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') campo.current?.blur()
      }}
    >
      <input
        ref={campo}
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label={label}
        maxLength={largo}
        autoFocus={autoFocus}
        value={value}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        onChange={(e) => {
          const limpio = e.target.value.replace(/\D/g, '').slice(0, largo)
          onChange(limpio)
          if (limpio.length === largo) onCompleto?.()
        }}
        // Invisible pero enfocable: el teclado y el cursor siguen funcionando.
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />

      <div className="pointer-events-none flex justify-center gap-2" aria-hidden="true">
        {Array.from({ length: largo }, (_, i) => {
          const lleno = i < value.length
          const activo = enfocado && i === value.length
          return (
            <span
              key={i}
              className={`flex h-12 w-11 items-center justify-center rounded-xl border-2 text-2xl transition-colors ${
                activo
                  ? 'border-marca bg-white'
                  : lleno
                    ? 'border-paper-line bg-white'
                    : 'border-paper-line bg-white/60'
              }`}
            >
              {lleno && <span className="h-3 w-3 rounded-full bg-ink" />}
            </span>
          )
        })}
      </div>
    </div>
  )
}
