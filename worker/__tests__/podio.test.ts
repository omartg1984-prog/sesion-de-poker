import { describe, expect, it } from 'vitest'
import { ganadorDe, podioDe } from '../podio'

const COLORES = [
  { key: 'green', label: 'Verdes', color: '#1f8f4e', value: 25, inventory: 200 },
  { key: 'white', label: 'Blancas', color: '#f2f2ea', value: 1, inventory: 200 },
]

const jugador = (id: string, cambios: Partial<Parameters<typeof podioDe>[1][number]> = {}) => ({
  usuario_id: id,
  entrada: 500,
  recompras: '[]',
  fichas_final: '{}',
  rebuys: 0,
  addons: 0,
  lugar: 0,
  ...cambios,
})

const fichas = (verdes: number) => JSON.stringify({ green: verdes })

describe('el podio de una noche de cash', () => {
  const mesa = { tipo: 'cash', torneo: null }

  it('gana el que se llevó más de lo que puso', () => {
    const podio = podioDe(
      mesa,
      [
        jugador('ana', { fichas_final: fichas(40) }), // sacó 1000, puso 500
        jugador('beto', { fichas_final: fichas(4) }), // sacó 100
        jugador('cris', { fichas_final: fichas(24) }), // sacó 600
      ],
      COLORES,
    )
    expect(podio.map((p) => p.jugador.usuario_id)).toEqual(['ana', 'cris', 'beto'])
    expect(podio[0].resultado).toBe(500)
    expect(podio[0].lugar).toBe(1)
  })

  it('las recompras cuentan como dinero puesto', () => {
    const podio = podioDe(
      mesa,
      [
        jugador('ana', { fichas_final: fichas(40) }),
        jugador('beto', { fichas_final: fichas(40), recompras: '[{"dinero":600}]' }),
      ],
      COLORES,
    )
    // Los dos acabaron con 1000, pero Beto puso 1100: perdió la noche.
    expect(podio[0].jugador.usuario_id).toBe('ana')
    expect(podio[1].resultado).toBe(-100)
  })
})

describe('el podio de un torneo', () => {
  const torneo = {
    tipo: 'torneo',
    torneo: JSON.stringify({
      buyIn: 500,
      rebuyPrice: 400,
      addOnPrice: 300,
      payouts: [{ pct: 70 }, { pct: 30 }],
    }),
  }

  it('manda el premio del lugar, no las fichas que quedaron en la mesa', () => {
    /* En torneo las fichas son puntos y al final no valen nada: lo que se cobra sale
       de la bolsa según el lugar. Un montón de fichas sin lugar no paga. */
    const podio = podioDe(
      torneo,
      [
        jugador('ana', { lugar: 2 }),
        jugador('beto', { lugar: 1 }),
        jugador('cris', { fichas_final: fichas(400) }),
      ],
      COLORES,
    )
    expect(podio[0].jugador.usuario_id).toBe('beto')
    expect(podio[2].jugador.usuario_id).toBe('cris')
    expect(podio[2].saco).toBe(0)
  })

  it('la cena sale de la bolsa antes de repartir premios', () => {
    /* Tres entradas de $500 son $1,500; con $200 de cena por cabeza quedan $900 para
       premios. Sin descontarla, la tabla de la liga daría a cada quien más de lo que
       de verdad se llevó a casa. */
    const conCena = {
      tipo: 'torneo',
      torneo: JSON.stringify({
        buyIn: 500,
        rebuyPrice: 400,
        addOnPrice: 300,
        payouts: [{ pct: 70 }, { pct: 30 }],
        cenaPorPersona: 200,
      }),
    }
    const podio = podioDe(
      conCena,
      [jugador('ana', { lugar: 2 }), jugador('beto', { lugar: 1 }), jugador('cris')],
      COLORES,
    )
    const saco = (id: string) => podio.find((x) => x.jugador.usuario_id === id)!.saco
    expect(saco('beto')).toBeCloseTo(630, 6)
    expect(saco('ana')).toBeCloseTo(270, 6)
    expect(saco('beto') + saco('ana')).toBeCloseTo(900, 6)
  })
})

