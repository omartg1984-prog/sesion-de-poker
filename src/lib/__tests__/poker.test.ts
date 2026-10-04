import { describe, expect, it } from 'vitest'
import {
  CATEGORIAS,
  asientosDe,
  azarCon,
  bandaDeJugabilidad,
  carta,
  categoriaDe,
  cuentasDeLaApuesta,
  equidadDe,
  evaluar,
  nombreDeLaMano,
  simular,
} from '../poker'

/*
 * El motor del simulador. Aquí no se fija "qué número da" sino lo que tiene que cumplir:
 * que una mano le gane a otra cuando de verdad le gana, y que la simulación no mienta en
 * los casos donde la respuesta se sabe de antemano.
 */

/** 'As', 'Kc', 'Td'… para escribir los casos como se leen. */
const VAL = '23456789TJQKA'
const PAL = 'shdc'
const c = (txt: string) => carta(VAL.indexOf(txt[0]), PAL.indexOf(txt[1]))
const mano = (txt: string) => txt.split(' ').map(c)
const nombre = (cartas: number[]) => CATEGORIAS[categoriaDe(evaluar(cartas))]

describe('qué mano es', () => {
  it('reconoce cada categoría', () => {
    expect(nombre(mano('As Ks Qs Js Ts'))).toBe('Escalera de color')
    expect(nombre(mano('9h 9s 9d 9c 2h'))).toBe('Póker')
    expect(nombre(mano('9h 9s 9d 2c 2h'))).toBe('Full')
    expect(nombre(mano('As Js 9s 5s 2s'))).toBe('Color')
    expect(nombre(mano('9h 8s 7d 6c 5h'))).toBe('Escalera')
    expect(nombre(mano('9h 9s 9d 5c 2h'))).toBe('Tercia')
    expect(nombre(mano('9h 9s 5d 5c 2h'))).toBe('Dos pares')
    expect(nombre(mano('9h 9s 7d 5c 2h'))).toBe('Par')
    expect(nombre(mano('Ah Js 7d 5c 2h'))).toBe('Carta alta')
  })

  it('la rueda es escalera y la cierra el 5, no el as', () => {
    expect(nombre(mano('Ah 2s 3d 4c 5h'))).toBe('Escalera')
    /* Y pierde contra cualquier otra escalera: es la más baja que existe. */
    expect(evaluar(mano('Ah 2s 3d 4c 5h'))).toBeLessThan(evaluar(mano('2h 3s 4d 5c 6h')))
  })

  it('con siete cartas agarra las cinco mejores', () => {
    /* Hay color y hay tercia; el color manda. */
    expect(nombre(mano('As Ks 9s 5s 2s Ah Ad'))).toBe('Color')
    /* Y la escalera que sale usando sólo parte de la mesa también cuenta. */
    expect(nombre(mano('9h 8s 2d 2c 7h 6d 5s'))).toBe('Escalera')
  })

  it('dos tercias son un full, no una tercia', () => {
    const siete = mano('9h 9s 9d 5c 5h 5s 2d')
    expect(nombre(siete)).toBe('Full')
    /* El full se arma con la tercia más alta y la otra de par. */
    expect(evaluar(siete)).toBe(evaluar(mano('9h 9s 9d 5c 5h')))
  })

  it('las categorías van en orden', () => {
    const escalera = [
      mano('Ah Js 7d 5c 2h'),
      mano('9h 9s 7d 5c 2h'),
      mano('9h 9s 5d 5c 2h'),
      mano('9h 9s 9d 5c 2h'),
      mano('9h 8s 7d 6c 5h'),
      mano('As Js 9s 5s 2s'),
      mano('9h 9s 9d 2c 2h'),
      mano('9h 9s 9d 9c 2h'),
      mano('As Ks Qs Js Ts'),
    ]
    for (let i = 1; i < escalera.length; i++) {
      expect(evaluar(escalera[i])).toBeGreaterThan(evaluar(escalera[i - 1]))
    }
  })

  it('a igual categoría mandan las cartas altas', () => {
    expect(evaluar(mano('Ah As Kd Qc 2h'))).toBeGreaterThan(evaluar(mano('Kh Ks Ad Qc 2h')))
    expect(evaluar(mano('Ah As Kd Qc 3h'))).toBeGreaterThan(evaluar(mano('Ah As Kd Qc 2h')))
  })

  it('dos manos iguales empatan aunque cambien de palo', () => {
    expect(evaluar(mano('Ah As Kd Qc 2h'))).toBe(evaluar(mano('Ad Ac Ks Qh 2d')))
  })
})

