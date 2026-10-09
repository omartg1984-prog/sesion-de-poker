import { describe, expect, it } from 'vitest'
import {
  arrancarMano,
  bote,
  comoSeDiceCorto,
  deshacer,
  jugar,
  opciones,
  paraIgualar,
  repartirElBote,
  siguenVivos,
  type ConfigMano,
  type Mano,
} from '../mano'

/*
 * La mano apuntada movimiento por movimiento. Lo que se fija aquí es lo que cualquiera de
 * la mesa reclamaría: que el bote cuadre, que le toque a quien le toca y que la ciega
 * grande tenga su oportunidad de subir aunque todos nada más hayan pagado.
 */

const mesa = (jugadores: number, chica = 1, grande = 2): ConfigMano => ({
  jugadores,
  ciegaChica: chica,
  ciegaGrande: grande,
})

/** Jugar varios movimientos seguidos, como se leería el repaso. */
const correr = (m: Mano, pasos: [Parameters<typeof jugar>[1], number?][]) =>
  pasos.reduce((e, [tipo, hasta]) => jugar(e, tipo, hasta), m)

describe('cómo arranca la mano', () => {
  it('las ciegas ya están puestas antes de que hable nadie', () => {
    const m = arrancarMano(mesa(6))
    expect(m.total[1]).toBe(1)
    expect(m.total[2]).toBe(2)
    expect(bote(m)).toBe(3)
  })

  it('antes del flop habla el de después de la ciega grande', () => {
    expect(arrancarMano(mesa(6)).turno).toBe(3)
    expect(arrancarMano(mesa(4)).turno).toBe(3)
  })

  it('en una mesa de tres le toca al botón, que es el que sigue', () => {
    expect(arrancarMano(mesa(3)).turno).toBe(0)
  })

  it('de a dos el botón es la ciega chica y habla primero', () => {
    const m = arrancarMano(mesa(2))
    expect(m.total[0]).toBe(1)
    expect(m.total[1]).toBe(2)
    expect(m.turno).toBe(0)
  })

  it('pagar antes del flop cuesta lo que falta para la ciega grande', () => {
    const m = arrancarMano(mesa(6))
    expect(paraIgualar(m)).toBe(2)
    expect(opciones(m)!.pasa).toBe(false)
  })
})

describe('el turno va dando la vuelta', () => {
  it('pasa al siguiente que sigue vivo, saltándose a los que se fueron', () => {
    let m = arrancarMano(mesa(6))
    m = jugar(m, 'seVa')
    expect(m.turno).toBe(4)
    m = jugar(m, 'seVa')
    expect(m.turno).toBe(5)
    expect(siguenVivos(m)).toBe(4)
  })

  it('si todos se van, la mano se acaba ahí', () => {
    let m = arrancarMano(mesa(4))
    m = correr(m, [['seVa'], ['seVa'], ['seVa']])
    expect(m.terminada).toBe(true)
    expect(siguenVivos(m)).toBe(1)
    /* Lo que quedó en el bote es de la ciega grande, que no tuvo ni que hablar. */
    expect(bote(m)).toBe(3)
  })

  it('el que sube vuelve a abrir la ronda: los de atrás hablan otra vez', () => {
    let m = arrancarMano(mesa(4))
    m = jugar(m, 'paga') // el 3 paga 2
    m = jugar(m, 'sube', 8) // el 0 sube a 8
    expect(m.turno).toBe(1)
    m = jugar(m, 'seVa') // la ciega chica se va
    m = jugar(m, 'seVa') // la grande se va
    /* El 3 ya había hablado, pero se quedó corto: le toca otra vez. */
    expect(m.turno).toBe(3)
    expect(paraIgualar(m)).toBe(6)
  })
})

describe('la ciega grande tiene su oportunidad', () => {
  it('si todos nada más pagan, la grande todavía puede subir', () => {
    let m = arrancarMano(mesa(4))
    m = correr(m, [['paga'], ['paga'], ['paga']])
    /* Han hablado el 3, el 0 y el 1: le toca a la ciega grande aunque esté igualada. */
    expect(m.turno).toBe(2)
    expect(paraIgualar(m)).toBe(0)
    expect(opciones(m)!.pasa).toBe(true)
  })

  it('cuando la grande pasa, se acaba la ronda y se va al flop', () => {
    let m = arrancarMano(mesa(4))
    m = correr(m, [['paga'], ['paga'], ['paga'], ['pasa']])
    expect(m.calle).toBe('flop')
    expect(bote(m)).toBe(8)
    /* Del flop en adelante habla primero la ciega chica. */
    expect(m.turno).toBe(1)
  })

  it('y si sube, la ronda sigue', () => {
    let m = arrancarMano(mesa(4))
    m = correr(m, [['paga'], ['paga'], ['paga'], ['sube', 10]])
    expect(m.calle).toBe('preflop')
    expect(m.turno).toBe(3)
    expect(paraIgualar(m)).toBe(8)
  })
})

