import { leerJson, podioDe } from './podio'
import type { ColorFicha, Env } from './tipos'

/**
 * Estadísticas acumuladas de una liga.
 *
 * Solo cuentan las partidas **cerradas**. Una partida abierta todavía no tiene las
 * fichas contadas, así que todos aparecerían perdiendo lo que pusieron: meterla no
 * daría un dato provisional sino uno falso.
 *
 * Cash y torneo se mezclan a propósito: en los dos el número que importa es el mismo,
 * cuánto ganó o perdió esa noche.
 */

/**
 * Cómo reparte puntos una liga.
 *
 * Es una lista de consideraciones, no una fórmula fija: la casa elige cuáles cuentan y
 * cuánto paga cada una. Dos ligas pueden premiar cosas distintas —una la constancia,
 * otra ganar la noche, otra no recomprar— y las dos tienen razón.
 *
 * Se cuenta siempre contra la mesa y no con una tabla fija (10-7-5-3…) porque las mesas
 * no son del mismo tamaño: ganarle a siete vale más que ganarle a tres.
 */

/** Lo que pasó esa noche, que es de donde salen los puntos. */
export interface NocheParaPuntos {
  lugar: number
  deCuantos: number
  /** Lo que ganó o perdió en dinero. */
  resultado: number
  recompras: number
}

/** Una consideración del catálogo: qué paga y cuándo. */
export interface Consideracion {
  id: string
  etiqueta: string
  ayuda: string
  /** Cuántas veces se cobra esa noche. 0 = no aplica. */
  veces: (n: NocheParaPuntos) => number
  /** Lo que paga cuando una liga la enciende por primera vez. */
  sugerido: number
  /** Las que restan se escriben en negativo y se pintan distinto. */
  castigo?: boolean
}

export const CONSIDERACIONES: Consideracion[] = [
  {
    id: 'base',
    etiqueta: 'Por presentarte',
    ayuda: 'Lo que suma venir, aunque te vayas en la primera mano.',
    veces: () => 1,
    sugerido: 1,
  },
  {
    id: 'porJugador',
    etiqueta: 'Por cada uno al que le ganas',
    ayuda: 'Es lo que hace que ganarle a siete valga más que ganarle a tres.',
    veces: (n) => Math.max(0, n.deCuantos - n.lugar),
    sugerido: 1,
  },
  {
    id: 'bonoGanar',
    etiqueta: 'Por ganar la noche',
    ayuda: 'Un premio aparte para el primer lugar.',
    veces: (n) => (n.lugar === 1 ? 1 : 0),
    sugerido: 3,
  },
  {
    id: 'bonoPodio',
    etiqueta: 'Por quedar entre los tres primeros',
    ayuda: 'Sólo en mesas de más de tres: en una de tres, todos estarían en el podio.',
    veces: (n) => (n.lugar <= 3 && n.deCuantos > 3 ? 1 : 0),
    sugerido: 2,
  },
  {
    id: 'bonoPositivo',
    etiqueta: 'Por salir ganando dinero',
    ayuda: 'No es lo mismo quedar tercero arriba que tercero abajo.',
    veces: (n) => (n.resultado > 0 ? 1 : 0),
    sugerido: 2,
  },
  {
    id: 'sinRecompras',
    etiqueta: 'Por aguantar sin recomprar',
    ayuda: 'Premia al que hizo rendir su entrada.',
    veces: (n) => (n.recompras === 0 ? 1 : 0),
    sugerido: 2,
  },
  {
    id: 'bonoUltimo',
    etiqueta: 'Por quedar último',
    ayuda: 'Para restar. Ponlo en negativo si quieres que duela.',
    veces: (n) => (n.lugar === n.deCuantos && n.deCuantos > 1 ? 1 : 0),
    sugerido: -1,
    castigo: true,
  },
  {
    id: 'porRecompra',
    etiqueta: 'Por cada recompra',
    ayuda: 'Para restar. Castiga al que compra su camino de vuelta.',
    veces: (n) => Math.max(0, n.recompras),
    sugerido: -1,
    castigo: true,
  },
]

