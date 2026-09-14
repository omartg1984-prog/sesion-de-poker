import { moneyShort, signed } from './money'
import { compartirArchivoNativo, esNativo, guardarArchivoNativo } from './nativo'
import {
  dibujarLiga,
  dibujarNumeros,
  dibujarTabla,
  type DatosLiga,
  type DatosNumeros,
  type DatosTabla,
} from './imagenTablas'
import {
  CREAM,
  MARCA,
  MARCA_ALTA,
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
  /* De dónde salió la bolsa. No es lo mismo una de pura entrada que una donde la mitad
     fueron recompras: el que la ve en el chat quiere saber eso. */
  dineroEntradas: number
  dineroRecompras: number
  dineroAddons: number
  lugares: LugarTorneo[]
}

export type DatosImagen = DatosCash | DatosTorneo | DatosLiga | DatosNumeros | DatosTabla

/*
 * La caja de la bolsa: el número que todos buscan primero cuando les llega la imagen al
 * chat. Antes en cash era un renglón chico al pie, del tamaño de la firma, así que
 * había que sumar de cabeza para saber de cuánto fue la noche.
 *
 * Debajo va de qué se compone, que es la otra mitad de la pregunta: no es lo mismo una
 * bolsa de $12,000 de pura entrada que una donde la mitad fueron recompras.
 */
const ALTO_BOLSA = 136

function dibujarBolsa(
  ctx: CanvasRenderingContext2D,
  W: number,
  pad: number,
  arriba: number,
  rotulo: string,
  monto: number,
  desglose: string,
) {
  const alto = ALTO_BOLSA - 16
  ctx.fillStyle = 'rgba(255,255,255,.06)'
  roundRect(ctx, pad, arriba, W - 2 * pad, alto, 16)
  ctx.fill()
  ctx.strokeStyle = 'rgba(223,31,46,.7)'
  ctx.lineWidth = 2
  roundRect(ctx, pad, arriba, W - 2 * pad, alto, 16)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = CREAM
  ctx.font = "600 18px 'Inter',Arial,sans-serif"
  ctx.fillText(rotulo, W / 2, arriba + 36)

  ctx.fillStyle = MARCA_ALTA
  ctx.font = "700 52px 'Khand',Arial,sans-serif"
  ctx.fillText(moneyShort(monto), W / 2, arriba + 88)

  if (desglose) {
    ctx.fillStyle = 'rgba(255,255,255,.6)'
    ctx.font = "500 17px 'Inter',Arial,sans-serif"
    ctx.fillText(desglose, W / 2, arriba + 114)
  }
}

/* ---------- cash ---------- */

function dibujarCash(d: DatosCash): HTMLCanvasElement {
  const filas = [...d.filas].sort((a, b) => b.pl - a.pl)

  const W = 1000
  const pad = 44
  const headerH = 180
  const theadH = 58
  const rowH = 76
  const footerH = 120
  const H =
    headerH + ALTO_BOLSA + theadH + rowH * Math.max(filas.length, 1) + footerH + pad

  const { cv, ctx } = makeCanvas(W, H)
  pintarMesa(ctx, W, H, d.titulo, d.subtitulo, '♠ ♥ ♣ ♦')

  const entradas = filas.reduce((t, r) => t + r.entrada, 0)
  const recompras = filas.reduce((t, r) => t + r.recompra, 0)
  dibujarBolsa(
    ctx,
    W,
    pad,
    headerH - 6,
    'EN LA MESA',
    d.totalMesa,
    recompras > 0
      ? `${moneyShort(entradas)} de entradas · ${moneyShort(recompras)} en recompras`
      : `${filas.length} jugadores de entrada`,
  )

  const arribaTabla = headerH + ALTO_BOLSA
  const colName = pad + 26
  const cEnt = 500
  const cRec = 660
  const cFin = 810
  const cRes = W - pad

  ctx.font = "600 16px 'Inter',Arial,sans-serif"
  ctx.fillStyle = 'rgba(255,255,255,.65)'
  ctx.textAlign = 'left'
  ctx.fillText('JUGADOR', colName, arribaTabla + theadH / 2 + 5)
  ctx.textAlign = 'right'
  ctx.fillText('Entrada', cEnt, arribaTabla + theadH / 2 + 5)
  ctx.fillText('Recompra', cRec, arribaTabla + theadH / 2 + 5)
  ctx.fillText('Final', cFin, arribaTabla + theadH / 2 + 5)
  ctx.fillText('Resultado', cRes, arribaTabla + theadH / 2 + 5)
  lineaTenue(ctx, pad, W - pad, arribaTabla + theadH)

  let ry = arribaTabla + theadH
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
    ctx.font = "600 26px 'Khand',Arial,sans-serif"
    ctx.fillText(ellipsis(r.nombre, 16), nameX, midY)

    ctx.textAlign = 'right'
    ctx.font = "500 22px 'Inter',Arial,sans-serif"
    ctx.fillStyle = CREAM
    ctx.fillText(moneyShort(r.entrada), cEnt, midY)
    ctx.fillText(r.recompra > 0 ? moneyShort(r.recompra) : '—', cRec, midY)
    ctx.fillText(moneyShort(r.final), cFin, midY)

    ctx.fillStyle = r.pl > 0.005 ? WIN : r.pl < -0.005 ? LOSS : NEUTRO
    ctx.font = "700 26px 'Khand',Arial,sans-serif"
    ctx.fillText(signed(r.pl), cRes, midY)
    ry += rowH
  })

  lineaTenue(ctx, pad, W - pad, ry + 8)
  ctx.textAlign = 'left'
  ctx.fillStyle = MARCA
  ctx.font = "600 22px 'Inter',Arial,sans-serif"
  ctx.fillText(
    `${filas.length} ${filas.length === 1 ? 'jugador' : 'jugadores'} en la mesa`,
    colName,
    ry + 50,
  )
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,.5)'
  ctx.font = "400 18px 'Inter',Arial,sans-serif"
  ctx.fillText('♠ OnlyCards', W - pad, ry + 50)

  return cv
}

