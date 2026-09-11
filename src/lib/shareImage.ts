import { moneyShort, signed } from './money'
import { dibujarLiga, dibujarNumeros, type DatosLiga, type DatosNumeros } from './imagenTablas'
import {
  CREAM,
  GOLD,
  GOLD_SOFT,
  LOSS,
  MEDALS,
  NEUTRO,
  WIN,
  ellipsis,
  lineaTenue,
  makeCanvas,
  pintarMesa,
  roundRect,
} from './lienzo'

/* La paleta y las brochas se reexportan por comodidad: quien dibuja ya importa de aquí. */
export * from './lienzo'

/*
 * Las imágenes para mandar por WhatsApp: resultados de cash, de torneo, y —vía
 * imagenTablas.ts— la tabla de la liga y los números de una noche.
 *
 * Reciben datos ya masticados, no el estado de la app: así sirve igual para cash que
 * para torneo, y para lo que venga, sin que el dibujo sepa de dónde salieron.
 */

export interface FilaCash {
  nombre: string
  entrada: number
  recompra: number
  final: number
  pl: number
}

export interface DatosCash {
  tipo: 'cash'
  titulo: string
  subtitulo: string
  filas: FilaCash[]
  totalMesa: number
}

export interface LugarTorneo {
  lugar: number
  pct: number
  premio: number
  ganador: string | null
}

export interface DatosTorneo {
  tipo: 'torneo'
  titulo: string
  subtitulo: string
  bolsa: number
  jugadores: number
  recompras: number
  addons: number
  lugares: LugarTorneo[]
}

export type DatosImagen = DatosCash | DatosTorneo | DatosLiga | DatosNumeros

/* ---------- cash ---------- */

function dibujarCash(d: DatosCash): HTMLCanvasElement {
  const filas = [...d.filas].sort((a, b) => b.pl - a.pl)

  const W = 1000
  const pad = 44
  const headerH = 180
  const theadH = 58
  const rowH = 76
  const footerH = 120
  const H = headerH + theadH + rowH * Math.max(filas.length, 1) + footerH + pad

  const { cv, ctx } = makeCanvas(W, H)
  pintarMesa(ctx, W, H, d.titulo, d.subtitulo, '♠ ♥ ♣ ♦')

  const colName = pad + 26
  const cEnt = 500
  const cRec = 660
  const cFin = 810
  const cRes = W - pad

  ctx.font = "600 16px 'Inter',Arial,sans-serif"
  ctx.fillStyle = 'rgba(255,255,255,.65)'
  ctx.textAlign = 'left'
  ctx.fillText('JUGADOR', colName, headerH + theadH / 2 + 5)
  ctx.textAlign = 'right'
  ctx.fillText('Entrada', cEnt, headerH + theadH / 2 + 5)
  ctx.fillText('Recompra', cRec, headerH + theadH / 2 + 5)
  ctx.fillText('Final', cFin, headerH + theadH / 2 + 5)
  ctx.fillText('Resultado', cRes, headerH + theadH / 2 + 5)
  lineaTenue(ctx, pad, W - pad, headerH + theadH)

  let ry = headerH + theadH
  filas.forEach((r, i) => {
    if (i % 2 === 1) {
      ctx.fillStyle = 'rgba(255,255,255,.05)'
      roundRect(ctx, pad - 6, ry + 4, W - 2 * pad + 12, rowH - 8, 10)
      ctx.fill()
    }
    const midY = ry + rowH / 2 + 7

    ctx.textAlign = 'left'
    let nameX = colName
    if (r.pl > 0.005 && MEDALS[i]) {
      ctx.font = "22px 'Inter',Arial,sans-serif"
      ctx.fillText(MEDALS[i], colName - 4, midY)
      nameX = colName + 34
    }
    ctx.fillStyle = '#ffffff'
    ctx.font = "600 26px 'Oswald',Arial,sans-serif"
    ctx.fillText(ellipsis(r.nombre, 16), nameX, midY)

    ctx.textAlign = 'right'
    ctx.font = "500 22px 'Inter',Arial,sans-serif"
    ctx.fillStyle = CREAM
    ctx.fillText(moneyShort(r.entrada), cEnt, midY)
    ctx.fillText(r.recompra > 0 ? moneyShort(r.recompra) : '—', cRec, midY)
    ctx.fillText(moneyShort(r.final), cFin, midY)

    ctx.fillStyle = r.pl > 0.005 ? WIN : r.pl < -0.005 ? LOSS : NEUTRO
    ctx.font = "700 26px 'Oswald',Arial,sans-serif"
    ctx.fillText(signed(r.pl), cRes, midY)
    ry += rowH
  })

  lineaTenue(ctx, pad, W - pad, ry + 8)
  ctx.textAlign = 'left'
  ctx.fillStyle = GOLD
  ctx.font = "600 22px 'Inter',Arial,sans-serif"
  ctx.fillText('Total en la mesa: ' + moneyShort(d.totalMesa), colName, ry + 50)
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,.5)'
  ctx.font = "400 18px 'Inter',Arial,sans-serif"
  ctx.fillText('♠ Sesión de Póker', W - pad, ry + 50)

  return cv
}

/* ---------- torneo ---------- */

