import { describe, expect, it } from 'vitest'
import { balancedStack, computeDistribution, distributionText, stackTotal } from '../distribution'
import type { Caps, DealPlayer } from '../distribution'
import { money } from '../money'
import type { ChipColor, Chips } from '../../store/types'

const COLORS: ChipColor[] = [
  { key: 'green', label: 'Verdes', color: '#1f8f4e', value: 25, inventory: 100 },
  { key: 'black', label: 'Negras', color: '#2b2b2b', value: 10, inventory: 100 },
  { key: 'red', label: 'Rojas', color: '#d0342c', value: 5, inventory: 150 },
  { key: 'blue', label: 'Azules', color: '#2563c9', value: 2, inventory: 150 },
  { key: 'white', label: 'Blancas', color: '#f2f2ea', value: 1, inventory: 200 },
]

const NO_CAPS: Caps = {}

function player(id: string, buyIn: number, deal: Chips | null = null): DealPlayer {
  return { id, name: id, buyIn, deal }
}

describe('balancedStack', () => {
  it('reparte $500 con fichas chicas acotadas y el resto en verdes', () => {
    const { counts, total } = balancedStack(500, COLORS, NO_CAPS)
    expect(counts).toEqual({ green: 14, black: 7, red: 8, blue: 12, white: 16 })
    expect(total).toBe(500)
  })

  it('con una entrada menor solo cambian las verdes: las chicas quedan igual', () => {
    const { counts, total } = balancedStack(300, COLORS, NO_CAPS)
    expect(counts).toEqual({ green: 6, black: 7, red: 8, blue: 12, white: 16 })
    expect(total).toBe(300)
  })

  it('suma exacta para cualquier buy-in cuando hay una ficha de valor 1', () => {
    for (let b = 1; b <= 1200; b += 7) {
      const { total } = balancedStack(b, COLORS, NO_CAPS)
      expect(total).toBe(b)
    }
  })

  it('mantiene acotada la pila de cambio: nadie acapara fichas chicas', () => {
    // El tope es el de CHANGE_KEEP; la reparación exacta puede agregar 2 fichas más
    // de una denominación chica para cuadrar el último peso.
    const keep: Record<string, number> = { white: 16, blue: 12, red: 8, black: 6 }
    for (let b = 1; b <= 3000; b++) {
      const { counts } = balancedStack(b, COLORS, NO_CAPS)
      for (const [key, max] of Object.entries(keep)) {
        expect(counts[key]).toBeLessThanOrEqual(max + 2)
      }
    }
  })

  it('el valor extra va a las fichas grandes, no a más fichas chicas', () => {
    // Sea cual sea el buy-in, lo que se lleva en fichas chicas nunca crece:
    // se queda cerca del valor de la pila de cambio (16 + 24 + 40 + 60 = $140).
    for (let b = 1; b <= 3000; b++) {
      const { counts } = balancedStack(b, COLORS, NO_CAPS)
      const valorChicas = counts.white * 1 + counts.blue * 2 + counts.red * 5 + counts.black * 10
      expect(valorChicas).toBeLessThanOrEqual(170)
    }
    // y por encima de esa pila, el resto se cubre con verdes
    expect(balancedStack(1000, COLORS, NO_CAPS).counts.green).toBe(34)
  })

  it('respeta los topes por color', () => {
    const caps: Caps = { green: 2, black: 3, red: 4, blue: 5, white: 6 }
    const { counts, total } = balancedStack(500, COLORS, caps)
    for (const [key, max] of Object.entries(caps)) expect(counts[key]).toBeLessThanOrEqual(max)
    expect(total).toBe(stackTotal(counts, COLORS))
    expect(total).toBeLessThan(500) // con esos topes no alcanza
  })

  it('devuelve todo en cero si el buy-in es 0 o negativo', () => {
    expect(balancedStack(0, COLORS, NO_CAPS)).toEqual({
      counts: { green: 0, black: 0, red: 0, blue: 0, white: 0 },
      total: 0,
    })
    expect(balancedStack(-50, COLORS, NO_CAPS).total).toBe(0)
  })

  it('no se pasa del objetivo cuando no hay ficha chica que ajuste', () => {
    const gruesas: ChipColor[] = [
      { key: 'g', label: 'Verdes', color: '#1f8f4e', value: 25, inventory: 999 },
      { key: 'b', label: 'Negras', color: '#2b2b2b', value: 10, inventory: 999 },
      { key: 'r', label: 'Rojas', color: '#d0342c', value: 5, inventory: 999 },
    ]
    const { total } = balancedStack(503, gruesas, NO_CAPS)
    expect(total).toBe(500)
    expect(total).toBeLessThanOrEqual(503)
  })

  it('ignora los colores con valor 0', () => {
    const conCero: ChipColor[] = [
      ...COLORS,
      { key: 'x', label: 'Sin valor', color: '#000000', value: 0, inventory: 50 },
    ]
    const { counts, total } = balancedStack(200, conCero, NO_CAPS)
    expect(counts.x).toBe(0)
    expect(total).toBe(200)
  })
})

