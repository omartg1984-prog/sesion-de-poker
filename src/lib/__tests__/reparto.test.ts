import { describe, expect, it } from 'vitest'
import { repartirRedondeado } from '../reparto'

const suma = (n: number[]) => n.reduce((a, b) => a + b, 0)

describe('repartir el dinero sin morralla', () => {
  it('lo entregado más lo que sobra siempre es lo que había en la mesa', () => {
    const casos: [number[], number, number][] = [
      [[1347, 653], 2000, 50],
      [[900, 700, 400], 2000, 100],
      [[333, 333, 334], 1000, 20],
      [[1250, 250, 500], 2000, 10],
      [[80, 45, 25, 20, 30], 200, 50],
    ]
    for (const [montos, total, paso] of casos) {
      const { pagos, sobra } = repartirRedondeado(montos, total, paso)
      expect(suma(pagos) + sobra).toBeCloseTo(total, 6)
    }
  })

  it('todo lo que se entrega sale en billetes del tamaño elegido', () => {
    const { pagos } = repartirRedondeado([1347, 653, 412], 2412, 50)
    for (const p of pagos) expect(p % 50).toBe(0)
  })

  it('si las fichas suman más que el bote, lo reporta como faltante', () => {
    // Es un error de conteo. Repartir a prorrata lo escondería detrás de números que
    // parecen cuadrar; mejor que el faltante se vea.
    const { pagos, sobra } = repartirRedondeado([1500, 1500], 2000, 50)
    expect(pagos).toEqual([1500, 1500])
    expect(sobra).toBe(-1000)
  })

  it('cuando las fichas cuadran, lo que sobra es menos de un billete', () => {
    const { sobra } = repartirRedondeado([1347, 653], 2000, 50)
    expect(sobra).toBeGreaterThanOrEqual(0)
    expect(sobra).toBeLessThan(50)
  })

  it('nadie pierde más de un billete contra lo que le tocaba', () => {
    const montos = [1347, 653, 412, 88]
    const { pagos } = repartirRedondeado(montos, suma(montos), 50)
    montos.forEach((m, i) => {
      expect(pagos[i]).toBeGreaterThan(m - 50)
      expect(pagos[i]).toBeLessThan(m + 50)
    })
  })

  it('el billete suelto va al que quedó más cerca del siguiente', () => {
    // A le sobran 40 sobre su piso y a B sólo 10: el billete es de A.
    const { pagos } = repartirRedondeado([140, 110], 250, 50)
    expect(pagos).toEqual([150, 100])
  })

  it('no depende del orden en que se listen los jugadores', () => {
    const a = repartirRedondeado([1347, 653, 412], 2412, 50)
    const b = repartirRedondeado([412, 1347, 653], 2412, 50)
    expect(suma(a.pagos)).toBe(suma(b.pagos))
    expect(a.sobra).toBe(b.sobra)
    expect(b.pagos[1]).toBe(a.pagos[0])
  })

  it('cuando todo es múltiplo del billete, cuadra exacto y no sobra nada', () => {
    const { pagos, sobra } = repartirRedondeado([1500, 500], 2000, 50)
    expect(pagos).toEqual([1500, 500])
    expect(sobra).toBe(0)
  })

  it('sin jugadores, todo el dinero se queda en la mesa', () => {
    expect(repartirRedondeado([], 500, 50)).toEqual({ pagos: [], sobra: 500 })
  })
})
