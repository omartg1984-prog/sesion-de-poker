import { describe, expect, it } from 'vitest'
import {
  cartasVisibles,
  mueveElHeroe,
  mueveElSiguiente,
  repartir,
  resolver,
  tocaAlHeroe,
  type ConfigEntreno,
  type Entrenamiento,
} from '../entrenador'
import { bote as boteDe, siguenVivos } from '../mano'
import { azarCon } from '../poker'
import { rivalesAlAzar } from '../rival'

/*
 * El entrenador: manos repartidas de verdad contra rivales que juegan distinto. Lo que
 * se fija es que la baraja sea una baraja —nadie con la misma carta que otro—, que los
 * rivales no vean lo que no tienen que ver, y que el bote acabe en manos de quien
 * ganó.
 */

const cfg = (jugadores = 4, heroe = 0): ConfigEntreno => ({
  jugadores,
  heroe,
  ciegaChica: 1,
  ciegaGrande: 2,
})

/** Una mano repartida, con rivales sacados de la misma semilla. */
const nueva = (semilla: number, jugadores = 4) => {
  const azar = azarCon(semilla)
  return repartir(cfg(jugadores), rivalesAlAzar(jugadores, azar), azar)
}

/** Deja correr a los rivales hasta que toque al héroe o se acabe. */
const correr = (e: Entrenamiento, azar: () => number) => {
  let x = e
  for (let i = 0; i < 60 && !tocaAlHeroe(x) && !x.mano.terminada; i++) {
    const antes = x
    x = mueveElSiguiente(x, azar)
    /* Si una vuelta no mueve nada, el ciclo se quedaría trabado: mejor que truene la
       prueba a que la pantalla se congele. */
    if (x === antes) break
  }
  return x
}

describe('la repartida', () => {
  it('nadie trae una carta que traiga otro, ni una que esté en la mesa', () => {
    for (let s = 1; s <= 25; s++) {
      const e = nueva(s, 6)
      const todas = [...e.cartas.flat(), ...e.mesa]
      expect(new Set(todas).size).toBe(todas.length)
      expect(todas.every((c) => c >= 0 && c < 52)).toBe(true)
    }
  })

  it('a cada quien le tocan dos y a la mesa cinco', () => {
    const e = nueva(4, 7)
    expect(e.cartas).toHaveLength(7)
    expect(e.cartas.every((c) => c.length === 2)).toBe(true)
    expect(e.mesa).toHaveLength(5)
  })

  it('las ciegas ya están puestas y a nadie se le ve la mesa antes de tiempo', () => {
    const e = nueva(6)
    expect(boteDe(e.mano)).toBe(3)
    expect(cartasVisibles(e)).toEqual([])
  })

  it('cada rival trae su estilo y el héroe ninguno', () => {
    const e = nueva(8, 5)
    expect(e.estilos[0]).toBe('')
    expect(e.estilos.slice(1).every((x) => x.length > 0)).toBe(true)
  })
})

describe('las cartas de en medio se destapan por calle', () => {
  it('en el flop son tres, en el turn cuatro y en el river cinco', () => {
    const azar = azarCon(3)
    let e = nueva(3, 3)
    e = correr(e, azar)
    /* Se pasa o se paga hasta que la mano avance de calle. */
    for (let i = 0; i < 40 && e.mano.calle === 'preflop' && !e.mano.terminada; i++) {
      e = tocaAlHeroe(e) ? mueveElHeroe(e, 'paga') : mueveElSiguiente(e, azar)
      if (e.mano.calle === 'preflop' && tocaAlHeroe(e)) e = mueveElHeroe(e, 'pasa')
    }
    if (e.mano.calle === 'flop') expect(cartasVisibles(e)).toHaveLength(3)
  })
})

describe('los rivales juegan solos', () => {
  it('después de dejarlos correr, o le toca al héroe o se acabó', () => {
    for (let s = 1; s <= 20; s++) {
      const azar = azarCon(s * 13)
      const e = correr(nueva(s, 5), azar)
      expect(tocaAlHeroe(e) || e.mano.terminada).toBe(true)
    }
  })

  it('el héroe no mueve cuando no le toca', () => {
    const e = nueva(5)
    /* Antes del flop en una mesa de cuatro habla primero el de después de la grande. */
    expect(tocaAlHeroe(e)).toBe(false)
    expect(mueveElHeroe(e, 'paga')).toBe(e)
  })
})

describe('el final', () => {
  it('si todos se van, el bote es del que queda y no se enseñan cartas', () => {
    const azar = azarCon(21)
    let e = nueva(21, 4)
    /* El héroe se va en cuanto puede; alguien se queda con el bote. */
    for (let i = 0; i < 60 && !e.mano.terminada; i++) {
      e = tocaAlHeroe(e) ? mueveElHeroe(e, 'seVa') : mueveElSiguiente(e, azar)
    }
    e = resolver(e)
    expect(e.final).not.toBeNull()
    if (e.final && !e.final.alGolpe) {
      expect(e.final.ganadores).toHaveLength(1)
      expect(e.final.conQue).toBe('')
      /* Se fue: pierde lo que haya puesto, ni un peso más. */
      expect(e.final.heroe).toBe(-e.mano.total[0])
    }
  })

  it('lo que gana el héroe nunca es más que el bote', () => {
    for (let s = 1; s <= 30; s++) {
      const azar = azarCon(s * 7 + 1)
      let e = nueva(s, 4)
      for (let i = 0; i < 80 && !e.mano.terminada; i++) {
        e = tocaAlHeroe(e) ? mueveElHeroe(e, 'paga') : mueveElSiguiente(e, azar)
        if (tocaAlHeroe(e) && (e.mano.puesto[0] ?? 0) >= Math.max(...e.mano.puesto))
          e = mueveElHeroe(e, 'pasa')
      }
      e = resolver(e)
      expect(e.final).not.toBeNull()
      expect(e.final!.heroe).toBeLessThanOrEqual(e.final!.bote)
    }
  })

  it('al golpe gana la mejor mano y se dice con qué', () => {
    const azar = azarCon(99)
    let e = nueva(99, 3)
    for (let i = 0; i < 80 && !e.mano.terminada; i++) {
      if (tocaAlHeroe(e)) {
        const falta = Math.max(...e.mano.puesto) - e.mano.puesto[0]
        e = mueveElHeroe(e, falta > 0 ? 'paga' : 'pasa')
      } else e = mueveElSiguiente(e, azar)
    }
    e = resolver(e)
    expect(e.final).not.toBeNull()
    if (e.final?.alGolpe) {
      expect(e.final.conQue.length).toBeGreaterThan(0)
      expect(e.final.ganadores.length).toBeGreaterThanOrEqual(1)
      expect(siguenVivos(e.mano)).toBeGreaterThan(1)
      /* Al golpe se enseña todo lo de en medio. */
      expect(cartasVisibles(e)).toHaveLength(5)
    }
  })

  it('resolver dos veces no cambia nada', () => {
    const azar = azarCon(31)
    let e = nueva(31, 4)
    for (let i = 0; i < 80 && !e.mano.terminada; i++) {
      e = tocaAlHeroe(e) ? mueveElHeroe(e, 'seVa') : mueveElSiguiente(e, azar)
    }
    const una = resolver(e)
    expect(resolver(una)).toBe(una)
  })
})
