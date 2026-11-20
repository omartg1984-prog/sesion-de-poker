import { moneyShort, signed, textOn } from './money'
import {
  CREAM,
  cargarImagen,
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
 * Las tablas compartibles: el acumulado de la liga, los números de una noche, y un
 * molde genérico para cualquier otra (el reparto de fichas, el del dinero).
 *
 * Reusan el fieltro, el marco dorado y la paleta de la imagen de resultados, para que
 * todo lo que sale de la app al chat se vea de la misma familia.
 */

/**
 * Una celda de la imagen, ya escrita y con su color.
 *
 * La imagen no calcula nada: la pantalla decide qué columnas se mandan y cómo se leen,
 * y aquí sólo se dibuja. Así el día que la liga quiera mandar otra cosa no hay que
 * tocar el dibujo.
 */
export interface Celda {
  texto: string
  tono?: 'win' | 'loss' | 'crema'
}

export interface FilaLiga {
  puesto: number
  nombre: string
  foto: string | null
  /** La cifra grande del podio: la misma por la que está ordenada la tabla. */
  destacado: Celda
  /** Las columnas elegidas, en el mismo orden que `columnas`. */
  celdas: Celda[]
  /**
   * Cuántos lugares subió o bajó con la última noche.
   *
   * `undefined` en el que debutó esa noche: no se movió de ningún lado, así que no le
   * toca flecha.
   */
  movida?: number
  /** Títulos ganados, para presumir debajo del nombre en el podio. */
  titulos: string[]
}

export interface DatosLiga {
  tipo: 'liga'
  titulo: string
  subtitulo: string
  /** Los encabezados de las columnas elegidas. Caben cuatro. */
  columnas: string[]
  /** Si se dibujan las flechas de lo que subió o bajó cada quien. */
  conMovidas?: boolean
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

/* Sobre el escalón claro del segundo lugar, el verde y el rojo de siempre se pierden. */
const WIN_OSCURO = '#1c7a4e'
const LOSS_OSCURO = '#b0142b'

/** El color de una celda según cómo la mandó la pantalla. */
const tintaDe = (c: Celda) =>
  c.tono === 'win' ? WIN : c.tono === 'loss' ? LOSS : c.tono === 'crema' ? CREAM : '#ffffff'

/**
 * La flecha de lo que subió o bajó: triángulo y número, en verde o en rojo.
 *
 * Se dibuja a mano y no con una letra —▲— porque el triángulo de las fuentes cambia de
 * tamaño y de posición según el teléfono que abra la imagen, y aquí tiene que verse
 * igual en todos.
 */
function dibujarMovida(
  ctx: CanvasRenderingContext2D,
  n: number,
  x: number,
  y: number,
  sobreClaro = false,
) {
  if (n === 0) {
    ctx.fillStyle = sobreClaro ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.45)'
    ctx.font = "600 18px 'Inter',Arial,sans-serif"
    ctx.textAlign = 'left'
    ctx.fillText('=', x, y)
    return
  }
  const sube = n > 0
  ctx.fillStyle = sube ? (sobreClaro ? WIN_OSCURO : WIN) : sobreClaro ? LOSS_OSCURO : LOSS
  const alto = 9
  const ancho = 11
  const cima = y - 15
  ctx.beginPath()
  if (sube) {
    ctx.moveTo(x + ancho / 2, cima)
    ctx.lineTo(x + ancho, cima + alto)
    ctx.lineTo(x, cima + alto)
  } else {
    ctx.moveTo(x, cima)
    ctx.lineTo(x + ancho, cima)
    ctx.lineTo(x + ancho / 2, cima + alto)
  }
  ctx.closePath()
  ctx.fill()
  ctx.font = "700 19px 'Inter',Arial,sans-serif"
  ctx.textAlign = 'left'
  ctx.fillText(String(Math.abs(n)), x + ancho + 4, y)
}

/** Podio de tres escalones. El primero va en medio y más alto, como en el pódium real. */
function dibujarPodio(
  ctx: CanvasRenderingContext2D,
  filas: FilaLiga[],
  caras: (HTMLImageElement | null)[],
  W: number,
  base: number,
  conMovidas = false,
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

      /* Lo que se movió con la última noche, en la esquina del escalón: es el único
         hueco libre que hay, y ahí no le estorba al nombre ni a la cifra. */
      if (conMovidas && fila.movida !== undefined)
        dibujarMovida(ctx, fila.movida, x + ancho - 50, cima + 34, idx === 1)

      // de abajo hacia arriba: la cifra, el nombre, el título y la cara hasta arriba
      ctx.fillStyle = tintaDe(fila.destacado)
      ctx.font = "700 26px 'Khand',Arial,sans-serif"
      ctx.fillText(fila.destacado.texto, medio, cima - 14)

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

  dibujarPodio(ctx, d.filas, caras.slice(0, 3), W, headerH + podioH - 30, d.conMovidas)

  let ry = headerH + podioH
  if (restantes.length) {
    const colName = pad + 26
    /*
     * Las columnas se reparten desde la derecha, que es donde tienen que quedar
     * alineadas. La pantalla manda las que eligió la casa —hasta cuatro— y aquí sólo
     * se acomodan: con menos columnas, al nombre le queda más aire.
     */
    const cols = d.columnas.slice(0, 4)
    const anchoCol = 168
    const xDe = (i: number) => W - pad - (cols.length - 1 - i) * anchoCol
    /* Hasta dónde puede crecer el nombre sin chocar con la primera columna. */
    const largoNombre = cols.length >= 4 ? 12 : cols.length === 3 ? 16 : 20

    ctx.font = "600 16px 'Inter',Arial,sans-serif"
    ctx.fillStyle = 'rgba(255,255,255,.65)'
    ctx.textAlign = 'left'
    ctx.fillText('JUGADOR', colName, ry + theadH / 2 + 5)
    ctx.textAlign = 'right'
    cols.forEach((c, i) => ctx.fillText(c, xDe(i), ry + theadH / 2 + 5))
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
      const nombre = ellipsis(f.nombre, largoNombre)
      ctx.fillText(nombre, colName + 88, midY)

      /* La flecha va pegada al nombre, no en una columna suya: así se lee como parte
         de quién es —"Chuy, que subió tres"— y no como un dato más de la tabla. */
      if (d.conMovidas && f.movida !== undefined)
        dibujarMovida(ctx, f.movida, colName + 96 + ctx.measureText(nombre).width, midY)

      ctx.textAlign = 'right'
      f.celdas.slice(0, cols.length).forEach((celda, i) => {
        /* La última columna es la que se mira primero, así que va con el tipo grande. */
        const grande = i === cols.length - 1
        ctx.font = grande
          ? "700 24px 'Khand',Arial,sans-serif"
          : "500 20px 'Inter',Arial,sans-serif"
        ctx.fillStyle = celda.tono ? tintaDe(celda) : grande ? '#ffffff' : CREAM
        ctx.fillText(celda.texto, xDe(i), midY)
      })
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

/* ---------- una tabla cualquiera ---------- */

/*
 * El molde genérico: recibe encabezados y celdas ya formateadas y las dibuja con el
 * mismo marco rojo que el resto. Existe para que cualquier tabla de la app se pueda
 * mandar al chat sin escribir un dibujo nuevo cada vez.
 */
export interface DatosTabla {
  tipo: 'tabla'
  titulo: string
  subtitulo: string
  /** La línea chica de hasta arriba, en rojo. */
  gorro: string
  columnas: string[]
  /**
   * La ficha que encabeza cada columna, cuando la columna es de un color de ficha.
   *
   * Dibujada se reconoce de un golpe y ocupa lo mismo siempre; escrita, "Amarillas"
   * junto a "Moradas" en siete columnas no cabe, y la letra se encoge hasta que la
   * tabla deja de leerse. `null` en las columnas que son de texto.
   */
  fichas?: ({ color: string; valor: number } | null)[]
  /** Celdas ya con su formato: la imagen no calcula nada. */
  filas: string[][]
  /** Foto de cada fila, para la primera columna. */
  fotos?: (string | null)[]
  /** La cara de la noche, difuminada al fondo. */
  fondo?: string | null
  pie: string
}

export async function dibujarTabla(d: DatosTabla): Promise<HTMLCanvasElement> {
  const caras = await cargarImagenes(d.fotos ?? d.filas.map(() => null))
  const fondo = d.fondo ? await cargarImagen(d.fondo) : null
  const W = 1000
  const pad = 44
  const headerH = 176
  const theadH = 52
  const rowH = 58
  const footerH = 92
  const H = headerH + theadH + rowH * Math.max(d.filas.length, 1) + footerH + pad

  const { cv, ctx } = makeCanvas(W, H)
  pintarMesa(ctx, W, H, d.titulo, d.subtitulo, d.gorro, fondo)

  /*
   * Las columnas se miden, no se reparten a ojo.
   *
   * Antes iban a intervalos iguales y alineadas a la derecha, con lo que una celda larga
   * —"800 fichas · hasta el primer descanso"— se metía encima de la de al lado y las
   * letras salían amontonadas. Ahora se mide lo más ancho de cada columna y se acomodan
   * de derecha a izquierda; si aun así no caben, la letra encoge hasta que quepan.
   */
  const colName = pad + 26
  const anchoNombre = 300
  const primeraX = d.fotos ? colName + 42 : colName
  const hueco = 26

  /* La ficha del encabezado, cuando la columna lleva una. Encoge con la letra: una
     liga con diez colores se saldría de la hoja dibujándolas siempre del mismo tamaño. */
  let radioFicha = 20
  const fichaDe = (i: number) => d.fichas?.[i] ?? null

  const FUENTE_DATO = (px: number) => `500 ${px}px 'Inter',Arial,sans-serif`
  const anchoDe = (i: number, px: number) => {
    ctx.font = FUENTE_DATO(px)
    const celdas = d.filas.map((f) => ctx.measureText(f[i] ?? '').width)
    if (fichaDe(i)) {
      celdas.push(radioFicha * 2)
    } else {
      ctx.font = "600 16px 'Inter',Arial,sans-serif"
      celdas.push(ctx.measureText((d.columnas[i] ?? '').toUpperCase()).width)
    }
    return Math.max(0, ...celdas)
  }

  const disponible = W - pad - (primeraX + anchoNombre)
  const loQueOcupan = (px: number) =>
    d.columnas.slice(1).reduce((s, _, k) => s + anchoDe(k + 1, px) + hueco, 0)
  let px = 21
  while (loQueOcupan(px) > disponible && (px > 14 || radioFicha > 12)) {
    if (px > 14) px -= 1
    else radioFicha -= 1
  }
  const anchos = d.columnas.slice(1).map((_, k) => anchoDe(k + 1, px))

  /* Cada columna termina donde empieza la siguiente: así ninguna puede pisar a otra. */
  const derechaDe: number[] = []
  let borde = W - pad
  for (let k = anchos.length - 1; k >= 0; k--) {
    derechaDe[k] = borde
    borde -= anchos[k] + hueco
  }
  const xDe = (i: number) => (i === 0 ? colName : derechaDe[i - 1])

  d.columnas.forEach((c, i) => {
    const ficha = fichaDe(i)
    if (ficha) {
      /* La ficha se dibuja pegada al borde derecho de su columna, que es donde empieza
         la cuenta de abajo: así el número queda debajo de su propia ficha. */
      const texto = moneyShort(ficha.valor).replace('$', '')
      const cuerpo = Math.min(
        (radioFicha / 20) * 13,
        ((radioFicha * 1.3) / Math.max(2, texto.length)) * 1.7,
      )
      pintarFicha(
        ctx,
        xDe(i) - radioFicha,
        headerH + theadH / 2,
        radioFicha,
        ficha.color,
        texto,
        cuerpo,
      )
      return
    }
    ctx.font = "600 16px 'Inter',Arial,sans-serif"
    ctx.fillStyle = 'rgba(255,255,255,.65)'
    ctx.textAlign = i === 0 ? 'left' : 'right'
    ctx.fillText(c.toUpperCase(), xDe(i), headerH + theadH / 2 + 5)
  })
  lineaTenue(ctx, pad, W - pad, headerH + theadH)

  let ry = headerH + theadH
  d.filas.forEach((fila, i) => {
    if (i % 2 === 1) {
      ctx.fillStyle = 'rgba(255,255,255,.05)'
      roundRect(ctx, pad - 6, ry + 3, W - 2 * pad + 12, rowH - 6, 10)
      ctx.fill()
    }
    const midY = ry + rowH / 2 + 6

    const cara = caras[i] ?? null
    let nombreX = colName
    if (d.fotos) {
      dibujarAvatar(ctx, cara, fila[0] ?? '', colName + 16, ry + rowH / 2, 17)
      nombreX = colName + 42
    }

    fila.forEach((celda, c) => {
      ctx.textAlign = c === 0 ? 'left' : 'right'
      ctx.fillStyle = '#ffffff'
      ctx.font = c === 0 ? "600 23px 'Khand',Arial,sans-serif" : FUENTE_DATO(px)
      ctx.fillText(c === 0 ? ellipsis(celda, 16) : celda, c === 0 ? nombreX : xDe(c), midY)
    })
    ry += rowH
  })

  lineaTenue(ctx, pad, W - pad, ry + 8)
  ctx.textAlign = 'left'
  ctx.fillStyle = MARCA
  ctx.font = "600 20px 'Inter',Arial,sans-serif"
  ctx.fillText(d.pie, colName, ry + 44)
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,.5)'
  ctx.font = "400 18px 'Inter',Arial,sans-serif"
  ctx.fillText('♠ OnlyCards', W - pad, ry + 44)

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

/* ---------- cuánto vale cada ficha ---------- */

/*
 * En torneo las fichas no valen lo que dice la liga: valen los puntos que se les
 * asignaron esa noche, y cambian de un torneo a otro según los montos. En la mesa eso
 * se pregunta cada quince minutos.
 *
 * Por eso esta imagen dibuja la ficha de verdad con su valor en el centro, en vez de
 * una tabla de texto: lo que se busca es el color, no el renglón.
 */
export interface DatosFichas {
  tipo: 'fichas'
  titulo: string
  subtitulo: string
  gorro: string
  fichas: { label: string; color: string; valor: number }[]
  pie: string
}

/** La misma ficha que dibuja el componente Chip, pero en canvas y con su valor dentro. */
function pintarFicha(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radio: number,
  color: string,
  valor: string,
  /* El mismo cuerpo para todas: si cada una se ajusta a sus propios dígitos, el "50"
     sale enorme junto a un "10,000" diminuto y dejan de leerse como un juego. */
  cuerpo: number,
) {
  const e = radio / 48
  /* Sobre fichas claras las muescas blancas desaparecerían; ahí van oscuras. */
  const muesca = textOn(color) === '#ffffff' ? 'rgba(255,255,255,.92)' : 'rgba(0,0,0,.35)'

  ctx.save()
  ctx.translate(cx, cy)

  ctx.beginPath()
  ctx.arc(0, 0, 48 * e, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,.22)'
  ctx.lineWidth = 2 * e
  ctx.stroke()

  /* Seis muescas en el canto: mismo reparto que el SVG de la app. */
  const paso = (2 * Math.PI * 44 * e) / 6
  ctx.beginPath()
  ctx.arc(0, 0, 44 * e, 0, Math.PI * 2)
  ctx.strokeStyle = muesca
  ctx.lineWidth = 12 * e
  ctx.setLineDash([paso * 0.46, paso * 0.54])
  ctx.stroke()
  ctx.setLineDash([])

  ctx.beginPath()
  ctx.arc(0, 0, 31 * e, 0, Math.PI * 2)
  ctx.fillStyle = '#f6f2e8'
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,.15)'
  ctx.lineWidth = 1.5 * e
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(0, 0, 36 * e, 0, Math.PI * 2)
  ctx.strokeStyle = muesca
  ctx.lineWidth = 2 * e
  ctx.setLineDash([3 * e, 4 * e])
  ctx.stroke()
  ctx.setLineDash([])

  /* El valor va en el disco central, que es lo que esta imagen viene a contestar. */
  ctx.fillStyle = '#17171b'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.round(cuerpo)}px 'Khand',Arial,sans-serif`
  ctx.fillText(valor, 0, 2 * e)
  ctx.textBaseline = 'alphabetic'
  ctx.restore()
}

export function dibujarFichas(d: DatosFichas): HTMLCanvasElement {
  const W = 1000
  const pad = 44
  const headerH = 176
  const footerH = 96

  /* Cuatro por renglón como mucho: más chicas ya no se distinguen los colores. */
  const columnas = Math.min(Math.max(d.fichas.length, 1), 4)
  const renglones = Math.ceil(d.fichas.length / columnas)
  const celda = (W - 2 * pad) / columnas
  const radio = Math.min(celda * 0.33, 82)
  const altoCelda = radio * 2 + 78
  const H = headerH + renglones * altoCelda + footerH + pad

  const { cv, ctx } = makeCanvas(W, H)
  pintarMesa(ctx, W, H, d.titulo, d.subtitulo, d.gorro)

  /* Un solo cuerpo de letra, el que le sirve al valor más largo. */
  const textos = d.fichas.map((f) => moneyShort(f.valor).replace('$', ''))
  const masLargo = Math.max(2, ...textos.map((t) => t.length))
  const escala = radio / 48
  const cuerpo = Math.min(30 * escala, ((50 * escala) / masLargo) * 1.7)

  d.fichas.forEach((f, i) => {
    const col = i % columnas
    const ren = Math.floor(i / columnas)
    const cx = pad + celda * col + celda / 2
    const cy = headerH + ren * altoCelda + radio + 10

    pintarFicha(ctx, cx, cy, radio, f.color, textos[i], cuerpo)

    ctx.textAlign = 'center'
    ctx.fillStyle = CREAM
    ctx.font = "600 24px 'Khand',Arial,sans-serif"
    ctx.fillText(ellipsis(f.label, 12), cx, cy + radio + 36)

    ctx.fillStyle = 'rgba(255,255,255,.55)'
    ctx.font = "500 17px 'Inter',Arial,sans-serif"
    ctx.fillText(`vale ${f.valor.toLocaleString('es-MX')}`, cx, cy + radio + 60)
  })

  const pieY = headerH + renglones * altoCelda + 46
  lineaTenue(ctx, pad, W - pad, pieY - 24)
  ctx.textAlign = 'left'
  ctx.fillStyle = MARCA
  ctx.font = "600 20px 'Inter',Arial,sans-serif"
  ctx.fillText(d.pie, pad + 26, pieY)
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,.5)'
  ctx.font = "400 18px 'Inter',Arial,sans-serif"
  ctx.fillText('♠ OnlyCards', W - pad, pieY)

  return cv
}
