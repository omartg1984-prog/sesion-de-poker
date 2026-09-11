import { useEffect } from 'react'
import { useApp } from '../store/app'

/** Aviso breve abajo de la pantalla. */
export default function Toast() {
  const aviso = useApp((s) => s.aviso)
  const limpiarAviso = useApp((s) => s.limpiarAviso)

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(limpiarAviso, 2600)
    return () => clearTimeout(t)
  }, [aviso, limpiarAviso])

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] z-60 flex justify-center px-4 transition-opacity ${
        aviso ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <span className="max-w-full rounded-full bg-[#111] px-5 py-3 text-center text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,.4)]">
        {aviso ?? ''}
      </span>
    </div>
  )
}
