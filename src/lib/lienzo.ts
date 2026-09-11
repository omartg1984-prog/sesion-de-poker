/*
 * Lo que comparten todas las imágenes que salen de la app: la paleta y las cuatro
 * brochas básicas (fieltro, marco, bordes redondos, línea tenue).
 *
 * Vive aparte de shareImage.ts a propósito: ahí están los dibujos de cash y torneo,
 * que a su vez llaman a los de imagenTablas.ts, y si las brochas vivieran junto a
 * ellos los dos archivos se importarían en círculo y el primero en cargar reventaría.
 *
 * Los colores son los mismos de la app (ver index.css), en su versión para fondo
 * oscuro. El rojo de la marca sube a #ff5560 porque el #df1f2e de la app se apaga
 * sobre el negro; y el título grande va en blanco, no en rojo, para que el rojo
 * siga significando algo cuando aparece.
 */

export const NOCHE_ALTO = '#2a1016'
export const NOCHE_HONDO = '#100e12'
export const MARCA = '#ff5560'
export const MARCA_ALTA = '#ffffff'
export const CREAM = '#cfcac2'
export const WIN = '#4fc785'
export const LOSS = '#ff6b6b'
export const NEUTRO = '#8d8a86'
export const MEDALS = ['🥇', '🥈', '🥉']

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function ellipsis(texto: string, max: number): string {
  return texto.length > max ? texto.slice(0, max - 1) + '…' : texto
}

export function makeCanvas(w: number, h: number) {
  const scale = 2 // 2x para que se vea nítida en el celular
  const cv = document.createElement('canvas')
  cv.width = w * scale
  cv.height = h * scale
  const ctx = cv.getContext('2d')!
  ctx.scale(scale, scale)
  return { cv, ctx }
}

/** Fondo oscuro con marco rojo y encabezado, común a todas las imágenes. */
export function pintarMesa(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  titulo: string,
  subtitulo: string,
  gorro: string,
) {
  const g = ctx.createRadialGradient(w / 2, 60, 80, w / 2, h * 0.4, h)
  g.addColorStop(0, NOCHE_ALTO)
  g.addColorStop(1, NOCHE_HONDO)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(223,31,46,.95)'
  ctx.lineWidth = 5
  roundRect(ctx, 16, 16, w - 32, h - 32, 26)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = MARCA
  ctx.font = "600 22px 'Khand',Arial,sans-serif"
  ctx.fillText(gorro, w / 2, 58)
  ctx.fillStyle = MARCA_ALTA
  ctx.font = "700 48px 'Khand',Arial,sans-serif"
  ctx.fillText(titulo.toUpperCase(), w / 2, 110)
  ctx.fillStyle = CREAM
  ctx.font = "400 24px 'Inter',Arial,sans-serif"
  ctx.fillText(subtitulo, w / 2, 146)
}

export function lineaTenue(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number) {
  ctx.strokeStyle = 'rgba(255,255,255,.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x2, y)
  ctx.stroke()
}

/*
 * Las fotos de perfil en el lienzo.
 *
 * Se guardan como data URL, así que cargan al instante y sin pedir permiso a ningún
 * servidor: si vinieran de otro dominio, el navegador marcaría el lienzo como
 * contaminado y `toBlob` se negaría a entregar la imagen para compartir.
 */

/** Devuelve null en vez de fallar: una foto rota no debe tumbar la imagen entera. */
export function cargarImagen(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  return new Promise((resolver) => {
    const img = new Image()
    img.onload = () => resolver(img)
    img.onerror = () => resolver(null)
    img.src = src
  })
}

/** Carga varias a la vez y las devuelve en el mismo orden. */
export const cargarImagenes = (fuentes: (string | null)[]) => Promise.all(fuentes.map(cargarImagen))

/**
 * La foto recortada en círculo, con su aro. Si no hay foto dibuja la inicial, igual
 * que el avatar de la app.
 */
export function dibujarAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  nombre: string,
  cx: number,
  cy: number,
  radio: number,
  aro = MARCA,
) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radio, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  if (img) {
    // Se recorta al centro para que una foto rectangular no salga estirada.
    const lado = Math.min(img.width, img.height)
    ctx.drawImage(
      img,
      (img.width - lado) / 2,
      (img.height - lado) / 2,
      lado,
      lado,
      cx - radio,
      cy - radio,
      radio * 2,
      radio * 2,
    )
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.12)'
    ctx.fillRect(cx - radio, cy - radio, radio * 2, radio * 2)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.font = `${Math.round(radio * 1.1)}px 'Khand',Arial,sans-serif`
    ctx.fillText((nombre.trim()[0] || '?').toUpperCase(), cx, cy + radio * 0.4)
  }
  ctx.restore()

  ctx.strokeStyle = aro
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(cx, cy, radio, 0, Math.PI * 2)
  ctx.stroke()
}
