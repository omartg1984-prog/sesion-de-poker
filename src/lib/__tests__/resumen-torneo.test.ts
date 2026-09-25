import { describe, expect, it } from 'vitest'
import { resumenDeTorneo, tablaDeReglas } from '../resumenTorneo'
import type { ConfigTorneo } from '../api'

const BASE: ConfigTorneo = {
  buyIn: 500,
  rebuyPrice: 400,
  addOnPrice: 300,
  payouts: [{ pct: 50 }, { pct: 30 }, { pct: 20 }],
  stack: 10000,
  rebuyChips: 8000,
  addOnChips: 6000,
  recomprasHasta: 6,
  addOnsHasta: 6,
}

describe('de qué consta el torneo', () => {
  it('dice cada compra con su dinero, sus fichas y hasta cuándo', () => {
    const { compras } = resumenDeTorneo(BASE)
    expect(compras).toEqual([
      { que: 'Entrada', dinero: 500, fichas: 10000, hasta: '' },
      { que: 'Recompra', dinero: 400, fichas: 8000, hasta: 'hasta que acabe el nivel 6' },
      { que: 'Add-on', dinero: 300, fichas: 6000, hasta: 'hasta que acabe el nivel 6' },
    ])
  })

  it('sin nivel de corte, se compra toda la noche', () => {
    const { compras } = resumenDeTorneo({ ...BASE, recomprasHasta: 0, addOnsHasta: undefined })
    expect(compras[1].hasta).toBe('toda la noche')
    expect(compras[2].hasta).toBe('toda la noche')
  })

  it('lo que no se cobra no se anuncia', () => {
    const { compras } = resumenDeTorneo({ ...BASE, rebuyPrice: 0, addOnPrice: 0 })
    expect(compras.map((c) => c.que)).toEqual(['Entrada'])
  })

  it('los lugares que cobran cero no salen en el reparto', () => {
    const { premios } = resumenDeTorneo({
      ...BASE,
      payouts: [{ pct: 60 }, { pct: 40 }, { pct: 0 }],
    })
    expect(premios).toEqual([
      { lugar: 1, pct: 60 },
      { lugar: 2, pct: 40 },
    ])
  })

  it('un torneo de los viejos cae al stack para las fichas de recompra', () => {
    const { compras } = resumenDeTorneo({
      buyIn: 500,
      rebuyPrice: 500,
      addOnPrice: 0,
      payouts: [{ pct: 100 }],
    })
    /* Sin `stack` configurado, el stack es el buy-in: es lo que hacía la app antes. */
    expect(compras[0].fichas).toBe(500)
    expect(compras[1].fichas).toBe(500)
  })

  it('la bolsa mínima es lo que juntan los que ya están, sin recompras', () => {
    expect(resumenDeTorneo(BASE, 8).bolsaMinima).toBe(4000)
    expect(resumenDeTorneo(BASE).bolsaMinima).toBe(0)
  })
})

describe('las reglas como imagen', () => {
  it('lleva cada compra con sus fichas y hasta cuándo', () => {
    const t = tablaDeReglas(BASE, { titulo: 'El del reloj', liga: 'Los Domingos' })
    expect(t.columnas).toEqual(['Qué', 'Cuánto', 'Detalle'])
    expect(t.filas.slice(0, 3)).toEqual([
      ['Entrada', '$500', '10,000 fichas'],
      ['Recompra', '$400', '8,000 fichas · hasta que acabe el nivel 6'],
      ['Add-on', '$300', '6,000 fichas · hasta que acabe el nivel 6'],
    ])
  })

  it('la cena sale en la tabla y dice que se va de la bolsa', () => {
    const t = tablaDeReglas(
      { ...BASE, cenaPorPersona: 150 },
      { titulo: 'El del reloj', liga: 'Los Domingos' },
    )
    expect(t.filas).toContainEqual(['Cena', '$150', 'por persona, sale de la bolsa'])
  })

  it('sin cena no se inventa el renglón', () => {
    const t = tablaDeReglas(BASE, { titulo: 'x', liga: 'y' })
    expect(t.filas.some((f) => f[0] === 'Cena')).toBe(false)
  })

  it('cierra con los premios, uno por lugar que cobra', () => {
    const t = tablaDeReglas(BASE, { titulo: 'x', liga: 'y' })
    expect(t.filas.slice(-3)).toEqual([
      ['1º lugar', '50%', 'de la bolsa a repartir'],
      ['2º lugar', '30%', 'de la bolsa a repartir'],
      ['3º lugar', '20%', 'de la bolsa a repartir'],
    ])
  })
})
