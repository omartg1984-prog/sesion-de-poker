import { count, num } from './money'
import { repartoDeLaCasa } from './reparto-de-la-casa'
import type { ChipColor, Chips } from '../store/types'

/*
 * El plan de las fichas de la noche.
 *
 * Hasta aquí la app repartía sola y nadie veía el reparto hasta que ya estaba hecho,
 * jugador por jugador. Con pocos colores y seis en la mesa eso bastaba. Con más valores
 * de ficha y veinte apuntados, no: la pregunta que se hace en la mesa antes de empezar
 * es "¿cómo las vamos a repartir y para cuántos alcanza?", y esa pregunta no se contesta
 * mirando veinte tarjetas.
 *
 * Esto es la respuesta: un puñado —el mismo para todos— y la cuenta de hasta dónde
 * aguanta la caja repartiéndolo así.
 */

/**
 * Con cuánto entra alguien a una partida cash si nadie dice otra cosa.
 *
 * Casi todos entran con esto, así que arrancar en cero obligaba a teclear el mismo
 * número una vez por jugador. Se puede cambiar por persona antes de guardar.
 */
export const ENTRADA_POR_DEFECTO = 500

/**
 * Cuántas fichas lleva una entrada cuando la caja alcanza de sobra.
 *
 * Va por valor y no por color: así da lo mismo que las de $50 sean moradas aquí y
 * naranjas en otra liga. Suman $500, que es la entrada de siempre.
 *
 * Los valores que no vienen en la lista —las de $100— arrancan en cero a propósito: son
 * la reserva. Entran nada más cuando sin ellas no alcanza, y mientras no entren dejan la
 * morralla libre para dar cambio en las recompras.
 */
export const ENTRADA_SUGERIDA: { valor: number; cuantas: number }[] = [
  { valor: 1, cuantas: 10 },
  { valor: 2, cuantas: 10 },
  { valor: 5, cuantas: 8 },
  { valor: 10, cuantas: 8 },
  { valor: 25, cuantas: 10 },
  { valor: 50, cuantas: 2 },
]

/** Tope de fichas por color. Sin poner, no hay tope. */
export type Topes = Record<string, number>

/**
 * Lo que la sugerencia pide de cada color de esta liga.
 *
 * Si dos colores valen lo mismo —pasa cuando alguien duplica una ficha por error— nada
 * más el primero se lleva la cantidad: repartir el doble descuadraría la entrada.
 */
export function deseadasPorValor(colores: ChipColor[]): Chips {
  const fichas: Chips = {}
  const ya = new Set<number>()
  for (const c of colores) {
    const valor = num(c.value)
    const suyo = ENTRADA_SUGERIDA.find((e) => Math.abs(e.valor - valor) < 1e-9)
    fichas[c.key] = suyo && !ya.has(valor) ? suyo.cuantas : 0
    if (suyo) ya.add(valor)
  }
  return fichas
}

export interface Entrada {
  fichas: Chips
  total: number
}

/**
 * Arma un puñado que valga `objetivo`: primero lo que se quiere de cada color, y lo que
 * falte, con las fichas más grandes que quepan.
 *
 * `topes` es cuántas se pueden usar de cada color. Es lo que mete las fichas grandes a
 * la fuerza cuando hay mucha gente: si de verdes alcanzan siete por cabeza y no diez,
 * las tres que faltan se cubren con una de $100, que es justo para lo que se guardaban.
 *
 * Pedir toda la morralla y cuadrar con fichas grandes no siempre se puede a la vez: con
 * los topes apretados puede quedar un hueco de $21 y ni una ficha chica libre con la que
 * taparlo. Ahí se cede en la morralla —se pide menos y se intenta otra vez— hasta que
 * cuadre, porque un puñado que no vale lo que puso el jugador no sirve para nada. Lo
 * último que se intenta es sin morralla: puras fichas grandes, que cuadran siempre que
 * la caja tenga el dinero.
 *
 * Puede quedar corto —`total < objetivo`— cuando ya no hay con qué cuadrar. Eso no se
 * esconde: quien lo llama tiene que decirlo en pantalla.
 */