describe('con cuánta frecuencia ganas', () => {
  /* Semilla fija: la simulación es al azar, pero la prueba no puede serlo. */
  const corre = (mano_: string, mesa: string, rivales: number, iteraciones = 8000) =>
    simular({
      mano: mano(mano_),
      mesa: mesa ? mano(mesa) : [],
      rivales,
      iteraciones,
      azar: azarCon(1234),
    })

  it('los tres porcentajes suman cien', () => {
    const r = corre('Ah Ad', '', 3)
    expect(r.gano + r.empate + r.perdi).toBeCloseTo(100, 6)
  })

  it('con la mano imbatible nunca pierdes', () => {
    /* Escalera de color al as en la mesa: nadie puede más, y sólo se puede empatar. */
    const r = corre('As Ks', 'Qs Js Ts 2d 3c', 5)
    expect(r.perdi).toBe(0)
    expect(r.gano).toBeGreaterThan(99)
  })

  it('con la peor mano posible casi nunca ganas', () => {
    /* La mesa trae color al as: tus dos cartas no suman nada y cualquiera con una pica
       te gana. Lo normal es empatar con los que tampoco tienen pica. */
    const r = corre('2h 3d', 'As Ks Qs Js 9s', 5)
    expect(r.gano).toBe(0)
  })

  it('un par de ases le gana a la mesa mucho más que cualquier otra mano', () => {
    const ases = corre('Ah Ad', '', 1)
    const basura = corre('7h 2d', '', 1)
    expect(ases.gano).toBeGreaterThan(80)
    expect(ases.gano).toBeLessThan(90)
    expect(basura.gano).toBeLessThan(40)
  })

  it('la misma mano gana menos cuantos más rivales haya', () => {
    const uno = corre('Ah Ad', '', 1)
    const cinco = corre('Ah Ad', '', 5)
    expect(cinco.gano).toBeLessThan(uno.gano)
  })

  it('no reparte cartas que ya se ven', () => {
    /* Si repartiera repetidas, alguien podría tener el otro as de picas y empatar la
       escalera de color; con el mazo bien hecho eso no pasa nunca. */
    const r = corre('As Ks', 'Qs Js Ts 2d 3c', 9, 4000)
    expect(r.empate).toBe(0)
  })
})

describe('cómo se llama lo que traes', () => {
  it('con menos de cinco cartas todavía no se puede decir', () => {
    expect(nombreDeLaMano(mano('Ah Ad'), [])).toBe('')
    expect(nombreDeLaMano(mano('Ah Ad'), mano('2s 7d'))).toBe('')
  })

  it('con el flop ya dice qué es', () => {
    expect(nombreDeLaMano(mano('Ah Ad'), mano('As 7d 2c'))).toBe('Tercia')
  })
})

describe('las manos que ya se conocen', () => {
  const corre = (
    mano_: string,
    mesa: string,
    rivales: number,
    manosRivales: string[] = [],
    iteraciones = 8000,
  ) =>
    simular({
      mano: mano(mano_),
      mesa: mesa ? mano(mesa) : [],
      rivales,
      manosRivales: manosRivales.map(mano),
      iteraciones,
      azar: azarCon(7),
    })

  it('con todo sobre la mesa la respuesta es exacta, sin repartir nada', () => {
    /* Tercia de ases contra dos pares: ya está jugada, no hay nada que simular. */
    const r = corre('Ah Ad', 'As Kd 7c 3h 2s', 1, ['Kh 7s'])
    expect(r.gano).toBe(100)
    expect(r.manos).toBe(1)
  })

  it('y dice que pierdes cuando pierdes', () => {
    /* Color contra tercia: el color manda. */
    const r = corre('Ah Ad', '2s 7s 9s As Kd', 1, ['3s 4s'])
    expect(r.perdi).toBe(100)
  })

  it('reconoce el empate cuando la mesa juega para los dos', () => {
    const r = corre('2h 3d', 'As Ks Qs Js Ts', 1, ['4c 5d'])
    expect(r.empate).toBe(100)
  })

  it('saber la mano de uno cambia el pronóstico contra los demás', () => {
    /* Enfrente hay ases: tu par de reyes vale mucho menos de lo que valdría a ciegas. */
    const aCiegas = corre('Kh Kd', '', 1)
    const sabiendo = corre('Kh Kd', '', 1, ['As Ad'])
    expect(sabiendo.gano).toBeLessThan(aCiegas.gano)
    expect(sabiendo.gano).toBeGreaterThan(15)
    expect(sabiendo.gano).toBeLessThan(25)
  })

  it('se puede saber la de uno y no la de los otros', () => {
    const r = corre('Kh Kd', '', 3, ['As Ad'])
    expect(r.gano + r.empate + r.perdi).toBeCloseTo(100, 6)
    expect(r.manos).toBeGreaterThan(1)
  })

  it('las cartas de los rivales tampoco se reparten dos veces', () => {
    /* Si el as de picas de la escalera pudiera salirle a alguien más, habría empates. */
    const r = corre('As Ks', 'Qs Js Ts 2d 3c', 2, ['4h 5h'], 3000)
    expect(r.gano).toBe(100)
  })
})

