import {
  CALLES,
  arrancarMano,
  bote as boteDe,
  jugar,
  opciones,
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
 * No hay stacks ni all-in. Se juega como si todos trajeran de sobra, que es lo que deja
 * practicar lo único que importa aquí: si pagar sale a cuentas. Meter fichas contadas
 * traería botes partidos, que es otro tema y no el que se está aprendiendo.
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
  /** Lo que gana o pierde el héroe en esta mano. */
  heroe: number
  /** Si se llegó al golpe: ahí se enseñan las cartas de todos. */
  alGolpe: boolean
}

/** Las de en medio que ya se pueden ver, según la calle que se esté jugando. */
export function cartasVisibles(e: Entrenamiento): number[] {
  const hasta = { preflop: 0, flop: 3, turn: 4, river: 5 }[e.mano.calle]
  /* Terminada la mano se enseña todo: es lo que se mira al revisar qué pasó. */
  return e.final && e.final.alGolpe ? e.mesa : e.mesa.slice(0, hasta)
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

  if (vivos.length <= 1) {
    const ganador = vivos[0] ?? e.cfg.heroe
    return {
      ...e,
      final: {
        ganadores: [ganador],
        conQue: '',
        bote,
        heroe: ganador === e.cfg.heroe ? bote - puesto : -puesto,
        alGolpe: false,
      },
    }
  }

  const puntajes = vivos.map((s) => evaluar([...e.cartas[s], ...e.mesa]))
  const mejor = Math.max(...puntajes)
  const ganadores = vivos.filter((_, i) => puntajes[i] === mejor)
  const parte = bote / ganadores.length

  return {
    ...e,
    final: {
      ganadores,
      conQue: CATEGORIAS[categoriaDe(mejor)],
      bote,
      heroe: ganadores.includes(e.cfg.heroe) ? parte - puesto : -puesto,
      alGolpe: true,
    },
  }
}

/** En qué calle va, contada como número, para saber si avanzó. */
export const calleDe = (e: Entrenamiento) => CALLES.indexOf(e.mano.calle)
