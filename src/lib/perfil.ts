/*
 * Qué tipo de jugador eres.
 *
 * Una mano no dice nada: se gana con basura y se pierde con ases. Lo que sí dice algo es
 * lo que haces una y otra vez —en cuántas entras, cuántas subes, cuántas pagas cuando
 * las cuentas decían que no— y eso se ve solo después de un rato.
 *
 * Son los mismos nombres que traen los rivales de la máquina a propósito: si al de
 * enfrente se le dice "pagador" y a ti también, ya sabes qué está viendo él de ti.
 */

export interface Resumen {
  /** Manos repartidas desde que se empezó. */
  manos: number
  /** En cuántas puso dinero por gusto, sin contar las ciegas. */
  jugadas: number
  /** En cuántas subió antes del flop. */
  subio: number
  /** Decisiones con algo que pagar, que son las que se pueden calificar. */
  decisiones: number
  buenas: number
  /** Pagó cuando las cuentas decían que no. */
  pagosDeMas: number
  /** Se fue cuando las cuentas decían que sí. */
  tiradasDeMas: number
}

export const RESUMEN_VACIO: Resumen = {
  manos: 0,
  jugadas: 0,
  subio: 0,
  decisiones: 0,
  buenas: 0,
  pagosDeMas: 0,
  tiradasDeMas: 0,
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
export function perfilDe(r: Resumen): Perfil | null {
  if (r.manos < MANOS_PARA_PERFIL) return null

  const entra = r.jugadas / r.manos
  const manda = r.jugadas > 0 ? r.subio / r.jugadas : 0

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
  if (r.pagosDeMas >= 3 && r.pagosDeMas > r.tiradasDeMas * 2)
    return {
      ...base,
      consejo: `Llevas ${r.pagosDeMas} pagadas que no salían a cuentas. Cuando la barra no llegue a la raya, tírala.`,
    }
  if (r.tiradasDeMas >= 3 && r.tiradasDeMas > r.pagosDeMas * 2)
    return {
      ...base,
      consejo: `Llevas ${r.tiradasDeMas} tiradas que sí se pagaban. Cuando la barra pase la raya, paga aunque la mano se vea fea.`,
    }
  return base
}

/** De cada diez decisiones, cuántas estuvieron bien. Null si todavía no hay ninguna. */
export const punteria = (r: Resumen) =>
  r.decisiones > 0 ? (r.buenas / r.decisiones) * 100 : null
