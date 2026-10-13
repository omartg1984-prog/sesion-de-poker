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

/** De cada 100 veces, cuántas gana, empata y pierde un jugador. */
export interface Reparto {
  gano: number
  empate: number
  perdi: number
  /*
   * De cada 100 botes, qué parte se lleva. No es lo mismo que ganar: un empate a dos
   * paga medio bote y uno a tres, un tercio. Sumando el de todos da 100, porque cada
   * bote se lo lleva alguien.
   */
  parte: number
}

export interface Simulacion extends Reparto {
  /** Cuántas manos se jugaron para sacar esos números. */
  manos: number
  /*
   * Lo mismo para cada rival, cada uno en su asiento. El rival al que se le sabe la mano
   * trae su número de verdad; al que no, el de una mano cualquiera, que es justo lo que
   * se sabe de él. Tú no vas aquí: tus números son los de arriba.
   */
  porRival: Reparto[]
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
  /*
   * Las manos que sí se conocen, para repasar una mano después de jugada: cada entrada
   * son las dos cartas de un rival. Los rivales que no vengan aquí se reparten al azar,
   * así que se puede saber la de uno y no la de los otros.
   */
  manosRivales?: number[][]
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
  const azar = p.azar ?? Math.random

  /* Cada mano sabida se queda en su asiento: el rival 3 sigue siendo el rival 3 aunque
     del 1 y el 2 no se sepa nada, y así su porcentaje se puede poner junto a su nombre. */
  const sabidas: (number[] | null)[] = Array.from({ length: rivales }, (_, i) => {
    const m = p.manosRivales?.[i]
    return m && m.length === 2 ? m : null
  })

  const conocidas = [...p.mano, ...p.mesa]
  for (const m of sabidas) if (m) conocidas.push(...m)

  const mazo: number[] = []
  const usada = new Array<boolean>(52).fill(false)
  for (const c of conocidas) usada[c] = true
  for (let c = 0; c < 52; c++) if (!usada[c]) mazo.push(c)

  const faltanMesa = 5 - p.mesa.length

  /* De dónde saca sus cartas cada rival del que no se sabe nada: de ahí para adelante
     en lo que se barajó, después de las que faltan de la mesa. */
  const desde = new Array<number>(rivales).fill(-1)
  let cuantosAlAzar = 0
  for (let r = 0; r < rivales; r++) {
    if (sabidas[r]) continue
    desde[r] = faltanMesa + cuantosAlAzar * 2
    cuantosAlAzar++
  }

  const aRepartir = faltanMesa + cuantosAlAzar * 2

  /* Si no queda nada por repartir, la mano ya está jugada: una vuelta basta y todas las
     demás darían lo mismo. */
  const iteraciones = aRepartir === 0 ? 1 : Math.max(200, Math.floor(p.iteraciones ?? 20000))

  /* Un casillero por jugador: el 0 soy yo y del 1 en adelante los rivales, en su asiento. */
  const gano = new Array<number>(1 + rivales).fill(0)
  const empate = new Array<number>(1 + rivales).fill(0)
  const parte = new Array<number>(1 + rivales).fill(0)
  const puntajes = new Array<number>(1 + rivales).fill(0)

  const siete = new Array<number>(7)
  for (let i = 0; i < iteraciones; i++) {
    /* Baraja sólo lo que hace falta: sacar 13 cartas de 48 no necesita mover las 48. */
    for (let k = 0; k < aRepartir; k++) {
      const j = k + Math.floor(azar() * (mazo.length - k))
      const t = mazo[k]
      mazo[k] = mazo[j]
      mazo[j] = t
    }

    /* La mesa es la misma para todos, así que se pone una vez y sólo se cambian las dos
       primeras casillas al pasar de una mano a la siguiente. */
    for (let k = 0; k < p.mesa.length; k++) siete[2 + k] = p.mesa[k]
    for (let k = 0; k < faltanMesa; k++) siete[2 + p.mesa.length + k] = mazo[k]

    siete[0] = p.mano[0]
    siete[1] = p.mano[1]
    puntajes[0] = evaluar(siete)

    for (let r = 0; r < rivales; r++) {
      const suyas = sabidas[r]
      if (suyas) {
        siete[0] = suyas[0]
        siete[1] = suyas[1]
      } else {
        siete[0] = mazo[desde[r]]
        siete[1] = mazo[desde[r] + 1]
      }
      puntajes[1 + r] = evaluar(siete)
    }

    let mejor = puntajes[0]
    for (let k = 1; k <= rivales; k++) if (puntajes[k] > mejor) mejor = puntajes[k]
    let cuantos = 0
    for (let k = 0; k <= rivales; k++) if (puntajes[k] === mejor) cuantos++
    for (let k = 0; k <= rivales; k++) {
      if (puntajes[k] !== mejor) continue
      if (cuantos === 1) gano[k]++
      else empate[k]++
      parte[k] += 1 / cuantos
    }
  }

