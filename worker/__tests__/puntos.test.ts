import { describe, expect, it } from 'vitest'
import {
  esquemaDePuntos,
  PESOS_POR_PUNTO,
  PESOS_SUGERIDOS,
  puedeSubir,
  puntosDeLaNoche,
  puntosDeLaTemporada,
  PUNTOS_POR_DEFECTO,
  vencidosEn,
  type EsquemaPuntos,
} from '../posiciones'

/*
 * El campeonato de la liga, en una sola cuenta:
 *
 *     puntos = saldo de la temporada ÷ lo que vale un punto + a cuántos les ganaste
 *
 * Lo que se prueba aquí es sobre todo lo que la mesa va a discutir: que la cuenta dé
 * exactamente lo que se acordó, que el dinero entre una sola vez —sobre el saldo del
 * semestre y no noche por noche— y que mover lo que vale el punto haga lo que promete.
 */

/** Lo que vale un punto, dicho corto. */
const a = (pesosPorPunto: number, minimoNoches = 0): EsquemaPuntos => ({
  pesosPorPunto,
  minimoNoches,
})

const CIEN = a(100)

describe('la fórmula, como se acordó', () => {
  /* Los cuatro casos que se pusieron por escrito antes de tocar el código. */
  it('ocho noches, +$2,000 y 48 vencidos son 68 puntos', () => {
    expect(puntosDeLaTemporada(2000, 48, CIEN)).toBe(68)
  })

  it('una sola noche, +$1,500 y 13 vencidos son 28', () => {
    expect(puntosDeLaTemporada(1500, 13, CIEN)).toBe(28)
  })

  it('tres noches, +$600 y 18 vencidos son 24', () => {
    expect(puntosDeLaTemporada(600, 18, CIEN)).toBe(24)
  })

  it('el saldo en contra resta: −$900 con 30 vencidos son 21', () => {
    expect(puntosDeLaTemporada(-900, 30, CIEN)).toBe(21)
  })

  it('sin nada guardado el punto cuesta cien y el podio está abierto', () => {
    expect(PUNTOS_POR_DEFECTO).toEqual({ pesosPorPunto: PESOS_POR_PUNTO, minimoNoches: 0 })
    expect(PESOS_POR_PUNTO).toBe(100)
    expect(PESOS_SUGERIDOS).toContain(100)
  })
})

describe('los vencidos', () => {
  it('son los que quedaron abajo, no el lugar', () => {
    /* Sexto en una mesa de quince: nueve abajo. */
    expect(vencidosEn({ lugar: 6, deCuantos: 15 })).toBe(9)
  })

  it('el que gana le gana a todos los demás', () => {
    expect(vencidosEn({ lugar: 1, deCuantos: 8 })).toBe(7)
  })

  it('el último no le gana a nadie', () => {
    expect(vencidosEn({ lugar: 8, deCuantos: 8 })).toBe(0)
    expect(vencidosEn({ lugar: 1, deCuantos: 1 })).toBe(0)
  })

  it('la mesa grande vale más: ganar entre quince no es ganar entre cuatro', () => {
    expect(vencidosEn({ lugar: 1, deCuantos: 15 })).toBeGreaterThan(
      vencidosEn({ lugar: 1, deCuantos: 4 }),
    )
  })

  it('quedar mejor nunca da menos', () => {
    for (let lugar = 1; lugar < 10; lugar++) {
      expect(vencidosEn({ lugar, deCuantos: 10 })).toBeGreaterThanOrEqual(
        vencidosEn({ lugar: lugar + 1, deCuantos: 10 }),
      )
    }
  })

  it('un lugar imposible no da puntos negativos', () => {
    expect(vencidosEn({ lugar: 12, deCuantos: 8 })).toBe(0)
  })
})

