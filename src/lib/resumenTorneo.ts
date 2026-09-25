import type { ConfigTorneo } from './api'
import { num } from './money'

/*
 * De qué consta un torneo, dicho para alguien que todavía no se apunta.
 *
 * El que abre el link del grupo no ha visto la pantalla de armado ni sabe qué es un
 * add-on. Lo que necesita antes de decir que sí es: cuánto me cuesta, cuántas fichas me
 * dan, hasta cuándo puedo comprar y cómo se reparte el dinero al final.
 *
 * Vive aparte de la pantalla porque son cuentas, no dibujo, y porque las mismas líneas
 * sirven para la invitación y para el resumen que se manda al chat.
 */

export interface CompraDelTorneo {
  /** 'Entrada', 'Recompra', 'Add-on'. */
  que: string
  dinero: number
  fichas: number
  /** Hasta cuándo se puede comprar, ya dicho en palabras. */
  hasta: string
}

export interface PremioDelTorneo {
  lugar: number
  pct: number
}

export interface ResumenTorneo {
  compras: CompraDelTorneo[]
  premios: PremioDelTorneo[]
  /** Lo que junta la mesa si se apuntan todos los que hay, sin recompras. */
  bolsaMinima: number
}

/** Las fichas de una compra. Los torneos viejos no las traen y ahí manda el stack. */
const fichasDe = (fichas: unknown, stack: number) => num(fichas) || stack

const hastaCuando = (nivel: unknown) => {
  const n = Math.max(0, Math.floor(num(nivel)))
  return n > 0 ? `hasta que acabe el nivel ${n}` : 'toda la noche'
}

export function resumenDeTorneo(t: ConfigTorneo, apuntados = 0): ResumenTorneo {
  const stack = num(t.stack) || num(t.buyIn)

  const compras: CompraDelTorneo[] = [
    { que: 'Entrada', dinero: num(t.buyIn), fichas: stack, hasta: '' },
  ]
  if (num(t.rebuyPrice) > 0)
    compras.push({
      que: 'Recompra',
      dinero: num(t.rebuyPrice),
      fichas: fichasDe(t.rebuyChips, stack),
      hasta: hastaCuando(t.recomprasHasta),
    })
  if (num(t.addOnPrice) > 0)
    compras.push({
      que: 'Add-on',
      dinero: num(t.addOnPrice),
      fichas: fichasDe(t.addOnChips, stack),
      hasta: hastaCuando(t.addOnsHasta),
    })

  /* Sólo los lugares que de verdad cobran: un 0% en la lista es ruido. */
  const premios = t.payouts
    .map((x, i) => ({ lugar: i + 1, pct: num(x.pct) }))
    .filter((x) => x.pct > 0)

  return { compras, premios, bolsaMinima: num(t.buyIn) * Math.max(0, Math.floor(apuntados)) }
}
