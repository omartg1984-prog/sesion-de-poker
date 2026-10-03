import { describe, expect, it } from 'vitest'
import {
  CONSIDERACIONES,
  PUNTOS_POR_DEFECTO,
  esquemaDePuntos,
  puntosDeLaNoche,
  type EsquemaPuntos,
} from '../posiciones'

/*
 * El campeonato reparte "un punto por cada jugador al que le ganaste, más uno por
 * presentarte". Lo que se fija aquí no es la fórmula sino lo que debe cumplir, que es
 * lo que se rompería sin querer al cambiarla.
 */

/** Una noche cualquiera, con lo mínimo para puntuar. */
const noche = (lugar: number, deCuantos: number, extra: { resultado?: number; recompras?: number } = {}) => ({
  lugar,
  deCuantos,
  resultado: extra.resultado ?? 0,
  recompras: extra.recompras ?? 0,
})

const con = (reglas: Record<string, number>): EsquemaPuntos => ({
  reglas: Object.entries(reglas).map(([id, puntos]) => ({ id, puntos })),
})

describe('puntos de campeonato', () => {
  it('el que gana se lleva tantos puntos como jugadores había', () => {
    expect(puntosDeLaNoche(noche(1, 8))).toBe(8)
    expect(puntosDeLaNoche(noche(1, 4))).toBe(4)
  })

  it('el último siempre se lleva uno, por presentarse', () => {
    for (const mesa of [2, 3, 5, 9]) {
      expect(puntosDeLaNoche(noche(mesa, mesa))).toBe(1)
    }
  })

  it('nunca reparte cero: venir siempre suma algo', () => {
    for (let mesa = 1; mesa <= 12; mesa++) {
      for (let lugar = 1; lugar <= mesa; lugar++) {
        expect(puntosDeLaNoche(noche(lugar, mesa))).toBeGreaterThan(0)
      }
    }
  })

  it('ganar una mesa grande vale más que ganar una chica', () => {
    // Es la razón de no usar una tabla fija de puntos por lugar.
    expect(puntosDeLaNoche(noche(1, 8))).toBeGreaterThan(puntosDeLaNoche(noche(1, 4)))
  })

  it('quedar mejor nunca da menos puntos', () => {
    for (let lugar = 1; lugar < 8; lugar++) {
      expect(puntosDeLaNoche(noche(lugar, 8))).toBeGreaterThan(puntosDeLaNoche(noche(lugar + 1, 8)))
    }
  })

  it('una noche reparte siempre el mismo total, sin importar quién ganó', () => {
    const total = (mesa: number) =>
      Array.from({ length: mesa }, (_, i) => puntosDeLaNoche(noche(i + 1, mesa))).reduce(
        (a, b) => a + b,
        0,
      )
    expect(total(8)).toBe(36)
    expect(total(4)).toBe(10)
  })
})

/*
 * Las consideraciones que puede encender o apagar cada casa. Lo que se fija es que los
 * números de siempre sigan dando lo de siempre y que lo guardado no rompa la tabla.
 */
