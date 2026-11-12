import { describe, expect, it } from 'vitest'
import {
  CONSIDERACIONES,
  PUNTOS_CONTRA_LA_MESA,
  PUNTOS_DEL_REGLAMENTO,
  PUNTOS_POR_DEFECTO,
  cualesCuentan,
  cupoDeNoches,
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

/*
 * La otra forma de puntuar: una tabla fija por lugar. Es la que usa el reglamento de la
 * liga y la que usan casi todas las ligas de casa.
 */
describe('la tabla por lugar', () => {
  it('paga lo que dice la tabla y nada del sexto en adelante', () => {
    const e: EsquemaPuntos = { reglas: [], tabla: [25, 20, 15, 10, 5] }
    expect(puntosDeLaNoche(noche(1, 8), e)).toBe(25)
    expect(puntosDeLaNoche(noche(5, 8), e)).toBe(5)
    expect(puntosDeLaNoche(noche(6, 8), e)).toBe(0)
    expect(puntosDeLaNoche(noche(8, 8), e)).toBe(0)
  })

  it('el reglamento de la liga: asistencia, bono y lugar', () => {
    const e = PUNTOS_DEL_REGLAMENTO
    /* Ganas dinero y quedas 1º: 5 de asistencia + 5 de bono + 25 de posición. */
    expect(puntosDeLaNoche(noche(1, 8, { resultado: 900 }), e)).toBe(35)
    /* Pierdes pero quedas 5º: 5 + 0 + 5. */
    expect(puntosDeLaNoche(noche(5, 8, { resultado: -300 }), e)).toBe(10)
    /* Del sexto en adelante sólo quedan los cinco por venir. */
    expect(puntosDeLaNoche(noche(7, 8, { resultado: -500 }), e)).toBe(5)
  })

  it('la tabla y las consideraciones pueden convivir', () => {
    const e: EsquemaPuntos = { reglas: [{ id: 'base', puntos: 5 }], tabla: [25, 20] }
    expect(puntosDeLaNoche(noche(1, 6), e)).toBe(30)
    expect(puntosDeLaNoche(noche(3, 6), e)).toBe(5)
  })

  it('una tabla vacía no se guarda como si existiera', () => {
    const e = esquemaDePuntos(JSON.stringify({ reglas: [{ id: 'base', puntos: 1 }], tabla: [] }))
    expect(e.tabla).toBeUndefined()
  })

  it('la tabla guardada se limpia como todo lo demás', () => {
    const e = esquemaDePuntos(JSON.stringify({ reglas: [], tabla: [25, 'veinte', null, 99999] }))
    expect(e.tabla).toEqual([25, 0, 0, 999])
  })
})

/*
 * Los dos arreglos que pidió la liga después de ver la temporada: que el dinero cuente
 * completo —y no sólo si saliste ganando— y que para coronarse haya que haber venido.
 */
describe('cuando el dinero cuenta completo', () => {
  it('ganar más paga más', () => {
    const e = con({ porCadaCien: 1 })
    expect(puntosDeLaNoche(noche(1, 8, { resultado: 1200 }), e)).toBe(12)
    expect(puntosDeLaNoche(noche(1, 8, { resultado: 100 }), e)).toBe(1)
  })

  it('perder poco duele menos que perder mucho', () => {
    /* Era el defecto de fondo: con el bono de "salir ganando", perder $38 y perder
       $1,245 daban exactamente lo mismo. */
    const e = con({ porCadaCienPerdido: -1 })
    expect(puntosDeLaNoche(noche(6, 8, { resultado: -300 }), e)).toBeGreaterThan(
      puntosDeLaNoche(noche(8, 8, { resultado: -1200 }), e),
    )
  })

  it('lo que se lleva no castiga y lo que se deja no premia', () => {
    const e = con({ porCadaCien: 1, porCadaCienPerdido: -1 })
    expect(puntosDeLaNoche(noche(1, 8, { resultado: 500 }), e)).toBe(5)
    expect(puntosDeLaNoche(noche(8, 8, { resultado: -500 }), e)).toBe(-5)
    expect(puntosDeLaNoche(noche(4, 8, { resultado: 0 }), e)).toBe(0)
  })

  it('los centavos sueltos no suman: se cobra por cada cien completos', () => {
    const e = con({ porCadaCien: 1 })
    expect(puntosDeLaNoche(noche(1, 8, { resultado: 99 }), e)).toBe(0)
    expect(puntosDeLaNoche(noche(1, 8, { resultado: 199 }), e)).toBe(1)
  })
})

describe('el mínimo de asistencia para el podio', () => {
  it('se guarda con el resto del esquema', () => {
    const e = esquemaDePuntos(JSON.stringify({ reglas: [{ id: 'base', puntos: 1 }], minimoPodio: 50 }))
    expect(e.minimoPodio).toBe(50)
  })

  it('en cero es como si no estuviera', () => {
    const e = esquemaDePuntos(JSON.stringify({ reglas: [], minimoPodio: 0 }))
    expect(e.minimoPodio).toBeUndefined()
  })

  it('es un por ciento: no se sale de 0 a 100', () => {
    const arriba = esquemaDePuntos(JSON.stringify({ reglas: [], minimoPodio: 900 }))
    expect(arriba.minimoPodio).toBe(100)
    const abajo = esquemaDePuntos(JSON.stringify({ reglas: [], minimoPodio: -40 }))
    expect(abajo.minimoPodio).toBeUndefined()
    const basura = esquemaDePuntos(JSON.stringify({ reglas: [], minimoPodio: 'la mitad' }))
    expect(basura.minimoPodio).toBeUndefined()
  })

  it('no cambia lo que suma una noche', () => {
    /* Es una regla del podio, no de los puntos: nadie deja de sumar por faltar. */
    const sin: EsquemaPuntos = { reglas: [{ id: 'base', puntos: 5 }] }
    const con: EsquemaPuntos = { reglas: [{ id: 'base', puntos: 5 }], minimoPodio: 50 }
    expect(puntosDeLaNoche(noche(3, 8), con)).toBe(puntosDeLaNoche(noche(3, 8), sin))
  })
})

describe('el tope de los puntos por dinero', () => {
  it('recorta la noche grande sin tocar las chicas', () => {
    const e: EsquemaPuntos = { reglas: [{ id: 'porCadaCien', puntos: 1 }], topeDinero: 5 }
    expect(puntosDeLaNoche(noche(1, 8, { resultado: 1200 }), e)).toBe(5)
    expect(puntosDeLaNoche(noche(1, 8, { resultado: 300 }), e)).toBe(3)
    expect(puntosDeLaNoche(noche(1, 8, { resultado: 38 }), e)).toBe(0)
  })

  it('también por abajo: perder mucho tiene piso', () => {
    const e: EsquemaPuntos = { reglas: [{ id: 'porCadaCienPerdido', puntos: -1 }], topeDinero: 5 }
    expect(puntosDeLaNoche(noche(8, 8, { resultado: -1245 }), e)).toBe(-5)
    expect(puntosDeLaNoche(noche(8, 8, { resultado: -300 }), e)).toBe(-3)
    expect(puntosDeLaNoche(noche(8, 8, { resultado: -38 }), e)).toBe(0)
  })

  it('el tope es de las dos juntas, no de cada una', () => {
    const e: EsquemaPuntos = {
      reglas: [
        { id: 'porCadaCien', puntos: 1 },
        { id: 'porCadaCienPerdido', puntos: -1 },
      ],
      topeDinero: 5,
    }
    expect(puntosDeLaNoche(noche(1, 8, { resultado: 2000 }), e)).toBe(5)
    expect(puntosDeLaNoche(noche(8, 8, { resultado: -2000 }), e)).toBe(-5)
  })

  it('no toca lo que no es dinero', () => {
    /* Un tope de 2 no puede recortar los puntos de ganar la noche. */
    const e: EsquemaPuntos = {
      reglas: [
        { id: 'base', puntos: 5 },
        { id: 'bonoGanar', puntos: 10 },
        { id: 'porCadaCien', puntos: 1 },
      ],
      topeDinero: 2,
    }
    expect(puntosDeLaNoche(noche(1, 8, { resultado: 900 }), e)).toBe(5 + 10 + 2)
  })

  it('en cero no hay tope', () => {
    const e: EsquemaPuntos = { reglas: [{ id: 'porCadaCien', puntos: 1 }], topeDinero: 0 }
    expect(puntosDeLaNoche(noche(1, 8, { resultado: 1200 }), e)).toBe(12)
  })

  it('se guarda y se limpia como todo lo demás', () => {
    expect(esquemaDePuntos(JSON.stringify({ reglas: [], topeDinero: 5 })).topeDinero).toBe(5)
    expect(esquemaDePuntos(JSON.stringify({ reglas: [], topeDinero: 0 })).topeDinero).toBeUndefined()
    expect(esquemaDePuntos(JSON.stringify({ reglas: [], topeDinero: -3 })).topeDinero).toBeUndefined()
    expect(
      esquemaDePuntos(JSON.stringify({ reglas: [], topeDinero: 'mucho' })).topeDinero,
    ).toBeUndefined()
  })
})

describe('las mejores noches', () => {
  /** Una noche de alguien, con lo que hace falta para repartir el descarte. */
  const n = (indice: number, puntos: number, resultado = 0) => ({ indice, puntos, resultado })

  it('el cupo es el por ciento de las noches de la liga, redondeando hacia arriba', () => {
    expect(cupoDeNoches(7, 80)).toBe(6) // 5.6 → 6
    expect(cupoDeNoches(10, 80)).toBe(8)
    expect(cupoDeNoches(7, 50)).toBe(4) // 3.5 → 4
  })

  it('en 0 y en 100 cuentan todas', () => {
    expect(cupoDeNoches(7, 0)).toBe(0)
    expect(cupoDeNoches(7, 100)).toBe(0)
  })

  it('nunca deja a nadie sin una sola noche', () => {
    /* Un por ciento chiquito en una temporada corta daría cero, y la tabla entera
       quedaría en ceros. */
    expect(cupoDeNoches(2, 10)).toBe(1)
  })

  it('se queda con las mejores y tira la peor', () => {
    const cuentan = cualesCuentan([n(0, 10), n(1, 2), n(2, 8), n(3, 7)], 3)
    expect([...cuentan].sort()).toEqual([0, 2, 3])
  })

  it('al que faltó no le quita nada', () => {
    /* Vino tres veces en una temporada de siete: el cupo es seis y no le sobra
       ninguna. El descarte sólo le pega a los que vienen mucho. */
    const cuentan = cualesCuentan([n(0, 4), n(1, 1), n(2, 9)], cupoDeNoches(7, 80))
    expect(cuentan.size).toBe(3)
  })

  it('empatados a puntos, se queda el de mejor saldo', () => {
    const cuentan = cualesCuentan([n(0, 5, -300), n(1, 5, 900), n(2, 9, 0)], 2)
    expect([...cuentan].sort()).toEqual([1, 2])
  })

  it('empatados en todo, se queda la más vieja', () => {
    /* No es que una valga más: es que el número no puede cambiar solo entre dos
       visitas a la misma pantalla. */
    const cuentan = cualesCuentan([n(5, 5, 100), n(2, 5, 100), n(9, 5, 100)], 2)
    expect([...cuentan].sort((a, b) => a - b)).toEqual([2, 5])
  })

  it('sin cupo cuentan todas', () => {
    const cuentan = cualesCuentan([n(0, 10), n(1, 2), n(2, 8)], 0)
    expect(cuentan.size).toBe(3)
  })

  it('se guarda, y en 100 es como si no estuviera', () => {
    expect(esquemaDePuntos(JSON.stringify({ reglas: [], mejoresNoches: 80 })).mejoresNoches).toBe(80)
    expect(
      esquemaDePuntos(JSON.stringify({ reglas: [], mejoresNoches: 100 })).mejoresNoches,
    ).toBeUndefined()
    expect(
      esquemaDePuntos(JSON.stringify({ reglas: [], mejoresNoches: 0 })).mejoresNoches,
    ).toBeUndefined()
    expect(
      esquemaDePuntos(JSON.stringify({ reglas: [], mejoresNoches: 900 })).mejoresNoches,
    ).toBeUndefined()
  })

  it('no cambia lo que vale una noche suelta', () => {
    /* El descarte se reparte al armar la temporada, no al contar la noche. */
    const sin: EsquemaPuntos = { reglas: [{ id: 'base', puntos: 5 }] }
    const con: EsquemaPuntos = { reglas: [{ id: 'base', puntos: 5 }], mejoresNoches: 80 }
    expect(puntosDeLaNoche(noche(3, 8), con)).toBe(puntosDeLaNoche(noche(3, 8), sin))
  })
})

describe('las ligas que ya existen', () => {
  it('un guardado sin los campos nuevos puntúa exactamente igual que antes', () => {
    /* Es la prueba que de verdad importa: nadie debe despertar con otra tabla. */
    const viejo = esquemaDePuntos(
      JSON.stringify({
        reglas: [
          { id: 'base', puntos: 5 },
          { id: 'bonoPositivo', puntos: 5 },
        ],
        tabla: [25, 20, 15, 10, 5],
      }),
    )
    expect(viejo.topeDinero).toBeUndefined()
    expect(viejo.mejoresNoches).toBeUndefined()
    expect(viejo.minimoPodio).toBeUndefined()

    for (let mesa = 2; mesa <= 10; mesa++) {
      for (let lugar = 1; lugar <= mesa; lugar++) {
        for (const resultado of [-1200, -38, 0, 38, 1200]) {
          expect(puntosDeLaNoche(noche(lugar, mesa, { resultado }), viejo)).toBe(
            puntosDeLaNoche(noche(lugar, mesa, { resultado }), PUNTOS_DEL_REGLAMENTO),
          )
        }
      }
    }
  })

  it('y los de siempre siguen dando lo de siempre', () => {
    expect(puntosDeLaNoche(noche(1, 8), PUNTOS_POR_DEFECTO)).toBe(8)
    expect(puntosDeLaNoche(noche(8, 8), PUNTOS_POR_DEFECTO)).toBe(1)
  })
})

describe('contra la mesa', () => {
  it('no paga un solo punto por dinero', () => {
    const conFeria = puntosDeLaNoche(noche(3, 8, { resultado: 5000 }), PUNTOS_CONTRA_LA_MESA)
    const conPoco = puntosDeLaNoche(noche(3, 8, { resultado: 1 }), PUNTOS_CONTRA_LA_MESA)
    expect(conFeria).toBe(conPoco)
  })

  it('pero sí distingue salir arriba de salir abajo', () => {
    expect(puntosDeLaNoche(noche(3, 8, { resultado: 100 }), PUNTOS_CONTRA_LA_MESA)).toBe(
      puntosDeLaNoche(noche(3, 8, { resultado: -100 }), PUNTOS_CONTRA_LA_MESA) + 2,
    )
  })

  it('ganarle a siete vale más que ganarle a tres', () => {
    expect(puntosDeLaNoche(noche(1, 8, { resultado: 100 }), PUNTOS_CONTRA_LA_MESA)).toBe(
      3 + 7 + 3 + 2,
    )
    expect(puntosDeLaNoche(noche(1, 4, { resultado: 100 }), PUNTOS_CONTRA_LA_MESA)).toBe(
      3 + 3 + 3 + 2,
    )
  })

  it('trae el descarte y el mínimo del podio puestos, y ninguna tabla fija', () => {
    expect(PUNTOS_CONTRA_LA_MESA.mejoresNoches).toBe(80)
    expect(PUNTOS_CONTRA_LA_MESA.minimoPodio).toBe(50)
    expect(PUNTOS_CONTRA_LA_MESA.tabla).toBeUndefined()
    expect(PUNTOS_CONTRA_LA_MESA.topeDinero).toBeUndefined()
  })
})
