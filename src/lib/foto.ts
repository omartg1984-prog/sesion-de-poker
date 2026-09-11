/** Lado máximo de una foto. Más que esto no aporta nada en un avatar. */
export const LADO_FOTO = 256

/**
 * Encoge y recorta al centro en el navegador, y devuelve un data URL.
 *
 * Se hace aquí y no en el servidor para que la foto viaje pequeña: la cámara de un
 * teléfono saca 5 MB y lo que acaba guardándose ronda los 20 KB. La usan tanto la foto
 * de perfil como la de la liga, que se guardan y se validan igual.
 */
export function encogerFoto(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onerror = () => rechazar(new Error('No se pudo leer la imagen'))
    lector.onload = () => {
      const img = new Image()
      img.onerror = () => rechazar(new Error('El archivo no es una imagen'))
      img.onload = () => {
        const lienzo = document.createElement('canvas')
        lienzo.width = LADO_FOTO
        lienzo.height = LADO_FOTO
        const ctx = lienzo.getContext('2d')!
        const lado = Math.min(img.width, img.height)
        ctx.drawImage(
          img,
          (img.width - lado) / 2,
          (img.height - lado) / 2,
          lado,
          lado,
          0,
          0,
          LADO_FOTO,
          LADO_FOTO,
        )
        resolver(lienzo.toDataURL('image/jpeg', 0.85))
      }
      img.src = String(lector.result)
    }
    lector.readAsDataURL(archivo)
  })
}
