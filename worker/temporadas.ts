import type { Env } from './tipos'

/**
 * Las temporadas de una liga.
 *
 * Una temporada es un rango de fechas y nada más. Cada noche cae en la suya por su
 * fecha, sin que nadie la etiquete: así una partida creada hoy con fecha de hace un mes
 * entra donde le toca, y arreglar un rango mal puesto es mover una fecha en vez de
 * tocar todas las noches.
 *
 * Una liga sin temporadas cuenta todas sus noches, como ha sido siempre. Todo lo de
 * aquí aguanta que la liga no tenga ninguna, y aguanta también que la base todavía no
 * sepa de temporadas: en los dos casos contesta "no hay" y la tabla sale completa.
 */
export interface Temporada {
  id: string
  nombre: string
  /** 'YYYY-MM-DD', dentro de la temporada. */
  desde: string
  /** 'YYYY-MM-DD', dentro de la temporada. En null, la que sigue corriendo. */
  hasta: string | null
}

/**
 * Las temporadas de la liga, de la más nueva a la más vieja.
 *
 * Si la tabla todavía no existe en la base contesta que no hay ninguna, y la liga se ve
 * como siempre. Esto es a propósito: el código sale a producción solo al hacer push y
 * las migraciones se corren a mano, así que el orden no puede ser una bomba.
 */
export async function temporadasDe(env: Env, ligaId: string): Promise<Temporada[]> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, nombre, desde, hasta FROM temporadas
       WHERE liga_id = ? ORDER BY desde DESC`,
    )
      .bind(ligaId)
      .all<Temporada>()
    return results ?? []
  } catch {
    return []
  }
}

/** Las noches que un admin dejó fuera del campeonato. */
export async function nochesSueltas(env: Env, ligaId: string): Promise<Set<string>> {
  try {
    const { results } = await env.DB.prepare(
      'SELECT id FROM partidas WHERE liga_id = ? AND cuenta_para_tabla = 0',
    )
      .bind(ligaId)
      .all<{ id: string }>()
    return new Set((results ?? []).map((f) => f.id))
  } catch {
    return new Set()
  }
}

/** Si esa fecha cae dentro de la temporada. Los dos extremos cuentan. */
export const dentroDe = (t: Temporada, fecha: string): boolean =>
  fecha >= t.desde && (t.hasta === null || fecha <= t.hasta)

/**
 * La temporada que corre hoy.
 *
 * Es la que contiene la fecha de hoy. Si hoy cae en un hueco —terminó una y la que
 * sigue todavía no empieza— es la última que ya pasó, que es la que la gente tiene en
 * la cabeza cuando acaba de cerrarse el semestre.
 */
export function temporadaDeHoy(lista: Temporada[], hoy: string): Temporada | null {
  if (lista.length === 0) return null
  return lista.find((t) => dentroDe(t, hoy)) ?? lista.find((t) => t.desde <= hoy) ?? null
}

/**
 * Cuál se está viendo.
 *
 * `pedida` es lo que mandó la pantalla: el id de una temporada, 'todo' para la liga
 * completa, o nada para que decida la app. Sin nada, la de hoy. Un id que ya no existe
 * —se borró la temporada mientras alguien la miraba— también cae en la de hoy.
 */
export function cualVer(
  lista: Temporada[],
  pedida: string | null,
  hoy: string,
): Temporada | null {
  if (pedida === 'todo') return null
  if (pedida) return lista.find((t) => t.id === pedida) ?? temporadaDeHoy(lista, hoy)
  return temporadaDeHoy(lista, hoy)
}

/**
 * Si dos temporadas se pisan.
 *
 * Una noche cae en su temporada por la fecha, así que dos rangos encimados dejarían la
 * misma noche en dos campeonatos y nadie sabría en cuál cuenta. `hasta` en null es
 * "sigue corriendo", y eso se encima con todo lo que venga después.
 */
export const seEnciman = (
  a: { desde: string; hasta: string | null },
  b: { desde: string; hasta: string | null },
): boolean => (b.hasta === null || a.desde <= b.hasta) && (a.hasta === null || a.hasta >= b.desde)