export interface ReglaPuntos {
  id: string
  puntos: number
}

export interface EsquemaPuntos {
  reglas: ReglaPuntos[]
  /*
   * Puntos por lugar: [1º, 2º, 3º…]. Vacía = no se usa.
   *
   * Es la otra forma de puntuar, y la que usan casi todas las ligas de casa: una tabla
   * fija —25, 20, 15, 10, 5— en vez de contar a cuántos les ganaste. Las dos pueden
   * estar encendidas a la vez, aunque normalmente se usa una.
   */
  tabla?: number[]
}

/* Los de siempre: un punto por venir y uno por cada quien al que le ganaste. Las ligas
   que nunca toquen esto siguen puntuando exactamente igual que antes. */
export const PUNTOS_POR_DEFECTO: EsquemaPuntos = {
  reglas: [
    { id: 'base', puntos: 1 },
    { id: 'porJugador', puntos: 1 },
  ],
}

/** Lo que dice el reglamento de la liga: asistencia, bono por positivo y tabla fija. */
export const PUNTOS_DEL_REGLAMENTO: EsquemaPuntos = {
  reglas: [
    { id: 'base', puntos: 5 },
    { id: 'bonoPositivo', puntos: 5 },
  ],
  tabla: [25, 20, 15, 10, 5],
}

const limpio = (v: unknown) => {
  /* Sólo un número de verdad cuenta: `Number(null)` y `Number('')` dan 0, y eso
     convertiría un campo que nadie puso en un cero que sí cambia la tabla. */
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return Math.max(-999, Math.min(999, Math.round(v)))
}

/**
 * Lee el esquema guardado.
 *
 * Entiende también la forma vieja —cuatro campos sueltos— porque hubo ligas guardadas
 * así antes de que las consideraciones fueran una lista.
 */
export function esquemaDePuntos(crudo: string | null | undefined): EsquemaPuntos {
  const g = leerJson<Record<string, unknown>>(crudo ?? null, {})

  const deLista = Array.isArray(g.reglas)
    ? (g.reglas as unknown[])
        .map((r) => {
          const o = (r ?? {}) as Record<string, unknown>
          const id = String(o.id ?? '')
          const puntos = limpio(o.puntos)
          return CONSIDERACIONES.some((c) => c.id === id) && puntos !== null
            ? { id, puntos }
            : null
        })
        .filter((r): r is ReglaPuntos => r !== null)
    : null
  /* La tabla se limpia como todo lo demás, y se corta en doce: más lugares que eso no
     los llena nadie y un guardado raro no va a inflar la cuenta. */
  const tabla = Array.isArray(g.tabla)
    ? (g.tabla as unknown[]).map((v) => limpio(v) ?? 0).slice(0, 12)
    : undefined

  if (deLista) {
    /* Una lista vacía es una decisión válida —nadie suma nada—, pero repetir un id no:
       se queda el primero. */
    const vistos = new Set<string>()
    const reglas = deLista.filter((r) => !vistos.has(r.id) && vistos.add(r.id))
    return tabla && tabla.length > 0 ? { reglas, tabla } : { reglas }
  }

  /* La forma vieja: { base, porJugador, bonoGanar, bonoPodio }. */
  const viejas = ['base', 'porJugador', 'bonoGanar', 'bonoPodio']
  const convertidas = viejas
    .map((id) => ({ id, puntos: limpio(g[id]) }))
    .filter((r): r is ReglaPuntos => r.puntos !== null && r.puntos !== 0)
  return convertidas.length > 0 ? { reglas: convertidas } : PUNTOS_POR_DEFECTO
}