function dibujarTorneo(d: DatosTorneo): HTMLCanvasElement {
  const W = 1000
  const pad = 44
  const headerH = 170
  const poolH = 120
  const theadH = 54
  const rowH = 76
  const footerH = 110
  const H = headerH + poolH + theadH + rowH * Math.max(d.lugares.length, 1) + footerH + pad

  const { cv, ctx } = makeCanvas(W, H)
  pintarMesa(ctx, W, H, d.titulo, d.subtitulo, '🏆 TORNEO')

  ctx.fillStyle = 'rgba(255,255,255,.06)'
  roundRect(ctx, pad, headerH - 6, W - 2 * pad, poolH - 16, 16)
  ctx.fill()
  ctx.strokeStyle = 'rgba(180,142,67,.65)'
  ctx.lineWidth = 2
  roundRect(ctx, pad, headerH - 6, W - 2 * pad, poolH - 16, 16)
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.fillStyle = CREAM
  ctx.font = "600 18px 'Inter',Arial,sans-serif"
  ctx.fillText('BOLSA A REPARTIR', W / 2, headerH + 34)
  ctx.fillStyle = GOLD_SOFT
  ctx.font = "700 46px 'Oswald',Arial,sans-serif"
  ctx.fillText(moneyShort(d.bolsa), W / 2, headerH + 82)

  const colName = pad + 22
  const cPct = 470
  const cPrize = 700
  const cWin = W - pad
  const y = headerH + poolH

  ctx.font = "600 16px 'Inter',Arial,sans-serif"
  ctx.fillStyle = 'rgba(255,255,255,.65)'
  ctx.textAlign = 'left'
  ctx.fillText('LUGAR', colName, y + theadH / 2 + 5)
  ctx.textAlign = 'right'
  ctx.fillText('%', cPct, y + theadH / 2 + 5)
  ctx.fillText('PREMIO', cPrize, y + theadH / 2 + 5)
  ctx.fillText('GANADOR', cWin, y + theadH / 2 + 5)
  lineaTenue(ctx, pad, W - pad, y + theadH)

  let ry = y + theadH
  d.lugares.forEach((po, i) => {
    if (i % 2 === 1) {
      ctx.fillStyle = 'rgba(255,255,255,.05)'
      roundRect(ctx, pad - 6, ry + 4, W - 2 * pad + 12, rowH - 8, 10)
      ctx.fill()
    }
    const midY = ry + rowH / 2 + 7

    ctx.textAlign = 'left'
    ctx.font = "26px 'Inter',Arial,sans-serif"
    ctx.fillStyle = '#ffffff'
    ctx.fillText(MEDALS[i] || '🎖', colName, midY)
    ctx.font = "700 28px 'Oswald',Arial,sans-serif"
    ctx.fillText(po.lugar + 'º', colName + 44, midY)

    ctx.textAlign = 'right'
    ctx.font = "500 22px 'Inter',Arial,sans-serif"
    ctx.fillStyle = CREAM
    ctx.fillText(po.pct + '%', cPct, midY)
    ctx.fillStyle = WIN
    ctx.font = "700 26px 'Oswald',Arial,sans-serif"
    ctx.fillText(moneyShort(po.premio), cPrize, midY)

    ctx.fillStyle = '#ffffff'
    ctx.font = "600 24px 'Oswald',Arial,sans-serif"
    ctx.fillText(ellipsis(po.ganador || '—', 14), cWin, midY)
    ry += rowH
  })

  lineaTenue(ctx, pad, W - pad, ry + 8)
  ctx.textAlign = 'left'
  ctx.fillStyle = GOLD
  ctx.font = "600 20px 'Inter',Arial,sans-serif"
  ctx.fillText(
    `${d.jugadores} jugadores · ${d.recompras} recompras · ${d.addons} add-ons`,
    colName,
    ry + 48,
  )
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,.5)'
  ctx.font = "400 18px 'Inter',Arial,sans-serif"
  ctx.fillText('♠ Sesión de Póker', W - pad, ry + 48)

  return cv
}

/* ---------- API pública ---------- */

/** Espera a que carguen las fuentes para que la imagen salga con la tipografía correcta. */
export async function construirLienzo(d: DatosImagen): Promise<HTMLCanvasElement> {
  try {
    await document.fonts?.ready
  } catch {
    /* si el navegador no expone document.fonts, se dibuja con los fallbacks */
  }
  if (d.tipo === 'liga') return dibujarLiga(d)
  if (d.tipo === 'numeros') return dibujarNumeros(d)
  return d.tipo === 'torneo' ? dibujarTorneo(d) : dibujarCash(d)
}

export function lienzoABlob(cv: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    cv.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen'))),
      'image/png',
    )
  })
}

export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export const NOMBRE_IMAGEN = 'resultados-poker.png'

/** Comparte el PNG con la hoja nativa; si no se puede, lo descarga. */
export async function compartirImagen(d: DatosImagen): Promise<'compartida' | 'descargada'> {
  const blob = await lienzoABlob(await construirLienzo(d))
  const archivo = new File([blob], NOMBRE_IMAGEN, { type: 'image/png' })
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: 'Resultados de Póker' })
      return 'compartida'
    } catch (err) {
      // el usuario canceló la hoja de compartir: no descargamos a sus espaldas
      if (err instanceof DOMException && err.name === 'AbortError') return 'compartida'
    }
  }
  descargarBlob(blob, NOMBRE_IMAGEN)
  return 'descargada'
}

export async function descargarImagen(d: DatosImagen) {
  descargarBlob(await lienzoABlob(await construirLienzo(d)), NOMBRE_IMAGEN)
}
