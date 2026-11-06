import { describe, expect, it } from 'vitest'
import { cuandoCorre, diaCorto, semestreDe } from '../temporadas'

/*
 * Las fechas de una temporada.
 *
 * El semestre que se propone al crear una es lo que decide, en la práctica, en qué
 * campeonato va a caer cada noche: si julio se fuera al semestre de enero, la mitad de
 * la liga contaría donde no es.
 */

describe('el semestre que se propone', () => {
  it('de julio a diciembre es el segundo', () => {
    expect(semestreDe('2026-11-06')).toEqual({
      nombre: '2026 · Jul–Dic',
      desde: '2026-07-01',
      hasta: '2026-12-31',
    })
  })

  it('de enero a junio es el primero', () => {
    expect(semestreDe('2026-03-01')).toEqual({
      nombre: '2026 · Ene–Jun',
      desde: '2026-01-01',
      hasta: '2026-06-30',
    })
  })

  it('y el corte cae entre el 30 de junio y el 1 de julio', () => {
    expect(semestreDe('2026-06-30').nombre).toBe('2026 · Ene–Jun')
    expect(semestreDe('2026-07-01').nombre).toBe('2026 · Jul–Dic')
  })

  it('cada año el suyo', () => {
    expect(semestreDe('2027-08-15').desde).toBe('2027-07-01')
  })
})

describe('cómo se lee de cuándo a cuándo corre', () => {
  it('con cierre, los dos extremos', () => {
    expect(cuandoCorre({ id: 'x', nombre: 'x', desde: '2026-07-01', hasta: '2026-12-31' })).toBe(
      '1 jul 2026 — 31 dic 2026',
    )
  })

  it('sin cierre, que sigue corriendo', () => {
    expect(cuandoCorre({ id: 'x', nombre: 'x', desde: '2026-07-01', hasta: null })).toBe(
      'Desde el 1 jul 2026 · sigue corriendo',
    )
  })

  /* Las fechas se parten a mano en vez de dárselas a Date: '2026-07-01' se lee como
     medianoche UTC y en México eso es todavía el 30 de junio. */
  it('no se recorre un día por la zona horaria', () => {
    expect(diaCorto('2026-07-01')).toContain('1 jul')
    expect(diaCorto('2026-01-01')).toContain('1 ene')
  })
})