export function armarEntrada(
  colores: ChipColor[],
  objetivo: number,
  deseadas: Chips,
  topes: Topes = {},
): Entrada {
  const meta = Math.max(0, Math.round(num(objetivo)))
  let mejor: Entrada | null = null
  /* De pedir toda la morralla a no pedir nada, en veinte pasos. */
  for (let paso = 20; paso >= 0; paso--) {
    const pedido: Chips = {}
    for (const c of colores) pedido[c.key] = Math.floor((count(deseadas[c.key]) * paso) / 20)
    const intento = unIntento(colores, meta, pedido, topes)
    /* Nunca se pasa del objetivo, así que el intento más alto es el mejor. */
    if (intento.total === meta) return intento
    if (mejor === null || intento.total > mejor.total) mejor = intento
  }
  return mejor ?? { fichas: {}, total: 0 }
}

function unIntento(
  colores: ChipColor[],
  objetivo: number,
  deseadas: Chips,
  topes: Topes,
): Entrada {
  const meta = Math.max(0, Math.round(num(objetivo)))
  const fichas: Chips = {}
  for (const c of colores) fichas[c.key] = 0
  if (meta <= 0) return { fichas, total: 0 }

  const asc = colores.slice().sort((a, b) => num(a.value) - num(b.value))
  const tope = (key: string) =>
    topes[key] === undefined ? Infinity : Math.max(0, Math.floor(topes[key]))

  let total = 0

  /* 1) lo que se quiere, de la ficha chica a la grande y sin pasarse del objetivo */
  for (const c of asc) {
    const v = num(c.value)
    if (v <= 0) continue
    const cabe = Math.floor((meta - total) / v)
    const n = Math.min(count(deseadas[c.key]), tope(c.key), Math.max(0, cabe))
    fichas[c.key] = n
    total += n * v
  }

  /* 2) lo que falta, con las más grandes primero: menos fichas en la mano y es lo que
        deja las chicas en la caja para el cambio */
  for (let i = asc.length - 1; i >= 0 && total < meta; i--) {
    const c = asc[i]
    const v = num(c.value)
    if (v <= 0) continue
    const lugar = tope(c.key) - fichas[c.key]
    if (lugar <= 0) continue
    const add = Math.min(lugar, Math.floor((meta - total) / v))
    if (add > 0) {
      fichas[c.key] += add
      total += add * v
    }
  }

  return { fichas, total }
}

/** El puñado que sugiere la app para esta liga y esta entrada. */
export function entradaSugerida(
  colores: ChipColor[],
  objetivo: number,
  topes: Topes = {},
): Entrada {
  return armarEntrada(colores, objetivo, deseadasPorValor(colores), topes)
}

/**
 * De dónde arranca el plan: lo que la liga tenga puesto como entrada de siempre, si
 * cuadra con lo que se pone esta noche, y si no, la sugerencia de la app.
 *
 * Tiene que cuadrar al peso. El puñado de $500 de la liga no sirve para una noche de
 * $300: enseñarlo como plan sería enseñar un plan que la app no va a usar.
 */
export function entradaDeArranque(colores: ChipColor[], objetivo: number): Entrada {
  const casa = repartoDeLaCasa(colores)
  if (casa && Math.abs(casa.total - num(objetivo)) < 1e-9) {
    const fichas: Chips = {}
    for (const c of colores) fichas[c.key] = count(casa.fichas[c.key])
    return { fichas, total: casa.total }
  }
  return entradaSugerida(colores, objetivo)
}

export interface Aguante {
  /** Cuántas entregas de este puñado salen de la caja. */
  entregas: number
  /** El color que se acaba primero: el que pone el tope. */
  seAcabaPrimero: ChipColor | null
}

/**
 * Hasta dónde aguanta la caja repartiendo este puñado.
 *
 * El tope lo pone un solo color —el primero que se acaba— y por eso se devuelve: "no
 * alcanza" no sirve de nada, "se acaban las verdes" dice qué mover.
 */
export function cuantasAguanta(colores: ChipColor[], fichas: Chips): Aguante {
  let entregas = Infinity
  let seAcabaPrimero: ChipColor | null = null
  for (const c of colores) {
    const n = count(fichas[c.key])
    if (n <= 0) continue
    const cuantas = Math.floor(count(c.inventory) / n)
    if (cuantas < entregas) {
      entregas = cuantas
      seAcabaPrimero = c
    }
  }
  return { entregas, seAcabaPrimero }
}

