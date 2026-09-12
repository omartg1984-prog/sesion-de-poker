import { EPS, num } from '../../lib/money'
import { leerJson, type Participacion } from '../../lib/api'
import type { Distribution } from '../../lib/distribution'
import type { ChipColor, Chips } from '../../store/types'

/*
 * El cuadre de la noche: que las fichas que salieron vuelvan y que el dinero que entró
 * salga completo.
 *
 * Son dos inventarios distintos y ninguno sustituye al otro. Las fichas dicen si el
 * conteo está bien hecho; el dinero, si ya se le pagó a todos. Una partida se puede
 * cerrar con las fichas mal y el dinero cuadrando —contaron mal pero pagaron bien— y al
 * revés, así que se revisan por separado.
 */

export interface FilaColor {
  color: ChipColor
  /** Las que se le dieron a los jugadores al entrar y al recomprar. */
  entregadas: number
  /** Las que aparecieron en el conteo del cash out. */
  contadas: number
  /** Contadas − entregadas. Positivo = aparecieron de más. */
  dif: number
}

export interface Cuadre {
  fichas: FilaColor[]
  fichasCuadran: boolean
  /** Entradas + recompras: todo el dinero que llegó a la mesa. */
  recaudado: number
  /** Lo que ya se entregó en el cash out. */
  pagado: number
  /** Lo que todavía no se reparte. */
  enLaMesa: number
  /** Se pagó más de lo que entró: eso es un error, no un sobrante. */
  pagadoDeMas: boolean
  /** Cuántos jugadores tienen ya su conteo de fichas capturado. */
  contados: number
  jugadores: number
}

export function calcularCuadre(
  participaciones: Participacion[],
  colores: ChipColor[],
  reparto: Distribution,
  invertidoDe: (p: Participacion) => number,
): Cuadre {
  const entregadasPorColor: Record<string, number> = {}
  for (const fila of reparto.rows) {
    for (const c of colores) entregadasPorColor[c.key] = (entregadasPorColor[c.key] ?? 0) + num(fila.counts[c.key])
  }

  const contadasPorColor: Record<string, number> = {}
  for (const p of participaciones) {
    const fichas = leerJson<Chips>(p.fichas_final, {})
    for (const c of colores) contadasPorColor[c.key] = (contadasPorColor[c.key] ?? 0) + num(fichas[c.key])
  }

  const fichas = colores.map((color) => {
    const entregadas = entregadasPorColor[color.key] ?? 0
    const contadas = contadasPorColor[color.key] ?? 0
    return { color, entregadas, contadas, dif: contadas - entregadas }
  })

  const recaudado = participaciones.reduce((a, p) => a + invertidoDe(p), 0)
  const pagado = participaciones.reduce((a, p) => a + num(p.pagado), 0)

  return {
    fichas,
    fichasCuadran: fichas.every((f) => f.dif === 0),
    recaudado,
    pagado,
    enLaMesa: recaudado - pagado,
    pagadoDeMas: pagado - recaudado > EPS,
    contados: participaciones.filter((p) => Object.keys(leerJson<Chips>(p.fichas_final, {})).length > 0).length,
    jugadores: participaciones.length,
  }
}

/**
 * Por qué todavía no se puede cerrar la partida, o `null` si ya se puede.
 *
 * Las fichas son un candado duro: si no vuelven las mismas que salieron, el conteo está
 * mal y todos los resultados de la noche salen mal.
 *
 * El dinero que queda en la mesa **no** frena el cierre. Casi siempre son los $20 o $50
 * que no se pudieron partir en billetes y se quedan para la próxima; frenar por eso
 * trabaría todas las noches. Lo que sí frena es haber pagado más de lo que entró, que
 * es dinero que no existe.
 */
export function porQueNoSePuedeCerrar(c: Cuadre): string | null {
  if (c.jugadores === 0) return 'Todavía no hay jugadores cargados.'
  if (c.contados < c.jugadores)
    return `Falta contarle las fichas a ${c.jugadores - c.contados} de ${c.jugadores}.`
  if (!c.fichasCuadran) {
    const malas = c.fichas.filter((f) => f.dif !== 0)
    const detalle = malas
      .map((f) => `${Math.abs(f.dif)} ${f.color.label || 'sin nombre'} ${f.dif > 0 ? 'de más' : 'de menos'}`)
      .join(', ')
    return `Las fichas no cuadran: ${detalle}.`
  }
  if (c.pagadoDeMas) return 'Se repartió más dinero del que entró a la mesa.'
  return null
}
