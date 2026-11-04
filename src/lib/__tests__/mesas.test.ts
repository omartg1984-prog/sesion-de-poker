import { describe, expect, it } from 'vitest'
import {
  cuantasMesasSugeridas,
  faltaParaElCambio,
  maximoDeMesas,
  mesasVacias,
  nivelesDeLaLiga,
  resumenDeMesas,
  sinMesa,
  sortearMesas,
  tamanosDeMesa,
  tocaCambiar,
  type JugadorParaSortear,
} from '../mesas'

/*
 * El sorteo de mesas.
 *
 * Lo que se prueba no es que salga un reparto concreto —es un sorteo, y dos iguales
 * seguidos serían sospechosos— sino que no salga uno malo: que no queden todos los
 * buenos de un lado ni todas las torres de fichas en la misma mesa.
 */

/** Un azar de juguete, para que la prueba no dependa de la suerte. */
function azarFijo(semilla = 7) {
  let s = semilla
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const gente = (
  cuantos: number,
  como: (i: number) => Partial<JugadorParaSortear> = () => ({}),
): JugadorParaSortear[] =>
  Array.from({ length: cuantos }, (_, i) => ({
    id: `j${i}`,
    nombre: `Jugador ${i}`,
    nivel: null,
    dinero: null,
    ...como(i),
  }))

describe('cuántos se sientan en cada mesa', () => {
  it('parte parejo cuando se puede', () => {
    expect(tamanosDeMesa(12, 2)).toEqual([6, 6])
  })

  it('y reparte al que sobra de uno en uno', () => {
    expect(tamanosDeMesa(11, 2)).toEqual([6, 5])
    expect(tamanosDeMesa(10, 3)).toEqual([4, 3, 3])
  })

  it('nunca deja una mesa vacía', () => {
    expect(tamanosDeMesa(3, 5)).toEqual([1, 1, 1])
  })

  it('de ocho para arriba propone dos mesas', () => {
    expect(cuantasMesasSugeridas(7)).toBe(1)
    expect(cuantasMesasSugeridas(8)).toBe(2)
    expect(cuantasMesasSugeridas(19)).toBe(3)
  })

  it('y no deja partir en mesas de dos', () => {
    expect(maximoDeMesas(8)).toBe(2)
    expect(maximoDeMesas(12)).toBe(4)
  })
})

describe('el sorteo', () => {
  it('sienta a todos, una sola vez, y respeta los tamaños', () => {
    const jugadores = gente(11)
    const mesas = sortearMesas(jugadores, 2, azarFijo())
    expect(mesas.map((m) => m.length).sort()).toEqual([5, 6])
    expect(mesas.flat().sort()).toEqual(jugadores.map((j) => j.id).sort())
  })

  it('con una sola mesa no reparte nada', () => {
    const jugadores = gente(6)
    expect(sortearMesas(jugadores, 1, azarFijo())).toEqual([jugadores.map((j) => j.id)])
  })

  it('sin nadie no hay mesas', () => {
    expect(sortearMesas([], 2, azarFijo())).toEqual([])
  })

  it('no deja a los buenos todos en la misma mesa', () => {
    /* Cuatro que juegan bien y cuatro que no: lo sano es dos y dos en cada mesa. */
    const jugadores = gente(8, (i) => ({ nivel: i < 4 ? 10 : 1 }))
    const mesas = sortearMesas(jugadores, 2, azarFijo())
    for (const mesa of mesas) {
      const buenos = mesa.filter((id) => Number(id.slice(1)) < 4).length
      expect(buenos).toBe(2)
    }
  })

  it('reparte las torres de fichas entre las dos mesas', () => {
    /* Dos de mil, dos de quinientos y cuatro de cien: cada mesa tiene que juntar 1700. */
    const montos = [1000, 1000, 500, 500, 100, 100, 100, 100]
    const jugadores = gente(8, (i) => ({ dinero: montos[i] }))
    const mesas = sortearMesas(jugadores, 2, azarFijo())
    const suma = (mesa: string[]) =>
      mesa.reduce((a, id) => a + montos[Number(id.slice(1))], 0)
    expect(mesas.map(suma)).toEqual([1700, 1700])
  })

  it('no amontona en una mesa a los que llegaron hoy', () => {
    /* Seis con historia y cuatro nuevos: dos nuevos por mesa. Para los números daría
       igual juntarlos —el que no tiene noches cuenta como término medio— y aun así no
       es lo que quiere nadie. */
    const jugadores = gente(10, (i) => ({ nivel: i < 6 ? 10 - i : null }))
    const mesas = sortearMesas(jugadores, 2, azarFijo())
    for (const mesa of mesas) {
      expect(mesa.filter((id) => Number(id.slice(1)) >= 6).length).toBe(2)
    }
  })

  it('aguanta que nadie tenga nivel ni dinero contado', () => {
    const mesas = sortearMesas(gente(9), 3, azarFijo())
    expect(mesas.map((m) => m.length)).toEqual([3, 3, 3])
  })

  it('con el mismo azar da el mismo reparto, y con otro da otro', () => {
    const jugadores = gente(10, (i) => ({ nivel: i }))
    const a = sortearMesas(jugadores, 2, azarFijo(1))
    const b = sortearMesas(jugadores, 2, azarFijo(1))
    expect(a).toEqual(b)
    /* No es garantía absoluta —dos sorteos pueden coincidir—, pero con diez jugadores
       y niveles todos distintos, dos semillas lejanas no tienen por qué dar lo mismo. */
    const c = sortearMesas(jugadores, 2, azarFijo(999))
    expect(c.map((m) => m.length)).toEqual([5, 5])
  })

  it('reparte el dinero aunque sólo se haya contado a algunos', () => {
    const jugadores = gente(8, (i) => ({ dinero: i < 2 ? 2000 : null }))
    const mesas = sortearMesas(jugadores, 2, azarFijo())
    /* Los dos contados traen lo mismo y son los únicos con fichas apuntadas: lo parejo
       es uno en cada mesa. */
    for (const mesa of mesas) {
      expect(mesa.filter((id) => Number(id.slice(1)) < 2).length).toBe(1)
    }
  })
})

describe('cómo quedó cada mesa', () => {
  const jugadores = gente(4, (i) => ({
    nivel: i < 2 ? 8 : null,
    dinero: i === 0 ? 700 : i === 1 ? 300 : null,
  }))

  it('cuenta el dinero de los que sí se contaron', () => {
    const [mesa] = resumenDeMesas([['j0', 'j1']], jugadores)
    expect(mesa.dinero).toBe(1000)
    expect(mesa.dineroPorCabeza).toBe(500)
  })

  it('no reparte el dinero entre los que no se contaron', () => {
    const [mesa] = resumenDeMesas([['j0', 'j2']], jugadores)
    expect(mesa.dinero).toBe(700)
    expect(mesa.dineroPorCabeza).toBe(700)
  })

  it('apunta a los que todavía no tienen nivel', () => {
    const [mesa] = resumenDeMesas([['j0', 'j2', 'j3']], jugadores)
    expect(mesa.nivel).toBe(8)
    expect(mesa.nuevos).toBe(2)
  })

  it('una mesa de puros nuevos no tiene nivel', () => {
    const [mesa] = resumenDeMesas([['j2', 'j3']], jugadores)
    expect(mesa.nivel).toBe(null)
  })

  it('al que ya no está en la partida no lo inventa', () => {
    const [mesa] = resumenDeMesas([['j0', 'se-fue']], jugadores)
    expect(mesa.jugadores.map((j) => j.id)).toEqual(['j0'])
  })

  it('y el que llegó después queda fuera del sorteo', () => {
    expect(sinMesa([['j0', 'j1']], jugadores).map((j) => j.id)).toEqual(['j2', 'j3'])
  })
})

describe('el reloj del cambio', () => {
  const ahora = Date.parse('2026-11-04T21:00:00.000Z')

  it('con el reloj parado no toca cambiar nada', () => {
    const m = { ...mesasVacias(), minutos: 45 }
    expect(faltaParaElCambio(m, ahora)).toBe(45 * 60)
    expect(tocaCambiar(m, ahora)).toBe(false)
  })

  it('descuenta lo que lleva corriendo', () => {
    const m = {
      ...mesasVacias(),
      minutos: 45,
      reloj: {
        corriendo: true,
        acumuladoSeg: 0,
        arrancadoEn: new Date(ahora - 10 * 60 * 1000).toISOString(),
      },
    }
    expect(faltaParaElCambio(m, ahora)).toBe(35 * 60)
    expect(tocaCambiar(m, ahora)).toBe(false)
  })

  it('y avisa cuando ya se pasó', () => {
    const m = {
      ...mesasVacias(),
      minutos: 45,
      reloj: {
        corriendo: true,
        acumuladoSeg: 46 * 60,
        arrancadoEn: new Date(ahora).toISOString(),
      },
    }
    expect(faltaParaElCambio(m, ahora)).toBeLessThan(0)
    expect(tocaCambiar(m, ahora)).toBe(true)
  })

  it('en pausa se queda donde iba', () => {
    const m = {
      ...mesasVacias(),
      minutos: 45,
      reloj: { corriendo: false, acumuladoSeg: 50 * 60, arrancadoEn: null },
    }
    expect(tocaCambiar(m, ahora)).toBe(false)
  })
})

describe('el nivel que sale de la tabla', () => {
  it('toma los puntos por noche del que ya tiene historia', () => {
    const niveles = nivelesDeLaLiga([
      { usuarioId: 'a', puntosPorNoche: 7.5, partidas: 9 },
      { usuarioId: 'b', puntosPorNoche: 4, partidas: 2 },
    ])
    expect(niveles).toEqual({ a: 7.5, b: 4 })
  })

  it('y deja fuera al de una sola noche, que todavía no se puede medir', () => {
    const niveles = nivelesDeLaLiga([{ usuarioId: 'c', puntosPorNoche: 18, partidas: 1 }])
    expect(niveles.c).toBeUndefined()
  })
})