describe('dónde te sientas', () => {
  it('el botón siempre es la mejor silla', () => {
    for (const n of [2, 4, 6, 9]) {
      const [primero] = asientosDe(n)
      expect(primero.marca).toBe('D')
      expect(primero.posicion).toBe('tardia')
    }
  })

  it('cara a cara el botón también pone la ciega chica', () => {
    const a = asientosDe(2)
    expect(a).toHaveLength(2)
    expect(a[0].nombre).toBe('Botón y ciega chica')
    expect(a[1].posicion).toBe('ciega')
  })

  it('en mesa normal las dos ciegas van después del botón', () => {
    const a = asientosDe(8)
    expect(a[1].marca).toBe('CCH')
    expect(a[2].marca).toBe('CG')
    expect(a[1].posicion).toBe('ciega')
    expect(a[2].posicion).toBe('ciega')
  })

  it('el de antes del botón juega en posición tardía', () => {
    const a = asientosDe(8)
    expect(a[a.length - 1].posicion).toBe('tardia')
  })

  it('hay un asiento por jugador y ninguno se repite', () => {
    for (const n of [2, 3, 5, 9]) {
      const a = asientosDe(n)
      expect(a).toHaveLength(n)
      expect(new Set(a.map((x) => x.indice)).size).toBe(n)
    }
  })

  it('entre más gente, más sillas de las malas', () => {
    const tempranas = (n: number) => asientosDe(n).filter((a) => a.posicion === 'temprana').length
    expect(tempranas(9)).toBeGreaterThan(tempranas(5))
  })
})

describe('qué tan factible es jugarla', () => {
  it('contra más gente, una misma mano vale más', () => {
    /* Ganar el 30% contra uno es malo; contra siete es excelente. */
    expect(bandaDeJugabilidad(30, 2, 'media').id).toBe('floja')
    expect(bandaDeJugabilidad(30, 8, 'media').id).toBe('fuerte')
  })

  it('desde posición temprana se le pide más a la misma mano', () => {
    const equidad = 30
    expect(bandaDeJugabilidad(equidad, 4, 'tardia').id).toBe('buena')
    expect(bandaDeJugabilidad(equidad, 4, 'temprana').id).toBe('limite')
  })

  it('por debajo de lo que te tocaría por reparto, siempre es para tirarla', () => {
    /* Con seis en la mesa lo justo es 16.7%: 12% está por debajo desde cualquier silla. */
    for (const p of ['temprana', 'media', 'tardia', 'ciega'] as const) {
      expect(bandaDeJugabilidad(12, 6, p).id).toBe('floja')
    }
    /* Y justo encima ya no: ahí empieza el "al límite". */
    expect(bandaDeJugabilidad(18, 6, 'tardia').id).toBe('limite')
  })

  it('cada banda trae el color con el que se pinta', () => {
    expect(bandaDeJugabilidad(90, 4, 'media').tono).toBe('win')
    expect(bandaDeJugabilidad(26, 4, 'media').tono).toBe('ambar')
    expect(bandaDeJugabilidad(10, 4, 'media').tono).toBe('loss')
  })
})

/*
 * Los porcentajes de los demás. Es la parte que se usa para repasar una mano después de
 * jugada: "con lo que yo traía y lo que traías tú, ¿quién iba ganando?".
 */
