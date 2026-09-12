import { describe, expect, it } from 'vitest'
import { calcularEstructura, enCurso, tramosDe, type Peticion } from '../torneo'

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
    const r = enCurso(e, 0)
    expect(r.nivel).toEqual(e.niveles[0])
    expect(r.restanteSeg).toBe(900)
    expect(r.terminado).toBe(false)
  })

  it('cambia de nivel justo al cumplirse los minutos', () => {
    expect(enCurso(e, 899).nivel.nivel).toBe(1)
    expect(enCurso(e, 900).nivel.nivel).toBe(2)
  })

  it('cuando se acaba el torneo queda en el último nivel y marca terminado', () => {
    const r = enCurso(e, 99999)
    expect(r.nivel).toEqual(e.niveles[e.niveles.length - 1])
    expect(r.terminado).toBe(true)
  })
})

describe('los descansos', () => {
  const conDescanso = calcularEstructura({ ...OCHO, descanso: { cadaNiveles: 4, minutos: 20 } })

  it('alargan la noche por lo que duran', () => {
    const sin = calcularEstructura(OCHO)
    // Doce niveles con descanso cada cuatro son dos descansos, no tres: después del
    // último nivel ya no hay que descansar.
    expect(conDescanso.duracionMinutos).toBe(sin.duracionMinutos + 2 * 20)
  })

  it('se meten entre los niveles, no al final', () => {
    const tramos = tramosDe(conDescanso)
    expect(tramos[3].tipo).toBe('nivel')
    expect(tramos[4].tipo).toBe('descanso')
    expect(tramos[tramos.length - 1].tipo).toBe('nivel')
  })

  it('el reloj entra al descanso al terminar el cuarto nivel', () => {
    const justoAntes = enCurso(conDescanso, 4 * 15 * 60 - 1)
    const justoDespues = enCurso(conDescanso, 4 * 15 * 60)
    expect(justoAntes.tramo.tipo).toBe('nivel')
    expect(justoDespues.tramo.tipo).toBe('descanso')
    expect(justoDespues.restanteSeg).toBe(20 * 60)
  })

  it('durante el descanso ya se ve el nivel que viene al volver', () => {
    const r = enCurso(conDescanso, 4 * 15 * 60 + 60)
    expect(r.tramo.tipo).toBe('descanso')
    expect(r.nivel.nivel).toBe(5)
  })

  it('el descanso recorre todo lo que viene después', () => {
    const sin = calcularEstructura(OCHO)
    // El nivel 5 sin descanso entra al minuto 60; con veinte de descanso, al 80.
    expect(enCurso(sin, 60 * 60).nivel.nivel).toBe(5)
    expect(enCurso(conDescanso, 60 * 60).tramo.tipo).toBe('descanso')
    expect(enCurso(conDescanso, 80 * 60).nivel.nivel).toBe(5)
  })
})