  const pct = (n: number) => (n / iteraciones) * 100
  const reparto = (k: number): Reparto => ({
    gano: pct(gano[k]),
    empate: pct(empate[k]),
    perdi: pct(iteraciones - gano[k] - empate[k]),
    parte: pct(parte[k]),
  })

  return {
    ...reparto(0),
    manos: iteraciones,
    porRival: Array.from({ length: rivales }, (_, r) => reparto(1 + r)),
  }
}

/**
 * Lo que vale una mano de aquí al final, en por ciento.
 *
 * Es la parte del bote que te toca, no las veces que ganas: los empates cuentan a
 * medias porque el bote se parte. Es el número con el que se decide si pagar.
 */
export const equidadDe = (r: Reparto) => r.parte

/** Cómo se llama lo que tienes ahora mismo, con las cartas que ya se ven. */
export function nombreDeLaMano(mano: number[], mesa: number[]): string {
  const cartas = [...mano, ...mesa]
  if (cartas.length < 5) return ''
  return CATEGORIAS[categoriaDe(evaluar(cartas))]
}

/* ---- la mesa y el lugar donde te sientas ---- */

export type Posicion = 'ciega' | 'temprana' | 'media' | 'tardia'

export interface Asiento {
  /** 0 es el botón, y de ahí se reparte en el sentido de las manecillas. */
  indice: number
  /** 'D', 'CG', 'CCH' o vacío: lo que se pinta dentro del asiento. */
  marca: string
  posicion: Posicion
  /** Cómo se llama esa posición en la mesa. */
  nombre: string
}

/**
 * Los asientos de una mesa de `jugadores`, en orden desde el botón.
 *
 * Las posiciones no son un gusto: salen de a cuántos les hablas antes de que te toque.
 * El botón habla al último todas las rondas —por eso es la mejor silla—, las ciegas ya
 * pusieron dinero y hablan primero del flop en adelante, y entre una cosa y otra están
 * los que entran temprano, que hablan casi a ciegas.
 *
 * Con dos jugadores no hay medias tintas: el botón es la ciega chica y el otro la grande.
 */
export function asientosDe(jugadores: number): Asiento[] {
  const n = Math.max(2, Math.min(10, Math.floor(jugadores)))
  const salida: Asiento[] = []

  for (let i = 0; i < n; i++) {
    if (i === 0) {
      salida.push({
        indice: 0,
        marca: 'D',
        posicion: 'tardia',
        nombre: n === 2 ? 'Botón y ciega chica' : 'Botón',
      })
      continue
    }
    if (n === 2) {
      salida.push({
        indice: 1,
        marca: 'CG',
        posicion: 'ciega',
        nombre: 'Ciega grande',
      })
      continue
    }
    if (i === 1) {
      salida.push({
        indice: 1,
        marca: 'CCH',
        posicion: 'ciega',
        nombre: 'Ciega chica',
      })
      continue
    }
    if (i === 2) {
      salida.push({
        indice: 2,
        marca: 'CG',
        posicion: 'ciega',
        nombre: 'Ciega grande',
      })
      continue
    }

    /* Los que quedan después de las ciegas se parten en tres: los primeros hablan casi
       sin información y el último antes del botón ya vio a casi toda la mesa. */
    const cuantos = n - 3
    const sitio = i - 3
    const ultimo = sitio === cuantos - 1
    if (ultimo && cuantos >= 2) {
      salida.push({
        indice: i,
        marca: '',
        posicion: 'tardia',
        nombre: 'Antes del botón',
      })
    } else if (sitio < Math.ceil(cuantos / 2)) {
      salida.push({
        indice: i,
        marca: '',
        posicion: 'temprana',
        nombre: 'Entra temprano',
      })
    } else {
      salida.push({
        indice: i,
        marca: '',
        posicion: 'media',
        nombre: 'A media mesa',
      })
    }
  }
  return salida
}

