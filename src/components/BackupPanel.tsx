import { useRef } from 'react'
import { exportBackup, importBackup } from '../lib/backup'
import { currentSession, useSession } from '../store/session'

/** Exportar / importar respaldo y empezar de cero. */
export default function BackupPanel() {
  const showToast = useSession((s) => s.showToast)
  const replaceSession = useSession((s) => s.replaceSession)
  const resetSession = useSession((s) => s.resetSession)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <details className="mb-3.5 rounded-[var(--radius-card)] bg-paper px-4 py-3.5 shadow-[0_8px_20px_rgba(0,0,0,.24)]">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink-soft [&::-webkit-details-marker]:hidden">
        <span>💾 Guardar / Cargar datos</span>
        <span className="ml-auto">▾</span>
      </summary>

      <div className="mt-3">
        <p className="mt-0 mb-2.5 text-[13px] text-ink-soft">
          La sesión se guarda sola en este dispositivo. El respaldo sirve para pasarla a otro
          celular o para no perderla si borras los datos del navegador.
        </p>

        <button
          type="button"
          className="btn btn-gold mb-2.5"
          onClick={() => {
            exportBackup(currentSession(useSession.getState()))
            showToast('Respaldo guardado ✅')
          }}
        >
          ⬇ Guardar respaldo (archivo)
        </button>

        <button type="button" className="btn btn-ghost mb-2.5" onClick={() => fileRef.current?.click()}>
          ⬆ Cargar respaldo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json,.txt"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            try {
              replaceSession(await importBackup(file))
              showToast('Respaldo cargado ✅')
            } catch {
              showToast('Archivo inválido')
            }
          }}
        />

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            if (window.confirm('¿Borrar todo y empezar de cero?')) {
              resetSession()
              showToast('Nueva sesión')
            }
          }}
        >
          🗑 Nueva sesión
        </button>
      </div>
    </details>
  )
}
