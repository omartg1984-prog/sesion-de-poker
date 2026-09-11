import { moneyShort, signed } from './money'
import {
  CREAM,
  cargarImagenes,
  dibujarAvatar,
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

/*
 * Las dos tablas compartibles: el acumulado de la liga y los números de una noche.
 *
 * Reusan el fieltro, el marco dorado y la paleta de la imagen de resultados, para que
 * todo lo que sale de la app al chat se vea de la misma familia.
 */

export interface FilaLiga {
  puesto: number
  nombre: string
  foto: string | null
  partidas: number
  balance: number
  roi: number
  /** Títulos ganados, para presumir debajo del nombre en el podio. */
  titulos: string[]
}

export interface DatosLiga {
  tipo: 'liga'
  titulo: string
  subtitulo: string
  filas: FilaLiga[]
  partidas: number
  dineroMovido: number
}

export interface FilaNumeros {
  nombre: string
  foto: string | null
  puso: number
  saco: number
  resultado: number
}

export interface DatosNumeros {
  tipo: 'numeros'
  titulo: string
  subtitulo: string
  filas: FilaNumeros[]
  mesa: number
  contado: number
  jugadores: number
  recompras: number
  ganadores: number
}

/* ---------- tabla de la liga ---------- */

const TONO_PUESTO = ['#df1f2e', '#c9c5bd', '#a9764a']
/* El 1º y el 3º son oscuros y el 2º claro, así que el número no puede ir siempre igual. */
const TINTA_PUESTO = ['#ffffff', '#17171b', '#ffffff']

/** Podio de tres escalones. El primero va en medio y más alto, como en el pódium real. */
function dibujarPodio(
  ctx: CanvasRenderingContext2D,
  filas: FilaLiga[],
  caras: (HTMLImageElement | null)[],
  W: number,
  base: number,
) {
  const alturas = [96, 68, 50]
  const ordenVisual = [1, 0, 2] // plata a la izquierda, oro en medio, bronce a la derecha
  const ancho = 176
  const hueco = 16
  const RADIO = 30
  let x = (W - (ancho * 3 + hueco * 2)) / 2

  for (const idx of ordenVisual) {
    const fila = filas[idx]
    if (fila) {
      const alto = alturas[idx]
      const cima = base - alto
      const medio = x + ancho / 2

      ctx.fillStyle = TONO_PUESTO[idx]
      roundRect(ctx, x, cima, ancho, alto, 10)
      ctx.fill()

      ctx.textAlign = 'center'
      ctx.fillStyle = TINTA_PUESTO[idx]
      ctx.font = "700 32px 'Khand',Arial,sans-serif"
      ctx.fillText(`${idx + 1}º`, medio, cima + 38)

      // de abajo hacia arriba: saldo, nombre, título y la cara hasta arriba
      ctx.fillStyle = fila.balance > 0.005 ? WIN : fila.balance < -0.005 ? LOSS : NEUTRO
      ctx.font = "700 26px 'Khand',Arial,sans-serif"
      ctx.fillText(signed(fila.balance), medio, cima - 14)

      ctx.fillStyle = '#ffffff'
      ctx.font = "600 25px 'Khand',Arial,sans-serif"
      ctx.fillText(ellipsis(fila.nombre, 13), medio, cima - 40)

      if (fila.titulos[0]) {
        ctx.fillStyle = MARCA
        ctx.font = "600 15px 'Inter',Arial,sans-serif"
        ctx.fillText(ellipsis(fila.titulos[0], 16), medio, cima - 64)
      }

      /* El aro del primero va dorado; los otros dos en rojo de marca. */
      dibujarAvatar(
        ctx,
        caras[idx] ?? null,
        fila.nombre,
        medio,
        cima - 96 - RADIO,
        RADIO,
        idx === 0 ? '#d9b063' : MARCA,
      )
    }
    x += ancho + hueco
  }
}

export async function dibujarLiga(d: DatosLiga): Promise<HTMLCanvasElement> {
  const restantes = d.filas.slice(3)
  /* Las fotos son data URL, así que esto no sale a la red: sólo hay que esperar a que
     el navegador las decodifique antes de poder dibujarlas. */
  const caras = await cargarImagenes(d.filas.map((f) => f.foto))
  const W = 1000
  const pad = 44
  const headerH = 182
  // Alto para que encima de cada escalón quepan la cara, el título, el nombre y el saldo.
  const podioH = 292
  const theadH = 52
  const rowH = 62
  const footerH = 104
  const H =
    headerH + podioH + (restantes.length ? theadH + rowH * restantes.length : 0) + footerH + pad

  const { cv, ctx } = makeCanvas(W, H)
  pintarMesa(ctx, W, H, d.titulo, d.subtitulo, '♠ TABLA DE LA LIGA')

  dibujarPodio(ctx, d.filas, caras.slice(0, 3), W, headerH + podioH - 30)

  let ry = headerH + podioH
  if (restantes.length) {
    const colName = pad + 26
    const cPartidas = 560
    const cRoi = 740
    const cSaldo = W - pad

    ctx.font = "600 16px 'Inter',Arial,sans-serif"
    ctx.fillStyle = 'rgba(255,255,255,.65)'
    ctx.textAlign = 'left'
    ctx.fillText('JUGADOR', colName, ry + theadH / 2 + 5)
    ctx.textAlign = 'right'
    ctx.fillText('PARTIDAS', cPartidas, ry + theadH / 2 + 5)
    ctx.fillText('REND.', cRoi, ry + theadH / 2 + 5)
    ctx.fillText('SALDO', cSaldo, ry + theadH / 2 + 5)
    lineaTenue(ctx, pad, W - pad, ry + theadH)

    ry += theadH
    restantes.forEach((f, i) => {
      if (i % 2 === 1) {
        ctx.fillStyle = 'rgba(255,255,255,.05)'
        roundRect(ctx, pad - 6, ry + 3, W - 2 * pad + 12, rowH - 6, 10)
        ctx.fill()
      }
      const midY = ry + rowH / 2 + 6

      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(255,255,255,.5)'
      ctx.font = "500 20px 'Inter',Arial,sans-serif"
      ctx.fillText(`${f.puesto}º`, colName - 4, midY)
      dibujarAvatar(ctx, caras[i + 3] ?? null, f.nombre, colName + 60, ry + rowH / 2, 19)
      ctx.textAlign = 'left'
      ctx.fillStyle = '#ffffff'
      ctx.font = "600 24px 'Khand',Arial,sans-serif"
      ctx.fillText(ellipsis(f.nombre, 16), colName + 88, midY)

      ctx.textAlign = 'right'
      ctx.font = "500 20px 'Inter',Arial,sans-serif"
      ctx.fillStyle = CREAM
      ctx.fillText(String(f.partidas), cPartidas, midY)
      ctx.fillStyle = f.roi > 0 ? WIN : f.roi < 0 ? LOSS : NEUTRO
      ctx.fillText(`${f.roi > 0 ? '+' : ''}${f.roi.toFixed(0)}%`, cRoi, midY)
      ctx.font = "700 24px 'Khand',Arial,sans-serif"
      ctx.fillText(signed(f.balance), cSaldo, midY)
      ry += rowH
    })
  }

  lineaTenue(ctx, pad, W - pad, ry + 8)
  ctx.textAlign = 'left'
  ctx.fillStyle = MARCA
  ctx.font = "600 20px 'Inter',Arial,sans-serif"
  ctx.fillText(
    `${d.partidas} ${d.partidas === 1 ? 'partida' : 'partidas'} · ${moneyShort(d.dineroMovido)} movidos`,
    pad + 26,
    ry + 46,
  )
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,.5)'
  ctx.font = "400 18px 'Inter',Arial,sans-serif"
  ctx.fillText('♠ OnlyCards', W - pad, ry + 46)

  return cv
}