describe('el derecho a presumir', () => {
  const mesa = { tipo: 'cash', torneo: null }

  it('es del que ganó', () => {
    const gano = ganadorDe(
      mesa,
      [jugador('ana', { fichas_final: fichas(40) }), jugador('beto')],
      COLORES,
    )
    expect(gano?.usuario_id).toBe('ana')
  })

  it('no lo tiene nadie si nadie salió ganando', () => {
    /* Una noche donde todos acabaron igual o abajo no tiene de qué presumir. */
    expect(ganadorDe(mesa, [jugador('ana'), jugador('beto')], COLORES)).toBeNull()
  })

  it('no lo tiene nadie en una mesa vacía', () => {
    expect(ganadorDe(mesa, [], COLORES)).toBeNull()
  })
})

describe('un conteo de fichas nunca es negativo', () => {
  /* La misma limpieza que hace la ruta al guardar. Se prueba aparte porque es lo que
     impide que un signo de menos tecleado sin querer envenene la tabla de la liga. */
  const soloFichas = (v: unknown): Record<string, number> => {
    const limpio: Record<string, number> = {}
    if (v && typeof v === 'object') {
      for (const [color, cuantas] of Object.entries(v as Record<string, unknown>)) {
        limpio[color] = Math.max(0, Math.floor(Number(cuantas) || 0))
      }
    }
    return limpio
  }

  it('un menos se vuelve cero', () => {
    expect(soloFichas({ green: -4, red: 3 })).toEqual({ green: 0, red: 3 })
  })

  it('los decimales y la basura tampoco pasan', () => {
    expect(soloFichas({ green: 2.7, red: 'x', blue: null })).toEqual({ green: 2, red: 0, blue: 0 })
  })

  it('lo que no es un objeto queda vacío', () => {
    expect(soloFichas(null)).toEqual({})
    expect(soloFichas('7')).toEqual({})
  })

  it('una ficha en negativo haría que alguien se lleve dinero negativo', () => {
    /* El caso real que apareció en los datos de prueba: −4 verdes de $25 dejaban a un
       jugador "sacando" −$100 de una mesa donde sólo se puede sacar de cero para arriba. */
    const COLOR = [{ key: 'green', label: 'V', color: '#0f0', value: 25, inventory: 200 }]
    const conMenos = podioDe(
      { tipo: 'cash', torneo: null },
      [jugador('a', { fichas_final: JSON.stringify({ green: -4 }) })],
      COLOR,
    )
    expect(conMenos[0].saco).toBeLessThan(0)

    const limpio = podioDe(
      { tipo: 'cash', torneo: null },
      [jugador('a', { fichas_final: JSON.stringify(soloFichas({ green: -4 })) })],
      COLOR,
    )
    expect(limpio[0].saco).toBe(0)
  })
})

/*
 * Tornecash.
 *
 * Lo que se prueba aquí es lo que lo hace distinto de todo lo demás: el lugar sale de
 * la ganancia neta en fichas y no del dinero, y la bolsa que se reparte es la suma de
 * todas las cuotas. Si alguna de las dos cosas se rompe, alguien cobra lo que no ganó.
 */
