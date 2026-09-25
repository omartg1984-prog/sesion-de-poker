import type { ConfigTorneo } from './api'
import type { DatosTabla } from './imagenTablas'
import { money, num } from './money'

/*
 * De qué consta un torneo, dicho para alguien que todavía no se apunta.
 *
 * El que abre el link del grupo no ha visto la pantalla de armado ni sabe qué es un
 * add-on. Lo que necesita antes de decir que sí es: cuánto me cuesta, cuántas fichas me
 * dan, hasta cuándo puedo comprar y cómo se reparte el dinero al final.
 *
 * Vive aparte de la pantalla porque son cuentas, no dibujo, y porque las mismas líneas
 * sirven para la invitación y para el resumen que se manda al chat.
 */

export interface CompraDelTorneo {
  /** 'Entrada', 'Recompra', 'Add-on'. */
  que: string
  dinero: number
  fichas: number
  /** Cuántas se permiten, ya dicho en palabras. '' en la entrada. */
  cuantas: string
  /** Hasta cuándo se puede comprar, ya dicho en palabras. */
  hasta: string
}

export interface PremioDelTorneo {
  lugar: number
  pct: number
}

export interface ResumenTorneo {
  compras: CompraDelTorneo[]
  premios: PremioDelTorneo[]
  /** Lo que se le cobra a cada quien de cena y no se reparte. 0 = no hay. */
  cenaPorPersona: number
  /** Lo que junta la mesa si se apuntan todos los que hay, sin recompras. */
  bolsaMinima: number
}

/** Las fichas de una compra. Los torneos viejos no las traen y ahí manda el stack. */
const fichasDe = (fichas: unknown, stack: number) => num(fichas) || stack

/** 'el primer descanso', 'el segundo descanso'… Como se dice, no como se numera. */
export function nombreDelDescanso(n: number): string {
  const ordinales = ['primer', 'segundo', 'tercer', 'cuarto', 'quinto']
  const o = ordinales[n - 1]
  return o ? `el ${o} descanso` : `el descanso ${n}`
}

/** 'sin límite', 'una sola', 'máximo 3'. El género lo pone quien llama. */
const cuantasSePueden = (tope: unknown, una: string) => {
  const n = Math.max(0, Math.floor(num(tope)))
  if (n <= 0) return 'sin límite'
  return n === 1 ? una : `máximo ${n}`
}

const hastaCuando = (descanso: unknown) => {
  const n = Math.max(0, Math.floor(num(descanso)))
  return n > 0 ? `hasta ${nombreDelDescanso(n)}` : 'toda la noche'
}

export function resumenDeTorneo(t: ConfigTorneo, apuntados = 0): ResumenTorneo {
  const stack = num(t.stack) || num(t.buyIn)

  const compras: CompraDelTorneo[] = [
    { que: 'Entrada', dinero: num(t.buyIn), fichas: stack, cuantas: '', hasta: '' },
  ]
  if (num(t.rebuyPrice) > 0)
    compras.push({
      que: 'Recompra',
      dinero: num(t.rebuyPrice),
      fichas: fichasDe(t.rebuyChips, stack),
      cuantas: cuantasSePueden(t.recomprasMax, 'una sola'),
      hasta: hastaCuando(t.recomprasHastaDescanso),
    })
  if (num(t.addOnPrice) > 0)
    compras.push({
      que: 'Add-on',
      dinero: num(t.addOnPrice),
      fichas: fichasDe(t.addOnChips, stack),
      cuantas: cuantasSePueden(t.addOnsMax, 'uno solo'),
      hasta: hastaCuando(t.addOnsHastaDescanso),
    })

  /* Sólo los lugares que de verdad cobran: un 0% en la lista es ruido. */
  const premios = t.payouts
    .map((x, i) => ({ lugar: i + 1, pct: num(x.pct) }))
    .filter((x) => x.pct > 0)

  return {
    compras,
    premios,
    cenaPorPersona: Math.max(0, num(t.cenaPorPersona)),
    bolsaMinima: num(t.buyIn) * Math.max(0, Math.floor(apuntados)),
  }
}

/**
 * Las reglas del torneo como imagen, para tirarlas en el chat del grupo.
 *
 * El link sirve para apuntarse, pero no todo el mundo lo abre y no siempre se quiere
 * que lo abran: a veces sólo hace falta que quede escrito de qué se trata la noche.
 * Esta tabla dice lo mismo que la invitación, sin link y sin que nadie tenga que
 * entrar a nada.
 */
export function tablaDeReglas(
  t: ConfigTorneo,
  datos: { titulo: string; liga: string; foto?: string | null },
): DatosTabla {
  const { compras, premios, cenaPorPersona } = resumenDeTorneo(t)
  const miles = (n: number) => Math.round(n).toLocaleString('es-MX')

  const filas = compras.map((c) => [
    c.que,
    money(c.dinero),
    [`${miles(c.fichas)} fichas`, c.cuantas, c.hasta].filter(Boolean).join(' · '),
  ])

  if (cenaPorPersona > 0)
    filas.push(['Cena', money(cenaPorPersona), 'por persona, sale de la bolsa'])

  /* "Lugar 1" y no "1º": la tipografía del título no trae la o volada y sale un cero. */
  for (const pr of premios)
    filas.push([`Lugar ${pr.lugar}`, `${pr.pct}%`, 'de la bolsa a repartir'])

  const horas = [
    t.horaInicio && `Empieza ${t.horaInicio}`,
    t.horaFin && `termina cerca de ${t.horaFin}`,
  ].filter(Boolean)

  return {
    tipo: 'tabla',
    titulo: 'Reglas del torneo',
    subtitulo: datos.titulo,
    gorro: datos.liga,
    columnas: ['Qué', 'Cuánto', 'Detalle'],
    filas,
    fondo: datos.foto ?? null,
    pie: horas.join(' · ') || 'La bolsa sube con cada recompra',
  }
}
