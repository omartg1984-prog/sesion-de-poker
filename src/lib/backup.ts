import type { SessionState } from '../store/types'
import { downloadBlob } from './shareImage'

/** Nombre de archivo a partir del nombre de la sesión, sin caracteres raros. */
function backupName(sessionName: string): string {
  const stamp =
    sessionName
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'poker'
  return `respaldo-${stamp}.json`
}

export function exportBackup(s: SessionState) {
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' })
  downloadBlob(blob, backupName(s.sessionName))
}

/** Lee un respaldo `.json`. Rechaza cualquier archivo que no traiga colores y jugadores. */
export function importBackup(file: File): Promise<SessionState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as SessionState
        if (!parsed || !Array.isArray(parsed.colors) || !Array.isArray(parsed.players)) {
          throw new Error('Archivo inválido')
        }
        resolve(parsed)
      } catch {
        reject(new Error('Archivo inválido'))
      }
    }
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsText(file)
  })
}

/**
 * `true` si la app se abrió desde un contexto efímero (p. ej. el visor de archivos de
 * WhatsApp con URL `content://`), donde el navegador no conserva el almacenamiento.
 */
export function isEphemeralContext(): boolean {
  return /^content:/i.test(location.href || '')
}

/** Copia texto al portapapeles, con respaldo para navegadores viejos. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