describe('el bote', () => {
  it('junta todo lo que se puso, calle por calle', () => {
    let m = arrancarMano(mesa(4))
    m = correr(m, [['paga'], ['paga'], ['paga'], ['pasa']])
    expect(bote(m)).toBe(8)
    /* En el flop: apuesta de 6 y dos que pagan. */
    m = correr(m, [['apuesta', 6], ['paga'], ['paga'], ['paga']])
    expect(bote(m)).toBe(8 + 24)
  })

  it('lo que se puso en una calle no se arrastra a la siguiente', () => {
    let m = arrancarMano(mesa(4))
    m = correr(m, [['paga'], ['paga'], ['paga'], ['pasa']])
    expect(m.puesto.every((p) => p === 0)).toBe(true)
    expect(m.total.every((t) => t === 2)).toBe(true)
  })

  it('subir es "a cuánto se queda", no cuánto suelta', () => {
    let m = arrancarMano(mesa(4))
    m = jugar(m, 'sube', 10) // el 3 no había puesto nada: suelta 10
    expect(bote(m)).toBe(13)
    m = jugar(m, 'sube', 30) // el 0 tampoco: suelta 30
    expect(bote(m)).toBe(43)
    m = jugar(m, 'paga') // la ciega chica ya tenía 1: suelta 29
    expect(bote(m)).toBe(72)
  })

  it('una subida por debajo del mínimo se acomoda sola', () => {
    let m = arrancarMano(mesa(4))
    m = jugar(m, 'sube', 3)
    /* La subida más chica son dos ciegas grandes: 2 + 2. */
    expect(m.movimientos[m.movimientos.length - 1].hasta).toBe(4)
  })
})

describe('de calle en calle', () => {
  it('pasando todos se llega hasta el river y ahí se acaba', () => {
    let m = arrancarMano(mesa(3))
    m = correr(m, [['paga'], ['paga'], ['pasa']])
    expect(m.calle).toBe('flop')
    for (const calle of ['turn', 'river'] as const) {
      m = correr(m, [['pasa'], ['pasa'], ['pasa']])
      expect(m.calle).toBe(calle)
    }
    m = correr(m, [['pasa'], ['pasa'], ['pasa']])
    expect(m.terminada).toBe(true)
    expect(m.turno).toBeNull()
  })

  it('una mano terminada ya no acepta movimientos', () => {
    let m = arrancarMano(mesa(2))
    m = jugar(m, 'seVa')
    expect(m.terminada).toBe(true)
    const antes = m.movimientos.length
    m = jugar(m, 'paga')
    expect(m.movimientos.length).toBe(antes)
  })
})

describe('deshacer', () => {
  it('quita el último movimiento y deja el bote como estaba', () => {
    let m = arrancarMano(mesa(4))
    m = correr(m, [['paga'], ['sube', 8]])
    const conSubida = bote(m)
    const atras = deshacer(m)
    expect(bote(atras)).toBe(conSubida - 8)
    expect(atras.turno).toBe(0)
  })

  it('deshacer hasta el principio deja la mano recién repartida', () => {
    let m = arrancarMano(mesa(4))
    m = correr(m, [['paga'], ['paga']])
    expect(deshacer(deshacer(m))).toEqual(arrancarMano(mesa(4)))
  })

  it('en una mano sin movimientos no rompe nada', () => {
    const m = arrancarMano(mesa(5))
    expect(deshacer(m)).toEqual(m)
  })
})

/*
 * Lo que se pinta en la placa de cada quien mientras se juega. Son dos palabras porque
 * en la mesa dibujada no cabe más, y porque de un vistazo lo que se busca es quién
 * subió, quién pagó y quién se fue.
 */
describe('cómo se dice en la mesa', () => {
  const pesos = (n: number) => `$${n}`

  it('cada movimiento tiene su palabra', () => {
    let m = arrancarMano(mesa(4))
    const dicho = () => comoSeDiceCorto(m.movimientos[m.movimientos.length - 1], pesos)
    expect(comoSeDiceCorto(m.movimientos[0], pesos)).toBe('Ciega $1')
    m = jugar(m, 'sube', 8)
    expect(dicho()).toBe('Sube $8')
    m = jugar(m, 'paga')
    expect(dicho()).toBe('Paga $8')
    m = jugar(m, 'seVa')
    expect(dicho()).toBe('Se fue')
  })

  it('subir dice a cuánto quedó, no lo que soltó', () => {
    let m = arrancarMano(mesa(4))
    m = correr(m, [['paga'], ['sube', 20]])
    /* El botón no había puesto nada, pero la ciega chica sí: lo que se canta es el 20. */
    m = jugar(m, 'sube', 60)
    expect(comoSeDiceCorto(m.movimientos[m.movimientos.length - 1], pesos)).toBe('Sube $60')
  })

  it('apostar de cero se dice apuesta, no sube', () => {
    let m = arrancarMano(mesa(3))
    m = correr(m, [['paga'], ['paga'], ['pasa']])
    m = jugar(m, 'apuesta', 10)
    expect(comoSeDiceCorto(m.movimientos[m.movimientos.length - 1], pesos)).toBe('Apuesta $10')
  })
})

