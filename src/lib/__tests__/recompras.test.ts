import { describe, expect, it } from 'vitest'
import { CAMBIO_RECOMPRA, computeDistribution, stackTotal } from '../distribution'
import type { ChipColor } from '../../store/types'

/*
 * Las fichas de cada recompra, por separado.
 *
 * Mientras todo iba en un solo montón, apuntar una recompra hacía saltar las fichas del
 * jugador a las de toda la noche y nadie sabía cuántas entregarle en ese momento. Ahora
 * cada concepto —la entrada y cada recompra— trae su propio renglón.
 */

const COLORES: ChipColor[] = [
  { key: 'verde', label: 'Verdes', color: '#1f8f4e', value: 25, inventory: 200 },
  { key: 'negra', label: 'Negras', color: '#2b2b2b', value: 10, inventory: 200 },
  { key: 'roja', label: 'Rojas', color: '#d0342c', value: 5, inventory: 300 },
  { key: 'azul', label: 'Azules', color: '#2563c9', value: 1, inventory: 400 },
]

describe('fichas por concepto', () => {
  it('cada renglón cubre su propio monto, no el de la noche entera', () => {
    const d = computeDistribution(
      [
        { id: 'ana#entrada', name: 'Ana', buyIn: 500, deal: null, cambio: 1 },
        { id: 'ana#r0', name: 'Ana · Recompra 1', buyIn: 400, deal: null, cambio: CAMBIO_RECOMPRA },
        { id: 'ana#r1', name: 'Ana · Recompra 2', buyIn: 300, deal: null, cambio: CAMBIO_RECOMPRA },
      ],
      COLORES,
    )

    expect(d.rows.map((r) => r.total)).toEqual([500, 400, 300])
    expect(d.anyShortfall).toBe(false)
  })

  it('lo que sale de la caja es lo mismo que salía cuando iba en un solo montón', () => {
    const juntos = computeDistribution(
      [{ id: 'ana', name: 'Ana', buyIn: 1200, deal: null }],
      COLORES,
    )
    const partido = computeDistribution(
      [
        { id: 'ana#entrada', name: 'Ana', buyIn: 500, deal: null, cambio: 1 },
        { id: 'ana#r0', name: 'Ana · Recompra 1', buyIn: 700, deal: null, cambio: CAMBIO_RECOMPRA },
      ],
      COLORES,
    )

    const valor = (n: number[]) => n.reduce((a, b) => a + b, 0)
    expect(valor(juntos.rows.map((r) => r.total))).toBe(
      valor(partido.rows.map((r) => r.total)),
    )
  })

  it('la recompra se reparte entre todos los colores, con menos morralla que la entrada', () => {
    const [entrada] = computeDistribution(
      [{ id: 'a', name: 'A', buyIn: 500, deal: null, cambio: 1 }],
      COLORES,
    ).rows
    const [recompra] = computeDistribution(
      [{ id: 'b', name: 'B', buyIn: 500, deal: null, cambio: CAMBIO_RECOMPRA }],
      COLORES,
    ).rows

    expect(recompra.total).toBe(500)

    /* Repartida: nadie recibe un bloque de la ficha más grande y nada más, porque con
       eso no se puede ni pagar una ciega sin pedir cambio. */
    for (const c of COLORES) expect(recompra.counts[c.key]).toBeGreaterThan(0)

    /* Pero con menos morralla que una entrada: algo de cambio ya trae en la mesa, y
       cada recompra completa le vaciaría a la casa las fichas chicas. */
    const chica = COLORES[COLORES.length - 1].key
    expect(recompra.counts[chica]).toBeLessThan(entrada.counts[chica])
  })

  it('un reparto a mano en una recompra no toca las fichas de la entrada', () => {
    const aMano = { verde: 16, negra: 0, roja: 0, azul: 0 }
    const d = computeDistribution(
      [
        { id: 'ana#entrada', name: 'Ana', buyIn: 500, deal: null, cambio: 1 },
        { id: 'ana#r0', name: 'Ana · Recompra 1', buyIn: 400, deal: aMano, cambio: CAMBIO_RECOMPRA },
      ],
      COLORES,
    )

    expect(d.rows[0].manual).toBe(false)
    expect(d.rows[0].total).toBe(500)
    expect(d.rows[1].manual).toBe(true)
    expect(stackTotal(d.rows[1].counts, COLORES)).toBe(400)
  })
})