/** Cuánto margen de más se le pide a una mano según desde dónde se juegue. */
export const EXIGENCIA: Record<Posicion, number> = {
  temprana: 1.6,
  media: 1.35,
  ciega: 1.25,
  tardia: 1.15,
}

export interface Banda {
  id: 'fuerte' | 'buena' | 'limite' | 'floja'
  etiqueta: string
  /** Para pintar: 'win', 'ambar' o 'loss'. */
  tono: 'win' | 'ambar' | 'loss'
}

/**
 * Qué tan factible es jugarla, en cuatro cajones.
 *
 * Se mide contra lo que te tocaría por puro reparto —con cuatro en la mesa, 25%— y no
 * contra un número fijo: una mano que gana el 30% es excelente contra siete y mala
 * contra uno. Encima se le pide más margen cuanto peor sea la posición.
 */
export function bandaDeJugabilidad(equidad: number, jugadores: number, posicion: Posicion): Banda {
  const justo = 100 / Math.max(2, jugadores)
  const razon = justo > 0 ? equidad / justo : 0
  const exige = EXIGENCIA[posicion]

  if (razon >= exige * 1.3) return { id: 'fuerte', etiqueta: 'Mano fuerte', tono: 'win' }
  if (razon >= exige) return { id: 'buena', etiqueta: 'Da para jugarla', tono: 'win' }
  if (razon >= 1) return { id: 'limite', etiqueta: 'Al límite', tono: 'ambar' }
  return { id: 'floja', etiqueta: 'Para tirarla', tono: 'loss' }
}

/* ---- lo que cuesta ver la siguiente carta ---- */

export interface Cuentas {
  /** Lo mínimo que tendrías que ganar para que pagar salga a cuentas, en por ciento. */
  necesitas: number
  /** Lo que de verdad ganas con esta mano, en por ciento. */
  tienes: number
  /** Lo que deja pagar, en pesos, repartido entre todas las veces que se jugara. */
  esperado: number
  /** Cuánto es la apuesta comparada con el bote, en veces. */
  parteDelBote: number
  conviene: boolean
}

/**
 * Si pagar sale a cuentas o no.
 *
 * La pregunta de la mesa nunca es "¿voy ganando?" sino "¿me alcanza para pagar esto?".
 * Pagar $100 a un bote de $900 necesita ganar una de cada diez; a un bote de $100,
 * una de cada dos. Por eso la misma mano se paga o se tira según lo que cueste.
 *
 * Lo que deja pagar es lo que ganas en promedio cada vez que se jugara la misma mano:
 * te llevas el bote cuando ganas y pierdes la apuesta cuando no.
 */
export function cuentasDeLaApuesta(equidad: number, bote: number, apuesta: number): Cuentas | null {
  if (!Number.isFinite(bote) || !Number.isFinite(apuesta)) return null
  if (bote <= 0 || apuesta <= 0) return null

  const p = Math.max(0, Math.min(100, equidad)) / 100
  const necesitas = (apuesta / (bote + apuesta)) * 100
  const esperado = p * bote - (1 - p) * apuesta

  return {
    necesitas,
    tienes: equidad,
    esperado,
    parteDelBote: apuesta / bote,
    conviene: esperado >= 0,
  }
}

/* ---- las cartas que todavía te pueden salvar ---- */

export interface Salidas {
  /** Cuántas de las que faltan te suben a algo que gana. */
  cuantas: number
  /** Cuáles son, para poder enseñarlas. */
  cartas: number[]
  /** Cuántas faltan por salir: dos en el flop, una en el turn, ninguna en el river. */
  porVenir: number
  /** Qué tan seguido sale al menos una de ellas, en por ciento. */
  probabilidad: number
  /**
   * Si de verdad se pudieron contar.
   *
   * Antes del flop no hay mesa de donde contarlas y cero no querría decir "no traes
   * nada" sino "todavía no se sabe", que no es lo mismo ni de lejos.
   */
  contadas: boolean
}

