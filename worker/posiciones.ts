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
 * Puntos de campeonato de una noche: uno por cada jugador al que le ganaste, más uno
 * por presentarte.
 *
 * Se reparte así y no con una tabla fija (10-7-5-3…) porque las mesas no siempre son
 * del mismo tamaño: ganarle a siete vale más que ganarle a tres, y con una tabla fija
 * las dos noches pagarían igual. El punto por asistir premia al que no falla, que es
 * justo lo que el saldo en dinero no mide.
 */
export const puntosDeLaNoche = (lugar: number, deCuantos: number) => deCuantos - lugar + 1

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

  /** Positiva = noches ganando seguidas; negativa = perdiendo. */
  rachaActual: number
  mejorRacha: number

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

export interface RecordLiga {
  etiqueta: string
  nombre: string
  valor: number
  /** Contexto: la fecha o el nombre de la partida. */
  detalle?: string
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
}

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

function leerJson<T>(crudo: string | null | undefined, porDefecto: T): T {
  if (!crudo) return porDefecto
  try {
    return JSON.parse(crudo) as T
  } catch {
    return porDefecto
  }
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
}

export async function calcularPosiciones(env: Env, ligaId: string): Promise<TablaLiga> {
  const liga = await env.DB.prepare('SELECT colores FROM ligas WHERE id = ?')
    .bind(ligaId)
    .first<{ colores: string }>()
  const colores = leerJson<ColorFicha[]>(liga?.colores, [])
  const valorDe = (fichas: Record<string, number> | Record<string, unknown>) =>
    colores.reduce((t, c) => t + num((fichas as Record<string, number>)[c.key]) * num(c.value), 0)

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

  for (const partida of partidas) {
    const jugadores = porPartida.get(partida.id) ?? []
    if (jugadores.length === 0) continue

    const etiqueta = partida.nombre || partida.fecha
    const esTorneo = partida.tipo === 'torneo'
    const t = leerJson(partida.torneo, {
      buyIn: 0,
      rebuyPrice: 0,
      addOnPrice: 0,
      payouts: [] as { pct: number }[],
    })

    const pagadoTorneo = (j: FilaParticipacion) =>
      num(t.buyIn) + num(j.rebuys) * num(t.rebuyPrice) + num(j.addons) * num(t.addOnPrice)
    const bolsa = esTorneo ? jugadores.reduce((s, j) => s + pagadoTorneo(j), 0) : 0

    // Primero el resultado de cada quien, para poder ordenar la mesa.
    const noches = jugadores.map((j) => {
      if (esTorneo) {
        const po = j.lugar ? t.payouts[j.lugar - 1] : undefined
        const puesto = pagadoTorneo(j)
        const saco = po ? (bolsa * num(po.pct)) / 100 : 0
        return {
          j,
          puesto,
          saco,
          recompras: num(j.rebuys),
          montoRecompras: num(j.rebuys) * num(t.rebuyPrice),
        }
      }
      const recompras = leerJson<{ dinero: number }[]>(j.recompras, [])
      const montoRecompras = recompras.reduce((a, r) => a + num(r.dinero), 0)
      return {
        j,
        puesto: num(j.entrada) + montoRecompras,
        saco: valorDe(leerJson<Record<string, number>>(j.fichas_final, {})),
        recompras: recompras.length,
        montoRecompras,
      }
    })

    const mesa = noches.reduce((s, n) => s + n.puesto, 0)
    dineroMovido += mesa
    if (!mayorMesa || mesa > mayorMesa.monto) mayorMesa = { monto: mesa, detalle: etiqueta }

    const ordenadas = [...noches].sort((a, b) => b.saco - b.puesto - (a.saco - a.puesto))
    ordenadas.forEach((n, i) => {
      anotar(n.j, {
        puesto: n.puesto,
        saco: n.saco,
        resultado: n.saco - n.puesto,
        recompras: n.recompras,
        montoRecompras: n.montoRecompras,
        lugarEnLaMesa: i + 1,
        deCuantos: ordenadas.length,
      })
    })
  }

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
      puntos: noches.reduce((a, n) => a + puntosDeLaNoche(n.lugarEnLaMesa, n.deCuantos), 0),
      rachaActual: rachaAlCierre(noches),
      mejorRacha: mejorRachaDe(noches),
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
  }
}
