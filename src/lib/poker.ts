/*
 * Qué tan buena es tu mano, en números.
 *
 * Dos piezas: una que puntúa siete cartas —las dos tuyas más la mesa— y otra que juega
 * la mano miles de veces repartiendo al azar lo que falta, para decir con qué frecuencia
 * ganas. No hay fórmula cerrada para eso: se simula, que es como se calcula de verdad.
 *
 * Las cartas van como un número de 0 a 51: `valor * 4 + palo`. Es feo de leer y es a
 * propósito —se barajan y se comparan millones de veces, y un objeto por carta hace la
 * simulación varias veces más lenta—.
 */

/** 0 = 2, 1 = 3, … 8 = 10, 9 = J, 10 = Q, 11 = K, 12 = A. */
export const VALORES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
/** 0 = ♠, 1 = ♥, 2 = ♦, 3 = ♣. */
export const PALOS = ['♠', '♥', '♦', '♣']

export const carta = (valor: number, palo: number) => valor * 4 + palo
export const valorDe = (c: number) => c >> 2
export const paloDe = (c: number) => c & 3
export const nombreDe = (c: number) => `${VALORES[valorDe(c)]}${PALOS[paloDe(c)]}`

/** Las categorías, de peor a mejor. El índice es lo que pesa al comparar. */
export const CATEGORIAS = [
  'Carta alta',
  'Par',
  'Dos pares',
  'Tercia',
  'Escalera',
  'Color',
  'Full',
  'Póker',
  'Escalera de color',
]

/* Cinco desempates como mucho, cada uno de 0 a 12: con base 13 caben sin pisarse. */
const BASE = 13
const PESO = [BASE ** 5, BASE ** 4, BASE ** 3, BASE ** 2, BASE, 1]

const puntaje = (categoria: number, desempates: number[]) => {
  let total = categoria * PESO[0]
  for (let i = 0; i < 5; i++) total += (desempates[i] ?? 0) * PESO[i + 1]
  return total
}

/** La categoría que salió de un puntaje, para poder nombrarla. */
export const categoriaDe = (puntos: number) => Math.floor(puntos / PESO[0])

/**
 * El valor más alto que cierra una escalera, o -1 si no hay.
 *
 * El as sirve de los dos lados: arriba cierra A-K-Q-J-10 y abajo cierra la rueda
 * 5-4-3-2-A, que es la escalera más baja que existe.
 */
function topeDeEscalera(hay: boolean[]): number {
  for (let tope = 12; tope >= 4; tope--) {
    if (hay[tope] && hay[tope - 1] && hay[tope - 2] && hay[tope - 3] && hay[tope - 4]) return tope
  }
  /* La rueda: el as cuenta por debajo del 2 y la escalera la cierra el 5. */
  if (hay[12] && hay[3] && hay[2] && hay[1] && hay[0]) return 3
  return -1
}

/**
 * Puntúa las cinco mejores de las que haya (cinco, seis o siete cartas).
 *
 * Devuelve un número que sólo sirve para comparar con otro del mismo tipo: más alto
 * gana, igual es empate.
 */
export function evaluar(cartas: number[]): number {
  const porValor = new Array<number>(13).fill(0)
  const porPalo = new Array<number>(4).fill(0)
  const hayValor = new Array<boolean>(13).fill(false)

  for (const c of cartas) {
    const v = c >> 2
    porValor[v]++
    hayValor[v] = true
    porPalo[c & 3]++
  }

  /* ---- color y escalera de color ---- */
  const paloDeColor = porPalo.findIndex((n) => n >= 5)
  if (paloDeColor >= 0) {
    const hayDelPalo = new Array<boolean>(13).fill(false)
    for (const c of cartas) if ((c & 3) === paloDeColor) hayDelPalo[c >> 2] = true

    const tope = topeDeEscalera(hayDelPalo)
    if (tope >= 0) return puntaje(8, [tope])

    const altas: number[] = []
    for (let v = 12; v >= 0 && altas.length < 5; v--) if (hayDelPalo[v]) altas.push(v)
    return puntaje(5, altas)
  }

  /* ---- los grupos: cuántas de cada valor ---- */
  const cuatro: number[] = []
  const tercias: number[] = []
  const pares: number[] = []
  const sueltas: number[] = []
  for (let v = 12; v >= 0; v--) {
    if (porValor[v] === 4) cuatro.push(v)
    else if (porValor[v] === 3) tercias.push(v)
    else if (porValor[v] === 2) pares.push(v)
    else if (porValor[v] === 1) sueltas.push(v)
  }

  if (cuatro.length > 0) {
    const resto = [...tercias, ...pares, ...sueltas].sort((a, b) => b - a)
    return puntaje(7, [cuatro[0], resto[0]])
  }

  /* Con siete cartas puede haber dos tercias: la segunda hace de par. */
  if (tercias.length > 0 && (tercias.length > 1 || pares.length > 0)) {
    const par = tercias.length > 1 ? Math.max(tercias[1], pares[0] ?? -1) : pares[0]
    return puntaje(6, [tercias[0], par])
  }

  const tope = topeDeEscalera(hayValor)
  if (tope >= 0) return puntaje(4, [tope])

  if (tercias.length > 0) {
    const resto = [...pares, ...sueltas].sort((a, b) => b - a)
    return puntaje(3, [tercias[0], resto[0], resto[1]])
  }

  if (pares.length >= 2) {
    const resto = [...pares.slice(2), ...sueltas].sort((a, b) => b - a)
    return puntaje(2, [pares[0], pares[1], resto[0]])
  }

  if (pares.length === 1) return puntaje(1, [pares[0], sueltas[0], sueltas[1], sueltas[2]])

  return puntaje(0, sueltas.slice(0, 5))
}

