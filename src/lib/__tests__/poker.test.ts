import { describe, expect, it } from 'vitest'
import {
  CATEGORIAS,
  azarCon,
  carta,
  categoriaDe,
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
