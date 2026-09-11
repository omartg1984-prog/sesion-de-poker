import { Download, Trash2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { exportBackup, importBackup } from '../lib/backup'
import { currentSession, useSession } from '../store/session'

/** Exportar / importar respaldo y empezar de cero. Vive dentro de la hoja de ajustes. */
export default function BackupPanel() {
  const showToast = useSession((s) => s.showToast)
  const replaceSession = useSession((s) => s.replaceSession)
  const resetSession = useSession((s) => s.resetSession)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <section>
      <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
        La sesión se guarda sola en este dispositivo. El respaldo sirve para pasarla a otro
        celular o para no perderla si borras los datos del navegador.
      </p>

      <button
        type="button"
        className="btn btn-gold mb-2.5"
        onClick={() => {
          exportBackup(currentSession(useSession.getState()))
          showToast('Respaldo guardado')
        }}
      >
        <Download size={17} strokeWidth={2.4} />
        Guardar respaldo
      </button>

      <button type="button" className="btn btn-ghost mb-2.5" onClick={() => fileRef.current?.click()}>
        <Upload size={17} strokeWidth={2.4} />
        Cargar respaldo
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
            showToast('Respaldo cargado')
          } catch {
            showToast('Archivo inválido')
          }
        }}
      />

      <button
        type="button"
        className="btn bg-loss/10 text-loss hover:bg-loss/16"
        onClick={() => {
          if (window.confirm('¿Borrar todo y empezar de cero?')) {
            resetSession()
            showToast('Nueva sesión')
          }
        }}
      >
        <Trash2 size={17} strokeWidth={2.4} />
        Nueva sesión
      </button>
    </section>
  )
}