/* ---------- torneo ---------- */

function dibujarTorneo(d: DatosTorneo): HTMLCanvasElement {
  const W = 1000
  const pad = 44
  const headerH = 170
  const theadH = 54
  const rowH = 76
  const footerH = 110
  const H =
    headerH + ALTO_BOLSA + theadH + rowH * Math.max(d.lugares.length, 1) + footerH + pad

  const { cv, ctx } = makeCanvas(W, H)
  pintarMesa(ctx, W, H, d.titulo, d.subtitulo, '🏆 TORNEO')

  const partes = [`${moneyShort(d.dineroEntradas)} de entradas`]
  if (d.dineroRecompras > 0) partes.push(`${moneyShort(d.dineroRecompras)} en recompras`)
  if (d.dineroAddons > 0) partes.push(`${moneyShort(d.dineroAddons)} en add-ons`)
  dibujarBolsa(ctx, W, pad, headerH - 6, 'BOLSA A REPARTIR', d.bolsa, partes.join(' · '))

  const poolH = ALTO_BOLSA
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
    ctx.font = "700 28px 'Khand',Arial,sans-serif"
    ctx.fillText(po.lugar + 'º', colName + 44, midY)

    ctx.textAlign = 'right'
    ctx.font = "500 22px 'Inter',Arial,sans-serif"
    ctx.fillStyle = CREAM
    ctx.fillText(po.pct + '%', cPct, midY)
    ctx.fillStyle = WIN
    ctx.font = "700 26px 'Khand',Arial,sans-serif"
    ctx.fillText(moneyShort(po.premio), cPrize, midY)

    ctx.fillStyle = '#ffffff'
    ctx.font = "600 24px 'Khand',Arial,sans-serif"
    ctx.fillText(ellipsis(po.ganador || '—', 14), cWin, midY)
    ry += rowH
  })

  lineaTenue(ctx, pad, W - pad, ry + 8)
  ctx.textAlign = 'left'
  ctx.fillStyle = MARCA
  ctx.font = "600 20px 'Inter',Arial,sans-serif"
  ctx.fillText(
    `${d.jugadores} jugadores · ${d.recompras} recompras · ${d.addons} add-ons`,
    colName,
    ry + 48,
  )
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,.5)'
  ctx.font = "400 18px 'Inter',Arial,sans-serif"
  ctx.fillText('♠ OnlyCards', W - pad, ry + 48)

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
  if (d.tipo === 'tabla') return await dibujarTabla(d)
  if (d.tipo === 'liga') return await dibujarLiga(d)
  if (d.tipo === 'numeros') return await dibujarNumeros(d)
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
const TITULO_COMPARTIR = 'Resultados de póker'

/** Comparte el PNG con la hoja del sistema; si no se puede, lo descarga. */
export async function compartirImagen(d: DatosImagen): Promise<'compartida' | 'descargada'> {
  const blob = await lienzoABlob(await construirLienzo(d))

  /* Dentro del APK, el WebView no trae `navigator.share`: hay que pasar por el plugin. */
  if (esNativo()) {
    await compartirArchivoNativo(blob, NOMBRE_IMAGEN, TITULO_COMPARTIR)
    return 'compartida'
  }

  const archivo = new File([blob], NOMBRE_IMAGEN, { type: 'image/png' })
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: TITULO_COMPARTIR })
      return 'compartida'
    } catch (err) {
      // el usuario canceló la hoja de compartir: no descargamos a sus espaldas
      if (err instanceof DOMException && err.name === 'AbortError') return 'compartida'
    }
  }
  descargarBlob(blob, NOMBRE_IMAGEN)
  return 'descargada'
}

/** Guarda el PNG. Devuelve dónde quedó, que en el teléfono no es obvio. */
export async function descargarImagen(d: DatosImagen): Promise<string> {
  const blob = await lienzoABlob(await construirLienzo(d))
  /* Una descarga que arranca la página se pierde sin avisar dentro del APK. */
  if (esNativo()) return await guardarArchivoNativo(blob, NOMBRE_IMAGEN)
  descargarBlob(blob, NOMBRE_IMAGEN)
  return 'Imagen descargada'
}