/**
 * Las cartas que todavía te pueden salvar la mano.
 *
 * Es la cuenta de toda la vida: cuatro para el color son nueve cartas, una escalera
 * abierta son ocho. Se cuentan las que te suben a algo que de verdad gana —de dos pares
 * para arriba, o emparejar una de las tuyas cuando no hay nada mayor en la mesa— y no
 * cualquiera que te mejore: emparejar un cinco en una mesa con rey no salva a nadie.
 *
 * Las que emparejan la mesa tampoco cuentan, porque ésas se las dan a todos por igual
 * y no te adelantan nada.
 *
 * En el river no hay salidas: ya no viene nada y lo que traes es lo que vale.
 */
export function salidas(mano: number[], mesa: number[]): Salidas {
  const faltanPorSalir = Math.max(0, 5 - mesa.length)

  /* Antes del flop no hay nada que contar: ahí lo que se juega es la mano que traes. */
  if (mano.length !== 2 || mesa.length < 3 || mesa.length > 5)
    return { cuantas: 0, cartas: [], porVenir: faltanPorSalir, probabilidad: 0, contadas: false }

  /* En el river ya salió todo: lo que traes es lo que vale. */
  if (mesa.length === 5)
    return { cuantas: 0, cartas: [], porVenir: 0, probabilidad: 0, contadas: true }

  const vistas = new Set([...mano, ...mesa])
  const ahora = categoriaDe(evaluar([...mano, ...mesa]))
  const altoDeLaMesa = Math.max(...mesa.map(valorDe))

  const cartas: number[] = []
  for (let c = 0; c < 52; c++) {
    if (vistas.has(c)) continue
    const nueva = categoriaDe(evaluar([...mano, ...mesa, c]))
    if (nueva <= ahora) continue

    const esTuya = mano.some((h) => valorDe(h) === valorDe(c))
    /* Escalera, color y escalera de color: ésas sí las armas tú con las tuyas. */
    const cierraProyecto = nueva === 4 || nueva === 5 || nueva === 8

    /* La que empareja la mesa no cuenta aunque te suba: se la dan a todos por igual, y
       al que ya te iba ganando lo sube también. Lo único que vale de ahí es la carta
       que te cierra el proyecto. */
    if (!esTuya && mesa.some((b) => valorDe(b) === valorDe(c)) && !cierraProyecto) continue

    /* De dos pares para arriba cuenta siempre. Quedarse en par sólo cuenta si empareja
       una de las tuyas y no hay nada más grande en la mesa: ése es el par de arriba. */
    if (nueva >= 2 || (esTuya && valorDe(c) > altoDeLaMesa)) cartas.push(c)
  }

  const porVenir = 5 - mesa.length
  const faltan = 52 - mano.length - mesa.length
  const k = cartas.length

  /* Pegar al menos una es uno menos fallarlas todas, una carta tras otra. */
  let fallar = 1
  for (let i = 0; i < porVenir; i++) fallar *= Math.max(0, faltan - k - i) / (faltan - i)

  return { cuantas: k, cartas, porVenir, probabilidad: (1 - fallar) * 100, contadas: true }
}

/* ---- lo que las cuentas frías no ven ---- */

export interface Razon {
  texto: string
  /** A favor de pagar, en contra, o ni una cosa ni otra. */
  aFavor: boolean | null
}

export interface Humano {
  /** La raya de siempre: lo que haría falta si la mano se acabara aquí. */
  fria: number
  /** La raya ya contando lo que todavía le puedes sacar después. */
  necesitas: number
  /** Lo que se cuenta que le sacas después si la pegas, en pesos. */
  extra: number
  /** Si pagar sale a cuentas con todo dentro. */
  conviene: boolean
  /** Lo que se tomó en cuenta, en palabras, para poder discutirlo. */
  razones: Razon[]
}