describe('el podio de una noche de tornecash', () => {
  /* Cuota $300, 500 fichas por entrada, y la verde vale 25 puntos esa noche. */
  const CONFIG = {
    buyIn: 300,
    rebuyPrice: 300,
    addOnPrice: 0,
    payouts: [{ pct: 50 }, { pct: 30 }, { pct: 20 }],
    stack: 500,
    valores: { green: 25, white: 1 },
  }
  const mesa = { tipo: 'tornecash', torneo: JSON.stringify(CONFIG) }

  /** Fichas verdes, que valen 25 puntos cada una. */
  const puntos = (p: number) => JSON.stringify({ green: p / 25 })

  it('el lugar lo da la ganancia neta en fichas, no el dinero', () => {
    const podio = podioDe(
      mesa,
      [
        /* Entró una vez: le dieron 500. Acaba con 1,250 → neta +750. */
        jugador('ana', { fichas_final: puntos(1250) }),
        /* Entró y recompró: le dieron 1,000. Acaba con 1,750 → neta +750… */
        jugador('beto', { rebuys: 1, fichas_final: puntos(1750) }),
        /* Entró una vez y acaba con 900 → neta +400. */
        jugador('cris', { fichas_final: puntos(900) }),
        jugador('dani', { fichas_final: puntos(0) }),
      ],
      COLORES,
    )
    /* Ana y Beto empatan en neta aunque Beto tenga más fichas enfrente. */
    expect(podio[0].lugar).toBe(1)
    expect(podio[1].lugar).toBe(1)
    expect(podio.map((x) => x.jugador.usuario_id).slice(2)).toEqual(['cris', 'dani'])
  })

  it('una recompra tardía no compra el primer lugar', () => {
    const podio = podioDe(
      mesa,
      [
        /* Acaba con más fichas que nadie, pero compró tres veces para llegar ahí. */
        jugador('beto', { rebuys: 3, fichas_final: puntos(2100) }), // dadas 2000 → +100
        jugador('ana', { fichas_final: puntos(1200) }), // dadas 500 → +700
      ],
      COLORES,
    )
    expect(podio[0].jugador.usuario_id).toBe('ana')
  })

  it('la bolsa es la suma de todas las cuotas, recompras incluidas', () => {
    const podio = podioDe(
      mesa,
      [
        jugador('ana', { fichas_final: puntos(1500) }),
        jugador('beto', { rebuys: 1, fichas_final: puntos(900) }),
        jugador('cris', { fichas_final: puntos(400) }),
        jugador('dani', { fichas_final: puntos(0) }),
      ],
      COLORES,
    )
    /* Cuatro entradas y una recompra: 5 × $300 = $1,500. */
    const bolsa = podio.reduce((a, x) => a + x.saco, 0)
    expect(bolsa).toBeCloseTo(1500, 6)
  })

  it('cobran los tres primeros y nadie más', () => {
    const podio = podioDe(
      mesa,
      [
        jugador('ana', { fichas_final: puntos(1500) }),
        jugador('beto', { fichas_final: puntos(1000) }),
        jugador('cris', { fichas_final: puntos(700) }),
        jugador('dani', { fichas_final: puntos(300) }),
        jugador('eli', { fichas_final: puntos(0) }),
      ],
      COLORES,
    )
    const bolsa = 5 * 300
    expect(podio[0].saco).toBeCloseTo(bolsa * 0.5, 6)
    expect(podio[1].saco).toBeCloseTo(bolsa * 0.3, 6)
    expect(podio[2].saco).toBeCloseTo(bolsa * 0.2, 6)
    expect(podio[3].saco).toBe(0)
    expect(podio[4].saco).toBe(0)
  })

  it('el resultado en dinero es el premio menos lo que pusiste', () => {
    const podio = podioDe(
      mesa,
      [
        jugador('ana', { fichas_final: puntos(1500) }),
        jugador('beto', { rebuys: 2, fichas_final: puntos(0) }),
        jugador('cris', { fichas_final: puntos(200) }),
        jugador('dani', { fichas_final: puntos(100) }),
        jugador('eli', { fichas_final: puntos(0) }),
      ],
      COLORES,
    )
    const bolsa = 5 * 300 + 2 * 300
    /* Ana gana el 50% de la bolsa y puso una cuota. */
    expect(podio[0].resultado).toBeCloseTo(bolsa * 0.5 - 300, 6)
    /* Beto se quedó fuera de premio y puso tres cuotas: pierde las tres. */
    expect(podio[4].jugador.usuario_id).toBe('beto')
    expect(podio[4].puso).toBe(900)
    expect(podio[4].resultado).toBe(-900)
  })

  /*
   * Con menos gente que lugares pagados, cobra casi todo el mundo.
   *
   * No es un error: es lo que dice el reparto que se puso esa noche. Queda apuntado
   * aquí para que se vea a propósito y no por descuido, y porque si alguna vez se
   * decide que con pocos sólo pague el primero, esta prueba es la que hay que cambiar.
   */
  it('con menos jugadores que lugares, cobran todos los que alcanzan lugar', () => {
    const podio = podioDe(
      mesa,
      [
        jugador('ana', { fichas_final: puntos(1200) }),
        jugador('beto', { fichas_final: puntos(300) }),
      ],
      COLORES,
    )
    expect(podio[0].saco).toBeCloseTo(600 * 0.5, 6)
    expect(podio[1].saco).toBeCloseTo(600 * 0.3, 6)
    /* Y el 20% del tercero, que no existe, se queda sin repartir. */
    expect(podio.reduce((a, x) => a + x.saco, 0)).toBeCloseTo(600 * 0.8, 6)
  })

  it('los que empatan en zona de premio se reparten lo de sus lugares', () => {
    const podio = podioDe(
      mesa,
      [
        jugador('ana', { fichas_final: puntos(1200) }),
        jugador('beto', { fichas_final: puntos(1200) }),
        jugador('cris', { fichas_final: puntos(0) }),
        jugador('dani', { fichas_final: puntos(0) }),
      ],
      COLORES,
    )
    const bolsa = 4 * 300
    /* Empatados en primero: se parten el 50% y el 30%. */
    expect(podio[0].lugar).toBe(1)
    expect(podio[1].lugar).toBe(1)
    expect(podio[0].saco).toBeCloseTo((bolsa * 0.8) / 2, 6)
    expect(podio[1].saco).toBeCloseTo((bolsa * 0.8) / 2, 6)
    /* Y los dos de abajo se parten el 20% del tercero, que también empataron. */
    expect(podio[2].lugar).toBe(3)
    expect(podio[2].saco).toBeCloseTo((bolsa * 0.2) / 2, 6)
  })

  it('pase lo que pase, la bolsa que se reparte nunca es más de lo que se juntó', () => {
    const casos = [
      [0, 0, 0, 0],
      [1250, 1250, 1250, 1250],
      [2000, 0, 0, 0],
      [500, 500, 500, 0],
      [1000, 900, 800, 700],
    ]
    for (const fichas of casos) {
      const podio = podioDe(
        mesa,
        fichas.map((f, i) => jugador('j' + i, { fichas_final: puntos(f) })),
        COLORES,
      )
      const repartido = podio.reduce((a, x) => a + x.saco, 0)
      expect(repartido).toBeLessThanOrEqual(4 * 300 + 1e-9)
      /* Y lo que gana uno lo pierde otro: la noche no crea ni destruye dinero. */
      expect(podio.reduce((a, x) => a + x.resultado, 0)).toBeCloseTo(0, 6)
    }
  })

  it('sin valores de la noche se usan los de la liga en vez de contar cero', () => {
    const sinValores = {
      tipo: 'tornecash',
      torneo: JSON.stringify({ ...CONFIG, valores: undefined }),
    }
    const podio = podioDe(
      sinValores,
      [jugador('ana', { fichas_final: JSON.stringify({ green: 40 }) }), jugador('beto')],
      COLORES,
    )
    /* 40 verdes a 25 de la liga son 1,000; menos las 500 que le dieron, +500. */
    expect(podio[0].jugador.usuario_id).toBe('ana')
    expect(podio[0].saco).toBeGreaterThan(0)
  })
})
