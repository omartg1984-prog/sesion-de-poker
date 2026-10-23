import { describe, expect, it } from 'vitest'
import { anotarDuelos, serieAcumulada, volatilidadDe, type Duelo } from '../posiciones'

/*
 * Las cuentas de la temporada que no son el campeonato: qué tan parejo juega cada
 * quien, cómo se movió su saldo noche por noche, y quién le ha ganado a quién.
 *
 * Las tres se miran en la pantalla de la liga y las tres se discuten en la mesa, así
 * que más vale que digan la verdad.
 */

describe('qué tan parejo juega alguien', () => {
  it('el que gana y pierde poquito se mueve poco', () => {
    const parejo = volatilidadDe([200, -150, 180, -200, 120])
    const rusa = volatilidadDe([3000, -2800, 2400, -2600, 1900])
    expect(parejo).toBeLessThan(rusa)
  })

  it('el que siempre deja lo mismo no se mueve nada', () => {
    expect(volatilidadDe([500, 500, 500, 500])).toBeCloseTo(0, 9)
  })

  it('no se calcula con menos de tres noches', () => {
    expect(volatilidadDe([])).toBe(0)
    expect(volatilidadDe([1000])).toBe(0)
    /* Dos resultados siempre se desvían uno del otro y saldría un número que no dice
       nada de cómo juega. */
    expect(volatilidadDe([5000, -5000])).toBe(0)
  })

  it('da lo mismo ganar mucho que perder mucho: lo que mide es el vaivén', () => {
    expect(volatilidadDe([100, 200, 300])).toBeCloseTo(volatilidadDe([-100, -200, -300]), 9)
  })

  it('no le importa en qué orden pasaron las noches', () => {
    expect(volatilidadDe([400, -100, 250])).toBeCloseTo(volatilidadDe([-100, 250, 400]), 9)
  })
})

describe('el saldo noche por noche', () => {
  it('va sumando lo de cada noche', () => {
    const noches = [
      { indice: 0, resultado: 100 },
      { indice: 1, resultado: -40 },
      { indice: 2, resultado: 300 },
    ]
    expect(serieAcumulada(noches, 3, 0)).toEqual([100, 60, 360])
  })

  it('la noche que alguien no vino arrastra el número de antes', () => {
    /* Vino a la primera y a la tercera: en la de en medio su raya se queda plana. */
    const noches = [
      { indice: 0, resultado: 500 },
      { indice: 2, resultado: -200 },
    ]
    expect(serieAcumulada(noches, 3, 0)).toEqual([500, 500, 300])
  })

  it('el que no ha venido nunca va en ceros toda la temporada', () => {
    expect(serieAcumulada([], 4, 0)).toEqual([0, 0, 0, 0])
  })

  it('al recortar la gráfica, el saldo sigue siendo el de toda la temporada', () => {
    const noches = [
      { indice: 0, resultado: 1000 },
      { indice: 1, resultado: 1000 },
      { indice: 2, resultado: -500 },
      { indice: 3, resultado: 200 },
    ]
    /* Dibujando sólo las dos últimas, la raya arranca en 1,500 y no en cero: con eso
       es con lo que de verdad llegó a esa noche. */
    expect(serieAcumulada(noches, 4, 2)).toEqual([1500, 1700])
  })

  it('dos veces en la misma noche se suman las dos', () => {
    const noches = [
      { indice: 1, resultado: 100 },
      { indice: 1, resultado: 50 },
    ]
    expect(serieAcumulada(noches, 2, 0)).toEqual([0, 150])
  })
})

describe('cara a cara', () => {
  /** La mesa de una noche, del primer lugar al último. */
  const mesa = (...ids: string[]) => ids.map((id, i) => ({ id, lugar: i + 1 }))

  const cuenta = (duelos: Map<string, Duelo>, x: string, y: string) => {
    const d = duelos.get(x < y ? `${x}|${y}` : `${y}|${x}`)
    if (!d) return null
    return d.a === x ? { gane: d.ganoA, perdi: d.ganoB } : { gane: d.ganoB, perdi: d.ganoA }
  }

  it('el que queda arriba le gana al que queda abajo', () => {
    const duelos = new Map<string, Duelo>()
    anotarDuelos(duelos, mesa('ana', 'beto', 'cris'))
    expect(cuenta(duelos, 'ana', 'beto')).toEqual({ gane: 1, perdi: 0 })
    expect(cuenta(duelos, 'beto', 'ana')).toEqual({ gane: 0, perdi: 1 })
    expect(cuenta(duelos, 'ana', 'cris')).toEqual({ gane: 1, perdi: 0 })
  })

  it('se van sumando noche tras noche', () => {
    const duelos = new Map<string, Duelo>()
    anotarDuelos(duelos, mesa('ana', 'beto'))
    anotarDuelos(duelos, mesa('ana', 'beto'))
    anotarDuelos(duelos, mesa('beto', 'ana'))
    expect(cuenta(duelos, 'ana', 'beto')).toEqual({ gane: 2, perdi: 1 })
  })

  it('da lo mismo en qué orden vengan los dos en la lista', () => {
    const unos = new Map<string, Duelo>()
    const otros = new Map<string, Duelo>()
    anotarDuelos(unos, mesa('zeta', 'alfa'))
    anotarDuelos(otros, [
      { id: 'alfa', lugar: 2 },
      { id: 'zeta', lugar: 1 },
    ])
    expect(cuenta(unos, 'zeta', 'alfa')).toEqual(cuenta(otros, 'zeta', 'alfa'))
  })

  it('el empate no se lo anota ninguno', () => {
    const duelos = new Map<string, Duelo>()
    anotarDuelos(duelos, [
      { id: 'ana', lugar: 1 },
      { id: 'beto', lugar: 1 },
    ])
    expect(cuenta(duelos, 'ana', 'beto')).toEqual({ gane: 0, perdi: 0 })
  })

  it('sólo cuentan las noches en que jugaron los dos', () => {
    const duelos = new Map<string, Duelo>()
    anotarDuelos(duelos, mesa('ana', 'beto'))
    anotarDuelos(duelos, mesa('ana', 'cris'))
    /* Beto y Cris nunca coincidieron: no hay duelo entre ellos. */
    expect(cuenta(duelos, 'beto', 'cris')).toBe(null)
  })

  it('una mesa de uno no arma duelos', () => {
    const duelos = new Map<string, Duelo>()
    anotarDuelos(duelos, mesa('ana'))
    expect(duelos.size).toBe(0)
  })

  it('en una mesa de cinco salen los diez duelos', () => {
    const duelos = new Map<string, Duelo>()
    anotarDuelos(duelos, mesa('a', 'b', 'c', 'd', 'e'))
    expect(duelos.size).toBe(10)
    /* Y lo que gana uno lo pierde el otro: nunca se cuentan dos victorias. */
    for (const d of duelos.values()) expect(d.ganoA + d.ganoB).toBe(1)
  })
})