/* ---- la simulación ---- */

export interface Simulacion {
  /** De cada 100 veces, cuántas ganas, empatas y pierdes. */
  gano: number
  empate: number
  perdi: number
  /** Cuántas manos se jugaron para sacar esos números. */
  manos: number
}

/** Un azar con semilla, para que las pruebas digan lo mismo todas las veces. */
export function azarCon(semilla: number): () => number {
  let a = semilla >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface PeticionSimulacion {
  /** Tus dos cartas. */
  mano: number[]
  /** Lo que ya está en la mesa: 0, 3, 4 o 5 cartas. */
  mesa: number[]
  /** Contra cuántos juegas. */
  rivales: number
  iteraciones?: number
  azar?: () => number
}

/**
 * Juega la mano miles de veces y cuenta cuántas ganas.
 *
 * Lo que falta —las cartas de los rivales y lo que queda por salir— se reparte al azar
 * del mazo que queda. No es una aproximación grosera: con veinte mil manos el número
 * baila menos de medio punto, que es menos de lo que importa en la mesa.
 */
export function simular(p: PeticionSimulacion): Simulacion {
  const rivales = Math.max(1, Math.min(9, Math.floor(p.rivales)))
  const iteraciones = Math.max(200, Math.floor(p.iteraciones ?? 20000))
  const azar = p.azar ?? Math.random

  const conocidas = [...p.mano, ...p.mesa]
  const mazo: number[] = []
  const usada = new Array<boolean>(52).fill(false)
  for (const c of conocidas) usada[c] = true
  for (let c = 0; c < 52; c++) if (!usada[c]) mazo.push(c)

  const faltanMesa = 5 - p.mesa.length
  const aRepartir = faltanMesa + rivales * 2

  let gano = 0
  let empate = 0

  const siete = new Array<number>(7)
  for (let i = 0; i < iteraciones; i++) {
    /* Baraja sólo lo que hace falta: sacar 13 cartas de 48 no necesita mover las 48. */
    for (let k = 0; k < aRepartir; k++) {
      const j = k + Math.floor(azar() * (mazo.length - k))
      const t = mazo[k]
      mazo[k] = mazo[j]
      mazo[j] = t
    }

    siete[0] = p.mano[0]
    siete[1] = p.mano[1]
    for (let k = 0; k < p.mesa.length; k++) siete[2 + k] = p.mesa[k]
    for (let k = 0; k < faltanMesa; k++) siete[2 + p.mesa.length + k] = mazo[k]

    const mia = evaluar(siete)

    let mejorRival = -1
    for (let r = 0; r < rivales; r++) {
      const a = mazo[faltanMesa + r * 2]
      const b = mazo[faltanMesa + r * 2 + 1]
      siete[0] = a
      siete[1] = b
      const suya = evaluar(siete)
      if (suya > mejorRival) mejorRival = suya
    }
    /* Se deja la mesa puesta para la vuelta siguiente; las dos primeras se reescriben. */

    if (mia > mejorRival) gano++
    else if (mia === mejorRival) empate++
  }

  const pct = (n: number) => (n / iteraciones) * 100
  return {
    gano: pct(gano),
    empate: pct(empate),
    perdi: pct(iteraciones - gano - empate),
    manos: iteraciones,
  }
}

/** Cómo se llama lo que tienes ahora mismo, con las cartas que ya se ven. */
export function nombreDeLaMano(mano: number[], mesa: number[]): string {
  const cartas = [...mano, ...mesa]
  if (cartas.length < 5) return ''
  return CATEGORIAS[categoriaDe(evaluar(cartas))]
}
