import { describe, expect, it } from 'vitest'
import { azarCon } from '../poker'
import {
  ESTILOS,
  decidir,
  estiloDeLaMano,
  estiloPorId,
  rivalesAlAzar,
  type Situacion,
} from '../rival'

/*
 * Cómo juega el de enfrente. Lo que se fija no es qué hace en una mano suelta —si no
 * fuera impredecible no servirían de nada— sino lo que tiene que cumplir cada tipo a lo
 * largo de muchas: que la roca se tire lo que el pagador paga, que el agresivo suba más
 * que el sólido y que nadie regale una mano que le toca ver gratis.
 */

const situacion = (x: Partial<Situacion> = {}): Situacion => ({
  equidad: 25,
  vivos: 4,
  bote: 100,
  paraIgualar: 50,
  alto: 50,
  minimo: 100,
  calle: 'flop',
  ...x,
})

/** Mil manos iguales, para ver con qué frecuencia hace cada cosa. */
const mil = (estilo: string, s: Situacion) => {
  const azar = azarCon(7)
  const cuenta: Record<string, number> = {}
  for (let i = 0; i < 1000; i++) {
    const d = decidir(estiloPorId(estilo), s, azar)
    cuenta[d.tipo] = (cuenta[d.tipo] ?? 0) + 1
  }
  return cuenta
}

describe('el catálogo de estilos', () => {
  it('no repite identificadores', () => {
    expect(new Set(ESTILOS.map((e) => e.id)).size).toBe(ESTILOS.length)
  })

  it('un id que no existe cae en uno de verdad, no revienta', () => {
    expect(estiloPorId('inventado').nombre).toBeTruthy()
  })
})

describe('con nada que pagar', () => {
  const gratis = situacion({ paraIgualar: 0, alto: 0, minimo: 20 })

  it('nadie se va cuando puede ver la carta gratis', () => {
    for (const e of ESTILOS) {
      const cuenta = mil(e.id, { ...gratis, equidad: 5 })
      expect(cuenta.seVa ?? 0).toBe(0)
    }
  })

  it('el agresivo apuesta más seguido que la roca con la misma mano', () => {
    const fuerte = { ...gratis, equidad: 60 }
    expect(mil('agresivo', fuerte).apuesta ?? 0).toBeGreaterThan(mil('roca', fuerte).apuesta ?? 0)
  })

  it('el farolero apuesta sin nada y la roca casi nunca', () => {
    const basura = { ...gratis, equidad: 6 }
    const farolero = mil('farolero', basura).apuesta ?? 0
    const roca = mil('roca', basura).apuesta ?? 0
    expect(farolero).toBeGreaterThan(200)
    expect(roca).toBeLessThan(80)
  })
})

describe('con algo que pagar', () => {
  /* Le piden 50 a un bote de 100: necesita ganar una de cada tres. */
  const caro = situacion({ equidad: 12, paraIgualar: 50, bote: 100 })

  it('la roca se tira lo que no le alcanza', () => {
    expect(mil('roca', caro).seVa ?? 0).toBeGreaterThan(900)
  })

  it('el pagador paga lo que la roca tira', () => {
    expect(mil('pagador', caro).paga ?? 0).toBeGreaterThan(mil('roca', caro).paga ?? 0)
  })

  it('con las cuentas a favor, todos pagan o suben, nadie se va', () => {
    const barato = situacion({ equidad: 70, paraIgualar: 10, bote: 300, alto: 10, minimo: 20 })
    for (const e of ESTILOS) {
      expect(mil(e.id, barato).seVa ?? 0).toBe(0)
    }
  })

  it('el agresivo sube más que el sólido con la misma manaza', () => {
    const manaza = situacion({ equidad: 75, paraIgualar: 20, bote: 200, alto: 20, minimo: 40 })
    expect(mil('agresivo', manaza).sube ?? 0).toBeGreaterThan(mil('solido', manaza).sube ?? 0)
  })
})

describe('lo que apuesta', () => {
  it('nunca apuesta por debajo del mínimo', () => {
    const azar = azarCon(3)
    const s = situacion({ paraIgualar: 0, alto: 0, bote: 4, minimo: 20, equidad: 90 })
    for (let i = 0; i < 300; i++) {
      const d = decidir(estiloPorId('loco'), s, azar)
      if (d.tipo === 'apuesta' || d.tipo === 'sube') expect(d.hasta).toBeGreaterThanOrEqual(20)
    }
  })

  it('subir deja la apuesta por encima de lo que hay puesto', () => {
    const azar = azarCon(5)
    const s = situacion({ equidad: 80, paraIgualar: 50, alto: 50, minimo: 100, bote: 150 })
    for (let i = 0; i < 300; i++) {
      const d = decidir(estiloPorId('agresivo'), s, azar)
      if (d.tipo === 'sube') expect(d.hasta).toBeGreaterThan(50)
    }
  })
})

describe('que cada quien juegue de varios modos', () => {
  it('un rival trae dos estilos distintos', () => {
    const azar = azarCon(11)
    for (const r of rivalesAlAzar(20, azar)) expect(r.base).not.toBe(r.otro)
  })

  it('casi siempre viene con el suyo, y de vez en cuando con el otro', () => {
    const azar = azarCon(2)
    const r = { base: 'roca', otro: 'loco', cambia: 0.25 }
    let locos = 0
    for (let i = 0; i < 1000; i++) if (estiloDeLaMano(r, azar).id === 'loco') locos++
    expect(locos).toBeGreaterThan(150)
    expect(locos).toBeLessThan(350)
  })

  it('la mesa no sale toda del mismo molde', () => {
    const distintos = new Set(rivalesAlAzar(8, azarCon(9)).map((r) => r.base))
    expect(distintos.size).toBeGreaterThan(1)
  })
})