/* ---------- números de una noche ---------- */

export async function dibujarNumeros(d: DatosNumeros): Promise<HTMLCanvasElement> {
  const caras = await cargarImagenes(d.filas.map((f) => f.foto))
  const W = 1000
  const pad = 44
  const headerH = 176
  const statsH = 130
  const theadH = 52
  const rowH = 62
  const footerH = 96
  const H = headerH + statsH + theadH + rowH * Math.max(d.filas.length, 1) + footerH + pad

  const { cv, ctx } = makeCanvas(W, H)
  pintarMesa(ctx, W, H, d.titulo, d.subtitulo, '♠ LA NOCHE EN NÚMEROS')

  const cifras: [string, string][] = [
    ['EN LA MESA', moneyShort(d.mesa)],
    ['CONTADO', moneyShort(d.contado)],
    ['JUGADORES', String(d.jugadores)],
    ['GANARON', `${d.ganadores} de ${d.jugadores}`],
  ]
  const ancho = (W - 2 * pad - 3 * 12) / 4
  cifras.forEach(([k, v], i) => {
    const x = pad + i * (ancho + 12)
    ctx.fillStyle = 'rgba(255,255,255,.06)'
    roundRect(ctx, x, headerH - 4, ancho, statsH - 28, 14)
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,.6)'
    ctx.font = "600 14px 'Inter',Arial,sans-serif"
    ctx.fillText(k, x + ancho / 2, headerH + 28)
    ctx.fillStyle = MARCA_ALTA
    ctx.font = "700 32px 'Khand',Arial,sans-serif"
    ctx.fillText(v, x + ancho / 2, headerH + 72)
  })

  const colName = pad + 26
  const cPuso = 520
  const cSaco = 700
  const cRes = W - pad
  let ry = headerH + statsH

  ctx.font = "600 16px 'Inter',Arial,sans-serif"
  ctx.fillStyle = 'rgba(255,255,255,.65)'
  ctx.textAlign = 'left'
  ctx.fillText('JUGADOR', colName, ry + theadH / 2 + 5)
  ctx.textAlign = 'right'
  ctx.fillText('PUSO', cPuso, ry + theadH / 2 + 5)
  ctx.fillText('SACÓ', cSaco, ry + theadH / 2 + 5)
  ctx.fillText('RESULTADO', cRes, ry + theadH / 2 + 5)
  lineaTenue(ctx, pad, W - pad, ry + theadH)

  ry += theadH
  d.filas.forEach((f, i) => {
    if (i % 2 === 1) {
      ctx.fillStyle = 'rgba(255,255,255,.05)'
      roundRect(ctx, pad - 6, ry + 3, W - 2 * pad + 12, rowH - 6, 10)
      ctx.fill()
    }
    const midY = ry + rowH / 2 + 6

    dibujarAvatar(ctx, caras[i] ?? null, f.nombre, colName + 16, ry + rowH / 2, 18)

    ctx.textAlign = 'left'
    let nameX = colName + 44
    if (f.resultado > 0.005 && MEDALS[i]) {
      ctx.font = "20px 'Inter',Arial,sans-serif"
      ctx.fillStyle = '#ffffff'
      ctx.fillText(MEDALS[i], nameX, midY)
      nameX += 30
    }
    ctx.fillStyle = '#ffffff'
    ctx.font = "600 24px 'Khand',Arial,sans-serif"
    ctx.fillText(ellipsis(f.nombre, 18), nameX, midY)

    ctx.textAlign = 'right'
    ctx.font = "500 20px 'Inter',Arial,sans-serif"
    ctx.fillStyle = CREAM
    ctx.fillText(moneyShort(f.puso), cPuso, midY)
    ctx.fillText(moneyShort(f.saco), cSaco, midY)
    ctx.fillStyle = f.resultado > 0.005 ? WIN : f.resultado < -0.005 ? LOSS : NEUTRO
    ctx.font = "700 24px 'Khand',Arial,sans-serif"
    ctx.fillText(signed(f.resultado), cRes, midY)
    ry += rowH
  })

  lineaTenue(ctx, pad, W - pad, ry + 8)
  ctx.textAlign = 'left'
  ctx.fillStyle = MARCA
  ctx.font = "600 20px 'Inter',Arial,sans-serif"
  ctx.fillText(
    d.recompras > 0
      ? `${d.recompras} ${d.recompras === 1 ? 'recompra' : 'recompras'} en la noche`
      : 'Sin recompras',
    colName,
    ry + 44,
  )
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,.5)'
  ctx.font = "400 18px 'Inter',Arial,sans-serif"
  ctx.fillText('♠ OnlyCards', W - pad, ry + 44)

  return cv
}