export interface Resto {
  /** Cuántas de cada color siguen en la caja. */
  fichas: Chips
  /** Lo que valen las que quedan. */
  dinero: number
  /** Los mismos colores pero con el inventario puesto en lo que queda. */
  colores: ChipColor[]
}

/**
 * Lo que queda en la caja después de lo que ya se repartió esta noche.
 *
 * Es la pregunta de media noche: alguien pide una recompra de $500 y hay que saber si
 * todavía hay con qué armársela, y de qué color. Contarla en pesos no basta —puede
 * haber $3,000 en la caja y ni una ficha chica para el cambio—, así que va color por
 * color, y de paso devuelve los colores con el inventario ya descontado para poder
 * preguntarle a `cuantasAguanta` cuántas pilas más salen de ahí.
 */
export function loQueQueda(colores: ChipColor[], repartidas: Chips): Resto {
  const fichas: Chips = {}
  let dinero = 0
  const quedan: ChipColor[] = []
  for (const c of colores) {
    const n = Math.max(0, count(c.inventory) - count(repartidas[c.key]))
    fichas[c.key] = n
    dinero += n * num(c.value)
    quedan.push({ ...c, inventory: n })
  }
  return { fichas, dinero, colores: quedan }
}

export interface PlanDeFichas extends Entrada, Aguante {
  /** Las fichas valen justo lo que pone cada quien. */
  cuadra: boolean
  /** Cuántas entregas se le pidieron. */
  pedidas: number
  /** La caja aguanta las entregas pedidas. */
  alcanza: boolean
  /** Lo que queda en la caja después de las pedidas, color por color. */
  sobra: Chips
  /** Lo que valen las que quedan. */
  sobraEnDinero: number
  /** Cuántas entregas más caben con lo que queda. */
  masEntregas: number
}

/**
 * El plan completo: el puñado, hasta dónde aguanta y qué queda después.
 *
 * `pedidas` son entregas, no jugadores. En una noche de cash cada recompra sale de la
 * misma caja que una entrada, así que contar jugadores y olvidar las recompras es
 * justamente cómo se acaban las fichas a media noche.
 */
export function planDeFichas(
  colores: ChipColor[],
  objetivo: number,
  fichas: Chips,
  pedidas: number,
): PlanDeFichas {
  const total = colores.reduce((t, c) => t + count(fichas[c.key]) * num(c.value), 0)
  const { entregas, seAcabaPrimero } = cuantasAguanta(colores, fichas)
  const cuantas = Math.max(0, Math.floor(num(pedidas)))

  const sobra: Chips = {}
  let sobraEnDinero = 0
  for (const c of colores) {
    const quedan = count(c.inventory) - count(fichas[c.key]) * cuantas
    sobra[c.key] = quedan
    if (quedan > 0) sobraEnDinero += quedan * num(c.value)
  }

  return {
    fichas,
    total,
    cuadra: Math.abs(total - num(objetivo)) < 1e-9,
    entregas,
    seAcabaPrimero,
    pedidas: cuantas,
    alcanza: entregas >= cuantas,
    sobra,
    sobraEnDinero,
    masEntregas: Math.max(0, entregas === Infinity ? Infinity : entregas - cuantas),
  }
}

/**
 * Con cuánto entra la mayoría esta noche.
 *
 * El plan es un puñado solo para todos, así que tiene que ser el de la entrada que más
 * se repite. El que entre con otra cosa se reparte solo, como siempre.
 */
export function entradaMasComun(montos: number[], porDefecto: number): number {
  const veces = new Map<number, number>()
  for (const m of montos) {
    const n = Math.round(num(m))
    if (n > 0) veces.set(n, (veces.get(n) ?? 0) + 1)
  }
  let gana = 0
  let max = 0
  for (const [monto, cuantas] of veces) {
    /* Empate: gana la entrada más alta. Un plan corto deja a alguien sin fichas; uno
       largo nada más sobra. */
    if (cuantas > max || (cuantas === max && monto > gana)) {
      gana = monto
      max = cuantas
    }
  }
  return gana > 0 ? gana : Math.round(num(porDefecto))
}
