import type { ConfigTorneo } from './api'
import { num } from './money'
import type { ChipColor, Chips } from '../store/types'

/*
 * Tornecash: la cuenta de la noche.
 *
 * Es la modalidad que no se parece a las otras dos. Se entra con una cuota fija, pero
 * las fichas que te dan no valen lo mismo que pagaste —$300 dan 500 fichas— y por eso
 * el dinero y las fichas dejan de ser la misma cosa a media noche.
 *
 * De ahí sale todo lo demás: el lugar no lo da quién tiene más fichas enfrente, sino
 * quién le ganó más a la noche, que son las fichas con las que acaba menos todas las
 * que le dieron al entrar y al recomprar. Así el que compró su camino de vuelta no
 * aparece arriba del que nunca tuvo que comprar.
 *
 * El dinero viene después y de un solo lugar: la bolsa de todas las cuotas, repartida
 * entre los de arriba según el porcentaje que se haya puesto esa noche.
 *
 * Esta cuenta es la misma que hace el servidor en `worker/podio.ts`. Está aquí porque
 * la pantalla la necesita en vivo, mientras el de la caja todavía está tecleando el
 * conteo y nadie ha cerrado nada. Las dos están amarradas por pruebas con los mismos
 * números: si una se mueve sin la otra, truenan.
 */

/** Lo mínimo de una participación para poder sacar la cuenta. */
export interface JugadorTornecash {
  rebuys: number
  fichas_final: string
}

export interface PuestoTornecash<T> {
  jugador: T
  /** Fichas que le dieron en toda la noche: la entrada y cada recompra. */
  dadas: number
  /** Fichas con las que acabó, ya contadas por color. */
  finales: number
  /** Lo que de verdad le ganó a la noche. Es lo que da el lugar. */
  neta: number
  /** Dinero que puso: la cuota por cada vez que entró. */
  puso: number
  /** Dinero que se lleva de la bolsa. */
  saco: number
  /** Lo que ganó o perdió en pesos. */
  resultado: number
  lugar: number
}

const leer = (crudo: string | null | undefined): Chips => {
  if (!crudo) return {}
  try {
    return JSON.parse(crudo) as Chips
  } catch {
    return {}
  }
}

/** Lo que cuesta cada recompra. Si no se puso, lo mismo que la entrada. */
export const cuotaDeRecompra = (cfg: ConfigTorneo) => num(cfg.rebuyPrice) || num(cfg.buyIn)

/** Lo que puso alguien en toda la noche, en dinero. */
export const puestoPor = (j: JugadorTornecash, cfg: ConfigTorneo) =>
  num(cfg.buyIn) + num(j.rebuys) * cuotaDeRecompra(cfg)

/** Las fichas que le dieron: una tanda al entrar y otra por cada recompra. */
export const fichasDadas = (j: JugadorTornecash, cfg: ConfigTorneo) =>
  num(cfg.stack) * (1 + num(j.rebuys))

/**
 * Lo que valen unas fichas contadas, en puntos de esta noche.
 *
 * Los valores van por noche y no por liga porque no son dinero: la liga dice que la
 * blanca vale un peso, y aquí esa misma blanca puede valer veinticinco. Al color que
 * no traiga valor de la noche se le usa el de la liga, que es mejor que contarlo en
 * cero y dejar fichas fuera de la cuenta sin que nadie se entere.
 */
export const enPuntos = (fichas: Chips, cfg: ConfigTorneo, colores: ChipColor[]) =>
  colores.reduce((total, c) => total + num(fichas[c.key]) * num(cfg.valores?.[c.key] ?? c.value), 0)

/** La bolsa de la noche: todas las cuotas juntas, menos la cena si se aparta. */
export function bolsaDe(jugadores: JugadorTornecash[], cfg: ConfigTorneo) {
  const recaudado = jugadores.reduce((s, j) => s + puestoPor(j, cfg), 0)
  const cena = Math.min(recaudado, Math.max(0, jugadores.length * num(cfg.cenaPorPersona)))
  return recaudado - cena
}

/**
 * La mesa ordenada por lo que le ganó cada quien a la noche.
 *
 * Los que acaban exactamente igual comparten lugar y se reparten en partes iguales los
 * premios de los puestos que ocupan. No es un caso raro aquí: el que se queda en ceros
 * con una recompra acaba con la misma neta que cualquier otro en las mismas, y si dos
 * de ésos empataran en zona de premio y cada quien cobrara su porcentaje completo, la
 * bolsa pagaría más de lo que se juntó.
 */
export function tablaTornecash<T extends JugadorTornecash>(
  jugadores: T[],
  cfg: ConfigTorneo,
  colores: ChipColor[],
): PuestoTornecash<T>[] {
  const bolsa = bolsaDe(jugadores, cfg)

  const conNeta = jugadores
    .map((j) => {
      const dadas = fichasDadas(j, cfg)
      const finales = enPuntos(leer(j.fichas_final), cfg, colores)
      return { jugador: j, dadas, finales, neta: finales - dadas, puso: puestoPor(j, cfg) }
    })
    .sort((a, b) => b.neta - a.neta)

  const puestos: PuestoTornecash<T>[] = []
  for (let i = 0; i < conNeta.length; ) {
    let fin = i + 1
    while (fin < conNeta.length && Math.abs(conNeta[fin].neta - conNeta[i].neta) <= 1e-9) fin++

    const empatados = fin - i
    let pct = 0
    for (let k = i; k < fin; k++) pct += num(cfg.payouts?.[k]?.pct)
    const saco = (bolsa * pct) / 100 / empatados

    for (let k = i; k < fin; k++) {
      const n = conNeta[k]
      puestos.push({ ...n, saco, resultado: saco - n.puso, lugar: i + 1 })
    }
    i = fin
  }
  return puestos
}

/**
 * Lo que no cuadra y hay que avisar antes de cerrar.
 *
 * Son las dos cosas que se descubren tarde y ya no se pueden arreglar: que los
 * porcentajes no sumen cien, y que haya menos gente que lugares pagados —ahí una parte
 * de la bolsa se queda sin dueño y nadie se da cuenta hasta contar el dinero.
 */
export function avisosDe(jugadores: JugadorTornecash[], cfg: ConfigTorneo): string[] {
  const avisos: string[] = []
  const pcts = cfg.payouts ?? []
  const suma = pcts.reduce((a, x) => a + num(x.pct), 0)

  if (pcts.length === 0) avisos.push('No has puesto cómo se parte la bolsa: nadie va a cobrar.')
  else if (Math.abs(suma - 100) > 0.001)
    avisos.push(
      `Los porcentajes suman ${Math.round(suma * 100) / 100}% y tienen que sumar 100. ` +
        (suma < 100 ? 'Así va a sobrar dinero en la caja.' : 'Así no va a alcanzar.'),
    )

  if (jugadores.length > 0 && jugadores.length < pcts.length) {
    const sobran = pcts.slice(jugadores.length).reduce((a, x) => a + num(x.pct), 0)
    if (sobran > 0)
      avisos.push(
        `Son ${jugadores.length} jugando y pagas ${pcts.length} lugares: el ${Math.round(sobran)}% ` +
          'de la bolsa se quedaría sin dueño. Quita lugares o reparte ese porcentaje.',
      )
  }

  if (num(cfg.stack) <= 0)
    avisos.push('Falta decir con cuántas fichas se sienta cada quien: sin eso no hay ganancia neta.')
  if (num(cfg.buyIn) <= 0) avisos.push('Falta la cuota de entrada.')

  return avisos
}
