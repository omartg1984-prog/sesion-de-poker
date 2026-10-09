import {
  CALLES,
  arrancarMano,
  bote as boteDe,
  jugar,
  opciones,
  repartirElBote,
  siguenVivos,
  type ConfigMano,
  type Mano,
} from './mano'
import { CATEGORIAS, categoriaDe, evaluar, simular } from './poker'
import { decidir, estiloDeLaMano, estiloPorId, type Rival } from './rival'

/*
 * Manos de verdad contra rivales de verdad.
 *
 * Es la otra mitad del simulador. Con la calculadora se resuelve una mano que está
 * pasando en la mesa; aquí se reparten manos una tras otra contra gente que juega
 * distinto entre sí, para agarrar el modo sin que cueste dinero.
 *
 * Los rivales no hacen trampa: cada uno ve sus dos cartas y las de en medio, y calcula
 * lo que se lleva contra manos que no conoce, igual que una persona. Lo que los hace
 * distintos no es la información, es cuánto margen le pide cada quien a la mano y qué
 * tan seguido se tira un farol.
 *
 * Cada quien trae sus fichas contadas. Sin eso se puede pagar todo y apostar no duele,
 * que es justo lo contrario de lo que hay que aprender: lo que enseña a jugar es que las
 * malas cuesten.
 */

/** Cuántas manos reparte cada rival para medir lo que se lleva. Alcanza y es rápido. */
const TANTEO = 1200

export interface ConfigEntreno extends ConfigMano {
  /** En qué silla se sienta el que está practicando. */
  heroe: number
}

export interface Entrenamiento {
  cfg: ConfigEntreno
  mano: Mano
  /** Las dos de cada asiento. */
  cartas: number[][]
  /** Las cinco de en medio: se reparten desde el principio y se destapan por calle. */
  mesa: number[]
  rivales: Rival[]
  /** El estilo que le tocó a cada quien esta mano; en la silla del héroe va vacío. */
  estilos: string[]
  /** Cómo acabó, una vez que ya no hay nada que hablar. */
  final: Final | null
}

export interface Final {
  ganadores: number[]
  /** Cómo se llama la mano con la que se ganó, o vacío si todos se fueron. */
  conQue: string
  bote: number
  /** Lo que se lleva del bote cada asiento, sin restarle lo que puso. */
  gana: number[]
  /** Lo que gana o pierde el héroe en esta mano. */
  heroe: number
  /** Si se llegó al golpe de verdad, con dos o más vivos. */
  alGolpe: boolean
  /** Si la mano del que practica era la mejor de las que se repartieron. */
  eraLaMejor: boolean
  /** Quién tenía la mejor de todas, se haya quedado o no. */
  mejorDeTodas: number[]
}

/**
 * Las de en medio que ya se pueden ver.
 *
 * Mientras se juega, las de la calle. Acabando la mano se enseñan las cinco aunque todos
 * se hayan ido: en una mesa de verdad eso no se ve nunca, pero aquí se está practicando
 * y la mitad de lo que se aprende es qué hubiera pasado si te quedas.
 */
export function cartasVisibles(e: Entrenamiento): number[] {
  const hasta = { preflop: 0, flop: 3, turn: 4, river: 5 }[e.mano.calle]
  return e.final ? e.mesa : e.mesa.slice(0, hasta)
}

/** Reparte una mano nueva: baraja, cartas para todos y las ciegas puestas. */
export function repartir(
  cfg: ConfigEntreno,
  rivales: Rival[],
  azar: () => number,
): Entrenamiento {
  const n = Math.max(2, Math.min(10, Math.floor(cfg.jugadores)))

  const mazo = Array.from({ length: 52 }, (_, i) => i)
  for (let i = mazo.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    const t = mazo[i]
    mazo[i] = mazo[j]
    mazo[j] = t
  }

  const cartas = Array.from({ length: n }, (_, s) => [mazo[s * 2], mazo[s * 2 + 1]])
  const mesa = mazo.slice(n * 2, n * 2 + 5)

  /* El estilo se sortea una vez por mano, no por movimiento: si cambiara a media mano
     el rival no tendría ningún paso que agarrarle. */
  const estilos = Array.from({ length: n }, (_, s) =>
    s === cfg.heroe ? '' : estiloDeLaMano(rivales[s] ?? rivales[0], azar).id,
  )

  return {
    cfg: { ...cfg, jugadores: n },
    mano: arrancarMano(cfg),
    cartas,
    mesa,
    rivales,
    estilos,
    final: null,
  }
}