describe('computeDistribution', () => {
  it('reparte a todos sin pasarse del inventario', () => {
    const colors = COLORS.map((c) => ({ ...c }))
    const players = [player('a', 500), player('b', 500), player('c', 500), player('d', 500)]
    const dist = computeDistribution(players, colors)

    expect(dist.rows).toHaveLength(4)
    for (const r of dist.rows) expect(r.leftover).toBe(0)
    for (const c of colors) {
      expect(dist.usage[c.key].used).toBeLessThanOrEqual(c.inventory)
      expect(dist.usage[c.key].over).toBe(false)
    }
    expect(dist.anyOver).toBe(false)
    expect(dist.anyShortfall).toBe(false)
  })

  it('reserva primero las fichas del jugador manual y reacomoda a los automáticos', () => {
    const colors: ChipColor[] = [
      { key: 'green', label: 'Verdes', color: '#1f8f4e', value: 25, inventory: 40 },
      { key: 'red', label: 'Rojas', color: '#d0342c', value: 5, inventory: 40 },
      { key: 'white', label: 'Blancas', color: '#f2f2ea', value: 1, inventory: 60 },
    ]
    const manual: Chips = { green: 20, red: 0, white: 0 }
    const players = [player('a', 500, manual), player('b', 500), player('c', 500)]
    const dist = computeDistribution(players, colors)

    const rowA = dist.rows.find((r) => r.id === 'a')!
    expect(rowA.manual).toBe(true)
    expect(rowA.counts).toEqual(manual)

    // a los automáticos solo les quedan 20 verdes para repartirse entre dos
    for (const id of ['b', 'c']) {
      const row = dist.rows.find((r) => r.id === id)!
      expect(row.manual).toBe(false)
      expect(row.counts.green).toBeLessThanOrEqual(10)
    }
    expect(dist.usage.green.used).toBeLessThanOrEqual(40)
    expect(dist.anyOver).toBe(false)
  })

  it('avisa cuando el inventario no alcanza para cuadrar exacto', () => {
    const colors: ChipColor[] = [
      { key: 'green', label: 'Verdes', color: '#1f8f4e', value: 25, inventory: 4 },
      { key: 'white', label: 'Blancas', color: '#f2f2ea', value: 1, inventory: 4 },
    ]
    const dist = computeDistribution([player('a', 500)], colors)
    expect(dist.rows[0].total).toBe(104)
    expect(dist.rows[0].leftover).toBe(396)
    expect(dist.anyShortfall).toBe(true)
  })

  it('marca el exceso cuando un reparto manual se pasa del inventario', () => {
    const colors: ChipColor[] = [
      { key: 'green', label: 'Verdes', color: '#1f8f4e', value: 25, inventory: 10 },
    ]
    const dist = computeDistribution([player('a', 500, { green: 30 })], colors)
    expect(dist.usage.green.used).toBe(30)
    expect(dist.usage.green.over).toBe(true)
    expect(dist.anyOver).toBe(true)
    expect(dist.rows[0].leftover).toBe(-250) // se pasa del buy-in
  })

  it('con "ignorar inventario" reparte exacto aunque no haya fichas suficientes', () => {
    const colors = COLORS.map((c) => ({ ...c, inventory: 1 }))
    const players = [player('a', 800), player('b', 800)]
    const dist = computeDistribution(players, colors, true)
    for (const r of dist.rows) expect(r.leftover).toBe(0)
    expect(dist.anyOver).toBe(false)
    expect(dist.anyShortfall).toBe(false)
  })

  it('se adapta al agregar jugadores: el tope justo baja y sigue cuadrando', () => {
    const colors = COLORS.map((c) => ({ ...c }))
    const dos = computeDistribution([player('a', 400), player('b', 400)], colors)
    const cinco = computeDistribution(
      ['a', 'b', 'c', 'd', 'e'].map((id) => player(id, 400)),
      colors,
    )
    expect(dos.rows.every((r) => r.leftover === 0)).toBe(true)
    expect(cinco.rows.every((r) => r.leftover === 0)).toBe(true)
    expect(cinco.usage.white.used).toBeLessThanOrEqual(colors[4].inventory)
  })

  it('usa "Jugador N" cuando no hay nombre', () => {
    const dist = computeDistribution([{ id: 'a', name: '', buyIn: 100, deal: null }], COLORS)
    expect(dist.rows[0].name).toBe('Jugador 1')
  })

  it('arma el texto para compartir', () => {
    const dist = computeDistribution([player('Ana', 300)], COLORS, true)
    const txt = distributionText(dist, COLORS, money)
    expect(txt).toContain('Reparto de fichas')
    expect(txt).toContain('Ana ($300): 6 Verdes, 7 Negras, 8 Rojas, 12 Azules, 16 Blancas')
  })
})
