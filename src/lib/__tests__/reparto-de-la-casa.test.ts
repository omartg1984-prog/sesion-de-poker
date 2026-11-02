import { describe, expect, it } from 'vitest'
import { repartoDeLaCasa, repartoPara } from '../reparto-de-la-casa'
import { DEFAULT_COLORS } from '../../store/defaults'
import type { ChipColor } from '../../store/types'

/*
 * El puñado que la casa pone en la mano al que entra.
 *
 * Lo que se prueba aquí es que no se le dé a nadie un montón que no cuadre con lo que
 * puso: eso descuadra la mesa desde el registro y no se nota hasta contar al final.
 */

const sinEntrada = DEFAULT_COLORS.map(({ entrada, ...resto }) => resto as ChipColor)

describe('el reparto de las fichas de siempre', () => {
  it('son 14 verdes, 8 negras, 8 rojas, 10 azules y 10 blancas', () => {
    const r = repartoDeLaCasa(DEFAULT_COLORS)!
    expect(r.fichas).toEqual({ green: 14, black: 8, red: 8, blue: 10, white: 10 })
  })

  it('y suman los $500 con los que entra todo el mundo', () => {
    expect(repartoDeLaCasa(DEFAULT_COLORS)!.total).toBe(500)
  })

  it('a una liga que no ha puesto el suyo se le da el de las fichas de fábrica', () => {
    /* Son las mismas llaves aunque la liga no haya guardado nunca los `entrada`. */
    expect(repartoDeLaCasa(sinEntrada)).toEqual(repartoDeLaCasa(DEFAULT_COLORS))
  })

  it('a una liga con sus propias fichas no se le inventa nada', () => {
    const suyas: ChipColor[] = [
      { key: 'moradas', label: 'Moradas', color: '#7c4dff', value: 20, inventory: 50 },
      { key: 'naranjas', label: 'Naranjas', color: '#ff9800', value: 2, inventory: 80 },
    ]
    expect(repartoDeLaCasa(suyas)).toBe(null)
  })

  it('lo que diga la liga manda sobre lo de fábrica', () => {
    const suyo = DEFAULT_COLORS.map((c) =>
      c.key === 'green' ? { ...c, entrada: 20 } : { ...c, entrada: 0 },
    )
    const r = repartoDeLaCasa(suyo)!
    expect(r.fichas).toEqual({ green: 20 })
    expect(r.total).toBe(500)
  })

  it('con todo en cero no hay reparto de la casa', () => {
    expect(repartoDeLaCasa(DEFAULT_COLORS.map((c) => ({ ...c, entrada: 0 })))).toBe(null)
  })

  it('no cuenta medias fichas ni cantidades negativas', () => {
    const raro = DEFAULT_COLORS.map((c) =>
      c.key === 'green' ? { ...c, entrada: 2.7 } : { ...c, entrada: -5 },
    )
    const r = repartoDeLaCasa(raro)!
    expect(r.fichas).toEqual({ green: 2 })
    expect(r.total).toBe(50)
  })
})

describe('a quién se le da el puñado de la casa', () => {
  it('al que entró con lo de siempre', () => {
    expect(repartoPara(DEFAULT_COLORS, 500)).toEqual({
      green: 14,
      black: 8,
      red: 8,
      blue: 10,
      white: 10,
    })
  })

  it('al que entró con menos, no: se le repartiría de más', () => {
    expect(repartoPara(DEFAULT_COLORS, 300)).toBe(null)
  })

  it('al que entró con más, tampoco: se quedaría corto', () => {
    expect(repartoPara(DEFAULT_COLORS, 700)).toBe(null)
  })

  it('ni un peso de diferencia alcanza', () => {
    expect(repartoPara(DEFAULT_COLORS, 499)).toBe(null)
    expect(repartoPara(DEFAULT_COLORS, 501)).toBe(null)
  })

  it('al que no puso nada, nada', () => {
    expect(repartoPara(DEFAULT_COLORS, 0)).toBe(null)
  })

  it('las fichas que da valen exactamente lo que puso', () => {
    const fichas = repartoPara(DEFAULT_COLORS, 500)!
    const vale = DEFAULT_COLORS.reduce((a, c) => a + (fichas[c.key] ?? 0) * c.value, 0)
    expect(vale).toBe(500)
  })
})
