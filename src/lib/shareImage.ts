import type { SessionState } from '../store/types'
import {
  entradaMoney,
  finalValueOf,
  investedOf,
  moneyShort,
  num,
  payoutAmount,
  plOf,
  poolOf,
  recompraMoney,
  signed,
} from './money'

/*
 * Mismos colores que la app (ver index.css). Sobre el fieltro oscuro el oro va en tres
 * intensidades para que no se aplane todo en un solo dorado: el más brillante es el de
 * las ganancias, que es lo que la gente busca primero al abrir la imagen.
 */
const FELT_TOP = '#243020'
const FELT_BOTTOM = '#1b241a'
const GOLD = '#b48e43' // marco y etiquetas
const GOLD_SOFT = '#d9b063' // títulos
const CREAM = '#d8d2c4' // cifras neutras
const WIN = '#f0d190' // ganancias: el oro más brillante
const LOSS = '#e4695e' // pérdidas: crimson aclarado para que lea sobre oscuro
const MEDALS = ['🥇', '🥈', '🥉']

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function ellipsis(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

function subtitle(s: SessionState): string {
  return (
    s.sessionName ||
    new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  )
}

/** Fondo de fieltro con marco dorado, común a las dos imágenes. */
function paintTable(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createRadialGradient(w / 2, 60, 80, w / 2, h * 0.4, h)
  g.addColorStop(0, FELT_TOP)
  g.addColorStop(1, FELT_BOTTOM)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(180,142,67,.9)'
  ctx.lineWidth = 5
  roundRect(ctx, 16, 16, w - 32, h - 32, 26)
  ctx.stroke()
}

function makeCanvas(w: number, h: number) {
  const scale = 2 // 2x para que se vea nítida en el celular
  const cv = document.createElement('canvas')
  cv.width = w * scale
  cv.height = h * scale
  const ctx = cv.getContext('2d')!
  ctx.scale(scale, scale)
  return { cv, ctx }
}

export function drawCashCanvas(s: SessionState): HTMLCanvasElement {
  const players = s.players
    .map((p) => ({
      name: p.name || 'Sin nombre',
      entrada: entradaMoney(p),
      recompra: recompraMoney(p),
      inv: investedOf(p),
      fin: finalValueOf(p, s.colors),
      pl: plOf(p, s.colors),
    }))
    .sort((a, b) => b.pl - a.pl)

  const W = 1000
  const pad = 44
  const headerH = 180
  const theadH = 58
  const rowH = 76
  const footerH = 120
  const H = headerH + theadH + rowH * players.length + footerH + pad

  const { cv, ctx } = makeCanvas(W, H)
  paintTable(ctx, W, H)

  ctx.textAlign = 'center'
  ctx.fillStyle = GOLD
  ctx.font = "600 22px 'Oswald',Arial,sans-serif"
  ctx.fillText('♠ ♥ ♣ ♦', W / 2, 58)
  ctx.fillStyle = GOLD_SOFT
  ctx.font = "700 52px 'Oswald',Arial,sans-serif"
  ctx.fillText('SESIÓN DE PÓKER', W / 2, 112)
  ctx.fillStyle = CREAM
  ctx.font = "400 24px 'Inter',Arial,sans-serif"
  ctx.fillText(subtitle(s), W / 2, 148)

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
  ctx.strokeStyle = 'rgba(255,255,255,.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad, headerH + theadH)
  ctx.lineTo(W - pad, headerH + theadH)
  ctx.stroke()

  let ry = headerH + theadH
  players.forEach((r, i) => {
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
    ctx.fillText(ellipsis(r.name, 16), nameX, midY)

    ctx.textAlign = 'right'
    ctx.font = "500 22px 'Inter',Arial,sans-serif"
    ctx.fillStyle = CREAM
    ctx.fillText(moneyShort(r.entrada), cEnt, midY)
    ctx.fillText(r.recompra > 0 ? moneyShort(r.recompra) : '—', cRec, midY)
    ctx.fillText(moneyShort(r.fin), cFin, midY)

    ctx.fillStyle = r.pl > 0.005 ? WIN : r.pl < -0.005 ? LOSS : '#9d9483'
    ctx.font = "700 26px 'Oswald',Arial,sans-serif"
    ctx.fillText(signed(r.pl), cRes, midY)
    ry += rowH
  })

  ctx.strokeStyle = 'rgba(255,255,255,.25)'
  ctx.beginPath()
  ctx.moveTo(pad, ry + 8)
  ctx.lineTo(W - pad, ry + 8)
  ctx.stroke()
  const totalInv = players.reduce((a, b) => a + b.inv, 0)
  ctx.textAlign = 'left'
  ctx.fillStyle = GOLD
  ctx.font = "600 22px 'Inter',Arial,sans-serif"
  ctx.fillText('Total en la mesa: ' + moneyShort(totalInv), colName, ry + 50)
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,.5)'
  ctx.font = "400 18px 'Inter',Arial,sans-serif"
  ctx.fillText('♠ Sesión de Póker', W - pad, ry + 50)

  return cv
}