/** Lo que se lleva un asiento ahora mismo, contra manos que no conoce. */
function equidadDe(e: Entrenamiento, s: number, azar: () => number): number {
  const vivos = siguenVivos(e.mano)
  const r = simular({
    mano: e.cartas[s],
    mesa: cartasVisibles(e),
    rivales: Math.max(1, vivos - 1),
    iteraciones: TANTEO,
    azar,
  })
  return r.parte
}

/** Si ya no hay nada que hablar y toca ver quién se lleva el bote. */
export const seAcabo = (e: Entrenamiento) => e.mano.terminada

export const tocaAlHeroe = (e: Entrenamiento) =>
  !e.mano.terminada && e.mano.turno === e.cfg.heroe

/**
 * Juega a los rivales hasta que le toque al héroe o se acabe la mano.
 *
 * Va de uno en uno a propósito y no todos de golpe: la pantalla quiere enseñar quién
 * hizo qué, y para eso hace falta poder dar un paso a la vez.
 */
export function mueveElSiguiente(e: Entrenamiento, azar: () => number): Entrenamiento {
  if (e.mano.terminada || e.mano.turno === null || e.mano.turno === e.cfg.heroe) return e

  const s = e.mano.turno
  const o = opciones(e.mano)
  if (!o) return e

  const d = decidir(
    estiloPorId(e.estilos[s]),
    {
      equidad: equidadDe(e, s, azar),
      vivos: siguenVivos(e.mano),
      bote: boteDe(e.mano),
      paraIgualar: o.paga,
      alto: Math.max(...e.mano.puesto),
      minimo: o.minimo,
      calle: e.mano.calle,
    },
    azar,
  )

  return { ...e, mano: jugar(e.mano, d.tipo, d.hasta) }
}

/** Lo que mueve el héroe. */
export function mueveElHeroe(
  e: Entrenamiento,
  tipo: Parameters<typeof jugar>[1],
  hasta?: number,
): Entrenamiento {
  if (!tocaAlHeroe(e)) return e
  return { ...e, mano: jugar(e.mano, tipo, hasta) }
}

/**
 * Quién se lleva el bote.
 *
 * Si quedó uno solo, no hay cartas que enseñar: el bote es suyo y nadie se entera de lo
 * que traía. Si se llegó al golpe, gana la mejor mano y los empates se parten.
 */
export function resolver(e: Entrenamiento): Entrenamiento {
  if (!e.mano.terminada || e.final) return e

  const bote = boteDe(e.mano)
  const vivos = Array.from({ length: e.cfg.jugadores }, (_, s) => s).filter((s) => e.mano.vivo[s])
  const puesto = e.mano.total[e.cfg.heroe] ?? 0
  const alGolpe = vivos.length > 1

  /* Sin golpe no hay cartas que comparar: el único que queda se lleva todo. Con golpe
     manda la mano, y el reparto por capas se encarga de los que se fueron con todo. */
  const fuerza = alGolpe
    ? (s: number) => evaluar([...e.cartas[s], ...e.mesa])
    : () => 0

  const gana = repartirElBote(e.mano.total, e.mano.vivo, fuerza)
  const ganadores = vivos.filter((s) => gana[s] > 0)
  const conQue = alGolpe && ganadores.length > 0 ? CATEGORIAS[categoriaDe(fuerza(ganadores[0]))] : ''

  /*
   * Quién tenía la mejor mano de la mesa, contando a los que se fueron.
   *
   * No decide nada —el bote ya se repartió— pero es lo que contesta la pregunta que
   * queda después de tirar una mano: "¿y si me quedo?". Sabiendo eso se aprende a
   * distinguir una buena tirada de una mala, que no es lo mismo que ganar o perder.
   */
  const todos = Array.from({ length: e.cfg.jugadores }, (_, s) => s)
  const alRiver = todos.map((s) => evaluar([...e.cartas[s], ...e.mesa]))
  const laMejor = Math.max(...alRiver)
  const mejorDeTodas = todos.filter((s) => alRiver[s] === laMejor)

  return {
    ...e,
    final: {
      ganadores: ganadores.length > 0 ? ganadores : vivos,
      conQue,
      bote,
      gana,
      heroe: (gana[e.cfg.heroe] ?? 0) - puesto,
      alGolpe,
      eraLaMejor: mejorDeTodas.includes(e.cfg.heroe),
      mejorDeTodas,
    },
  }
}

/** En qué calle va, contada como número, para saber si avanzó. */
export const calleDe = (e: Entrenamiento) => CALLES.indexOf(e.mano.calle)
