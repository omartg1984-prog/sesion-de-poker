import { describe, expect, it } from 'vitest'
import { puntosDeLaNoche } from '../posiciones'

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
