import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/*
 * Compartir y guardar archivos, dentro del APK y fuera de él.
 *
 * En el navegador esto lo resuelve la propia página: `navigator.share` abre la hoja de
 * compartir y un `<a download>` guarda el archivo. Dentro del APK ninguna de las dos
 * existe —el WebView de Android no trae la API de compartir, y las descargas que
 * arranca la página se pierden sin decir nada—, así que ahí hay que pasar por los
 * plugins nativos, que hablan con el sistema operativo de verdad.
 *
 * El APK abre el sitio publicado (ver capacitor.config.ts), así que este mismo código
 * corre en los dos lados: `esNativo()` decide cuál camino tomar en tiempo de ejecución.
 */

export const esNativo = () => Capacitor.isNativePlatform()

/** Los plugins reciben texto, no binario: el PNG viaja en base64. */
function aBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'))
    lector.onload = () => {
      const r = String(lector.result)
      // `readAsDataURL` devuelve "data:image/png;base64,AAAA…" y sólo interesa la cola.
      const coma = r.indexOf(',')
      resolve(coma >= 0 ? r.slice(coma + 1) : r)
    }
    lector.readAsDataURL(blob)
  })
}

/**
 * Deja el archivo en la caché de la app y devuelve la ruta que entiende el sistema.
 *
 * Va a la caché y no a Documentos a propósito: Android la limpia solo, y para
 * compartir sólo tiene que existir el tiempo que tarda la otra app en copiarlo.
 */
async function escribirEnCache(blob: Blob, nombre: string): Promise<string> {
  const { uri } = await Filesystem.writeFile({
    path: nombre,
    data: await aBase64(blob),
    directory: Directory.Cache,
  })
  return uri
}

/** Abre la hoja de compartir del sistema con el archivo ya adjunto. */
export async function compartirArchivoNativo(
  blob: Blob,
  nombre: string,
  titulo: string,
): Promise<boolean> {
  const uri = await escribirEnCache(blob, nombre)
  try {
    await Share.share({ title: titulo, files: [uri] })
    return true
  } catch (err) {
    /* Cancelar la hoja de compartir llega aquí como error; no es una falla. */
    if (String(err).toLowerCase().includes('cancel')) return true
    throw err
  }
}

/** Guarda el archivo donde el dueño del teléfono lo va a volver a encontrar. */
export async function guardarArchivoNativo(blob: Blob, nombre: string): Promise<string> {
  const datos = await aBase64(blob)
  try {
    await Filesystem.writeFile({ path: nombre, data: datos, directory: Directory.Documents })
    return 'Guardado en Documentos'
  } catch {
    /* Algunos Android no dejan escribir en Documentos sin permisos; la carpeta propia
       de la app siempre se puede, y el archivo sigue siendo visible desde Archivos. */
    await Filesystem.writeFile({ path: nombre, data: datos, directory: Directory.External })
    return 'Guardado en la carpeta de la app'
  }
}

/** Comparte texto suelto (sin archivo) por la hoja nativa. */
export async function compartirTextoNativo(texto: string, titulo: string): Promise<boolean> {
  try {
    await Share.share({ title: titulo, text: texto })
    return true
  } catch (err) {
    if (String(err).toLowerCase().includes('cancel')) return true
    throw err
  }
}
