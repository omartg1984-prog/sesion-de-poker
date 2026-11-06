import type { Temporada } from './api'

/*
 * Las cuentas de fechas de una temporada.
 *
 * Aquí y no en la pantalla porque son lo único que puede salir mal en silencio —un
 * semestre mal calculado deja una noche en el campeonato equivocado— y así se prueban
 * solas, sin tener que abrir la liga.
 */

/** Un día del calendario, corto: 1 jul 2026. */
export function diaCorto(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** De cuándo a cuándo corre, para leerlo de un vistazo. */
export function cuandoCorre(t: Temporada): string {
  return t.hasta === null
    ? `Desde el ${diaCorto(t.desde)} · sigue corriendo`
    : `${diaCorto(t.desde)} — ${diaCorto(t.hasta)}`
}

/**
 * El semestre en el que cae una fecha, ya con nombre.
 *
 * Es lo que se propone al crear una temporada, porque es como la casa las cuenta: las
 * reglas dicen "la temporada corre de julio a diciembre" y en diciembre se cierra con
 * posada. Así dar de alta la del semestre en curso es abrir y guardar, sin escribir
 * fechas. Se puede cambiar todo.
 */
export function semestreDe(iso: string): { nombre: string; desde: string; hasta: string } {
  const [a, m] = iso.split('-').map(Number)
  return m >= 7
    ? { nombre: `${a} · Jul–Dic`, desde: `${a}-07-01`, hasta: `${a}-12-31` }
    : { nombre: `${a} · Ene–Jun`, desde: `${a}-01-01`, hasta: `${a}-06-30` }
}
