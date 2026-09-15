import { describe, expect, it } from 'vitest'
import {
  calcularEstructura,
  enCurso,
  retirosDe,
  tramosDe,
  type NivelCiegas,
  type Peticion,
} from '../torneo'

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

  it('salen del tiempo pedido, no se le suman', () => {
    /* Si se quedó de jugar hasta la una, a la una hay que estar levantando la mesa:
       cenar sale de esas horas. Un torneo que se pasa de la hora prometida es justo lo
       que esta tabla existe para evitar. */
    expect(conDescanso.duracionMinutos).toBeLessThanOrEqual(OCHO.minutosDeseados)
  })

  it('a cambio caben menos niveles que jugando de corrido', () => {
    const sin = calcularEstructura(OCHO)
    expect(conDescanso.niveles.length).toBeLessThan(sin.niveles.length)
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

describe('retirar las fichas chicas', () => {
  /* Niveles a mano, para que el caso sea legible y no dependa de la fórmula. */
  const conCiegas = (pares: [number, number][]): NivelCiegas[] =>
    pares.map(([chica, grande], i) => ({
      nivel: i + 1,
      chica,
      grande,
      desdeMinuto: i * 15,
    }))

  it('saca la ficha cuando las ciegas ya son múltiplos de la siguiente', () => {
    // Con fichas de 25 y 100: en cuanto las ciegas son 100/200, la de 25 no paga nada.
    const r = retirosDe(conCiegas([[25, 50], [50, 100], [100, 200], [200, 400]]), [25, 100, 500])
    expect(r).toEqual([{ nivel: 3, valores: [25] }])
  })

  it('no retira la más grande: con algo hay que pagar', () => {
    const r = retirosDe(conCiegas([[100, 200], [200, 400], [400, 800]]), [100, 500])
    expect(r.some((x) => x.valores.includes(500))).toBe(false)
  })

  it('no retira nada si sólo hay una denominación', () => {
    expect(retirosDe(conCiegas([[25, 50], [100, 200]]), [25])).toEqual([])
  })

  it('no para la mesa en el último nivel', () => {
    /* Sacar fichas cuando ya se va a acabar el torneo es interrumpir por nada. */
    const r = retirosDe(conCiegas([[25, 50], [100, 200]]), [25, 100])
    expect(r).toEqual([])
  })

  it('las fichas salen en orden: la chica nunca después de una más grande', () => {
    const niveles = conCiegas([[25, 50], [500, 1000], [500, 1000], [1000, 2000], [2000, 4000]])
    const r = retirosDe(niveles, [25, 100, 500])
    const nivelesDeSalida = r.flatMap((x) => x.valores.map(() => x.nivel))
    expect([...nivelesDeSalida].sort((a, b) => a - b)).toEqual(nivelesDeSalida)
  })
})

describe('la parada para cambiar fichas', () => {
  const base = {
    descanso: null,
    stackInicial: 10000,
    minutosPorNivel: 15,
    duracionMinutos: 0,
    profundidad: 100,
    factor: 1.3,
    aviso: null,
  }
  const niveles: NivelCiegas[] = [1, 2, 3, 4].map((n) => ({
    nivel: n,
    chica: n * 100,
    grande: n * 200,
    desdeMinuto: (n - 1) * 15,
  }))

  it('mete una parada corta justo antes del nivel del retiro', () => {
    const tramos = tramosDe({ ...base, niveles, retiros: [{ nivel: 3, valores: [25] }] })
    const parada = tramos.find((t) => t.tipo === 'descanso')!
    expect(parada.minutos).toBe(5)
    expect(parada.tipo === 'descanso' && parada.retira).toEqual([25])
    // va en tercer lugar: nivel 1, nivel 2, parada, nivel 3…
    expect(tramos.indexOf(parada)).toBe(2)
  })

  it('si ahí ya tocaba descanso, aprovecha ése en vez de parar dos veces', () => {
    const tramos = tramosDe({
      ...base,
      niveles,
      descanso: { cadaNiveles: 2, minutos: 20 },
      retiros: [{ nivel: 3, valores: [25] }],
    })
    const descansos = tramos.filter((t) => t.tipo === 'descanso')
    expect(descansos).toHaveLength(1)
    expect(descansos[0].minutos).toBe(20)
    expect(descansos[0].tipo === 'descanso' && descansos[0].retira).toEqual([25])
  })

  it('las paradas salen del tiempo pedido, no se le suman', () => {
    const e = calcularEstructura({
      jugadores: 8,
      stackInicial: 10000,
      fichaMasChica: 50,
      valores: [50, 200, 1000, 2000, 10000],
      minutosDeseados: 300,
      minutosPorNivel: 15,
      descanso: { cadaNiveles: 4, minutos: 20 },
    })
    expect(e.duracionMinutos).toBeLessThanOrEqual(300)
  })

  it('sin valores no se retira nada, como los torneos de antes', () => {
    const e = calcularEstructura({
      jugadores: 8,
      stackInicial: 10000,
      fichaMasChica: 50,
      minutosDeseados: 300,
      minutosPorNivel: 15,
    })
    expect(e.retiros).toEqual([])
  })
})
