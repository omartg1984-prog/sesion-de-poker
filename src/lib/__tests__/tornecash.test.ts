import { describe, expect, it } from 'vitest'
import type { ConfigTorneo } from '../api'
import {
  avisosDe,
  bolsaDe,
  enPuntos,
  fichasDadas,
  puestoPor,
  tablaTornecash,
} from '../tornecash'

/*
 * La cuenta de una noche de tornecash.
 *
 * Los números de aquí son los mismos que los de `worker/__tests__/podio.test.ts` a
 * propósito: la pantalla saca la cuenta en vivo y el servidor la saca al cerrar, y si
 * las dos no dicen lo mismo, alguien ve un lugar en la mesa y otro en la tabla.
 */

const COLORES = [
  { key: 'green', label: 'Verdes', color: '#1f8f4e', value: 25, inventory: 200 },
  { key: 'white', label: 'Blancas', color: '#f2f2ea', value: 1, inventory: 200 },
]

const CFG: ConfigTorneo = {
  buyIn: 300,
  rebuyPrice: 300,
  addOnPrice: 0,
  payouts: [{ pct: 50 }, { pct: 30 }, { pct: 20 }],
  stack: 500,
  valores: { green: 25, white: 1 },
}

/** Un jugador que acabó con tantos puntos, contados en fichas verdes de 25. */
const jugador = (id: string, puntos: number, rebuys = 0) => ({
  id,
  rebuys,
  fichas_final: JSON.stringify({ green: puntos / 25 }),
})

describe('lo que puso y lo que le dieron', () => {
  it('cada entrada cuesta la cuota y da su tanda de fichas', () => {
    expect(puestoPor({ rebuys: 0, fichas_final: '{}' }, CFG)).toBe(300)
    expect(fichasDadas({ rebuys: 0, fichas_final: '{}' }, CFG)).toBe(500)
  })

  it('y cada recompra cuesta y da exactamente lo mismo', () => {
    expect(puestoPor({ rebuys: 2, fichas_final: '{}' }, CFG)).toBe(900)
    expect(fichasDadas({ rebuys: 2, fichas_final: '{}' }, CFG)).toBe(1500)
  })

  it('sin precio de recompra se cobra lo que cuesta entrar', () => {
    const sinPrecio = { ...CFG, rebuyPrice: 0 }
    expect(puestoPor({ rebuys: 1, fichas_final: '{}' }, sinPrecio)).toBe(600)
  })
})

describe('lo que valen las fichas contadas', () => {
  it('usa el valor de la noche, no el de la liga', () => {
    /* La blanca vale 1 en la liga y 10 esta noche. */
    const cfg = { ...CFG, valores: { green: 25, white: 10 } }
    expect(enPuntos({ white: 4 }, cfg, COLORES)).toBe(40)
  })

  it('al color sin valor de la noche se le usa el de la liga', () => {
    const cfg = { ...CFG, valores: { green: 25 } }
    expect(enPuntos({ green: 2, white: 3 }, cfg, COLORES)).toBe(53)
  })

  it('un conteo roto no tumba la cuenta', () => {
    expect(enPuntos({}, CFG, COLORES)).toBe(0)
    expect(
      tablaTornecash([{ rebuys: 0, fichas_final: 'no es json' }], CFG, COLORES)[0].finales,
    ).toBe(0)
  })
})

