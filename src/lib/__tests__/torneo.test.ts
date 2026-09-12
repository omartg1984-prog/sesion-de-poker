import { describe, expect, it } from 'vitest'
import { calcularEstructura, nivelEnCurso, type Peticion } from '../torneo'

/* La liga real: fichas de $1 arriba, ocho jugadores, tres horas. */
const OCHO: Peticion = {
  jugadores: 8,
  stackInicial: 1000,
  fichaMasChica: 1,
  minutosDeseados: 180,
  minutosPorNivel: 15,
}

describe('estructura de torneo', () => {
  it('las dos ciegas se pueden pagar con las fichas que hay', () => {
    for (const ficha of [1, 5, 25]) {
      const e = calcularEstructura({ ...OCHO, fichaMasChica: ficha })
      for (const n of e.niveles) {
        expect(n.chica % ficha).toBe(0)
        expect(n.grande).toBe(n.chica * 2)
      }
    }
  })

  it('las ciegas nunca bajan ni se estancan', () => {
    const e = calcularEstructura(OCHO)
    for (let i = 1; i < e.niveles.length; i++) {
      expect(e.niveles[i].chica).toBeGreaterThan(e.niveles[i - 1].chica)
    }
  })

  it('arranca con una profundidad jugable', () => {
    const e = calcularEstructura(OCHO)
    expect(e.profundidad).toBeGreaterThanOrEqual(50)
    expect(e.profundidad).toBeLessThanOrEqual(150)
  })

  it('la última ciega se come la mesa, que es cuando se acaba', () => {
    const e = calcularEstructura(OCHO)
    const enJuego = OCHO.jugadores * OCHO.stackInicial
    const ultima = e.niveles[e.niveles.length - 1].grande
    // Cerca de la vigésima parte; el redondeo a valores de casino mueve un poco.
    expect(ultima).toBeGreaterThan(enJuego / 40)
    expect(ultima).toBeLessThan(enJuego / 10)
  })

  it('dura lo que se pidió cuando el tiempo es múltiplo del nivel', () => {
    expect(calcularEstructura(OCHO).duracionMinutos).toBe(180)
  })

  it('más jugadores hacen el torneo más largo con el mismo stack', () => {
    // Hay más fichas en juego, así que las ciegas tienen que llegar más arriba.
    const pocos = calcularEstructura({ ...OCHO, jugadores: 4 })
    const muchos = calcularEstructura({ ...OCHO, jugadores: 16 })
    expect(muchos.factor).toBeGreaterThan(pocos.factor)
  })

  it('avisa cuando el torneo se va a convertir en rifa', () => {
    // Media hora para ocho jugadores no alcanza: las ciegas tendrían que volar.
    const e = calcularEstructura({ ...OCHO, minutosDeseados: 30 })
    expect(e.aviso).toContain('rifa')
  })

  it('avisa cuando se va a alargar de más', () => {
    const e = calcularEstructura({ ...OCHO, minutosDeseados: 600 })
    expect(e.aviso).toContain('alargar')
  })

  it('no avisa nada cuando la estructura es sana', () => {
    expect(calcularEstructura(OCHO).aviso).toBeNull()
  })
})

describe('el reloj', () => {
  const e = calcularEstructura(OCHO)

  it('al arrancar va en el primer nivel', () => {
    const r = nivelEnCurso(e.niveles, 0, 15)
    expect(r.indice).toBe(0)
    expect(r.restanteSeg).toBe(900)
    expect(r.terminado).toBe(false)
  })

  it('cambia de nivel justo al cumplirse los minutos', () => {
    expect(nivelEnCurso(e.niveles, 899, 15).indice).toBe(0)
    expect(nivelEnCurso(e.niveles, 900, 15).indice).toBe(1)
  })

  it('cuando se pasan todos los niveles queda en el último y marca terminado', () => {
    const r = nivelEnCurso(e.niveles, 99999, 15)
    expect(r.indice).toBe(e.niveles.length - 1)
    expect(r.terminado).toBe(true)
  })
})
