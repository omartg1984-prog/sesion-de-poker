import type { ConfigTorneo } from './api'
import { num } from './money'

/*
 * De dónde sale y a dónde va el dinero de un torneo.
 *
 * La bolsa no se sabe hasta el final: cada recompra y cada add-on la mueven, así que
 * cualquier cuenta hecha al arrancar queda vieja. Y encima de la mesa casi siempre hay
 * una cena que sale de lo que puso la gente —"entrada $500, cena incluida"—, de modo
 * que lo recaudado y lo que se reparte no son el mismo número.
 *
 * Confundirlos es lo que hace que al final del torneo nadie cuadre: el que llevó el
 * banco reparte porcentajes de una bolsa que ya pagó la pizza. Por eso esto devuelve
 * el desglose entero, renglón por renglón, y no sólo el total.
 */

export interface RenglonBolsa {
  /** 'Entradas', 'Recompras', 'Add-ons', 'Cena'. */
  que: string
  /** Cuántas veces. */
  cuantos: number
  /** A cómo cada una. */
  precio: number
  /** `cuantos × precio`. Negativo en lo que sale de la bolsa. */
  total: number
}

export interface DesgloseBolsa {
  /** Lo que entró: entradas, recompras y add-ons. */
  entradas: RenglonBolsa[]
  /** Lo que sale antes de repartir. Hoy sólo la cena. */
  salidas: RenglonBolsa[]
  /** Todo el dinero que puso la mesa. */
  recaudado: number
  /** Lo que se va en cena. Siempre positivo. */
  cena: number
  /** Lo que de verdad se reparte en premios. */
  premios: number
}

/**
 * El desglose de la noche.
 *
 * La cena se cobra por persona y una sola vez: recomprar tres veces no es cenar tres
 * veces. Nunca se lleva más que lo recaudado —si alguien teclea una cena imposible, la
 * bolsa se queda en cero en vez de salir negativa—.
 */
export function desgloseDeBolsa(
  jugadores: number,
  recompras: number,
  addOns: number,
  t: ConfigTorneo,
): DesgloseBolsa {
  const n = Math.max(0, Math.floor(jugadores))
  const entradas: RenglonBolsa[] = [
    { que: 'Entradas', cuantos: n, precio: num(t.buyIn), total: n * num(t.buyIn) },
  ]
  if (recompras > 0 || num(t.rebuyPrice) > 0)
    entradas.push({
      que: 'Recompras',
      cuantos: recompras,
      precio: num(t.rebuyPrice),
      total: recompras * num(t.rebuyPrice),
    })
  if (addOns > 0 || num(t.addOnPrice) > 0)
    entradas.push({
      que: 'Add-ons',
      cuantos: addOns,
      precio: num(t.addOnPrice),
      total: addOns * num(t.addOnPrice),
    })

  const recaudado = entradas.reduce((s, r) => s + r.total, 0)
  const cena = Math.min(recaudado, Math.max(0, n * num(t.cenaPorPersona)))

  const salidas: RenglonBolsa[] =
    cena > 0 ? [{ que: 'Cena', cuantos: n, precio: num(t.cenaPorPersona), total: -cena }] : []

  return { entradas, salidas, recaudado, cena, premios: recaudado - cena }
}

/** Lo que le toca al lugar `i` (base 0), ya descontada la cena. */
export function premioDelLugar(i: number, premios: number, t: ConfigTorneo): number {
  const po = t.payouts[i]
  return po ? (premios * num(po.pct)) / 100 : 0
}
