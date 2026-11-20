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
  /** Los que todavía no lo tienen, por nombre: "faltan dos" no sirve para ir por ellos. */
  faltanContar: string[]
  /** Igual con el dinero: a quiénes no se les ha apuntado lo que se llevaron. */
  faltanPagar: string[]
  /** A cuántos ya se les apuntó lo que se les entregó, aunque hayan sido $0. */
  pagados: number
  /**
   * A cuántos hay que entregarles algo.
   *
   * En cash y en torneo son todos: hasta el que se fue sin nada lleva su cero apuntado,
   * porque "cero" y "todavía no le pago" no son lo mismo. En tornecash sólo los que
   * alcanzaron lugar, porque a los demás no hay nada que entregarles y pedir ocho ceros
   * a la una de la mañana es trabajo que la app puede ahorrarse.
   */
  porCobrar: number
  jugadores: number
}

export function calcularCuadre(
  participaciones: Participacion[],
  colores: ChipColor[],
  reparto: Distribution,
  invertidoDe: (p: Participacion) => number,
  /** Quién tiene que acabar con un pago apuntado. Por omisión, todos. */
  debeCobrar: (p: Participacion) => boolean = () => true,
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

  /*
   * Quién tiene su conteo hecho.
   *
   * No basta con que le hayan salido fichas: el que se fue sin una sola también tiene
   * su conteo hecho, y es cero. Por eso manda `contadas_por` —quién lo capturó—, y las
   * fichas sueltas sólo sirven para las partidas viejas, de antes de que se guardara
   * quién contó.
   */
  const tieneConteo = (p: Participacion) =>
    p.contadas_por !== null || Object.keys(leerJson<Chips>(p.fichas_final, {})).length > 0

  const recaudado = participaciones.reduce((a, p) => a + invertidoDe(p), 0)
  const pagado = participaciones.reduce((a, p) => a + num(p.pagado), 0)

  return {
    fichas,
    fichasCuadran: fichas.every((f) => f.dif === 0),
    recaudado,
    pagado,
    enLaMesa: recaudado - pagado,
    pagadoDeMas: pagado - recaudado > EPS,
    contados: participaciones.filter(tieneConteo).length,
    faltanContar: participaciones.filter((p) => !tieneConteo(p)).map((p) => p.nombre),
    faltanPagar: participaciones
      .filter((p) => debeCobrar(p) && p.pagado === null)
      .map((p) => p.nombre),
    /* `pagado` en null es "todavía no se le entrega"; en 0 es "se fue sin nada", que es
       un dato válido y muy común. Por eso se cuenta el null, no el cero. */
    pagados: participaciones.filter((p) => debeCobrar(p) && p.pagado !== null).length,
    porCobrar: participaciones.filter(debeCobrar).length,
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
 *
 * Y frena que alguien se quede sin anotar. Eso pasó la primera noche de verdad: se
 * cerró la partida con dos jugadores sin apuntarles cuánto se les dio. Las fichas ya
 * cuadraban, así que nada avisó —y el dinero de esa noche quedó contado a medias—.
 * Anotar $0 es válido; dejarlo en blanco, no.
 */
export function porQueNoSePuedeCerrar(c: Cuadre): string | null {
  if (c.jugadores === 0) return 'Todavía no hay jugadores cargados.'
  if (c.faltanContar.length > 0)
    return (
      `Falta contarle las fichas a ${enLista(c.faltanContar)}.` +
      ' Si se fue sin una sola, abre su conteo y guárdalo en ceros.'
    )
  if (!c.fichasCuadran) {
    const malas = c.fichas.filter((f) => f.dif !== 0)
    const detalle = malas
      .map((f) => `${Math.abs(f.dif)} ${f.color.label || 'sin nombre'} ${f.dif > 0 ? 'de más' : 'de menos'}`)
      .join(', ')
    return `Las fichas no cuadran: ${detalle}.`
  }
  if (c.pagadoDeMas) return 'Se repartió más dinero del que entró a la mesa.'
  if (c.faltanPagar.length > 0)
    return `Falta apuntar cuánto se le dio a ${enLista(c.faltanPagar)}. Si se fue sin nada, ponle 0.`
  return null
}

/**
 * Una lista de nombres dicha como se dice: "Chuy y Omar", "Chuy, Omar y Beto".
 *
 * Pasado el tope se corta —"y 3 más"— porque un aviso de catorce nombres no se lee, y
 * con tres ya se sabe a quién hay que ir a buscar.
 */
export function enLista(nombres: string[], tope = 3): string {
  if (nombres.length === 0) return ''
  if (nombres.length === 1) return nombres[0]
  if (nombres.length <= tope + 1)
    return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
  return `${nombres.slice(0, tope).join(', ')} y ${nombres.length - tope} más`
}
