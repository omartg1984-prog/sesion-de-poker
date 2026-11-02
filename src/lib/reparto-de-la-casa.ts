import { num } from './money'
import { DEFAULT_COLORS } from '../store/defaults'
import type { ChipColor, Chips } from '../store/types'

/*
 * El puñado de fichas que la casa pone en la mano al que entra.
 *
 * Casi todas las noches entra todo el mundo con lo mismo y se reparte siempre igual:
 * tantas verdes, tantas rojas, tantas blancas. La cuenta automática da un reparto que
 * vale lo mismo, pero no es ése, y acaba con alguien contando fichas distintas a las de
 * siempre cada viernes.
 *
 * Esto no sustituye a la cuenta automática: la manda al banquillo nada más cuando lo
 * que puso alguien es exactamente lo que cubre este puñado. El que entra con más o con
 * menos se reparte solo, como hasta ahora.
 */

export interface RepartoDeLaCasa {
  /** Cuántas de cada color. */
  fichas: Chips
  /** Lo que valen juntas. */
  total: number
}

/**
 * Lo que la liga tenga puesto, o lo de las fichas de siempre.
 *
 * Si la liga no ha dicho nada, se usa lo que traen los colores de fábrica para los
 * colores que siguen siendo los de fábrica. Las ligas que se armaron sus propias fichas
 * no reconocen esas llaves y se quedan con el reparto automático, que es lo correcto:
 * inventarles un puñado con fichas que no conocemos sería peor que no hacer nada.
 */
export function repartoDeLaCasa(colores: ChipColor[]): RepartoDeLaCasa | null {
  /*
   * Se mira si el campo existe, no si trae algo.
   *
   * Poner todo en cero es una decisión —"aquí repártelas tú"— y tiene que poder
   * tomarse. Si se mirara sólo el número, apagarlo a mano daría lo mismo que no
   * haberlo tocado nunca, y volvería el de fábrica sin que nadie lo pidiera.
   */
  const suyo = colores.some((c) => c.entrada !== undefined)

  const fichas: Chips = {}
  let total = 0
  for (const c of colores) {
    const cuantas = suyo
      ? Math.max(0, Math.floor(num(c.entrada)))
      : Math.max(0, Math.floor(num(DEFAULT_COLORS.find((d) => d.key === c.key)?.entrada)))
    if (cuantas > 0) {
      fichas[c.key] = cuantas
      total += cuantas * num(c.value)
    }
  }

  return total > 0 ? { fichas, total } : null
}

/**
 * El puñado de la casa, si alcanza justo para lo que puso esta persona.
 *
 * Tiene que cuadrar al peso. Darle a alguien que entró con $300 el puñado de $500 deja
 * la mesa descuadrada desde el registro, y darle el de $500 a quien puso $700 lo deja
 * corto sin avisar.
 */
export function repartoPara(colores: ChipColor[], monto: number): Chips | null {
  const casa = repartoDeLaCasa(colores)
  if (!casa) return null
  return Math.abs(casa.total - monto) < 1e-9 ? casa.fichas : null
}