describe('lo que aporta una noche', () => {
  it('es a cuántos les ganó más lo que se llevó', () => {
    /* Quinto de diez —cinco abajo— y +$340 en la bolsa, a cien el punto. */
    expect(puntosDeLaNoche({ lugar: 5, deCuantos: 10, resultado: 340 }, CIEN)).toBeCloseTo(8.4, 9)
  })

  it('no se redondea: el entero se saca una sola vez, al final', () => {
    expect(puntosDeLaNoche({ lugar: 3, deCuantos: 4, resultado: 150 }, CIEN)).toBeCloseTo(2.5, 9)
  })

  it('perder resta aunque haya quedado arriba de alguien', () => {
    expect(puntosDeLaNoche({ lugar: 7, deCuantos: 10, resultado: -800 }, CIEN)).toBeCloseTo(-5, 9)
  })

  it('sin esquema usa los cien de siempre', () => {
    expect(puntosDeLaNoche({ lugar: 1, deCuantos: 5, resultado: 500 })).toBeCloseTo(9, 9)
  })
})

describe('el dinero entra una sola vez, sobre el saldo del semestre', () => {
  it('la noche del palazo no vale cincuenta puntos sueltos', () => {
    /* Ganar cinco mil un viernes y dejar cuatro mil el siguiente es ir +$1,000: diez
       puntos del dinero, no cincuenta de una noche. */
    expect(puntosDeLaTemporada(5000 - 4000, 0, CIEN)).toBe(10)
  })

  it('el redondeo al final no infla la cuenta', () => {
    /* Dos noches de +$150 son tres puntos. Redondeando cada una serían cuatro, y así se
       le regalaba un punto a quien partiera su dinero en más noches. */
    expect(puntosDeLaTemporada(300, 0, CIEN)).toBe(3)
  })

  it('el medio punto se va para arriba, también en contra', () => {
    expect(puntosDeLaTemporada(250, 0, CIEN)).toBe(3)
    expect(puntosDeLaTemporada(-250, 0, CIEN)).toBe(-2)
  })

  it('los pesos sueltos cuentan: no hace falta completar cien', () => {
    expect(puntosDeLaTemporada(60, 10, CIEN)).toBe(11)
    expect(puntosDeLaTemporada(40, 10, CIEN)).toBe(10)
  })

  it('sin saldo y sin vencidos nadie suma', () => {
    expect(puntosDeLaTemporada(0, 0, CIEN)).toBe(0)
  })
})

describe('lo que vale un punto', () => {
  it('a cincuenta el dinero pesa el doble', () => {
    expect(puntosDeLaTemporada(2000, 40, a(50))).toBe(80)
    expect(puntosDeLaTemporada(2000, 40, a(100))).toBe(60)
    expect(puntosDeLaTemporada(2000, 40, a(200))).toBe(50)
  })

  it('le da la vuelta a la temporada', () => {
    /* El que no se pierde una y acaba tablas contra el que vino tres veces y arrasó: con
       el punto barato gana la caja, con el punto caro gana la constancia. */
    const fiel = { saldo: -200, vencidos: 40 }
    const palazo = { saldo: 2400, vencidos: 18 }
    const con = (p: number, q: { saldo: number; vencidos: number }) =>
      puntosDeLaTemporada(q.saldo, q.vencidos, a(p))

    expect(con(50, palazo)).toBeGreaterThan(con(50, fiel))
    expect(con(200, fiel)).toBeGreaterThan(con(200, palazo))
  })

  it('los vencidos no se mueven con la perilla', () => {
    expect(puntosDeLaTemporada(0, 33, a(50))).toBe(33)
    expect(puntosDeLaTemporada(0, 33, a(100))).toBe(33)
    expect(puntosDeLaTemporada(0, 33, a(5000))).toBe(33)
  })

  it('un cero guardado no revienta la cuenta: vale como los cien de siempre', () => {
    expect(puntosDeLaTemporada(500, 5, a(0))).toBe(puntosDeLaTemporada(500, 5, CIEN))
  })
})