describe('cuando la liga cambia las consideraciones', () => {
  it('sin nada guardado puntúa como toda la vida', () => {
    expect(esquemaDePuntos(null)).toEqual(PUNTOS_POR_DEFECTO)
    expect(puntosDeLaNoche(noche(1, 8), esquemaDePuntos(null))).toBe(8)
  })

  it('el bono de ganar sólo le toca al primero', () => {
    const e = con({ base: 1, porJugador: 1, bonoGanar: 5 })
    expect(puntosDeLaNoche(noche(1, 8), e)).toBe(13)
    expect(puntosDeLaNoche(noche(2, 8), e)).toBe(7)
  })

  it('el bono de podio no se da en mesas de tres', () => {
    const e = con({ base: 1, porJugador: 1, bonoPodio: 3 })
    expect(puntosDeLaNoche(noche(3, 8), e)).toBe(6 + 3)
    expect(puntosDeLaNoche(noche(3, 3), e)).toBe(1)
  })

  it('se puede premiar salir ganando, que no es lo mismo que quedar bien', () => {
    const e = con({ base: 1, porJugador: 1, bonoPositivo: 4 })
    expect(puntosDeLaNoche(noche(3, 6, { resultado: 200 }), e)).toBe(4 + 4)
    expect(puntosDeLaNoche(noche(3, 6, { resultado: -200 }), e)).toBe(4)
  })

  it('y se puede castigar: las consideraciones también restan', () => {
    const e = con({ base: 1, porJugador: 1, porRecompra: -2 })
    expect(puntosDeLaNoche(noche(2, 6, { recompras: 3 }), e)).toBe(5 - 6)
  })

  it('aguantar sin recomprar paga, recomprar una vez ya no', () => {
    const e = con({ base: 1, sinRecompras: 3 })
    expect(puntosDeLaNoche(noche(4, 6), e)).toBe(4)
    expect(puntosDeLaNoche(noche(4, 6, { recompras: 1 }), e)).toBe(1)
  })

  it('quitar todas las consideraciones deja a todos en cero, no rompe nada', () => {
    const e: EsquemaPuntos = { reglas: [] }
    for (let l = 1; l <= 8; l++) expect(puntosDeLaNoche(noche(l, 8), e)).toBe(0)
  })

  it('subir lo que vale asistir le da la vuelta al que viene siempre', () => {
    const normal = esquemaDePuntos(null)
    const fiel = con({ base: 5, porJugador: 1 })
    /* Diez noches quedando último contra dos noches ganando, en mesas de seis. */
    const vieneSiempre = (e: EsquemaPuntos) => 10 * puntosDeLaNoche(noche(6, 6), e)
    const vieneYGana = (e: EsquemaPuntos) => 2 * puntosDeLaNoche(noche(1, 6), e)

    /* Con los puntos de siempre mandan las dos victorias, y está bien que así sea. */
    expect(vieneSiempre(normal)).toBeLessThan(vieneYGana(normal))
    /* Subiendo lo que paga presentarse, la constancia se impone. Para eso se edita. */
    expect(vieneSiempre(fiel)).toBeGreaterThan(vieneYGana(fiel))
  })
})

describe('lo que se lee de la base', () => {
  it('un guardado con basura cae a los números de siempre', () => {
    expect(esquemaDePuntos('no es json')).toEqual(PUNTOS_POR_DEFECTO)
    expect(esquemaDePuntos(JSON.stringify({ reglas: 'no es lista' }))).toEqual(PUNTOS_POR_DEFECTO)
  })

  it('ignora consideraciones que no existen y valores que no son números', () => {
    const e = esquemaDePuntos(
      JSON.stringify({
        reglas: [
          { id: 'base', puntos: 2 },
          { id: 'inventada', puntos: 50 },
          { id: 'porJugador', puntos: null },
        ],
      }),
    )
    expect(e.reglas).toEqual([{ id: 'base', puntos: 2 }])
  })

  it('no deja la misma consideración dos veces', () => {
    const e = esquemaDePuntos(
      JSON.stringify({ reglas: [{ id: 'base', puntos: 2 }, { id: 'base', puntos: 9 }] }),
    )
    expect(e.reglas).toEqual([{ id: 'base', puntos: 2 }])
  })

  it('una lista vacía es una decisión, no un error', () => {
    expect(esquemaDePuntos(JSON.stringify({ reglas: [] }))).toEqual({ reglas: [] })
  })

  it('no acepta números disparatados', () => {
    const e = esquemaDePuntos(JSON.stringify({ reglas: [{ id: 'base', puntos: 99999 }] }))
    expect(e.reglas[0].puntos).toBe(999)
  })

  it('entiende las ligas guardadas con la forma vieja', () => {
    /* Antes era { base, porJugador, bonoGanar, bonoPodio } y hubo ligas así. */
    const e = esquemaDePuntos(
      JSON.stringify({ base: 1, porJugador: 1, bonoGanar: 5, bonoPodio: 0 }),
    )
    expect(puntosDeLaNoche(noche(1, 8), e)).toBe(13)
    /* El que valía cero no se arrastra como consideración encendida. */
    expect(e.reglas.some((r) => r.id === 'bonoPodio')).toBe(false)
  })
})

describe('el catálogo', () => {
  it('no repite identificadores', () => {
    expect(new Set(CONSIDERACIONES.map((c) => c.id)).size).toBe(CONSIDERACIONES.length)
  })

  it('las de siempre siguen en el catálogo', () => {
    for (const id of PUNTOS_POR_DEFECTO.reglas.map((r) => r.id)) {
      expect(CONSIDERACIONES.some((c) => c.id === id)).toBe(true)
    }
  })

  it('las que restan vienen sugeridas en negativo', () => {
    for (const c of CONSIDERACIONES.filter((x) => x.castigo)) {
      expect(c.sugerido).toBeLessThan(0)
    }
  })
})