/** Lo que suma una noche para el campeonato. */
export function puntosDeLaNoche(
  noche: NocheParaPuntos,
  esquema: EsquemaPuntos = PUNTOS_POR_DEFECTO,
): number {
  let total = 0
  for (const regla of esquema.reglas) {
    const c = CONSIDERACIONES.find((x) => x.id === regla.id)
    if (c) total += c.veces(noche) * regla.puntos
  }
  /* Del largo de la tabla en adelante no se suman puntos de lugar, pero lo de asistir
     se cobra igual: es justo lo que dice el reglamento. */
  if (esquema.tabla && esquema.tabla.length > 0) total += esquema.tabla[noche.lugar - 1] ?? 0
  return total
}

interface FilaParticipacion {
  partida_id: string
  usuario_id: string
  nombre: string
  usuario: string
  foto: string | null
  entrada: number
  recompras: string
  fichas_final: string
  rebuys: number
  addons: number
  lugar: number
}

interface FilaPartida {
  id: string
  fecha: string
  nombre: string | null
  tipo: string
  torneo: string | null
}

export interface Posicion {
  usuarioId: string
  nombre: string
  usuario: string
  foto: string | null

  partidas: number
  invertido: number
  recuperado: number
  balance: number

  /** Balance ÷ invertido, en %. Mide el rendimiento sin premiar al que juega más. */
  roi: number
  /** Balance ÷ partidas: cuánto deja una noche típica. */
  promedio: number
  /** Qué tanto de las partidas de la liga jugó, en %. */
  asistencia: number

  mejor: number
  peor: number
  ganadas: number
  /** Veces que terminó entre los tres primeros, en mesas de más de tres. */
  podios: number
  /** Veces que terminó último. */
  ultimos: number
  /** Campeonato: suma de los puntos de cada noche. Ordena por constancia, no por dinero. */
  puntos: number
  /*
   * Los mismos puntos divididos entre las noches que vino.
   *
   * El total premia venir; esto premia hacerlo bien. Hacen falta los dos: con sólo el
   * total, el que no se pierde una le gana siempre al que viene poco y arrasa, y con
   * sólo el promedio pasa justo al revés.
   */
  puntosPorNoche: number

  /** Positiva = noches ganando seguidas; negativa = perdiendo. */
  rachaActual: number
  mejorRacha: number

  /**
   * Qué tanto se mueve de una noche a otra, en pesos.
   *
   * Dos personas pueden acabar la temporada con el mismo saldo jugando de maneras
   * opuestas: una ganando y perdiendo trescientos pesos cada viernes, la otra haciendo
   * tres mil una noche y perdiendo dos mil ochocientos la siguiente. El saldo no
   * distingue entre las dos; esto sí.
   *
   * Es la desviación de sus resultados. Con menos de tres noches no se calcula: dos
   * datos no dicen nada de qué tan parejo juega alguien.
   */
  volatilidad: number

  /**
   * El saldo acumulado después de cada noche de `fechas`, para la gráfica.
   *
   * Cuando alguien no vino, su número se arrastra igual: la raya se queda plana, que es
   * exactamente lo que pasó con su dinero esa noche.
   */
  serie: number[]

  recompras: number
  montoRecompras: number

  /** `false` si ya no está en la liga pero jugó partidas que siguen contando. */
  esMiembro: boolean

  /** Lo que se ganó presumir. */
  titulos: Titulo[]
}

/**
 * Un título que alguien se ganó. El `id` es lo que la app usa para elegir el icono;
 * la `etiqueta` y el `porque` van tal cual a la pantalla y a la imagen compartible.
 */
export interface Titulo {
  id:
    | 'rey'
    | 'tiburon'
    | 'racha'
    | 'seco'
    | 'cajero'
    | 'comefichas'
    | 'infalible'
    | 'fiel'
    | 'palazo'
    | 'batacazo'
  etiqueta: string
  porque: string
}

/**
 * Cuántas noches dibuja la gráfica de la temporada.
 *
 * No es un límite técnico sino de lectura: en la pantalla de un teléfono, treinta
 * puntos ya salen apretados y doscientos son una mancha. Las de antes siguen contando
 * para el saldo, que arranca acumulado desde la primera.
 */
const NOCHES_EN_LA_GRAFICA = 30

