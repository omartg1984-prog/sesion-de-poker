import { useEffect } from 'react'
import { useSession } from '../store/session'

/** Aviso breve abajo de la pantalla. */
export default function Toast() {
  const toast = useSession((s) => s.toast)
  const clearToast = useSession((s) => s.clearToast)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(clearToast, 1800)
    return () => clearTimeout(t)
  }, [toast, clearToast])

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 left-1/2 z-60 -translate-x-1/2 rounded-full bg-[#111] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,.4)] transition-opacity ${
        toast ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {toast ?? ''}
    </div>
  )
}
