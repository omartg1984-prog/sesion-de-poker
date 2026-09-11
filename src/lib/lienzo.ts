/*
 * Lo que comparten todas las imágenes que salen de la app: la paleta y las cuatro
 * brochas básicas (fieltro, marco, bordes redondos, línea tenue).
 *
 * Vive aparte de shareImage.ts a propósito: ahí están los dibujos de cash y torneo,
 * que a su vez llaman a los de imagenTablas.ts, y si las brochas vivieran junto a
 * ellos los dos archivos se importarían en círculo y el primero en cargar reventaría.
 *
 * Los colores son los mismos de la app (ver index.css). Sobre el fieltro oscuro el oro
 * va en tres intensidades para que no se aplane todo en un solo dorado: el más
 * brillante es el de las ganancias, que es lo que la gente busca al abrir la imagen.
 */

export const FELT_TOP = '#243020'
export const FELT_BOTTOM = '#1b241a'
export const GOLD = '#b48e43'
export const GOLD_SOFT = '#d9b063'
export const CREAM = '#d8d2c4'
export const WIN = '#f0d190'
export const LOSS = '#e4695e'
export const NEUTRO = '#9d9483'
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

/** Fondo de fieltro con marco dorado y encabezado, común a todas las imágenes. */
export function pintarMesa(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  titulo: string,
  subtitulo: string,
  gorro: string,
) {
  const g = ctx.createRadialGradient(w / 2, 60, 80, w / 2, h * 0.4, h)
  g.addColorStop(0, FELT_TOP)
  g.addColorStop(1, FELT_BOTTOM)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(180,142,67,.9)'
  ctx.lineWidth = 5
  roundRect(ctx, 16, 16, w - 32, h - 32, 26)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = GOLD
  ctx.font = "600 22px 'Oswald',Arial,sans-serif"
  ctx.fillText(gorro, w / 2, 58)
  ctx.fillStyle = GOLD_SOFT
  ctx.font = "700 48px 'Oswald',Arial,sans-serif"
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
