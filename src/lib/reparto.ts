import { EPS } from './money'

/*
 * Repartir el dinero de la mesa cuando no hay morralla.
 *
 * Las fichas dicen que a alguien le tocan $1,347, pero en la mesa sólo hay billetes de
 * $50. Redondear a cada quien por su cuenta no sirve: si todos redondean hacia arriba
 * el bote no alcanza, y si todos hacia abajo sobra un fajo.
 *
 * Lo que se hace es lo mismo que al repartir escaños: se le da a cada quien su parte
 * redondeada hacia abajo, y los billetes que quedan sueltos van a los que se quedaron
 * más cerca del siguiente —los que más "perdieron" al redondear—. Así nadie pierde más
 * de un billete contra lo que le tocaba, y la suma cuadra con lo que hay en la mesa.
 *
 * Lo que no se pueda partir en billetes se reporta como sobrante, que es lo que de
 * verdad queda en la caja al final de la noche.
 */

export interface Reparto {
  /** Cuánto entregarle a cada quien, en el mismo orden en que llegaron los montos. */
  pagos: number[]
  /**
   * Lo que queda en la mesa después de pagar. Normalmente es lo que no alcanza para
   * un billete más.
   *
   * Puede salir **negativo**, y entonces es un faltante: las fichas contadas suman más
   * de lo que hay en el bote. No se reparte a prorrata para taparlo a propósito —eso
   * escondería un error de conteo detrás de números que parecen cuadrar.
   */
  sobra: number
}

export function repartirRedondeado(montos: number[], total: number, paso: number): Reparto {
  if (paso <= 0 || montos.length === 0) {
    return { pagos: montos.map(() => 0), sobra: total }
  }

  /* Hacia abajo primero: así nunca se promete más dinero del que hay. */
  const piso = montos.map((m) => Math.max(0, Math.floor(m / paso + EPS) * paso))
  const pagos = [...piso]
  let sueltos = Math.floor((total - piso.reduce((a, b) => a + b, 0)) / paso + EPS)

  /* Los billetes sueltos van a quien quedó más cerca del siguiente escalón. Con empate
     manda el que más dinero tenía, para que no dependa del orden de la lista. */
  const orden = montos
    .map((m, i) => ({ i, resto: m - piso[i], monto: m }))
    .sort((a, b) => b.resto - a.resto || b.monto - a.monto)

  for (const { i } of orden) {
    if (sueltos <= 0) break
    pagos[i] += paso
    sueltos--
  }

  return { pagos, sobra: total - pagos.reduce((a, b) => a + b, 0) }
}
