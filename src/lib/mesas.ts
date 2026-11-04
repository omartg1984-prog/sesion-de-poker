import { RELOJ_PARADO, segundosCorridos, type RelojTorneo } from './torneo'
import { num } from './money'

/*
 * El sorteo de mesas de una noche de cash.
 *
 * Cuando llegan diez o doce no caben en una mesa y la noche se parte en dos. Partirla a
 * ojo siempre sale mal de la misma manera: los cuatro que mejor juegan acaban juntos,
 * y en la otra mesa se aburren. Y a media noche pasa lo contrario con el dinero —una
 * mesa con todas las torres y otra con los cortitos—, que es cuando conviene revolver.
 *
 * Por eso el sorteo mira dos cosas distintas según el momento:
 *
 *  1. Al arrancar, cómo juega cada quien. Sale del Nivel de la tabla de la liga —los
 *     puntos por noche—, que es lo único que compara a alguien que viene siempre con
 *     alguien que viene poco. El que todavía no tiene noches contadas entra como
 *     término medio y el reparto lo separa de los otros nuevos solo.
 *
 *  2. A media noche, además, cuánto trae enfrente cada quien. No tiene que cuadrar al
 *     peso: lo que arruina una mesa es que de un lado haya el triple que del otro, no
 *     que falten doscientos.
 *
 * Nada de esto es exacto ni pretende serlo: es un sorteo, y dos sorteos seguidos con la
 * misma gente dan mesas distintas. Lo que hace es evitar los repartos malos, no elegir
 * uno perfecto.
 */

/** Un jugador tal como entra al sorteo. */
export interface JugadorParaSortear {
  /** El del usuario, no el de la participación: es lo que se guarda en la partida. */
  id: string
  nombre: string
  /** Cómo juega, medido con el Nivel de la liga. null = todavía no se sabe. */
  nivel: number | null
  /** Lo que trae enfrente, en pesos. null = no se ha contado. */
  dinero: number | null
}

/** Cómo quedó repartida la noche. Es lo que se guarda en la partida, tal cual. */
export interface Mesas {
  /** Los ids de los jugadores de cada mesa. Vacío = no se ha sorteado. */
  mesas: string[][]
  /** Qué sorteo va: 1 es el del arranque, 2 el primer cambio de mesa. */
  ronda: number
  /** Cuándo se hizo el último sorteo. */
  sorteadoEn: string | null
  /** Si el último sorteo tomó en cuenta el dinero de cada quien. */
  conDinero: boolean
  /** Lo último que se le contó a cada quien, en pesos, por id de usuario. */
  dinero: Record<string, number>
  /** Cada cuántos minutos toca cambiar de mesa. */
  minutos: number
  /** El reloj de ese cambio: se reinicia en cada sorteo. */
  reloj: RelojTorneo
}

/** Cada cuánto se cambia de mesa si nadie dice otra cosa. */
export const MINUTOS_POR_DEFECTO = 45

/** Los ratos de siempre, para no teclear el número. */
export const MINUTOS_SUGERIDOS = [30, 45, 60, 90]

/**
 * De cuántos jugadores para arriba tiene sentido ofrecer el sorteo.
 *
 * Hasta ocho se juega en una mesa y el sorteo no pinta nada; de ahí para arriba empieza
 * a estorbar el codo del de al lado. No es una regla de la casa, es desde dónde se
 * enseña el botón: la noche de seis no tiene por qué cargar con una pestaña que no va
 * a usar.
 */
export const MINIMO_PARA_MESAS = 8

export const mesasVacias = (): Mesas => ({
  mesas: [],
  ronda: 0,
  sorteadoEn: null,
  conDinero: false,
  dinero: {},
  minutos: MINUTOS_POR_DEFECTO,
  reloj: RELOJ_PARADO,
})

/** En cuántas mesas se parte una noche de tanta gente, si nadie elige otra cosa. */
export function cuantasMesasSugeridas(jugadores: number): number {
  if (jugadores >= 19) return 3
  if (jugadores >= MINIMO_PARA_MESAS) return 2
  return 1
}

/** Hasta cuántas mesas se puede partir sin dejar una de dos. */
export const maximoDeMesas = (jugadores: number) => Math.max(1, Math.floor(jugadores / 3))

/*
 * Cuántos se sientan en cada mesa.
 *
 * Lo más parejo posible y los que sobran repartidos de uno en uno: con once y dos mesas
 * salen seis y cinco, nunca siete y cuatro.
 */
export function tamanosDeMesa(jugadores: number, cuantas: number): number[] {
  const mesas = Math.max(1, Math.min(Math.floor(cuantas), Math.max(1, jugadores)))
  const base = Math.floor(jugadores / mesas)
  const sobran = jugadores % mesas
  return Array.from({ length: mesas }, (_, i) => base + (i < sobran ? 1 : 0))
}