describe('cuánto gana cada quien', () => {
  it('reparte el 100% entre todos los de la mesa', () => {
    const s = simular({
      mano: mano('Ah Ad'),
      mesa: [],
      rivales: 3,
      iteraciones: 4000,
      azar: azarCon(7),
    })
    const suma = s.parte + s.porRival.reduce((a, r) => a + r.parte, 0)
    /* Cada bote se lo lleva alguien, y el que se parte se reparte: no se pierde nada. */
    expect(suma).toBeCloseTo(100, 6)
  })

  it('trae un número por rival, en su asiento', () => {
    const s = simular({
      mano: mano('7h 2d'),
      mesa: [],
      rivales: 5,
      iteraciones: 1000,
      azar: azarCon(1),
    })
    expect(s.porRival).toHaveLength(5)
  })

  it('al rival al que se le sabe la mano se le ve su número de verdad', () => {
    /* Yo con un par de reyes, el rival 1 con ases y el 2 a ciegas: el de los ases
       tiene que ir mejor que yo y yo mejor que el que no se sabe. */
    const s = simular({
      mano: mano('Kh Kd'),
      mesa: [],
      rivales: 2,
      manosRivales: [mano('As Ac'), []],
      iteraciones: 6000,
      azar: azarCon(3),
    })
    expect(equidadDe(s.porRival[0])).toBeGreaterThan(equidadDe(s))
    expect(equidadDe(s)).toBeGreaterThan(equidadDe(s.porRival[1]))
  })

  it('la mano sabida se queda en su asiento aunque las de antes no se sepan', () => {
    const s = simular({
      mano: mano('Kh Kd'),
      mesa: [],
      rivales: 3,
      /* Sólo se sabe la del tercero. */
      manosRivales: [[], [], mano('As Ac')],
      iteraciones: 6000,
      azar: azarCon(4),
    })
    expect(equidadDe(s.porRival[2])).toBeGreaterThan(equidadDe(s.porRival[0]))
    expect(equidadDe(s.porRival[2])).toBeGreaterThan(equidadDe(s.porRival[1]))
  })

  it('en una mano ya jugada no hay porcentajes: hay un ganador', () => {
    const s = simular({
      mano: mano('Ah Ad'),
      mesa: mano('As 7c 2d 9h 4s'),
      rivales: 1,
      manosRivales: [mano('Kh Kc')],
    })
    expect(s.gano).toBe(100)
    expect(s.porRival[0].perdi).toBe(100)
  })

  it('dos manos iguales empatan siempre, y cada uno se lleva medio bote', () => {
    /* La mesa es escalera de color y ninguno trae espadas: los dos juegan la mesa. */
    const s = simular({
      mano: mano('Kh Kd'),
      mesa: mano('9s 8s 7s 6s 5s'),
      rivales: 1,
      manosRivales: [mano('Qh Qd')],
    })
    expect(s.gano).toBe(0)
    expect(s.empate).toBe(100)
    expect(s.porRival[0].empate).toBe(100)
    expect(s.parte).toBe(50)
    expect(equidadDe(s)).toBe(50)
  })

  it('cara a cara, lo que yo pierdo es lo que gana el otro', () => {
    const s = simular({
      mano: mano('Ah Kh'),
      mesa: [],
      rivales: 1,
      manosRivales: [mano('7c 2d')],
      iteraciones: 3000,
      azar: azarCon(9),
    })
    expect(s.perdi).toBeCloseTo(s.porRival[0].gano, 6)
    expect(s.empate).toBeCloseTo(s.porRival[0].empate, 6)
    expect(s.gano + s.empate + s.perdi).toBeCloseTo(100, 6)
  })

  it('la equidad es la parte del bote que te toca', () => {
    expect(equidadDe({ gano: 40, empate: 20, perdi: 40, parte: 50 })).toBe(50)
  })
})

/*
 * Las cuentas de la apuesta. Lo que se fija son los casos de libro, los que cualquiera
 * de la mesa puede comprobar de cabeza.
 */
describe('si conviene pagar', () => {
  it('pagar un noveno del bote pide ganar una de cada diez', () => {
    const q = cuentasDeLaApuesta(20, 900, 100)!
    expect(q.necesitas).toBeCloseTo(10, 6)
    expect(q.conviene).toBe(true)
  })

  it('pagar lo que hay en el bote pide ganar la mitad', () => {
    const q = cuentasDeLaApuesta(50, 500, 500)!
    expect(q.necesitas).toBeCloseTo(50, 6)
    /* Justo en la raya: ni deja ni cuesta. */
    expect(q.esperado).toBeCloseTo(0, 6)
    expect(q.conviene).toBe(true)
  })

  it('con menos de lo que se necesita, no conviene', () => {
    const q = cuentasDeLaApuesta(20, 100, 100)!
    expect(q.necesitas).toBeCloseTo(50, 6)
    expect(q.conviene).toBe(false)
    expect(q.esperado).toBeLessThan(0)
  })

  it('lo que deja pagar es lo que ganas en promedio cada vez', () => {
    /* Ganas una de cada cuatro: te llevas $900 esa vez y pagas $100 las otras tres. */
    const q = cuentasDeLaApuesta(25, 900, 100)!
    expect(q.esperado).toBeCloseTo(0.25 * 900 - 0.75 * 100, 6)
    expect(q.esperado).toBeCloseTo(150, 6)
  })

  it('dice qué tan grande es la apuesta contra el bote', () => {
    expect(cuentasDeLaApuesta(50, 400, 200)!.parteDelBote).toBeCloseTo(0.5, 6)
  })

  it('sin bote o sin apuesta no hay nada que calcular', () => {
    expect(cuentasDeLaApuesta(50, 0, 100)).toBeNull()
    expect(cuentasDeLaApuesta(50, 500, 0)).toBeNull()
    expect(cuentasDeLaApuesta(50, 500, NaN)).toBeNull()
  })
})