describe('la tabla de la noche', () => {
  it('el lugar lo da la ganancia neta, no las fichas de enfrente', () => {
    const tabla = tablaTornecash(
      [jugador('beto', 2100, 3), jugador('ana', 1200)],
      CFG,
      COLORES,
    )
    /* Beto acaba con más fichas, pero compró cuatro tandas para llegar ahí. */
    expect(tabla[0].jugador.id).toBe('ana')
    expect(tabla[0].neta).toBe(700)
    expect(tabla[1].neta).toBe(100)
  })

  it('la bolsa es la suma de todas las cuotas', () => {
    const mesa = [jugador('ana', 1500), jugador('beto', 900, 1), jugador('cris', 400)]
    expect(bolsaDe(mesa, CFG)).toBe(4 * 300)
  })

  it('la cena se aparta antes de repartir', () => {
    const mesa = [jugador('ana', 1500), jugador('beto', 900)]
    expect(bolsaDe(mesa, { ...CFG, cenaPorPersona: 50 })).toBe(600 - 100)
  })

  it('cobran los de arriba y nadie más', () => {
    const mesa = [
      jugador('ana', 1500),
      jugador('beto', 1000),
      jugador('cris', 700),
      jugador('dani', 300),
      jugador('eli', 0),
    ]
    const tabla = tablaTornecash(mesa, CFG, COLORES)
    const bolsa = 5 * 300
    expect(tabla[0].saco).toBeCloseTo(bolsa * 0.5, 6)
    expect(tabla[1].saco).toBeCloseTo(bolsa * 0.3, 6)
    expect(tabla[2].saco).toBeCloseTo(bolsa * 0.2, 6)
    expect(tabla[3].saco).toBe(0)
    expect(tabla[4].saco).toBe(0)
  })

  it('los que empatan comparten lugar y se parten sus premios', () => {
    const mesa = [
      jugador('ana', 1200),
      jugador('beto', 1200),
      jugador('cris', 0),
      jugador('dani', 0),
    ]
    const tabla = tablaTornecash(mesa, CFG, COLORES)
    const bolsa = 4 * 300
    expect(tabla[0].lugar).toBe(1)
    expect(tabla[1].lugar).toBe(1)
    expect(tabla[0].saco).toBeCloseTo((bolsa * 0.8) / 2, 6)
    expect(tabla[2].lugar).toBe(3)
    expect(tabla[2].saco).toBeCloseTo((bolsa * 0.2) / 2, 6)
  })

  it('la noche no crea ni destruye dinero', () => {
    for (const fichas of [
      [0, 0, 0, 0],
      [1250, 1250, 1250, 1250],
      [2000, 0, 0, 0],
      [500, 500, 500, 0],
      [1000, 900, 800, 700],
    ]) {
      const tabla = tablaTornecash(
        fichas.map((f, i) => jugador('j' + i, f)),
        CFG,
        COLORES,
      )
      expect(tabla.reduce((a, x) => a + x.resultado, 0)).toBeCloseTo(0, 6)
      expect(tabla.reduce((a, x) => a + x.saco, 0)).toBeLessThanOrEqual(4 * 300 + 1e-9)
    }
  })

  it('con la mesa vacía no truena ni inventa dinero', () => {
    expect(tablaTornecash([], CFG, COLORES)).toEqual([])
    expect(bolsaDe([], CFG)).toBe(0)
  })
})

describe('lo que hay que avisar antes de cerrar', () => {
  const mesa = [jugador('ana', 1000), jugador('beto', 0)]

  it('con todo en orden no dice nada', () => {
    const cuatro = [...mesa, jugador('cris', 500), jugador('dani', 200)]
    expect(avisosDe(cuatro, CFG)).toEqual([])
  })

  it('avisa cuando los porcentajes no suman cien', () => {
    const avisos = avisosDe(mesa, { ...CFG, payouts: [{ pct: 50 }, { pct: 30 }] })
    expect(avisos.some((a) => a.includes('100'))).toBe(true)
  })

  it('avisa cuando hay menos gente que lugares pagados', () => {
    const avisos = avisosDe(mesa, CFG)
    expect(avisos.some((a) => a.includes('sin dueño'))).toBe(true)
  })

  it('avisa si faltan la cuota o las fichas de entrada', () => {
    expect(avisosDe(mesa, { ...CFG, stack: 0 }).some((a) => a.includes('fichas'))).toBe(true)
    expect(avisosDe(mesa, { ...CFG, buyIn: 0 }).some((a) => a.includes('cuota'))).toBe(true)
  })
})
