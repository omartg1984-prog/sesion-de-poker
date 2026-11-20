import { describe, expect, it } from 'vitest'
import { calcularCuadre, enLista, porQueNoSePuedeCerrar } from '../cuadre'
import type { Participacion } from '../../../lib/api'
import type { Distribution } from '../../../lib/distribution'
import type { ChipColor } from '../../../store/types'

/*
 * El cierre de la noche.
 *
 * Lo que se prueba aquí es sobre todo lo que nos pasó en la mesa: el que se fue sin una
 * sola ficha dejaba la partida trabada, porque "no tiene fichas" y "no le hemos contado
 * las fichas" se veían igual desde el código. Y cuando la app frenaba, decía cuántos
 * faltaban pero no quiénes, que es justo el dato que sirve a la una de la mañana.
 */

const COLORES: ChipColor[] = [
  { key: 'rojas', label: 'Rojas', value: 25, color: '#c22', inventory: 200 },
]

/** Un reparto donde a cada quien le dieron cuatro rojas. */
const repartoDe = (cuantos: number): Distribution =>
  ({
    rows: Array.from({ length: cuantos }, () => ({ counts: { rojas: 4 } })),
  }) as unknown as Distribution

const jugador = (nombre: string, cambios: Partial<Participacion> = {}): Participacion =>
  ({
    id: nombre,
    partida_id: 'p1',
    usuario_id: nombre,
    entrada: 100,
    recompras: '[]',
    fichas_manual: null,
    fichas_final: '{}',
    rebuys: 0,
    addons: 0,
    lugar: 0,
    pagado: null,
    contadas_por: null,
    contadas_por_nombre: null,
    cerrado_en: null,
    nombre,
    usuario: nombre.toLowerCase(),
    foto: null,
    ...cambios,
  }) as Participacion

const puso = () => 100

const cuadreDe = (gente: Participacion[]) =>
  calcularCuadre(gente, COLORES, repartoDe(gente.length), puso)

describe('el que se fue sin una sola ficha', () => {
  it('cuenta como contado si alguien capturó su conteo', () => {
    /* Es el caso que trabó la noche: fichas en cero, pero contadas. */
    const c = cuadreDe([
      jugador('Chuy', { fichas_final: '{"rojas":8}', contadas_por: 'u1' }),
      jugador('Omar', { fichas_final: '{}', contadas_por: 'u1' }),
    ])
    expect(c.contados).toBe(2)
    expect(c.faltanContar).toEqual([])
  })

  it('sin capturar, sigue faltando', () => {
    const c = cuadreDe([
      jugador('Chuy', { fichas_final: '{"rojas":8}', contadas_por: 'u1' }),
      jugador('Omar'),
    ])
    expect(c.contados).toBe(1)
    expect(c.faltanContar).toEqual(['Omar'])
  })

  it('las partidas viejas, sin quién contó, se leen por las fichas', () => {
    /* Antes no se guardaba quién capturaba. Esas noches siguen cerrando igual. */
    const c = cuadreDe([jugador('Chuy', { fichas_final: '{"rojas":8}' })])
    expect(c.contados).toBe(1)
  })
})

describe('por qué no se puede cerrar', () => {
  const todoListo = (nombre: string, cambios: Partial<Participacion> = {}) =>
    jugador(nombre, { fichas_final: '{"rojas":4}', contadas_por: 'u1', pagado: 100, ...cambios })

  it('dice quién falta por contar, no cuántos', () => {
    const traba = porQueNoSePuedeCerrar(cuadreDe([todoListo('Chuy'), jugador('Omar')]))
    expect(traba).toContain('Omar')
    expect(traba).not.toMatch(/1 de 2/)
  })

  it('y dice qué hacer con el que no tiene fichas', () => {
    const traba = porQueNoSePuedeCerrar(cuadreDe([todoListo('Chuy'), jugador('Omar')]))
    expect(traba).toContain('ceros')
  })

  it('dice quién falta por cobrar', () => {
    const traba = porQueNoSePuedeCerrar(
      cuadreDe([todoListo('Chuy'), todoListo('Omar', { pagado: null })]),
    )
    expect(traba).toContain('Omar')
    expect(traba).toContain('ponle 0')
  })

  it('un cero apuntado es un pago apuntado', () => {
    const c = cuadreDe([todoListo('Chuy'), todoListo('Omar', { pagado: 0 })])
    expect(c.faltanPagar).toEqual([])
    expect(porQueNoSePuedeCerrar(c)).toBeNull()
  })

  it('sin jugadores no hay nada que cerrar', () => {
    expect(porQueNoSePuedeCerrar(cuadreDe([]))).toContain('jugadores')
  })

  it('primero las fichas y luego el dinero: un aviso a la vez', () => {
    /* Con los dos problemas abiertos manda el del conteo, porque hasta que no están
       contadas las fichas los números de la noche no quieren decir nada. */
    const traba = porQueNoSePuedeCerrar(cuadreDe([jugador('Chuy'), jugador('Omar')]))
    expect(traba).toContain('fichas')
  })
})

describe('los nombres, dichos como se dicen', () => {
  it('uno solo va solo', () => {
    expect(enLista(['Chuy'])).toBe('Chuy')
  })

  it('dos van con y', () => {
    expect(enLista(['Chuy', 'Omar'])).toBe('Chuy y Omar')
  })

  it('tres y cuatro caben enteros', () => {
    expect(enLista(['Chuy', 'Omar', 'Beto'])).toBe('Chuy, Omar y Beto')
    expect(enLista(['Chuy', 'Omar', 'Beto', 'Ana'])).toBe('Chuy, Omar, Beto y Ana')
  })

  it('de cinco en adelante se corta: un aviso largo no se lee', () => {
    expect(enLista(['Chuy', 'Omar', 'Beto', 'Ana', 'Luis'])).toBe('Chuy, Omar, Beto y 2 más')
  })

  it('sin nadie no dice nada', () => {
    expect(enLista([])).toBe('')
  })
})
