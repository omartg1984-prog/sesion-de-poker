import { useEffect, useRef } from 'react'

/**
 * Vuelve a pedir los datos cuando la app regresa a primer plano.
 *
 * Como varios admins pueden estar tocando la misma partida desde sus teléfonos, lo
 * que tienes en pantalla puede haber quedado viejo mientras mirabas otra cosa. Esto
 * no es tiempo real, pero cubre el caso común: guardas el celular, lo vuelves a
 * sacar, y ves lo que hay ahora.
 */
export function useRecargarAlVolver(recargar: () => void, activo = true) {
  const fn = useRef(recargar)
  fn.current = recargar

  useEffect(() => {
    if (!activo) return
    const alVolver = () => {
      if (document.visibilityState === 'visible') fn.current()
    }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [activo])
}
