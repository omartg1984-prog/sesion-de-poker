import { describe, expect, it } from 'vitest'
import { desgloseDeBolsa, premioDelLugar } from '../bolsaTorneo'
import type { ConfigTorneo } from '../api'

const BASE: ConfigTorneo = {
  buyIn: 500,
  rebuyPrice: 400,
  addOnPrice: 300,
  payouts: [{ pct: 50 }, { pct: 30 }, { pct: 20 }],
}

describe('de dónde sale y a dónde va el dinero del torneo', () => {
  it('suma entradas, recompras y add-ons', () => {
    const d = desgloseDeBolsa(8, 5, 3, BASE)
    expect(d.entradas.map((r) => [r.que, r.cuantos, r.total])).toEqual([
      ['Entradas', 8, 4000],
      ['Recompras', 5, 2000],
      ['Add-ons', 3, 900],
    ])
    expect(d.recaudado).toBe(6900)
  })

  it('sin cena, lo recaudado es lo que se reparte', () => {
    const d = desgloseDeBolsa(8, 5, 3, BASE)
    expect(d.cena).toBe(0)
    expect(d.salidas).toEqual([])
    expect(d.premios).toBe(6900)
  })

  it('la cena sale de la bolsa antes de repartir', () => {
    const d = desgloseDeBolsa(8, 5, 3, { ...BASE, cenaPorPersona: 150 })
    expect(d.cena).toBe(1200)
    expect(d.salidas).toEqual([{ que: 'Cena', cuantos: 8, precio: 150, total: -1200 }])
    expect(d.recaudado).toBe(6900)
    expect(d.premios).toBe(5700)
  })

  it('se cobra por persona, no por recompra', () => {
    /* El que recompró tres veces cenó una. */
    const sinRecompras = desgloseDeBolsa(8, 0, 0, { ...BASE, cenaPorPersona: 150 })
    const conRecompras = desgloseDeBolsa(8, 9, 4, { ...BASE, cenaPorPersona: 150 })
    expect(sinRecompras.cena).toBe(conRecompras.cena)
  })

  it('una cena imposible deja la bolsa en cero, no en negativo', () => {
    const d = desgloseDeBolsa(4, 0, 0, { ...BASE, cenaPorPersona: 5000 })
    expect(d.recaudado).toBe(2000)
    expect(d.cena).toBe(2000)
    expect(d.premios).toBe(0)
  })

  it('los premios se calculan sobre lo que queda, no sobre lo recaudado', () => {
    const d = desgloseDeBolsa(8, 5, 3, { ...BASE, cenaPorPersona: 150 })
    expect(premioDelLugar(0, d.premios, BASE)).toBe(2850)
    expect(premioDelLugar(1, d.premios, BASE)).toBe(1710)
    expect(premioDelLugar(2, d.premios, BASE)).toBe(1140)
    /* Y lo repartido es exactamente la bolsa: nada se queda en el aire. */
    const repartido = [0, 1, 2].reduce((s, i) => s + premioDelLugar(i, d.premios, BASE), 0)
    expect(repartido).toBeCloseTo(d.premios, 6)
  })

  it('un lugar que no existe no paga nada', () => {
    expect(premioDelLugar(7, 5000, BASE)).toBe(0)
  })
})