/*
 * Las fichas de enfrente. Sin ellas se puede pagar todo y apostar no duele; con ellas
 * aparece el irse con todo y, detrás, los botes partidos, que es la cuenta del poker que
 * más se hace mal en la mesa.
 */
describe('cuando hay fichas contadas', () => {
  const conFichas = (fichas: number[]): ConfigMano => ({
    jugadores: fichas.length,
    ciegaChica: 1,
    ciegaGrande: 2,
    fichas,
  })

  it('nadie puede apostar lo que no trae', () => {
    let m = arrancarMano(conFichas([50, 50, 50, 50]))
    m = jugar(m, 'sube', 10000)
    expect(m.movimientos[m.movimientos.length - 1].hasta).toBe(50)
    expect(m.resto[3]).toBe(0)
  })

  it('pagar nunca cuesta más de lo que queda enfrente', () => {
    let m = arrancarMano(conFichas([500, 500, 500, 20]))
    m = jugar(m, 'sube', 200) // el 3, con 20, se va con todo
    expect(m.resto[3]).toBe(0)
    const o = opciones(m)!
    /* Al botón le piden igualar los 20 que alcanzó a poner, no los 200. */
    expect(o.paga).toBe(20)
  })

  it('al que se fue con todo ya no le vuelve a tocar', () => {
    let m = arrancarMano(conFichas([500, 500, 500, 20]))
    m = correr(m, [['sube', 20], ['paga'], ['paga'], ['paga']])
    expect(m.calle).toBe('flop')
    /* Sigue en la mano, pero sin fichas no habla. */
    expect(m.vivo[3]).toBe(true)
    expect(m.turno).not.toBe(3)
  })

  it('con uno solo que pueda apostar, se corren las calles hasta el river', () => {
    let m = arrancarMano(conFichas([30, 30]))
    /* De a dos: el botón se va con todo y el otro paga. Ya nadie trae nada. */
    m = correr(m, [['sube', 30], ['paga']])
    expect(m.terminada).toBe(true)
    expect(bote(m)).toBe(60)
  })

  it('la ciega de quien no alcanza se pone con lo que trae', () => {
    const m = arrancarMano(conFichas([500, 500, 1, 500]))
    expect(m.total[2]).toBe(1)
    expect(m.resto[2]).toBe(0)
  })

  it('sin fichas en la configuración, todo sigue como siempre', () => {
    const m = arrancarMano(mesa(4))
    expect(m.resto.every((r) => r === Infinity)).toBe(true)
    expect(opciones(m)!.maximo).toBe(Infinity)
  })
})

describe('cómo se parte el bote', () => {
  /* Cuatro pusieron distinto; gana el que menos puso. */
  it('el que se fue con todo sólo cobra hasta donde alcanzó a poner', () => {
    const gana = repartirElBote([50, 200, 200, 0], [true, true, true, false], (s) =>
      s === 0 ? 100 : s === 1 ? 50 : 10,
    )
    /* El 0 se lleva su capa: 50 de cada uno de los tres que pusieron. */
    expect(gana[0]).toBe(150)
    /* Lo de arriba se lo pelean el 1 y el 2, y gana el 1. */
    expect(gana[1]).toBe(300)
    expect(gana[2]).toBe(0)
    expect(gana[0] + gana[1] + gana[2]).toBe(450)
  })

  it('el bote completo se reparte, ni un peso de más ni de menos', () => {
    const total = [35, 120, 120, 7, 0]
    const gana = repartirElBote(total, [true, true, true, true, false], (s) => s)
    expect(gana.reduce((a, b) => a + b, 0)).toBe(total.reduce((a, b) => a + b, 0))
  })

  it('un empate se parte, y lo que no se puede partir se queda con el primero', () => {
    const gana = repartirElBote([25, 25, 25], [true, true, true], () => 10)
    expect(gana.reduce((a, b) => a + b, 0)).toBe(75)
    expect(gana[0]).toBe(25)
    expect(gana[1]).toBe(25)
  })

  it('al que apostó más de lo que nadie igualó se le devuelve el sobrante', () => {
    /* El 1 apostó 200, el 0 sólo alcanzó a pagar 50 y los demás se fueron. */
    const gana = repartirElBote([50, 200, 0], [true, true, false], (s) => (s === 0 ? 99 : 1))
    expect(gana[0]).toBe(100)
    /* Los 150 que nadie igualó vuelven a su dueño. */
    expect(gana[1]).toBe(150)
  })

  it('si todos se fueron menos uno, el bote entero es suyo', () => {
    const gana = repartirElBote([10, 40, 10], [false, true, false], () => 1)
    expect(gana[1]).toBe(60)
  })
})
