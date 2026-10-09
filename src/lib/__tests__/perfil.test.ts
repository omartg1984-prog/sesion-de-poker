import { describe, expect, it } from 'vitest'
import {
  MANOS_PARA_PERFIL,
  RENGLONES,
  TANTEO_VACIO,
  guardarTanteo,
  leerTanteo,
  perfilDe,
  sumar,
  type Tanteo,
} from '../perfil'

/*
 * El tipo de jugador que sale de lo que uno hace mano tras mano, y la tabla que lo
 * enseña. Lo que se fija es que los dos extremos se distingan —el que no entra a nada y
 * el que entra a todo—, que un error repetido pese más que el retrato general, y que
 * cada renglón de la tabla salga de donde dice.
 */

const tanteo = (x: Partial<Tanteo> = {}): Tanteo => ({ ...TANTEO_VACIO, ...x })
const renglon = (que: string) => RENGLONES.find((r) => r.que === que)!

describe('antes de tener de dónde', () => {
  it('con pocas manos no se dice qué tipo de jugador es', () => {
    expect(perfilDe(tanteo({ manos: MANOS_PARA_PERFIL - 1, entro: 1 }))).toBeNull()
  })

  it('los renglones sin datos se quedan vacíos en vez de inventar un cero', () => {
    for (const r of RENGLONES) {
      if (r.que === 'Manos jugadas') continue
      expect(r.valor(TANTEO_VACIO)).toBeNull()
    }
  })
})

describe('los tipos', () => {
  it('el que casi no entra es una roca', () => {
    expect(perfilDe(tanteo({ manos: 40, entro: 6, subioPreflop: 4 }))?.nombre).toBe('Roca')
  })

  it('el que casi no entra y sólo paga es un miedoso', () => {
    expect(perfilDe(tanteo({ manos: 40, entro: 6, subioPreflop: 0 }))?.nombre).toBe('Miedoso')
  })

  it('el que entra a todo pagando es un pagador', () => {
    expect(perfilDe(tanteo({ manos: 40, entro: 30, subioPreflop: 2 }))?.nombre).toBe('Pagador')
  })

  it('el que entra a todo y encima sube está loco', () => {
    expect(perfilDe(tanteo({ manos: 40, entro: 30, subioPreflop: 20 }))?.nombre).toBe('Loco')
  })

  it('en medio y con iniciativa, sólido', () => {
    expect(perfilDe(tanteo({ manos: 40, entro: 13, subioPreflop: 7 }))?.nombre).toBe('Sólido')
  })

  it('en medio pero sin subir, tibio', () => {
    expect(perfilDe(tanteo({ manos: 40, entro: 13, subioPreflop: 1 }))?.nombre).toBe('Tibio')
  })
})

describe('el error que se repite manda', () => {
  it('pagar de más se dice antes que el retrato general', () => {
    const p = perfilDe(tanteo({ manos: 40, entro: 6, subioPreflop: 4, pagadas: 9, pagadasBien: 2 }))
    expect(p?.nombre).toBe('Roca')
    expect(p?.consejo).toContain('7 pagadas')
  })

  it('tirar de más también', () => {
    const p = perfilDe(tanteo({ manos: 40, entro: 20, subioPreflop: 2, tiradas: 5, tiradasBien: 0 }))
    expect(p?.consejo).toContain('5 tiradas')
  })

  it('un error suelto no cambia el consejo', () => {
    const base = perfilDe(tanteo({ manos: 40, entro: 13, subioPreflop: 7 }))
    const con = perfilDe(tanteo({ manos: 40, entro: 13, subioPreflop: 7, pagadas: 2, pagadasBien: 0 }))
    expect(con?.consejo).toBe(base?.consejo)
  })
})

describe('la tabla', () => {
  it('a cuántas entras cuenta las manos, no las apuestas', () => {
    expect(renglon('A cuántas entras').valor(tanteo({ manos: 20, entro: 5 }))).toBe('5 · 25%')
  })

  it('a cuántas deberías sale de lo que decían las cuentas', () => {
    expect(renglon('A cuántas deberías').valor(tanteo({ manos: 20, debioEntrar: 7 }))).toBe(
      '7 · 35%',
    )
  })

  it('las tiradas correctas se dicen sobre las tiradas, no sobre las manos', () => {
    const v = renglon('Tiradas correctas').valor(tanteo({ manos: 50, tiradas: 8, tiradasBien: 6 }))
    expect(v).toBe('6 de 8 · 75%')
  })

  it('lo arriesgado compara subir contra pagar', () => {
    expect(renglon('Qué tan arriesgado').valor(tanteo({ subidas: 8, pagadas: 2 }))).toContain('80%')
    expect(renglon('Qué tan arriesgado').valor(tanteo({ subidas: 8, pagadas: 2 }))).toContain(
      'arriesgado',
    )
    expect(renglon('Qué tan arriesgado').valor(tanteo({ subidas: 1, pagadas: 9 }))).toContain(
      'conservador',
    )
  })
})

describe('juntar sesiones', () => {
  it('la de hoy se suma a lo de antes, campo por campo', () => {
    const antes = tanteo({ manos: 10, entro: 3, pagadas: 4, pagadasBien: 3, fichas: -50 })
    const hoy = tanteo({ manos: 5, entro: 2, pagadas: 1, pagadasBien: 1, fichas: 120 })
    const todo = sumar(antes, hoy)
    expect(todo.manos).toBe(15)
    expect(todo.entro).toBe(5)
    expect(todo.pagadasBien).toBe(4)
    expect(todo.fichas).toBe(70)
  })

  it('sumar el vacío no cambia nada', () => {
    const t = tanteo({ manos: 7, entro: 2 })
    expect(sumar(t, TANTEO_VACIO)).toEqual(t)
  })
})

describe('lo que se guarda de una sesión a otra', () => {
  /** Una caja de guardar como la del navegador, para probarla sin navegador. */
  const caja = () => {
    const d = new Map<string, string>()
    return {
      getItem: (k: string) => d.get(k) ?? null,
      setItem: (k: string, v: string) => void d.set(k, v),
    }
  }

  it('se guarda y se vuelve a leer igual', () => {
    const c = caja()
    const t = tanteo({ manos: 12, entro: 5, tiradas: 3, tiradasBien: 2, fichas: -40 })
    guardarTanteo('prueba', t, c)
    expect(leerTanteo('prueba', c)).toEqual(t)
  })

  it('cada liga lleva su propia cuenta', () => {
    const c = caja()
    guardarTanteo('viernes', tanteo({ manos: 9 }), c)
    guardarTanteo('domingos', tanteo({ manos: 3 }), c)
    expect(leerTanteo('viernes', c).manos).toBe(9)
    expect(leerTanteo('domingos', c).manos).toBe(3)
  })

  it('sin nada guardado se empieza de cero', () => {
    expect(leerTanteo('la-que-no-existe', caja())).toEqual(TANTEO_VACIO)
  })

  it('un guardado con basura se limpia en vez de romper', () => {
    const c = caja()
    c.setItem('onlycards.entrenamiento.rota', '{"manos":"muchas","entro":4}')
    const t = leerTanteo('rota', c)
    expect(t.manos).toBe(0)
    expect(t.entro).toBe(4)
  })

  it('sin dónde guardar se sigue jugando', () => {
    expect(leerTanteo('x', null)).toEqual(TANTEO_VACIO)
    expect(() => guardarTanteo('x', tanteo({ manos: 1 }), null)).not.toThrow()
  })
})