/** Todo lo que hay alrededor de la apuesta y que la cuenta fría no mira. */
export interface Situacion {
  /** Lo que hay en el bote antes de que pongas lo tuyo. */
  bote: number
  /** Lo que te piden. */
  apuesta: number
  /** Lo que les queda atrás a los que siguen: lo más que les puedes sacar. */
  atras: number
  salidas: Salidas
  /** Hablas al último en esta calle. */
  ultimo: boolean
  /** De cada 100 manos, a cuántas entra el que apostó. null si no se le ha visto jugar. */
  entraElQueApuesta: number | null
  /** Lo que ganarías mano a mano, si los demás se fueran. null si no se sabe. */
  manoAMano: number | null
}

/**
 * La misma cuenta, pero como la hace alguien que lleva años jugando.
 *
 * La cuenta fría sólo mira el dinero que ya está en la mesa, y por eso sale miedosa:
 * manda tirar proyectos que cualquiera paga. Lo que le falta es lo que pasa después
 * —si la pegas, todavía te van a pagar más— y eso baja la raya de verdad, no de dicho.
 *
 * Lo demás que importa no se deja meter en una cuenta sin inventarse números: desde
 * dónde hablas, y quién fue el que apostó. Eso va en palabras, que es como se piensa en
 * la mesa, y es cosa tuya pesarlo.
 */
export function conFactorHumano(c: Cuentas, m: Situacion): Humano {
  const razones: Razon[] = []

  /*
   * Lo que todavía le puedes sacar si la pegas.
   *
   * No es todo lo que traen atrás: hay que pegarla y además que te paguen. Se cuenta
   * media apuesta del tamaño del bote, que es lo que de verdad se cobra, y sólo con
   * proyecto de a de veras y con cartas por venir. Sin proyecto no hay qué esperar.
   */
  const hayProyecto = m.salidas.contadas && m.salidas.porVenir > 0 && m.salidas.cuantas >= 4
  const extra = hayProyecto ? Math.max(0, Math.min(m.atras, m.bote + m.apuesta) * 0.5) : 0

  const necesitas = (m.apuesta / (m.bote + m.apuesta + extra)) * 100
  const conviene = c.tienes >= necesitas

  if (extra > 0)
    razones.push({
      aFavor: true,
      texto: `Traes ${m.salidas.cuantas} cartas que te salvan y atrás queda dinero: si la pegas todavía le sacas más. Contando eso, la raya baja de ${Math.round(c.necesitas)} a ${Math.round(necesitas)}.`,
    })
  else if (!m.salidas.contadas)
    razones.push({
      aFavor: null,
      texto:
        'Antes del flop no hay cartas que contar: aquí lo que se juega es la mano que traes y desde dónde hablas.',
    })
  else if (m.salidas.porVenir === 0)
    razones.push({
      aFavor: false,
      texto:
        'Ya no viene ninguna carta: lo que traes es lo que vale y no hay nada que esperar de después.',
    })
  else
    razones.push({
      aFavor: false,
      texto:
        'No traes proyecto: no hay carta que te salve, así que el dinero de después no cuenta.',
    })

  razones.push(
    m.ultimo
      ? {
          aFavor: true,
          texto: 'Hablas al último: ves lo que hacen todos antes de poner un peso más.',
        }
      : {
          aFavor: false,
          texto: 'Hablas temprano: los que faltan todavía te pueden subir y te sale más cara.',
        },
  )

  if (m.entraElQueApuesta !== null) {
    if (m.entraElQueApuesta >= 45)
      razones.push({
        aFavor: true,
        texto: `El que apostó entra a ${Math.round(m.entraElQueApuesta)} de cada 100 manos: apuesta con cualquier cosa, así que su apuesta dice poco.`,
      })
    else if (m.entraElQueApuesta <= 22)
      razones.push({
        aFavor: false,
        texto: `El que apostó entra a ${Math.round(m.entraElQueApuesta)} de cada 100 manos: cuando se mete suele traer algo. La cuenta te lo toma por una mano cualquiera, así que ahí ganas menos de lo que dice.`,
      })
  }

  if (m.manoAMano !== null && m.manoAMano - c.tienes >= 8)
    razones.push({
      aFavor: true,
      texto: `Contra todos los que siguen ganas ${Math.round(c.tienes)} de cada 100; mano a mano ganarías ${Math.round(m.manoAMano)}. Si se van los demás, la mano es de las buenas.`,
    })

  return { fria: c.necesitas, necesitas, extra, conviene, razones }
}
