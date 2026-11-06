import { describe, expect, it } from 'vitest'
import {
  cualVer,
  dentroDe,
  seEnciman,
  temporadaDeHoy,
  type Temporada,
} from '../temporadas'

/*
 * Las temporadas.
 *
 * Una temporada es un rango de fechas y cada noche cae en la suya por su fecha. Lo que
 * se prueba aquí es lo que decide en qué campeonato cuenta una noche: los extremos del
 * rango, la que sigue corriendo, y que dos no puedan pisarse.
 */

/** Como las tiene la casa: julio a diciembre, y enero a junio. */
const B2026: Temporada = { id: 'b26', nombre: '2026-B', desde: '2026-07-01', hasta: '2026-12-31' }
const A2026: Temporada = { id: 'a26', nombre: '2026-A', desde: '2026-01-01', hasta: '2026-06-30' }
/** La que no tiene fecha de cierre todavía. */
const ABIERTA: Temporada = { id: 'ab', nombre: 'La que corre', desde: '2027-01-01', hasta: null }

/* De la más nueva a la más vieja, como llegan de la base. */
const LISTA = [ABIERTA, B2026, A2026]

describe('qué noche cae en qué temporada', () => {
  it('los dos extremos cuentan', () => {
    expect(dentroDe(B2026, '2026-07-01')).toBe(true)
    expect(dentroDe(B2026, '2026-12-31')).toBe(true)
  })

  it('un día antes o uno después, no', () => {
    expect(dentroDe(B2026, '2026-06-30')).toBe(false)
    expect(dentroDe(B2026, '2027-01-01')).toBe(false)
  })

  it('la que sigue corriendo se queda con todo lo que venga', () => {
    expect(dentroDe(ABIERTA, '2027-03-15')).toBe(true)
    expect(dentroDe(ABIERTA, '2099-12-31')).toBe(true)
    expect(dentroDe(ABIERTA, '2026-12-31')).toBe(false)
  })
})

describe('cuál es la temporada de hoy', () => {
  it('la que contiene la fecha de hoy', () => {
    expect(temporadaDeHoy(LISTA, '2026-11-06')?.id).toBe('b26')
    expect(temporadaDeHoy(LISTA, '2026-03-01')?.id).toBe('a26')
  })

  it('si hoy cae en un hueco, la última que ya pasó', () => {
    /* Entre el cierre de 2026-B y el arranque de la siguiente no hay temporada; lo que
       la gente tiene en la cabeza es el semestre que acaba de cerrarse. */
    const conHueco = [B2026, A2026]
    expect(temporadaDeHoy(conHueco, '2027-02-01')?.id).toBe('b26')
  })

  it('antes de la primera temporada, ninguna', () => {
    expect(temporadaDeHoy(LISTA, '2020-01-01')).toBe(null)
  })

  it('y una liga sin temporadas no tiene ninguna', () => {
    expect(temporadaDeHoy([], '2026-11-06')).toBe(null)
  })
})

describe('cuál se está viendo', () => {
  it('sin pedir nada, la de hoy', () => {
    expect(cualVer(LISTA, null, '2026-11-06')?.id).toBe('b26')
  })

  it('"todo" es la liga entera', () => {
    expect(cualVer(LISTA, 'todo', '2026-11-06')).toBe(null)
  })

  it('o la que se pidió', () => {
    expect(cualVer(LISTA, 'a26', '2026-11-06')?.id).toBe('a26')
  })

  it('y si se pide una que ya no existe, la de hoy', () => {
    /* Alguien tenía la pantalla abierta y otro admin borró esa temporada. */
    expect(cualVer(LISTA, 'borrada', '2026-11-06')?.id).toBe('b26')
  })

  it('en una liga sin temporadas, siempre la liga entera', () => {
    expect(cualVer([], null, '2026-11-06')).toBe(null)
    expect(cualVer([], 'cualquiera', '2026-11-06')).toBe(null)
  })
})

describe('dos temporadas no se pueden pisar', () => {
  it('pegadas pero sin encimarse, bien', () => {
    expect(seEnciman(A2026, B2026)).toBe(false)
  })

  it('un día compartido ya es encimarse', () => {
    expect(seEnciman({ desde: '2026-06-30', hasta: '2026-12-31' }, A2026)).toBe(true)
  })

  it('una dentro de otra, también', () => {
    expect(seEnciman({ desde: '2026-08-01', hasta: '2026-09-01' }, B2026)).toBe(true)
  })

  it('la que sigue corriendo se encima con todo lo que empiece después', () => {
    expect(seEnciman({ desde: '2027-06-01', hasta: '2027-12-31' }, ABIERTA)).toBe(true)
    expect(seEnciman({ desde: '2026-01-01', hasta: '2026-06-30' }, ABIERTA)).toBe(false)
  })

  it('y dos sin cierre siempre se pisan', () => {
    expect(seEnciman({ desde: '2030-01-01', hasta: null }, ABIERTA)).toBe(true)
  })
})
