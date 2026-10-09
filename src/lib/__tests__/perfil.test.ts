import { describe, expect, it } from 'vitest'
import { MANOS_PARA_PERFIL, RESUMEN_VACIO, perfilDe, punteria, type Resumen } from '../perfil'

/*
 * El tipo de jugador que sale de lo que uno hace mano tras mano. Lo que se fija es que
 * los dos extremos se distingan —el que no entra a nada y el que entra a todo— y que un
 * error repetido pese más que el retrato general.
 */

const resumen = (x: Partial<Resumen> = {}): Resumen => ({ ...RESUMEN_VACIO, ...x })

describe('antes de tener de dónde', () => {
  it('con pocas manos no se dice nada', () => {
    expect(perfilDe(resumen({ manos: MANOS_PARA_PERFIL - 1, jugadas: 1 }))).toBeNull()
  })

  it('sin decisiones medidas no hay puntería', () => {
    expect(punteria(resumen())).toBeNull()
  })
})

describe('los tipos', () => {
  it('el que casi no entra es una roca', () => {
    const p = perfilDe(resumen({ manos: 40, jugadas: 6, subio: 4 }))
    expect(p?.nombre).toBe('Roca')
  })

  it('el que casi no entra y además sólo paga es un miedoso', () => {
    const p = perfilDe(resumen({ manos: 40, jugadas: 6, subio: 0 }))
    expect(p?.nombre).toBe('Miedoso')
  })

  it('el que entra a todo pagando es un pagador', () => {
    const p = perfilDe(resumen({ manos: 40, jugadas: 30, subio: 2 }))
    expect(p?.nombre).toBe('Pagador')
  })

  it('el que entra a todo y encima sube está loco', () => {
    const p = perfilDe(resumen({ manos: 40, jugadas: 30, subio: 20 }))
    expect(p?.nombre).toBe('Loco')
  })

  it('en medio y con iniciativa, sólido', () => {
    const p = perfilDe(resumen({ manos: 40, jugadas: 13, subio: 7 }))
    expect(p?.nombre).toBe('Sólido')
  })

  it('en medio pero sin subir, tibio', () => {
    const p = perfilDe(resumen({ manos: 40, jugadas: 13, subio: 1 }))
    expect(p?.nombre).toBe('Tibio')
  })

  it('cada tipo trae qué quiere decir y qué corregir', () => {
    for (const jugadas of [4, 13, 30]) {
      for (const subio of [0, 3]) {
        const p = perfilDe(resumen({ manos: 40, jugadas, subio }))
        expect(p?.ayuda.length).toBeGreaterThan(10)
        expect(p?.consejo.length).toBeGreaterThan(10)
      }
    }
  })
})

describe('el error que se repite manda', () => {
  it('pagar de más se dice antes que el retrato general', () => {
    const p = perfilDe(resumen({ manos: 40, jugadas: 6, subio: 4, pagosDeMas: 7, tiradasDeMas: 1 }))
    expect(p?.nombre).toBe('Roca')
    expect(p?.consejo).toContain('7 pagadas')
  })

  it('tirar de más también', () => {
    const p = perfilDe(resumen({ manos: 40, jugadas: 20, subio: 2, pagosDeMas: 0, tiradasDeMas: 5 }))
    expect(p?.consejo).toContain('5 tiradas')
  })

  it('un error suelto no cambia el consejo', () => {
    const base = perfilDe(resumen({ manos: 40, jugadas: 13, subio: 7 }))
    const con = perfilDe(resumen({ manos: 40, jugadas: 13, subio: 7, pagosDeMas: 2 }))
    expect(con?.consejo).toBe(base?.consejo)
  })

  it('si los dos errores van parejos, ninguno manda', () => {
    const base = perfilDe(resumen({ manos: 40, jugadas: 13, subio: 7 }))
    const con = perfilDe(resumen({ manos: 40, jugadas: 13, subio: 7, pagosDeMas: 4, tiradasDeMas: 4 }))
    expect(con?.consejo).toBe(base?.consejo)
  })
})

describe('la puntería', () => {
  it('es el porcentaje de decisiones bien tomadas', () => {
    expect(punteria(resumen({ decisiones: 20, buenas: 15 }))).toBe(75)
  })
})