export interface RecordLiga {
  etiqueta: string
  nombre: string
  valor: number
  /** Contexto: la fecha o el nombre de la partida. */
  detalle?: string
}

/** Cómo le ha ido a dos personas una contra la otra. */
export interface Duelo {
  a: string
  b: string
  /** Noches en las que `a` quedó arriba de `b`. */
  ganoA: number
  ganoB: number
}

export interface TablaLiga {
  posiciones: Posicion[]
  partidasContadas: number
  partidasAbiertas: number
  /** Suma de todo lo que entró a las mesas. */
  dineroMovido: number
  promedioMesa: number
  /** La noche con más dinero en la mesa. */
  mayorMesa: { monto: number; detalle: string } | null
  records: RecordLiga[]
  /**
   * Las fechas que dibuja la gráfica, en orden. Son las últimas noches nada más: una
   * temporada de doscientos viernes no cabe en la pantalla de un teléfono ni dice más
   * que las últimas treinta.
   */
  fechas: string[]
  /**
   * Quién le ha ganado a quién, contando sólo las noches en que jugaron los dos.
   *
   * Es lo que de verdad se discute en la mesa —"a ti siempre te gano"— y hasta ahora
   * nadie tenía con qué contestar. Los empates no cuentan para ninguno.
   */
  caraACara: Duelo[]
}

/** Lo que hizo una persona en una noche concreta. */
interface Noche {
  puesto: number
  saco: number
  resultado: number
  recompras: number
  montoRecompras: number
  lugarEnLaMesa: number
  deCuantos: number
  /** Cuál de las noches de la temporada fue, para poder dibujar la gráfica. */
  indice: number
}

/**
 * Qué tan parejo juega alguien: la desviación de lo que deja cada noche.
 *
 * Con menos de tres noches devuelve cero. Dos resultados siempre "se desvían" uno del
 * otro y saldría un número grande que no quiere decir nada de cómo juega.
 */
export function volatilidadDe(resultados: number[]): number {
  if (resultados.length < 3) return 0
  const media = resultados.reduce((a, r) => a + r, 0) / resultados.length
  const v = resultados.reduce((a, r) => a + (r - media) ** 2, 0) / resultados.length
  return Math.sqrt(v)
}

/**
 * El saldo acumulado tras cada noche dibujada.
 *
 * Se acumula desde el principio de la temporada aunque la gráfica empiece después: la
 * raya tiene que decir con cuánto va de verdad, no con cuánto va desde que cabe en la
 * pantalla. Las noches en que alguien no vino arrastran el número de antes, porque eso
 * es justo lo que le pasó a su dinero.
 */
export function serieAcumulada(
  noches: { indice: number; resultado: number }[],
  cuantasNoches: number,
  desde: number,
): number[] {
  const puntos: number[] = []
  let acumulado = 0
  let j = 0
  for (let i = 0; i < cuantasNoches; i++) {
    while (j < noches.length && noches[j].indice === i) {
      acumulado += noches[j].resultado
      j++
    }
    if (i >= desde) puntos.push(acumulado)
  }
  return puntos
}

/**
 * Apunta quién quedó arriba de quién en una mesa, para el cara a cara.
 *
 * La clave de cada pareja lleva los dos ids ordenados, así "Omar contra Chuy" y "Chuy
 * contra Omar" caen en el mismo renglón. Los que empataron en lugar no se anotan nada:
 * no se ganaron.
 */
export function anotarDuelos(duelos: Map<string, Duelo>, mesa: { id: string; lugar: number }[]) {
  for (let i = 0; i < mesa.length; i++) {
    for (let k = i + 1; k < mesa.length; k++) {
      const uno = mesa[i]
      const otro = mesa[k]
      if (uno.id === otro.id) continue

      const alDerecho = uno.id < otro.id
      const a = alDerecho ? uno : otro
      const b = alDerecho ? otro : uno

      const clave = `${a.id}|${b.id}`
      const d = duelos.get(clave) ?? { a: a.id, b: b.id, ganoA: 0, ganoB: 0 }
      if (a.lugar < b.lugar) d.ganoA++
      else if (b.lugar < a.lugar) d.ganoB++
      duelos.set(clave, d)
    }
  }
}

