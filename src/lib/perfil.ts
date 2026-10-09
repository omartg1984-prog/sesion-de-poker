/*
 * Lo que se te ve jugando, mano tras mano.
 *
 * Una mano no dice nada: se gana con basura y se pierde con ases. Lo que sí dice algo es
 * lo que haces una y otra vez —a cuántas entras, a cuántas deberías haber entrado,
 * cuántas tiras bien— y eso sólo se ve después de un rato.
 *
 * Los números son de uno mismo y de nadie más. Los de la máquina no sirven para nada:
 * no está aprendiendo.
 */

export interface Tanteo {
  /** Manos repartidas. */
  manos: number
  /** En cuántas puso dinero por gusto antes del flop, sin contar las ciegas. */
  entro: number
  /** En cuántas las cuentas decían que entrar salía a cuentas. */
  debioEntrar: number
  /** Manos en las que subió antes del flop. */
  subioPreflop: number
  /** Veces que se fue teniendo algo que pagar. */
  tiradas: number
  tiradasBien: number
  /** Veces que pagó. */
  pagadas: number
  pagadasBien: number
  /** Veces que apostó o subió, en cualquier calle. */
  subidas: number
  /** Lo que lleva ganado o perdido. */
  fichas: number
}

export const TANTEO_VACIO: Tanteo = {
  manos: 0,
  entro: 0,
  debioEntrar: 0,
  subioPreflop: 0,
  tiradas: 0,
  tiradasBien: 0,
  pagadas: 0,
  pagadasBien: 0,
  subidas: 0,
  fichas: 0,
}

/** Dos tanteos juntos: lo de la sesión encima de lo de antes. */
export function sumar(a: Tanteo, b: Tanteo): Tanteo {
  const t = {} as Tanteo
  for (const k of Object.keys(TANTEO_VACIO) as (keyof Tanteo)[]) t[k] = a[k] + b[k]
  return t
}

/** Antes de esto no hay nada que decir: con tres manos cualquiera parece una roca. */
export const MANOS_PARA_PERFIL = 10

export interface Perfil {
  nombre: string
  /** Qué quiere decir, en una línea. */
  ayuda: string
  /** Lo que más te costaría dinero si sigues así. */
  consejo: string
}

/**
 * El tipo de jugador, de lo que se ve en sus manos.
 *
 * Se mira por dos lados, que son los dos de siempre: en cuántas manos entras y, de
 * ésas, en cuántas tomas la iniciativa. Entrar poco y subir cuando entras es lo que
 * gana; entrar a todo y pagar es lo que paga la cena de los demás.
 */
export function perfilDe(t: Tanteo): Perfil | null {
  if (t.manos < MANOS_PARA_PERFIL) return null

  const entra = t.entro / t.manos
  const manda = t.entro > 0 ? t.subioPreflop / t.entro : 0

  const base: Perfil =
    entra < 0.22
      ? manda >= 0.35
        ? {
            nombre: 'Roca',
            ayuda: 'Entras a muy pocas, y cuando entras traes algo.',
            consejo:
              'Dejas ir manos que sí se jugaban. Desde el botón y con poca gente, aflójate.',
          }
        : {
            nombre: 'Miedoso',
            ayuda: 'Entras a muy pocas y además las juegas pagando.',
            consejo:
              'Entrando tan poco, cuando entres cobra: pagar sin subir regala el bote al que apuesta.',
          }
      : entra > 0.45
        ? manda >= 0.35
          ? {
              nombre: 'Loco',
              ayuda: 'Entras a casi todas y encima subes.',
              consejo:
                'Vas a ganar muchos botes chicos y a perder los grandes. Tira más antes del flop.',
            }
          : {
              nombre: 'Pagador',
              ayuda: 'Entras a muchas manos y las juegas pagando.',
              consejo:
                'Es lo que más cuesta a la larga: pagar por ver. Si la mano vale, súbela; si no, tírala.',
            }
        : manda >= 0.35
          ? {
              nombre: 'Sólido',
              ayuda: 'Entras a las que valen y las juegas de frente.',
              consejo: 'Vas bien. Lo que queda es afinar contra quién vale la pena farolear.',
            }
          : {
              nombre: 'Tibio',
              ayuda: 'Eliges bien las manos pero casi no tomas la iniciativa.',
              consejo: 'Súbelas más: las manos buenas ganan más cuando tú marcas el precio.',
            }

  /* Si se repite un error, ése manda sobre el consejo general: es lo que de verdad
     está costando dinero ahora mismo. */
  const pagosDeMas = t.pagadas - t.pagadasBien
  const tiradasDeMas = t.tiradas - t.tiradasBien
  if (pagosDeMas >= 3 && pagosDeMas > tiradasDeMas * 2)
    return {
      ...base,
      consejo: `Llevas ${pagosDeMas} pagadas que no salían a cuentas. Cuando la barra no llegue a la raya, tírala.`,
    }
  if (tiradasDeMas >= 3 && tiradasDeMas > pagosDeMas * 2)
    return {
      ...base,
      consejo: `Llevas ${tiradasDeMas} tiradas que sí se pagaban. Cuando la barra pase la raya, paga aunque la mano se vea fea.`,
    }
  return base
}

