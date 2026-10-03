import { describe, expect, it } from 'vitest'
import { PUNTOS_POR_DEFECTO, esquemaDePuntos, puntosDeLaNoche } from '../posiciones'

/*
 * El campeonato reparte "un punto por cada jugador al que le ganaste, más uno por
 * presentarte". Lo que se fija aquí no es la fórmula sino lo que debe cumplir, que es
 * lo que se rompería sin querer al cambiarla.
 */
describe('puntos de campeonato', () => {
  it('el que gana se lleva tantos puntos como jugadores había', () => {
    expect(puntosDeLaNoche(1, 8)).toBe(8)
    expect(puntosDeLaNoche(1, 4)).toBe(4)
  })

  it('el último siempre se lleva uno, por presentarse', () => {
    for (const mesa of [2, 3, 5, 9]) {
      expect(puntosDeLaNoche(mesa, mesa)).toBe(1)
    }
  })

  it('nunca reparte cero: venir siempre suma algo', () => {
    for (let mesa = 1; mesa <= 12; mesa++) {
      for (let lugar = 1; lugar <= mesa; lugar++) {
        expect(puntosDeLaNoche(lugar, mesa)).toBeGreaterThan(0)
      }
    }
  })

  it('ganar una mesa grande vale más que ganar una chica', () => {
    // Es la razón de no usar una tabla fija de puntos por lugar.
    expect(puntosDeLaNoche(1, 8)).toBeGreaterThan(puntosDeLaNoche(1, 4))
  })

  it('quedar mejor nunca da menos puntos', () => {
    for (let lugar = 1; lugar < 8; lugar++) {
      expect(puntosDeLaNoche(lugar, 8)).toBeGreaterThan(puntosDeLaNoche(lugar + 1, 8))
    }
  })

  it('una noche reparte siempre el mismo total, sin importar quién ganó', () => {
    // Así ninguna noche pesa más que otra por cómo se acomodó la mesa.
    const total = (mesa: number) =>
      Array.from({ length: mesa }, (_, i) => puntosDeLaNoche(i + 1, mesa)).reduce((a, b) => a + b)
    expect(total(5)).toBe(15)
    expect(total(8)).toBe(36)
  })
})

/*
 * El esquema que puede cambiar cada casa. Lo que se fija aquí es que los números de
 * siempre sigan dando lo de siempre y que lo guardado no pueda romper la tabla.
 */
describe('cuando la liga cambia la fórmula', () => {
  it('sin nada guardado puntúa como toda la vida', () => {
    expect(esquemaDePuntos(null)).toEqual(PUNTOS_POR_DEFECTO)
    expect(puntosDeLaNoche(1, 8, esquemaDePuntos(null))).toBe(8)
  })

  it('el bono de ganar sólo le toca al primero', () => {
    const e = esquemaDePuntos(JSON.stringify({ bonoGanar: 5 }))
    expect(puntosDeLaNoche(1, 8, e)).toBe(13)
    expect(puntosDeLaNoche(2, 8, e)).toBe(7)
  })

  it('el bono de podio no se da en mesas de tres', () => {
    const e = esquemaDePuntos(JSON.stringify({ bonoPodio: 3 }))
    expect(puntosDeLaNoche(3, 8, e)).toBe(6 + 3)
    expect(puntosDeLaNoche(3, 3, e)).toBe(1)
  })

  it('subir lo que vale asistir le da la vuelta al que viene siempre', () => {
    const normal = esquemaDePuntos(null)
    const fiel = esquemaDePuntos(JSON.stringify({ base: 5 }))
    /* Diez noches quedando último contra dos noches ganando, en mesas de seis. */
    const vieneSiempre = (e: typeof normal) => 10 * puntosDeLaNoche(6, 6, e)
    const vieneYGana = (e: typeof normal) => 2 * puntosDeLaNoche(1, 6, e)

    /* Con los puntos de siempre mandan las dos victorias, y está bien que así sea. */
    expect(vieneSiempre(normal)).toBeLessThan(vieneYGana(normal))
    /* Subiendo lo que paga presentarse, la constancia se impone. Para eso se edita. */
    expect(vieneSiempre(fiel)).toBeGreaterThan(vieneYGana(fiel))
  })

  it('poner todo en cero deja a todos iguales, no rompe nada', () => {
    const e = esquemaDePuntos(JSON.stringify({ base: 0, porJugador: 0 }))
    for (let l = 1; l <= 8; l++) expect(puntosDeLaNoche(l, 8, e)).toBe(0)
  })

  it('un guardado con basura cae a los números de siempre', () => {
    expect(esquemaDePuntos('no es json')).toEqual(PUNTOS_POR_DEFECTO)
    expect(esquemaDePuntos(JSON.stringify({ base: 'diez', porJugador: null }))).toEqual(
      PUNTOS_POR_DEFECTO,
    )
  })

  it('no acepta números imposibles: ni negativos ni disparatados', () => {
    const e = esquemaDePuntos(JSON.stringify({ base: -5, porJugador: 99999 }))
    expect(e.base).toBe(0)
    expect(e.porJugador).toBe(999)
  })
})
