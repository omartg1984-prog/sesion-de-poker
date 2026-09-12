import { describe, expect, it } from 'vitest'
import { asignarValores, coloresDelTorneo } from '../torneo'
import { computeDistribution } from '../distribution'

/* Las fichas de la liga, con sus valores en dinero. */
const COLORES = [
  { key: 'green', label: 'Verdes', color: '#1f8f4e', value: 25, inventory: 200 },
  { key: 'black', label: 'Negras', color: '#2b2b2b', value: 10, inventory: 200 },
  { key: 'red', label: 'Rojas', color: '#d0342c', value: 5, inventory: 200 },
  { key: 'blue', label: 'Azules', color: '#2563c9', value: 2, inventory: 200 },
  { key: 'white', label: 'Blancas', color: '#f2f2ea', value: 1, inventory: 200 },
]

describe('valores de ficha en torneo', () => {
  it('la más barata en dinero se queda con la más baja del torneo', () => {
    const v = asignarValores(COLORES, 5)
    expect(v.white).toBeLessThan(v.blue)
    expect(v.blue).toBeLessThan(v.red)
    expect(v.red).toBeLessThan(v.black)
    expect(v.black).toBeLessThan(v.green)
  })

  it('la ficha más chica vale lo que la ciega chica', () => {
    // Por debajo de eso, la ficha no sirve para pagar nada.
    expect(asignarValores(COLORES, 5).white).toBe(5)
    expect(asignarValores(COLORES, 25).white).toBe(25)
  })

  it('usa la escalera de un juego de fichas de verdad', () => {
    // Con unidad 25 sale el set que vende cualquier tienda; sin denominaciones raras.
    const v = asignarValores(COLORES, 25)
    expect([v.white, v.blue, v.red, v.black, v.green]).toEqual([25, 100, 500, 1000, 5000])
  })

  it('no toca los valores en dinero de la liga', () => {
    asignarValores(COLORES, 5)
    expect(COLORES.find((c) => c.key === 'white')!.value).toBe(1)
  })

  it('los colores del torneo valen distinto que los de la liga', () => {
    const v = asignarValores(COLORES, 5)
    const delTorneo = coloresDelTorneo(COLORES, v)
    expect(delTorneo.find((c) => c.key === 'white')!.value).toBe(5)
    expect(delTorneo.find((c) => c.key === 'green')!.value).toBe(1000)
  })

  it('sin valores de torneo deja los de la liga como están', () => {
    expect(coloresDelTorneo(COLORES, undefined)).toEqual(COLORES)
  })
})

describe('repartir un stack de torneo', () => {
  it('con valores de torneo alcanza para stacks que en dinero serían imposibles', () => {
    /* Todo el inventario junto vale $8,600, así que ocho stacks de 5,000 no caben ni de
       broma si las fichas valen pesos. Valiendo puntos de torneo sobra inventario. */
    const valores = asignarValores(COLORES, 5)
    const jugadores = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      name: `J${i}`,
      buyIn: 5000,
      deal: null,
    }))

    const conDinero = computeDistribution(jugadores, COLORES)
    const conTorneo = computeDistribution(jugadores, coloresDelTorneo(COLORES, valores))

    expect(conDinero.anyShortfall).toBe(true)
    expect(conTorneo.anyShortfall).toBe(false)
    expect(conTorneo.anyOver).toBe(false)
  })

  it('y se arma con muchas menos fichas físicas', () => {
    // Es la otra mitad del problema: en la mesa hay que poder contarlas.
    const valores = asignarValores(COLORES, 5)
    const uno = [{ id: '1', name: 'J', buyIn: 1500, deal: null }]
    const cuantas = (filas: { counts: Record<string, number> }[]) =>
      Object.values(filas[0].counts).reduce((a, b) => a + b, 0)

    expect(cuantas(computeDistribution(uno, coloresDelTorneo(COLORES, valores)).rows)).toBeLessThan(
      cuantas(computeDistribution(uno, COLORES).rows) / 2,
    )
  })

  it('cada quien arranca con el stack exacto', () => {
    const valores = asignarValores(COLORES, 5)
    const jugadores = Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      name: `J${i}`,
      buyIn: 1500,
      deal: null,
    }))
    const d = computeDistribution(jugadores, coloresDelTorneo(COLORES, valores))
    for (const fila of d.rows) expect(fila.total).toBe(1500)
  })
})
