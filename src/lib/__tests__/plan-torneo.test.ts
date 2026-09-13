import { describe, expect, it } from 'vitest'
import { fichasPorPrecio, horaMas, minutosEntre, planFichas } from '../torneo'
import { computeDistribution } from '../distribution'

/* La caja de la liga: 200 de cada color. */
const CAJA = [
  { key: 'green', label: 'Verdes', color: '#1f8f4e', value: 25, inventory: 200 },
  { key: 'black', label: 'Negras', color: '#2b2b2b', value: 10, inventory: 200 },
  { key: 'red', label: 'Rojas', color: '#d0342c', value: 5, inventory: 200 },
  { key: 'blue', label: 'Azules', color: '#2563c9', value: 2, inventory: 200 },
  { key: 'white', label: 'Blancas', color: '#f2f2ea', value: 1, inventory: 200 },
]

const conCaja = (cuantas: number) => CAJA.map((c) => ({ ...c, inventory: cuantas }))

const peticion = (cambios: Partial<Parameters<typeof planFichas>[0]> = {}) =>
  planFichas({
    colores: CAJA,
    jugadores: 8,
    stack: 10000,
    fichasRecompra: 8000,
    fichasAddOn: 6000,
    recomprasEsperadas: 8,
    addOnsEsperados: 8,
    ...cambios,
  })

describe('cuántas fichas da lo que se paga', () => {
  it('la recompra y el add-on valen lo mismo por peso que la entrada', () => {
    // Lo que pidió Omar: $500 dan 1,000; entonces $400 dan 800 y $300 dan 600.
    expect(fichasPorPrecio(400, 500, 1000)).toBe(800)
    expect(fichasPorPrecio(300, 500, 1000)).toBe(600)
    expect(fichasPorPrecio(500, 500, 1000)).toBe(1000)
  })

  it('lo que no se cobra no da fichas', () => {
    expect(fichasPorPrecio(0, 500, 1000)).toBe(0)
  })

  it('redondea a algo que se pueda pagar con la ficha más chica', () => {
    // 333/500 de 10,000 son 6,660, que con fichas de 50 no se arma.
    expect(fichasPorPrecio(333, 500, 10000, 50) % 50).toBe(0)
  })
})

describe('el plan de fichas', () => {
  it('la ficha más chica paga la ciega chica del arranque', () => {
    // Cien ciegas grandes de profundidad: la chica es el stack entre doscientos.
    expect(peticion().fichaMasChica).toBe(50)
  })

  it('con la caja de la liga alcanza de sobra y no avisa nada', () => {
    const p = peticion()
    expect(p.puntosDisponibles).toBeGreaterThan(p.puntosNecesarios)
    expect(p.aviso).toBeNull()
  })

  it('cuenta las recompras y los add-ons esperados, no sólo los stacks', () => {
    const sin = peticion({ recomprasEsperadas: 0, addOnsEsperados: 0 })
    const con = peticion({ recomprasEsperadas: 20, addOnsEsperados: 20 })
    expect(con.puntosNecesarios).toBeGreaterThan(sin.puntosNecesarios)
  })

  it('sube el valor de la ficha cuando la caja no da para tanto', () => {
    /* Doce fichas por color contra ocho stacks de 10,000 más recompras: a la unidad
       cómoda no alcanzan, así que las fichas tienen que valer más. */
    const p = peticion({ colores: conCaja(12) })
    expect(p.fichaMasChica).toBeGreaterThan(50)
    expect(p.aviso).toMatch(/cien ciegas/)
  })

  it('avisa cuando no alcanza ni a una ficha de algún color por cabeza', () => {
    expect(peticion({ colores: conCaja(4) }).aviso).toMatch(/tantos jugadores/)
  })

  it('nunca deja valores en cero ni en NaN', () => {
    for (const v of Object.values(peticion({ colores: conCaja(0) }).valores)) {
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThan(0)
    }
  })
})

describe('el plan aguanta el reparto de verdad', () => {
  const reparteCon = (cuantas: number, jugadores: number, stack: number) => {
    const colores = conCaja(cuantas)
    const p = planFichas({
      colores,
      jugadores,
      stack,
      fichasRecompra: stack,
      fichasAddOn: stack,
      recomprasEsperadas: jugadores,
      addOnsEsperados: jugadores,
    })
    const mesa = colores.map((c) => ({ ...c, value: p.valores[c.key] }))
    return computeDistribution(
      Array.from({ length: jugadores }, (_, i) => ({
        id: String(i),
        name: `J${i}`,
        buyIn: stack,
        deal: null,
      })),
      mesa,
    )
  }

  it('con la caja de la liga todos arrancan parejos y sin pasarse del inventario', () => {
    const d = reparteCon(200, 8, 10000)
    expect(d.anyShortfall).toBe(false)
    expect(d.anyOver).toBe(false)
    for (const fila of d.rows) expect(fila.total).toBe(10000)
  })

  it('el tamaño del stack deja de importar: es el mismo reparto', () => {
    /* Las fichas son puntos, así que jugar a 10,000 o a 100,000 tiene que dar las mismas
       fichas físicas sobre la mesa; sólo cambia el número escrito en ellas. */
    const chico = reparteCon(200, 8, 10000)
    const grande = reparteCon(200, 8, 100000)
    expect(grande.rows[0].counts).toEqual(chico.rows[0].counts)
  })
})

describe('la hora de la pared', () => {
  it('de las ocho a la una son cinco horas, aunque cambie el día', () => {
    expect(minutosEntre('20:00', '01:00')).toBe(300)
    expect(minutosEntre('20:00', '23:30')).toBe(210)
  })

  it('sin horas válidas no inventa una duración', () => {
    expect(minutosEntre('', '01:00')).toBe(0)
  })

  it('dice a qué hora entra cada nivel', () => {
    expect(horaMas('20:00', 90)).toBe('21:30')
    expect(horaMas('23:30', 90)).toBe('01:00')
  })
})
