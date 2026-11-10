import { describe, expect, it } from 'vitest'
import {
  armarEntrada,
  cuantasAguanta,
  entradaDeArranque,
  entradaMasComun,
  entradaSugerida,
  planDeFichas,
} from '../plan-fichas'
import { DEFAULT_COLORS } from '../../store/defaults'
import type { ChipColor } from '../../store/types'

/*
 * El plan de las fichas.
 *
 * Lo que se prueba aquí es que el plan nunca enseñe un reparto que no cuadre con lo que
 * pone cada quien, y que la cuenta de "aguanta tantas entregas" sea la del color que se
 * acaba primero y no un promedio: lo segundo es lo que deja a la mesa sin fichas a
 * medianoche.
 */

/** Las fichas de Omar hoy: las cinco de siempre más las de $50 y las de $100. */
const CON_MORADAS: ChipColor[] = [
  { key: 'yellow', label: 'Amarillas', color: '#eda100', value: 100, inventory: 40 },
  { key: 'purple', label: 'Moradas', color: '#7c4dff', value: 50, inventory: 60 },
  { key: 'green', label: 'Verdes', color: '#1f8f4e', value: 25, inventory: 100 },
  { key: 'black', label: 'Negras', color: '#2b2b2b', value: 10, inventory: 100 },
  { key: 'red', label: 'Rojas', color: '#d0342c', value: 5, inventory: 150 },
  { key: 'blue', label: 'Azules', color: '#2563c9', value: 2, inventory: 150 },
  { key: 'white', label: 'Blancas', color: '#f2f2ea', value: 1, inventory: 200 },
]

describe('el puñado que sugiere la app', () => {
  it('es 10 blancas, 10 azules, 8 rojas, 8 negras, 10 verdes y 2 moradas', () => {
    const { fichas, total } = entradaSugerida(CON_MORADAS, 500)
    expect(fichas).toEqual({
      white: 10,
      blue: 10,
      red: 8,
      black: 8,
      green: 10,
      purple: 2,
      yellow: 0,
    })
    expect(total).toBe(500)
  })

  it('deja las amarillas guardadas mientras no haga falta', () => {
    expect(entradaSugerida(CON_MORADAS, 500).fichas.yellow).toBe(0)
  })

  it('en una liga sin fichas de $50 cuadra los $500 con las verdes', () => {
    /* Que es exactamente la entrada de siempre de las fichas de fábrica. */
    const { fichas, total } = entradaSugerida(DEFAULT_COLORS, 500)
    expect(fichas).toEqual({ white: 10, blue: 10, red: 8, black: 8, green: 14 })
    expect(total).toBe(500)
  })

  it('para una entrada más chica no se pasa de lo que pusieron', () => {
    const { total } = entradaSugerida(CON_MORADAS, 300)
    expect(total).toBe(300)
  })

  it('para una entrada más grande cuadra con fichas grandes', () => {
    const { fichas, total } = entradaSugerida(CON_MORADAS, 1000)
    expect(total).toBe(1000)
    /* Los $500 de más no salen en morralla. */
    expect(fichas.white).toBe(10)
    expect(fichas.blue).toBe(10)
  })

  it('a una liga con fichas de otros valores no se le inventa morralla', () => {
    const raras: ChipColor[] = [
      { key: 'a', label: 'Fucsia', color: '#e91e8c', value: 20, inventory: 100 },
      { key: 'b', label: 'Cian', color: '#00bcd4', value: 4, inventory: 100 },
    ]
    const { total } = entradaSugerida(raras, 400)
    expect(total).toBe(400)
  })
})

describe('cuando hay mucha gente', () => {
  it('con tope de siete verdes por cabeza, las que faltan entran en amarillas', () => {
    const topes: Record<string, number> = {}
    for (const c of CON_MORADAS) topes[c.key] = Math.floor(c.inventory / 14)
    const { fichas, total } = armarEntrada(
      CON_MORADAS,
      500,
      entradaSugerida(CON_MORADAS, 500).fichas,
      topes,
    )
    /* Lo primero y lo que no se negocia: las fichas valen lo que puso el jugador. */
    expect(total).toBe(500)
    expect(fichas.green).toBe(7)
    expect(fichas.yellow).toBeGreaterThan(0)
    /* Y la morralla casi no se toca: es la que da el cambio de las recompras. */
    expect(fichas.white).toBeGreaterThanOrEqual(8)
    expect(fichas.blue).toBeGreaterThanOrEqual(8)
  })

  it('y el reparto ajustado sí aguanta a todos', () => {
    const topes: Record<string, number> = {}
    for (const c of CON_MORADAS) topes[c.key] = Math.floor(c.inventory / 14)
    const ajustado = armarEntrada(
      CON_MORADAS,
      500,
      entradaSugerida(CON_MORADAS, 500).fichas,
      topes,
    )
    expect(cuantasAguanta(CON_MORADAS, ajustado.fichas).entregas).toBeGreaterThanOrEqual(14)
  })

  it('si de plano no hay con qué cuadrar, el puñado queda corto y se nota', () => {
    const pocas: ChipColor[] = [
      { key: 'green', label: 'Verdes', color: '#1f8f4e', value: 25, inventory: 4 },
    ]
    const { total } = armarEntrada(pocas, 500, { green: 20 }, { green: 4 })
    expect(total).toBe(100)
    expect(planDeFichas(pocas, 500, { green: 4 }, 1).cuadra).toBe(false)
  })
})