/** Un porcentaje, o null cuando todavía no hay de dónde sacarlo. */
const parte = (arriba: number, abajo: number) => (abajo > 0 ? (arriba / abajo) * 100 : null)

export interface Renglon {
  /** Cómo se llama el dato. */
  que: string
  /** Qué quiere decir, para el que no vive de esto. */
  ayuda: string
  /** El número, ya escrito, o null si todavía no hay. */
  valor: (t: Tanteo) => string | null
}

/**
 * La tabla, renglón por renglón.
 *
 * Vive aquí y no en la pantalla porque las dos columnas —la sesión y el total— tienen
 * que decir exactamente lo mismo, y porque así se puede probar que cada número sale de
 * donde dice que sale.
 */
export const RENGLONES: Renglon[] = [
  {
    que: 'Manos jugadas',
    ayuda: 'Cuántas se repartieron contigo en la mesa.',
    valor: (t) => String(t.manos),
  },
  {
    que: 'A cuántas entras',
    ayuda: 'En cuántas pones dinero por gusto, sin contar las ciegas.',
    valor: (t) => {
      const p = parte(t.entro, t.manos)
      return p === null ? null : `${t.entro} · ${Math.round(p)}%`
    },
  },
  {
    que: 'A cuántas deberías',
    ayuda: 'En cuántas las cuentas decían que entrar salía a cuentas.',
    valor: (t) => {
      const p = parte(t.debioEntrar, t.manos)
      return p === null ? null : `${t.debioEntrar} · ${Math.round(p)}%`
    },
  },
  {
    que: 'Tiradas correctas',
    ayuda: 'De las veces que te fuiste, en cuántas pagar salía caro de verdad.',
    valor: (t) => {
      const p = parte(t.tiradasBien, t.tiradas)
      return p === null ? null : `${t.tiradasBien} de ${t.tiradas} · ${Math.round(p)}%`
    },
  },
  {
    que: 'Pagadas correctas',
    ayuda: 'De las veces que pagaste, en cuántas sí salía a cuentas.',
    valor: (t) => {
      const p = parte(t.pagadasBien, t.pagadas)
      return p === null ? null : `${t.pagadasBien} de ${t.pagadas} · ${Math.round(p)}%`
    },
  },
  {
    que: 'Qué tan arriesgado',
    ayuda: 'De lo que haces con dinero, cuánto es apostar y subir en vez de sólo pagar.',
    valor: (t) => {
      const p = parte(t.subidas, t.subidas + t.pagadas)
      return p === null
        ? null
        : `${Math.round(p)}% · ${p >= 55 ? 'arriesgado' : p >= 30 ? 'normal' : 'conservador'}`
    },
  },
]

/* ---- lo que se guarda de una sesión a otra ---- */

const CLAVE = 'onlycards.entrenamiento'

/**
 * Lo acumulado de antes.
 *
 * Se guarda en el teléfono, no en el servidor: es una libreta de práctica, no un dato de
 * la liga. Si el navegador no deja guardar —ventana privada, permisos—, se juega igual y
 * sólo se pierde el histórico, que es lo de menos.
 */
type Caja = Pick<Storage, 'getItem' | 'setItem'>

/* El almacén del navegador, cuando lo hay. En una ventana privada, o con los permisos
   cerrados, leerlo truena: por eso se pide así y no directo. */
const delNavegador = (): Caja | null => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function leerTanteo(liga: string, caja: Caja | null = delNavegador()): Tanteo {
  try {
    const crudo = caja?.getItem(`${CLAVE}.${liga}`)
    if (!crudo) return TANTEO_VACIO
    const g = JSON.parse(crudo) as Record<string, unknown>
    const t = { ...TANTEO_VACIO }
    for (const k of Object.keys(TANTEO_VACIO) as (keyof Tanteo)[]) {
      const v = g[k]
      if (typeof v === 'number' && Number.isFinite(v)) t[k] = v
    }
    return t
  } catch {
    return TANTEO_VACIO
  }
}

export function guardarTanteo(liga: string, t: Tanteo, caja: Caja | null = delNavegador()) {
  try {
    caja?.setItem(`${CLAVE}.${liga}`, JSON.stringify(t))
  } catch {
    /* Sin dónde guardar se sigue jugando: el histórico es lo de menos. */
  }
}