/*
 * El nivel de cada quien llevado a una escala de 0 a 1.
 *
 * Los puntos por noche de una liga pueden ir de 3 a 9 y los de otra de 10 a 40; lo que
 * importa no es el número sino qué tan arriba está dentro de su propia liga. Al que no
 * tiene noches contadas se le pone en medio: no es un halago ni un castigo, es que no
 * sabemos, y en medio es donde menos daño hace equivocarse.
 */
function fuerzasDe(jugadores: JugadorParaSortear[]): number[] {
  const conocidos = jugadores
    .map((j) => j.nivel)
    .filter((v): v is number => v !== null && Number.isFinite(v))
  if (conocidos.length === 0) return jugadores.map(() => 0.5)
  const min = Math.min(...conocidos)
  const max = Math.max(...conocidos)
  const tramo = max - min
  return jugadores.map((j) =>
    j.nivel === null || !Number.isFinite(j.nivel) || tramo <= 0 ? 0.5 : (j.nivel - min) / tramo,
  )
}

/* El dinero pesa más que el nivel cuando hay dinero contado: una mesa con el doble de
   fichas se nota en la primera mano, y que el nivel quede un poco disparejo no. */
const PESO_NIVEL = 1
const PESO_DINERO = 2
/*
 * Y los nuevos, repartidos.
 *
 * Como el que no tiene noches cuenta como término medio, al sorteo le da igual
 * juntarlos: los números salen parejos de todas formas. Pero una mesa con los cuatro
 * que llegaron hoy y otra con los veteranos no es lo que pidió nadie. Pesa poquito a
 * propósito: desempata entre repartos parecidos, no manda sobre el nivel ni el dinero.
 */
const PESO_NUEVOS = 0.03

/** Cuántos repartos al azar se prueban antes de quedarse con el mejor. */
const INTENTOS = 8
/** Cuántas veces se intenta mejorar un reparto cambiando a dos de mesa. */
const PASOS_DE_MEJORA = 60

/**
 * Reparte a la gente en mesas, lo más parejas que se pueda.
 *
 * El azar es de verdad: dos sorteos seguidos con los mismos jugadores dan repartos
 * distintos. Lo que hace la función es tirar varios repartos al azar, medir qué tan
 * disparejo queda cada uno y quedarse con el menos malo, moviendo a dos de mesa
 * mientras eso mejore la cosa.
 */
export function sortearMesas(
  jugadores: JugadorParaSortear[],
  cuantas: number,
  azar: () => number = Math.random,
): string[][] {
  const n = jugadores.length
  if (n === 0) return []
  const tamanos = tamanosDeMesa(n, cuantas)
  const mesas = tamanos.length
  if (mesas <= 1) return [jugadores.map((j) => j.id)]

  const fuerza = fuerzasDe(jugadores)
  const nuevo = jugadores.map((j) => (j.nivel === null || !Number.isFinite(j.nivel) ? 1 : 0))
  const dinero = jugadores.map((j) => Math.max(0, num(j.dinero)))
  const hayDinero = jugadores.some((j) => j.dinero !== null && num(j.dinero) > 0)
  const dineroMedio = hayDinero ? dinero.reduce((a, b) => a + b, 0) / n : 0

  /*
   * Qué tan disparejo quedó un reparto. Cero es parejo y más es peor.
   *
   * Se mide por promedio y no por total: con seis en una mesa y cinco en la otra, que
   * las dos junten lo mismo dejaría a los cinco jugando más profundo. Lo que se siente
   * sentado es cuánto trae el de al lado, no cuánto hay en la mesa.
   */
  const desbalance = (dondeVa: number[]): number => {
    const sumaFuerza = new Array(mesas).fill(0)
    const sumaDinero = new Array(mesas).fill(0)
    const sumaNuevos = new Array(mesas).fill(0)
    const cuantos = new Array(mesas).fill(0)
    for (let i = 0; i < n; i++) {
      const m = dondeVa[i]
      sumaFuerza[m] += fuerza[i]
      sumaDinero[m] += dinero[i]
      sumaNuevos[m] += nuevo[i]
      cuantos[m]++
    }
    const medias = (suma: number[]) => suma.map((s, m) => (cuantos[m] > 0 ? s / cuantos[m] : 0))
    const abanico = (v: number[]) => Math.max(...v) - Math.min(...v)
    const porNivel = abanico(medias(sumaFuerza))
    const porDinero = hayDinero && dineroMedio > 0 ? abanico(medias(sumaDinero)) / dineroMedio : 0
    return (
      porNivel * PESO_NIVEL + porDinero * PESO_DINERO + abanico(sumaNuevos) * PESO_NUEVOS
    )
  }

  /** Un reparto al azar que respeta cuántos caben en cada mesa. */
  const alAzar = (): number[] => {
    const sillas: number[] = []
    tamanos.forEach((cuantos, m) => {
      for (let i = 0; i < cuantos; i++) sillas.push(m)
    })
    /* Fisher-Yates: baraja las sillas, no a la gente, y así los tamaños se respetan
       solos. */
    for (let i = sillas.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1))
      ;[sillas[i], sillas[j]] = [sillas[j], sillas[i]]
    }
    return sillas
  }

  let mejorReparto: number[] | null = null
  let mejorCosto = Infinity

  for (let intento = 0; intento < INTENTOS; intento++) {
    let dondeVa = alAzar()
    let costo = desbalance(dondeVa)

    /* Y de ahí se afina cambiando de mesa a dos jugadores a la vez: se prueban todas
       las parejas y se hace el cambio que más mejore, hasta que ninguno mejore. */
    for (let paso = 0; paso < PASOS_DE_MEJORA; paso++) {
      let mejorCambio: { costo: number; reparto: number[] } | null = null
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
          if (dondeVa[a] === dondeVa[b]) continue
          const prueba = dondeVa.slice()
          prueba[a] = dondeVa[b]
          prueba[b] = dondeVa[a]
          const c = desbalance(prueba)
          if (c < costo - 1e-9 && (!mejorCambio || c < mejorCambio.costo))
            mejorCambio = { costo: c, reparto: prueba }
        }
      }
      if (!mejorCambio) break
      dondeVa = mejorCambio.reparto
      costo = mejorCambio.costo
    }

    if (costo < mejorCosto - 1e-9) {
      mejorCosto = costo
      mejorReparto = dondeVa
    }
  }

  const salida: string[][] = Array.from({ length: mesas }, () => [])
  jugadores.forEach((j, i) => salida[mejorReparto![i]].push(j.id))
  return salida
}