export async function calcularPosiciones(env: Env, ligaId: string): Promise<TablaLiga> {
  const liga = await env.DB.prepare('SELECT colores, puntos FROM ligas WHERE id = ?')
    .bind(ligaId)
    .first<{ colores: string; puntos: string | null }>()
  const colores = leerJson<ColorFicha[]>(liga?.colores, [])
  /* Cómo puntea esta casa. Sin nada guardado, los números de siempre. */
  const esquema = esquemaDePuntos(liga?.puntos)
  const paraPuntos = (n: Noche): NocheParaPuntos => ({
    lugar: n.lugarEnLaMesa,
    deCuantos: n.deCuantos,
    resultado: n.resultado,
    recompras: n.recompras,
  })

  // En orden cronológico: las rachas necesitan saber qué pasó antes.
  const { results: partidas } = await env.DB.prepare(
    `SELECT id, fecha, nombre, tipo, torneo FROM partidas
     WHERE liga_id = ? AND estado = 'cerrada' ORDER BY fecha ASC, creada_en ASC`,
  )
    .bind(ligaId)
    .all<FilaPartida>()

  const abiertas = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM partidas WHERE liga_id = ? AND estado = 'abierta'",
  )
    .bind(ligaId)
    .first<{ n: number }>()
  const partidasAbiertas = abiertas?.n ?? 0

  const vacia: TablaLiga = {
    posiciones: [],
    partidasContadas: 0,
    partidasAbiertas,
    dineroMovido: 0,
    promedioMesa: 0,
    mayorMesa: null,
    records: [],
    fechas: [],
    caraACara: [],
  }
  if (partidas.length === 0) return vacia

  const marcas = partidas.map(() => '?').join(',')
  const { results: participaciones } = await env.DB.prepare(
    `SELECT p.partida_id, p.usuario_id, u.nombre, u.usuario, u.foto,
            p.entrada, p.recompras, p.fichas_final, p.rebuys, p.addons, p.lugar
     FROM participaciones p JOIN usuarios u ON u.id = p.usuario_id
     WHERE p.partida_id IN (${marcas})`,
  )
    .bind(...partidas.map((p) => p.id))
    .all<FilaParticipacion>()

  const porPartida = new Map<string, FilaParticipacion[]>()
  for (const par of participaciones) {
    const lista = porPartida.get(par.partida_id) ?? []
    lista.push(par)
    porPartida.set(par.partida_id, lista)
  }

  /** Historial por persona, en orden cronológico. */
  const historial = new Map<string, { datos: FilaParticipacion; noches: Noche[] }>()
  const anotar = (par: FilaParticipacion, noche: Noche) => {
    let h = historial.get(par.usuario_id)
    if (!h) {
      h = { datos: par, noches: [] }
      historial.set(par.usuario_id, h)
    }
    h.noches.push(noche)
  }

  let dineroMovido = 0
  let mayorMesa: TablaLiga['mayorMesa'] = null

  /* Los duelos, por pareja. La clave va con los dos ids ordenados para que "Omar contra
     Chuy" y "Chuy contra Omar" caigan en el mismo renglón. */
  const duelos = new Map<string, Duelo>()

  partidas.forEach((partida, indice) => {
    const jugadores = porPartida.get(partida.id) ?? []
    if (jugadores.length === 0) return

    const etiqueta = partida.nombre || partida.fecha
    /* La misma regla que usa el lobby para el podio y el permiso de presumir: si
       aquí se ordenara distinto, el ganador de la noche no sería el mismo en dos
       pantallas de la misma app. */
    const ordenadas = podioDe(partida, jugadores, colores)

    const mesa = ordenadas.reduce((s, n) => s + n.puso, 0)
    dineroMovido += mesa
    if (!mayorMesa || mesa > mayorMesa.monto) mayorMesa = { monto: mesa, detalle: etiqueta }

    for (const n of ordenadas) {
      anotar(n.jugador, {
        puesto: n.puso,
        saco: n.saco,
        resultado: n.resultado,
        recompras: n.recompras,
        montoRecompras: n.montoRecompras,
        lugarEnLaMesa: n.lugar,
        deCuantos: ordenadas.length,
        indice,
      })
    }

    /* Cada quien contra cada quien, en esta mesa. */
    anotarDuelos(
      duelos,
      ordenadas.map((n) => ({ id: n.jugador.usuario_id, lugar: n.lugar })),
    )
  })

  /** Noches ganando seguidas al final del historial; negativo si va perdiendo. */
  const rachaAlCierre = (noches: Noche[]) => {
    if (noches.length === 0) return 0
    const gana = noches[noches.length - 1].resultado > 0
    let n = 0
    for (let i = noches.length - 1; i >= 0; i--) {
      const g = noches[i].resultado > 0
      if (g !== gana) break
      n++
    }
    return gana ? n : -n
  }

  /* De dónde arranca la gráfica: las últimas noches nada más. */
  const DESDE = Math.max(0, partidas.length - NOCHES_EN_LA_GRAFICA)
  const fechas = partidas.slice(DESDE).map((p) => p.fecha)

  const mejorRachaDe = (noches: Noche[]) => {
    let mejor = 0
    let corrida = 0
    for (const n of noches) {
      corrida = n.resultado > 0 ? corrida + 1 : 0
      if (corrida > mejor) mejor = corrida
    }
    return mejor
  }

  const { results: socios } = await env.DB.prepare(
    'SELECT usuario_id FROM miembros WHERE liga_id = ?',
  )
    .bind(ligaId)
    .all<{ usuario_id: string }>()
  const dentro = new Set(socios.map((m) => m.usuario_id))

  const posiciones: Posicion[] = [...historial.values()].map(({ datos, noches }) => {
    const invertido = noches.reduce((a, n) => a + n.puesto, 0)
    const recuperado = noches.reduce((a, n) => a + n.saco, 0)
    const balance = recuperado - invertido
    return {
      usuarioId: datos.usuario_id,
      nombre: datos.nombre,
      usuario: datos.usuario,
      foto: datos.foto,
      partidas: noches.length,
      invertido,
      recuperado,
      balance,
      roi: invertido > 0 ? (balance / invertido) * 100 : 0,
      promedio: noches.length ? balance / noches.length : 0,
      asistencia: (noches.length / partidas.length) * 100,
      mejor: noches.reduce((m, n) => Math.max(m, n.resultado), 0),
      peor: noches.reduce((m, n) => Math.min(m, n.resultado), 0),
      ganadas: noches.filter((n) => n.resultado > 0).length,
      // Un podio en una mesa de tres no dice nada: los tres estarían en él.
      podios: noches.filter((n) => n.lugarEnLaMesa <= 3 && n.deCuantos > 3).length,
      ultimos: noches.filter((n) => n.lugarEnLaMesa === n.deCuantos && n.deCuantos > 1).length,
      puntos: noches.reduce((a, n) => a + puntosDeLaNoche(paraPuntos(n), esquema), 0),
      puntosPorNoche: noches.length
        ? noches.reduce((a, n) => a + puntosDeLaNoche(paraPuntos(n), esquema), 0) / noches.length
        : 0,
      rachaActual: rachaAlCierre(noches),
      mejorRacha: mejorRachaDe(noches),
      volatilidad: volatilidadDe(noches.map((n) => n.resultado)),
      serie: serieAcumulada(noches, partidas.length, DESDE),
      recompras: noches.reduce((a, n) => a + n.recompras, 0),
      montoRecompras: noches.reduce((a, n) => a + n.montoRecompras, 0),
      esMiembro: dentro.has(datos.usuario_id),
      titulos: [],
    }
  })

  posiciones.sort((a, b) => b.balance - a.balance)

  /* ---------- títulos ---------- */

  const dar = (p: Posicion | undefined, t: Titulo) => {
    if (p) p.titulos.push(t)
  }
  /** El que más alto puntúa en algo, si el número llega a decir algo. */
  const punta = (valor: (p: Posicion) => number, filtro: (p: Posicion) => boolean = () => true) => {
    const aptos = posiciones.filter(filtro)
    if (aptos.length === 0) return undefined
    const top = aptos.reduce((a, b) => (valor(b) > valor(a) ? b : a))
    return valor(top) > 0 ? top : undefined
  }
  // Los rendimientos piden dos noches: con una sola, la suerte de principiante
  // coronaría a cualquiera.
  const conHistorial = (p: Posicion) => p.partidas >= 2
  const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-MX')

  if (posiciones[0]?.balance > 0)
    dar(posiciones[0], { id: 'rey', etiqueta: 'El Rey', porque: `${pesos(posiciones[0].balance)} arriba` })

  dar(punta((p) => p.roi, conHistorial), { id: 'tiburon', etiqueta: 'Tiburón', porque: 'el que mejor rinde' })
  dar(punta((p) => p.mejor), { id: 'palazo', etiqueta: 'El Palazo', porque: 'la mejor noche de la liga' })
  dar(punta((p) => -p.peor), { id: 'batacazo', etiqueta: 'El Batacazo', porque: 'la peor noche de la liga' })
  dar(punta((p) => p.recompras), { id: 'comefichas', etiqueta: 'Come-fichas', porque: 'el que más recompra' })

  const ultimo = posiciones[posiciones.length - 1]
  if (ultimo && ultimo.balance < 0 && posiciones.length > 1)
    dar(ultimo, { id: 'cajero', etiqueta: 'El Cajero', porque: 'financia la liga' })

  for (const p of posiciones) {
    if (p.rachaActual >= 2)
      dar(p, { id: 'racha', etiqueta: 'En racha', porque: `${p.rachaActual} noches ganando` })
    if (p.rachaActual <= -2)
      dar(p, { id: 'seco', etiqueta: 'En seco', porque: `${-p.rachaActual} noches perdiendo` })
    if (p.partidas >= 2 && p.ganadas === p.partidas)
      dar(p, { id: 'infalible', etiqueta: 'Infalible', porque: 'no ha perdido una noche' })
    if (p.partidas >= 3 && p.asistencia >= 99.5)
      dar(p, { id: 'fiel', etiqueta: 'El Fiel', porque: 'no se ha perdido una' })
  }

  /** El mejor de la liga en algo, siempre que el número diga algo. */
  const mejorEn = (
    etiqueta: string,
    valor: (p: Posicion) => number,
    filtro: (p: Posicion) => boolean = () => true,
    detalle?: (p: Posicion) => string,
  ): RecordLiga | null => {
    const aptos = posiciones.filter(filtro)
    if (aptos.length === 0) return null
    const ganador = aptos.reduce((a, b) => (valor(b) > valor(a) ? b : a))
    if (valor(ganador) <= 0) return null
    return {
      etiqueta,
      nombre: ganador.nombre,
      valor: valor(ganador),
      detalle: detalle?.(ganador),
    }
  }

  const records = [
    mejorEn('Mejor noche', (p) => p.mejor),
    mejorEn('Mejor rendimiento', (p) => p.roi, conHistorial, (p) => `en ${p.partidas} partidas`),
    mejorEn('Racha más larga', (p) => p.mejorRacha, conHistorial, () => 'noches ganando seguidas'),
    mejorEn('Más asistencias', (p) => p.partidas, () => true, () => `de ${partidas.length}`),
    mejorEn('Más podios', (p) => p.podios),
    mejorEn('Más recompras', (p) => p.recompras),
    mejorEn('Peor noche', (p) => -p.peor),
  ].filter((r): r is RecordLiga => r !== null)

  return {
    posiciones,
    partidasContadas: partidas.length,
    partidasAbiertas,
    dineroMovido,
    promedioMesa: dineroMovido / partidas.length,
    mayorMesa,
    records,
    fechas,
    caraACara: [...duelos.values()],
  }
}