describe('hasta dónde aguanta la caja', () => {
  it('manda el color que se acaba primero, no el promedio', () => {
    const { entregas, seAcabaPrimero } = cuantasAguanta(
      CON_MORADAS,
      entradaSugerida(CON_MORADAS, 500).fichas,
    )
    /* 100 verdes a 10 por entrega: diez. Las blancas darían veinte. */
    expect(entregas).toBe(10)
    expect(seAcabaPrimero?.key).toBe('green')
  })

  it('un puñado vacío no pone tope', () => {
    expect(cuantasAguanta(CON_MORADAS, {}).entregas).toBe(Infinity)
    expect(cuantasAguanta(CON_MORADAS, {}).seAcabaPrimero).toBe(null)
  })

  it('las fichas que no lleva el puñado no cuentan para el tope', () => {
    /* Hay 40 amarillas, pero si la entrada no lleva ninguna no son las que se acaban. */
    expect(cuantasAguanta(CON_MORADAS, { yellow: 0, green: 1 }).seAcabaPrimero?.key).toBe('green')
  })
})

describe('el plan de la noche', () => {
  const fichas = entradaSugerida(CON_MORADAS, 500).fichas

  it('dice que no alcanza antes de que falte sobre la mesa', () => {
    const plan = planDeFichas(CON_MORADAS, 500, fichas, 14)
    expect(plan.alcanza).toBe(false)
    expect(plan.entregas).toBe(10)
    expect(plan.seAcabaPrimero?.label).toBe('Verdes')
  })

  it('con pocos en la mesa dice cuántas entregas más caben', () => {
    const plan = planDeFichas(CON_MORADAS, 500, fichas, 6)
    expect(plan.alcanza).toBe(true)
    expect(plan.masEntregas).toBe(4)
  })

  it('y qué fichas quedan en la caja para el cambio', () => {
    const plan = planDeFichas(CON_MORADAS, 500, fichas, 6)
    expect(plan.sobra.white).toBe(200 - 60)
    expect(plan.sobra.green).toBe(100 - 60)
    /* Las amarillas no se repartieron: están completas. */
    expect(plan.sobra.yellow).toBe(40)
  })

  it('las fichas del plan cuadran con lo que pone cada quien', () => {
    expect(planDeFichas(CON_MORADAS, 500, fichas, 10).cuadra).toBe(true)
    expect(planDeFichas(CON_MORADAS, 450, fichas, 10).cuadra).toBe(false)
  })
})

describe('de arranque', () => {
  it('se enseña lo que la liga tiene puesto como entrada de siempre', () => {
    expect(entradaDeArranque(DEFAULT_COLORS, 500).fichas).toEqual({
      green: 14,
      black: 8,
      red: 8,
      blue: 10,
      white: 10,
    })
  })

  it('pero si la noche es de otro monto se sugiere uno que sí cuadre', () => {
    const plan = entradaDeArranque(DEFAULT_COLORS, 300)
    expect(plan.total).toBe(300)
  })
})

describe('con cuánto entra la mayoría', () => {
  it('es la entrada que más se repite', () => {
    expect(entradaMasComun([500, 500, 300, 500, 1000], 500)).toBe(500)
    expect(entradaMasComun([300, 300, 500], 500)).toBe(300)
  })

  it('en el empate gana la más alta: un plan corto deja a alguien sin fichas', () => {
    expect(entradaMasComun([300, 500], 500)).toBe(500)
  })

  it('sin nadie apuntado, la de siempre', () => {
    expect(entradaMasComun([], 500)).toBe(500)
    expect(entradaMasComun([0, 0], 500)).toBe(500)
  })
})
