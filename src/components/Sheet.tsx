import { X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

interface Props {
  abierta: boolean
  onCerrar: () => void
  titulo: string
  children: ReactNode
}

/**
 * Hoja que sube desde abajo, al alcance del pulgar. Reemplaza a los `<details>`:
 * saca del scroll principal todo lo que se toca poco (ajustes, respaldo) sin
 * esconderlo en otra pantalla.
 */
export default function Sheet({ abierta, onCerrar, titulo, children }: Props) {
  // `montada` mantiene la hoja en el DOM mientras corre la animación de salida.
  const [montada, setMontada] = useState(abierta)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (abierta) {
      setMontada(true)
      // un frame de retraso para que la transición tenga desde dónde arrancar
      const t = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(t)
    }
    setVisible(false)
    const t = setTimeout(() => setMontada(false), 250)
    return () => clearTimeout(t)
  }, [abierta])

  useEffect(() => {
    if (!abierta) return
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', alTeclear)
    // mientras la hoja está abierta, el fondo no se desplaza
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = previo
    }
  }, [abierta, onCerrar])

  if (!montada) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={titulo}>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className={`absolute inset-0 cursor-default border-none bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        className={`relative flex max-h-[86dvh] w-full max-w-[640px] flex-col rounded-t-[22px] bg-paper shadow-[0_-8px_40px_rgba(0,0,0,.5)] transition-transform duration-250 ease-out ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          <div className="absolute inset-x-0 top-2 mx-auto h-1 w-10 rounded-full bg-ink/15" />
          <h2 className="mt-2 flex-1 font-display text-lg font-semibold tracking-[.5px] text-ink uppercase">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="mt-2 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-ink/8 text-ink-soft active:scale-95"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  )
}