describe('lo que se lee de la base', () => {
  it('sin nada guardado, cien el punto y sin mínimo', () => {
    expect(esquemaDePuntos(null)).toEqual(PUNTOS_POR_DEFECTO)
    expect(esquemaDePuntos('')).toEqual(PUNTOS_POR_DEFECTO)
    expect(esquemaDePuntos('{')).toEqual(PUNTOS_POR_DEFECTO)
    expect(esquemaDePuntos('[]')).toEqual(PUNTOS_POR_DEFECTO)
  })

  it('lee las dos cosas que la casa puede mover', () => {
    expect(esquemaDePuntos(JSON.stringify({ pesosPorPunto: 50, minimoNoches: 4 }))).toEqual({
      pesosPorPunto: 50,
      minimoNoches: 4,
    })
  })

  it('lo que no es número no cuenta como cero', () => {
    expect(esquemaDePuntos(JSON.stringify({ pesosPorPunto: 'cien', minimoNoches: null }))).toEqual(
      PUNTOS_POR_DEFECTO,
    )
  })

  it('un punto en cero o en negativo cae a los cien', () => {
    expect(esquemaDePuntos(JSON.stringify({ pesosPorPunto: 0 })).pesosPorPunto).toBe(100)
    expect(esquemaDePuntos(JSON.stringify({ pesosPorPunto: -200 })).pesosPorPunto).toBe(100)
  })

  it('no acepta números disparatados', () => {
    expect(esquemaDePuntos(JSON.stringify({ pesosPorPunto: 1e12 })).pesosPorPunto).toBe(100000)
    expect(esquemaDePuntos(JSON.stringify({ minimoNoches: 5000 })).minimoNoches).toBe(999)
    expect(esquemaDePuntos(JSON.stringify({ minimoNoches: -3 })).minimoNoches).toBe(0)
  })

  it('redondea a números enteros', () => {
    expect(esquemaDePuntos(JSON.stringify({ pesosPorPunto: 99.6 })).pesosPorPunto).toBe(100)
    expect(esquemaDePuntos(JSON.stringify({ minimoNoches: 3.4 })).minimoNoches).toBe(3)
  })

  it('la configuración vieja se ignora y la liga pasa a la fórmula', () => {
    /* Las ligas guardadas con el catálogo de consideraciones —tabla por lugar, tope del
       dinero, descarte de noches— ya no puntúan con eso. Es a propósito: esa mezcla era
       justo lo que había que quitar. */
    const vieja = JSON.stringify({
      reglas: [
        { id: 'base', puntos: 5 },
        { id: 'bonoPositivo', puntos: 5 },
      ],
      tabla: [25, 20, 15, 10, 5],
      topeDinero: 12,
      mejoresNoches: 80,
      minimoPodio: 50,
    })
    expect(esquemaDePuntos(vieja)).toEqual(PUNTOS_POR_DEFECTO)
  })

  it('una liga vieja que sí pedía noches mínimas las conserva', () => {
    expect(esquemaDePuntos(JSON.stringify({ reglas: [], minimoNoches: 4 }))).toEqual({
      pesosPorPunto: 100,
      minimoNoches: 4,
    })
  })

  it('lo que se guarda se vuelve a leer igual', () => {
    const puesto = a(200, 5)
    expect(esquemaDePuntos(JSON.stringify(puesto))).toEqual(puesto)
  })
})

describe('quién puede subir al podio', () => {
  it('sin mínimo, todos pueden', () => {
    expect(puedeSubir({ partidas: 1 }, a(100, 0))).toBe(true)
  })

  it('con cuatro de mínimo, el que vino a tres no se corona', () => {
    expect(puedeSubir({ partidas: 4 }, a(100, 4))).toBe(true)
    expect(puedeSubir({ partidas: 3 }, a(100, 4))).toBe(false)
  })

  it('se cuenta en noches y no en por ciento: no se mueve si la temporada se alarga', () => {
    /* Cuatro noches alcanzan en una temporada de siete y también en una de veinte: es lo
       que se dice en la mesa y no cambia solo en diciembre. */
    expect(puedeSubir({ partidas: 4 }, a(100, 4))).toBe(true)
  })

  it('no cambia lo que suma nadie', () => {
    expect(puntosDeLaTemporada(900, 20, a(100, 6))).toBe(puntosDeLaTemporada(900, 20, a(100, 0)))
  })
})
