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
