import type { ColorFicha, Env } from './tipos'

/**
 * Tabla acumulada de una liga.
 *
 * Solo cuentan las partidas **cerradas**. Una partida abierta todavía no tiene las
 * fichas contadas, así que todos aparecerían perdiendo todo lo que pusieron: meterla
 * en la tabla no sería "provisional", sería falso.
 *
 * Cash y torneo se mezclan en la misma tabla a propósito: en los dos casos el número
 * que importa es el mismo, cuánto dinero ganó o perdió esa noche.
 */

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
  mejor: number
  peor: number
  /** Partidas en las que terminó con saldo a favor. */
  ganadas: number
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

export async function calcularPosiciones(
  env: Env,
  ligaId: string,
): Promise<{ posiciones: Posicion[]; partidasContadas: number; partidasAbiertas: number }> {
  const liga = await env.DB.prepare('SELECT colores FROM ligas WHERE id = ?')
    .bind(ligaId)
    .first<{ colores: string }>()
  const colores = leerJson<ColorFicha[]>(liga?.colores, [])
  const valorDe = (fichas: Record<string, number>) =>
    colores.reduce((t, c) => t + num(fichas[c.key]) * num(c.value), 0)

  const { results: partidas } = await env.DB.prepare(
    "SELECT id, tipo, torneo FROM partidas WHERE liga_id = ? AND estado = 'cerrada'",
  )
    .bind(ligaId)
    .all<FilaPartida>()

  const abiertas = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM partidas WHERE liga_id = ? AND estado = 'abierta'",
  )
    .bind(ligaId)
    .first<{ n: number }>()

  if (partidas.length === 0) {
    return { posiciones: [], partidasContadas: 0, partidasAbiertas: abiertas?.n ?? 0 }
  }

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

  const acumulado = new Map<string, Posicion>()
  const tomar = (par: FilaParticipacion): Posicion => {
    let p = acumulado.get(par.usuario_id)
    if (!p) {
      p = {
        usuarioId: par.usuario_id,
        nombre: par.nombre,
        usuario: par.usuario,
        foto: par.foto,
        partidas: 0,
        invertido: 0,
        recuperado: 0,
        balance: 0,
        mejor: 0,
        peor: 0,
        ganadas: 0,
      }
      acumulado.set(par.usuario_id, p)
    }
    return p
  }

  for (const partida of partidas) {
    const jugadores = porPartida.get(partida.id) ?? []
    if (jugadores.length === 0) continue

    if (partida.tipo === 'torneo') {
      const t = leerJson(partida.torneo, {
        buyIn: 0,
        rebuyPrice: 0,
        addOnPrice: 0,
        payouts: [] as { pct: number }[],
      })
      const pagado = (j: FilaParticipacion) =>
        num(t.buyIn) + num(j.rebuys) * num(t.rebuyPrice) + num(j.addons) * num(t.addOnPrice)
      const bolsa = jugadores.reduce((s, j) => s + pagado(j), 0)

      for (const j of jugadores) {
        const po = j.lugar ? t.payouts[j.lugar - 1] : undefined
        const premio = po ? (bolsa * num(po.pct)) / 100 : 0
        const puesto = pagado(j)
        const acu = tomar(j)
        acu.partidas++
        acu.invertido += puesto
        acu.recuperado += premio
        const resultado = premio - puesto
        acu.balance += resultado
        acu.mejor = Math.max(acu.mejor, resultado)
        acu.peor = Math.min(acu.peor, resultado)
        if (resultado > 0) acu.ganadas++
      }
    } else {
      for (const j of jugadores) {
        const recompras = leerJson<{ dinero: number }[]>(j.recompras, [])
        const puesto = num(j.entrada) + recompras.reduce((a, r) => a + num(r.dinero), 0)
        const final = valorDe(leerJson<Record<string, number>>(j.fichas_final, {}))
        const acu = tomar(j)
        acu.partidas++
        acu.invertido += puesto
        acu.recuperado += final
        const resultado = final - puesto
        acu.balance += resultado
        acu.mejor = Math.max(acu.mejor, resultado)
        acu.peor = Math.min(acu.peor, resultado)
        if (resultado > 0) acu.ganadas++
      }
    }
  }

  const posiciones = [...acumulado.values()].sort((a, b) => b.balance - a.balance)
  return { posiciones, partidasContadas: partidas.length, partidasAbiertas: abiertas?.n ?? 0 }
}