/** Cómo quedó cada mesa, para enseñarlo. */
export interface ResumenMesa {
  jugadores: JugadorParaSortear[]
  /** Lo que juntan los que sí se contaron. */
  dinero: number
  /** Cuánto trae en promedio el de esa mesa, de los contados. */
  dineroPorCabeza: number
  /** El nivel medio de los que tienen noches contadas. null = ninguno. */
  nivel: number | null
  /** Cuántos entraron sin nivel conocido. */
  nuevos: number
}

export function resumenDeMesas(
  mesas: string[][],
  jugadores: JugadorParaSortear[],
): ResumenMesa[] {
  const porId = new Map(jugadores.map((j) => [j.id, j]))
  return mesas.map((ids) => {
    /* Los que ya no están —se fueron, los quitaron de la partida— no se inventan: la
       mesa se enseña con los que quedan. */
    const suyos = ids.map((id) => porId.get(id)).filter((j): j is JugadorParaSortear => !!j)
    const conNivel = suyos.filter((j) => j.nivel !== null && Number.isFinite(j.nivel))
    const contados = suyos.filter((j) => j.dinero !== null)
    const dinero = contados.reduce((a, j) => a + num(j.dinero), 0)
    return {
      jugadores: suyos,
      dinero,
      dineroPorCabeza: contados.length > 0 ? dinero / contados.length : 0,
      nivel:
        conNivel.length > 0
          ? conNivel.reduce((a, j) => a + (j.nivel as number), 0) / conNivel.length
          : null,
      nuevos: suyos.length - conNivel.length,
    }
  })
}

/** Quién quedó fuera del último sorteo: llegó tarde, o lo metieron después. */
export function sinMesa(mesas: string[][], jugadores: JugadorParaSortear[]) {
  const repartidos = new Set(mesas.flat())
  return jugadores.filter((j) => !repartidos.has(j.id))
}

/** Segundos que faltan para el cambio de mesa. Negativo = ya se pasó. */
export const faltaParaElCambio = (m: Mesas, ahora = Date.now()) =>
  m.minutos * 60 - segundosCorridos(m.reloj, ahora)

/** Si ya tocaba cambiar. Con el reloj parado no toca nada: nadie lo arrancó. */
export const tocaCambiar = (m: Mesas, ahora = Date.now()) =>
  m.reloj.corriendo && faltaParaElCambio(m, ahora) <= 0

/*
 * El nivel de cada quien, sacado de la tabla de la liga.
 *
 * Con una sola noche contada no se mide a nadie: una noche buena de un principiante lo
 * pondría de tiburón y acabaría cargando a su mesa. Esos entran como nuevos, que es lo
 * que son.
 */
export const NOCHES_PARA_TENER_NIVEL = 2

export function nivelesDeLaLiga(
  posiciones: { usuarioId: string; puntosPorNoche: number; partidas: number }[],
  minimo = NOCHES_PARA_TENER_NIVEL,
): Record<string, number> {
  const salida: Record<string, number> = {}
  for (const p of posiciones) {
    if (p.partidas >= minimo && Number.isFinite(p.puntosPorNoche))
      salida[p.usuarioId] = p.puntosPorNoche
  }
  return salida
}
