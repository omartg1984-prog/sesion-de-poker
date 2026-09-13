import type { ColorFicha } from './tipos'

/*
 * Quién ganó una noche, y en qué orden quedaron los demás.
 *
 * Vive aparte porque la misma respuesta la necesitan tres cosas que antes no se
 * hablaban: la tabla de la liga, el resumen de cada partida en el lobby, y el permiso
 * para presumir —que sólo se le da al que ganó—. Con la regla en un solo lugar es
 * imposible que el podio del lobby diga una cosa y el micrófono se lo den a otro.
 *
 * La regla es la misma para cash y para torneo: manda lo que te llevaste menos lo que
 * pusiste. En torneo eso sale de los premios por lugar; en cash, de las fichas contadas
 * al final. Y en los dos, lo que cuenta son las fichas, nunca el billete que se entregó:
 * a quien le faltaron cinco pesos porque no había feria no baja de lugar por eso.
 */

export const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

export function leerJson<T>(crudo: string | null | undefined, porDefecto: T): T {
  if (!crudo) return porDefecto
  try {
    return JSON.parse(crudo) as T
  } catch {
    return porDefecto
  }
}

export interface ConfigTorneo {
  buyIn: number
  rebuyPrice: number
  addOnPrice: number
  payouts: { pct: number }[]
}

/** Lo mínimo de una participación para poder ordenar la mesa. */
export interface JugadorDeLaNoche {
  usuario_id: string
  entrada: number
  recompras: string
  fichas_final: string
  rebuys: number
  addons: number
  lugar: number
}

export interface PuestoEnLaNoche<T> {
  jugador: T
  /** Lo que puso: entrada más recompras. */
  puso: number
  /** Lo que se llevó, en fichas o en premio. */
  saco: number
  resultado: number
  recompras: number
  montoRecompras: number
  /** 1 = ganó la noche. */
  lugar: number
}

/**
 * La mesa ordenada de mejor a peor resultado.
 *
 * Devuelve los mismos objetos que recibió (`jugador`), para que quien llame pueda
 * seguir usando sus propios campos —nombre, foto— sin que esto tenga que conocerlos.
 */
export function podioDe<T extends JugadorDeLaNoche>(
  partida: { tipo: string; torneo: string | null },
  jugadores: T[],
  colores: ColorFicha[],
): PuestoEnLaNoche<T>[] {
  const esTorneo = partida.tipo === 'torneo'
  const t = leerJson<ConfigTorneo>(partida.torneo, {
    buyIn: 0,
    rebuyPrice: 0,
    addOnPrice: 0,
    payouts: [],
  })

  const valorDe = (fichas: Record<string, number>) =>
    colores.reduce((total, c) => total + num(fichas[c.key]) * num(c.value), 0)

  const pagadoTorneo = (j: JugadorDeLaNoche) =>
    num(t.buyIn) + num(j.rebuys) * num(t.rebuyPrice) + num(j.addons) * num(t.addOnPrice)

  const bolsa = esTorneo ? jugadores.reduce((s, j) => s + pagadoTorneo(j), 0) : 0

  const sinOrdenar = jugadores.map((j) => {
    if (esTorneo) {
      const premio = j.lugar ? t.payouts[j.lugar - 1] : undefined
      return {
        jugador: j,
        puso: pagadoTorneo(j),
        saco: premio ? (bolsa * num(premio.pct)) / 100 : 0,
        recompras: num(j.rebuys),
        montoRecompras: num(j.rebuys) * num(t.rebuyPrice),
      }
    }
    const recompras = leerJson<{ dinero: number }[]>(j.recompras, [])
    const montoRecompras = recompras.reduce((a, r) => a + num(r.dinero), 0)
    return {
      jugador: j,
      puso: num(j.entrada) + montoRecompras,
      saco: valorDe(leerJson<Record<string, number>>(j.fichas_final, {})),
      recompras: recompras.length,
      montoRecompras,
    }
  })

  return sinOrdenar
    .sort((a, b) => b.saco - b.puso - (a.saco - a.puso))
    .map((n, i) => ({ ...n, resultado: n.saco - n.puso, lugar: i + 1 }))
}

/**
 * Quién tiene derecho a presumir esa noche, o `null` si nadie.
 *
 * Nadie gana una mesa vacía, y tampoco gana quien acabó igual que como entró: si en la
 * noche nadie sacó más de lo que puso, el micrófono se queda apagado.
 */
export function ganadorDe<T extends JugadorDeLaNoche>(
  partida: { tipo: string; torneo: string | null },
  jugadores: T[],
  colores: ColorFicha[],
): T | null {
  const podio = podioDe(partida, jugadores, colores)
  const primero = podio[0]
  return primero && primero.resultado > 0 ? primero.jugador : null
}
