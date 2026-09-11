import { describe, expect, it } from 'vitest'
import {
  chipValue,
  count,
  finalValueOf,
  investedOf,
  money,
  moneyShort,
  netOf,
  num,
  paidOf,
  payoutAmount,
  pctSum,
  plOf,
  poolOf,
  recompraMoney,
  signed,
  textOn,
} from '../money'
import type { ChipColor, Player, Tournament } from '../../store/types'

const COLORS: ChipColor[] = [
  { key: 'green', label: 'Verdes', color: '#1f8f4e', value: 25, inventory: 100 },
  { key: 'red', label: 'Rojas', color: '#d0342c', value: 5, inventory: 150 },
  { key: 'white', label: 'Blancas', color: '#f2f2ea', value: 1, inventory: 200 },
]

function makePlayer(over: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'Ana',
    entrada: { money: 0, chips: { green: 0, red: 0, white: 0 } },
    recompras: [],
    final: { green: 0, red: 0, white: 0 },
    tourney: { rebuys: 0, addons: 0, place: 0 },
    deal: null,
    ...over,
  }
}

describe('num / count', () => {
  it('convierte texto de formulario a número', () => {
    expect(num('250')).toBe(250)
    expect(num('12.5')).toBe(12.5)
    expect(num(300)).toBe(300)
  })

  it('lo que no es número vale 0', () => {
    expect(num('')).toBe(0)
    expect(num('abc')).toBe(0)
    expect(num(null)).toBe(0)
    expect(num(undefined)).toBe(0)
    expect(num(NaN)).toBe(0)
    expect(num(Infinity)).toBe(0)
  })

  it('count entrega enteros no negativos', () => {
    expect(count('7')).toBe(7)
    expect(count(7.9)).toBe(7)
    expect(count(-3)).toBe(0)
    expect(count('nada')).toBe(0)
  })
})

describe('formato de dinero', () => {
  it('money agrega separador de miles', () => {
    expect(money(1250)).toBe('$1,250')
    expect(money(0)).toBe('$0')
  })

  it('money usa el signo menos para negativos', () => {
    expect(money(-300)).toBe('−$300')
  })

  it('signed siempre lleva signo, salvo el cero', () => {
    expect(signed(400)).toBe('+$400')
    expect(signed(-120)).toBe('−$120')
    expect(signed(0)).toBe('$0')
    expect(signed(0.001)).toBe('$0')
  })

  it('moneyShort redondea a pesos enteros', () => {
    expect(moneyShort(1250.7)).toBe('$1,251')
    expect(moneyShort(-40.2)).toBe('$-40')
  })
})

describe('textOn', () => {
  it('usa texto oscuro sobre colores claros y blanco sobre oscuros', () => {
    expect(textOn('#f2f2ea')).toBe('#222222')
    expect(textOn('#ffffff')).toBe('#222222')
    expect(textOn('#2b2b2b')).toBe('#ffffff')
    expect(textOn('#1f8f4e')).toBe('#ffffff')
  })

  it('acepta hex de 3 dígitos y valores inválidos', () => {
    expect(textOn('#fff')).toBe('#222222')
    expect(textOn('#000')).toBe('#ffffff')
    expect(textOn('')).toBe('#ffffff')
  })
})

describe('cálculos de cash', () => {
  it('chipValue suma fichas por su valor', () => {
    expect(chipValue({ green: 4, red: 2, white: 5 }, COLORS)).toBe(115)
    expect(chipValue({}, COLORS)).toBe(0)
  })

  it('invertido = entrada + todas las recompras', () => {
    const p = makePlayer({
      entrada: { money: 500, chips: { green: 0, red: 0, white: 0 } },
      recompras: [
        { money: 200, chips: { green: 0, red: 0, white: 0 } },
        { money: 100, chips: { green: 0, red: 0, white: 0 } },
      ],
    })
    expect(recompraMoney(p)).toBe(300)
    expect(investedOf(p)).toBe(800)
  })

  it('P/L = valor final − invertido', () => {
    const p = makePlayer({
      entrada: { money: 500, chips: { green: 0, red: 0, white: 0 } },
      final: { green: 30, red: 10, white: 0 },
    })
    expect(finalValueOf(p, COLORS)).toBe(800)
    expect(plOf(p, COLORS)).toBe(300)
  })

  it('la suma de los P/L es cero cuando las fichas cuadran con el dinero', () => {
    const a = makePlayer({
      id: 'a',
      entrada: { money: 500, chips: { green: 0, red: 0, white: 0 } },
      final: { green: 32, red: 0, white: 0 },
    })
    const b = makePlayer({
      id: 'b',
      entrada: { money: 500, chips: { green: 0, red: 0, white: 0 } },
      final: { green: 8, red: 0, white: 0 },
    })
    expect(plOf(a, COLORS) + plOf(b, COLORS)).toBe(0)
  })
})

describe('cálculos de torneo', () => {
  const t: Tournament = {
    buyIn: 200,
    rebuyPrice: 100,
    addOnPrice: 50,
    payouts: [{ pct: 50 }, { pct: 30 }, { pct: 20 }],
  }

  const players: Player[] = [
    makePlayer({ id: 'a', name: 'Ana', tourney: { rebuys: 1, addons: 1, place: 1 } }),
    makePlayer({ id: 'b', name: 'Beto', tourney: { rebuys: 0, addons: 0, place: 2 } }),
    makePlayer({ id: 'c', name: 'Caro', tourney: { rebuys: 2, addons: 0, place: 3 } }),
    makePlayer({ id: 'd', name: 'Dani', tourney: { rebuys: 0, addons: 0, place: 0 } }),
  ]

  it('lo pagado incluye entrada, recompras y add-ons', () => {
    expect(paidOf(players[0], t)).toBe(350)
    expect(paidOf(players[1], t)).toBe(200)
    expect(paidOf(players[2], t)).toBe(400)
  })

  it('la bolsa es la suma de lo que pagaron todos', () => {
    expect(poolOf(players, t)).toBe(1150)
  })

  it('el premio de cada lugar es bolsa × porcentaje', () => {
    expect(pctSum(t)).toBe(100)
    expect(payoutAmount(0, players, t)).toBe(575)
    expect(payoutAmount(1, players, t)).toBe(345)
    expect(payoutAmount(2, players, t)).toBe(230)
    expect(payoutAmount(9, players, t)).toBe(0)
  })

  it('los netos suman cero cuando los porcentajes suman 100', () => {
    const total = players.reduce((s, p) => s + netOf(p, players, t), 0)
    expect(Math.abs(total)).toBeLessThan(0.005)
  })

  it('quien no quedó en lugar premiado tiene neto negativo', () => {
    expect(netOf(players[3], players, t)).toBe(-200)
  })
})