export function drawTournamentCanvas(s: SessionState): HTMLCanvasElement {
  const { tournament: t, players } = s
  const pool = poolOf(players, t)
  const payouts = t.payouts

  const W = 1000
  const pad = 44
  const headerH = 170
  const poolH = 120
  const theadH = 54
  const rowH = 76
  const footerH = 110
  const H = headerH + poolH + theadH + rowH * payouts.length + footerH + pad

  const { cv, ctx } = makeCanvas(W, H)
  paintTable(ctx, W, H)

  ctx.textAlign = 'center'
  ctx.fillStyle = GOLD
  ctx.font = "600 22px 'Oswald',Arial,sans-serif"
  ctx.fillText('🏆 TORNEO', W / 2, 56)
  ctx.fillStyle = GOLD_SOFT
  ctx.font = "700 50px 'Oswald',Arial,sans-serif"
  ctx.fillText('SESIÓN DE PÓKER', W / 2, 108)
  ctx.fillStyle = CREAM
  ctx.font = "400 24px 'Inter',Arial,sans-serif"
  ctx.fillText(subtitle(s), W / 2, 144)

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
  ctx.fillText(moneyShort(pool), W / 2, headerH + 82)

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
  ctx.strokeStyle = 'rgba(255,255,255,.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad, y + theadH)
  ctx.lineTo(W - pad, y + theadH)
  ctx.stroke()

  let ry = y + theadH
  payouts.forEach((po, i) => {
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
    ctx.fillText(i + 1 + 'º', colName + 44, midY)

    ctx.textAlign = 'right'
    ctx.font = "500 22px 'Inter',Arial,sans-serif"
    ctx.fillStyle = CREAM
    ctx.fillText(num(po.pct) + '%', cPct, midY)
    ctx.fillStyle = WIN
    ctx.font = "700 26px 'Oswald',Arial,sans-serif"
    ctx.fillText(moneyShort(payoutAmount(i, players, t)), cPrize, midY)

    const winner = players.find((p) => p.tourney.place === i + 1)
    ctx.fillStyle = '#ffffff'
    ctx.font = "600 24px 'Oswald',Arial,sans-serif"
    ctx.fillText(ellipsis(winner ? winner.name || 'Sin nombre' : '—', 14), cWin, midY)
    ry += rowH
  })

  ctx.strokeStyle = 'rgba(255,255,255,.25)'
  ctx.beginPath()
  ctx.moveTo(pad, ry + 8)
  ctx.lineTo(W - pad, ry + 8)
  ctx.stroke()
  const rebuysN = players.reduce((a, p) => a + num(p.tourney.rebuys), 0)
  const addonsN = players.reduce((a, p) => a + num(p.tourney.addons), 0)
  ctx.textAlign = 'left'
  ctx.fillStyle = GOLD
  ctx.font = "600 20px 'Inter',Arial,sans-serif"
  ctx.fillText(
    `${players.length} jugadores · ${rebuysN} recompras · ${addonsN} add-ons`,
    colName,
    ry + 48,
  )
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,.5)'
  ctx.font = "400 18px 'Inter',Arial,sans-serif"
  ctx.fillText('♠ Sesión de Póker', W - pad, ry + 48)

  return cv
}

/** Espera a que carguen las fuentes para que la imagen salga con la tipografía correcta. */
export async function buildCanvas(s: SessionState): Promise<HTMLCanvasElement> {
  try {
    await document.fonts?.ready
  } catch {
    /* si el navegador no expone document.fonts, se dibuja con los fallbacks */
  }
  return s.mode === 'torneo' ? drawTournamentCanvas(s) : drawCashCanvas(s)
}

export function canvasToBlob(cv: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    cv.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen'))), 'image/png')
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export const IMAGE_FILENAME = 'resultados-poker.png'

/** Comparte el PNG con la hoja nativa; si no se puede, lo descarga. */
export async function shareImage(s: SessionState): Promise<'shared' | 'downloaded'> {
  const blob = await canvasToBlob(await buildCanvas(s))
  const file = new File([blob], IMAGE_FILENAME, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Resultados de Póker' })
      return 'shared'
    } catch (err) {
      // el usuario canceló la hoja de compartir: no descargamos a sus espaldas
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared'
    }
  }
  downloadBlob(blob, IMAGE_FILENAME)
  return 'downloaded'
}

export async function downloadImage(s: SessionState) {
  downloadBlob(await canvasToBlob(await buildCanvas(s)), IMAGE_FILENAME)
}
