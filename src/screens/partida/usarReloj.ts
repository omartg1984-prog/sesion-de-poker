import { useEffect, useRef, useState } from 'react'
import { sonar, sonidoGuardado } from '../../lib/sonidos'
import {
  enCurso,
  segundosCorridos,
  type Estructura,
  type NivelCiegas,
  type RelojTorneo,
  type Tramo,
} from '../../lib/torneo'

/*
 * El latido del reloj del torneo.
 *
 * El estado vive en el servidor (desde cuándo corre, cuánto llevaba antes de la pausa),
 * así que cualquiera que abra la app ve el mismo nivel. Aquí sólo se late cada segundo
 * para redibujar, y se vuelve a pedir el estado de vez en cuando por si alguien más le
 * dio pausa desde otro teléfono.
 *
 * Vive aparte porque el reloj se ve en dos tamaños —el de la pestaña y el de pantalla
 * completa— y los dos tienen que estar contando lo mismo.
 */

const CADA_CUANTO_RECARGAR_MS = 20_000

export interface EstadoReloj {
  /** Segundos que lleva el torneo. */
  corridos: number
  tramo: Tramo
  restanteSeg: number
  terminado: boolean
  nivel: NivelCiegas
  siguienteNivel: NivelCiegas | null
  enDescanso: boolean
  /** De 0 a 1 dentro del nivel o descanso que se está jugando. */
  avance: number
  /** Último minuto del nivel: el aviso de que ya van a subir. */
  porSubir: boolean
  /** Si el descanso en curso es para cambiar fichas, los valores que salen. */
}

export function usarReloj(
  estructura: Estructura,
  reloj: RelojTorneo,
  recargar: () => void,
  /* Con el reloj grande abierto, el chico no tiene que estar pidiendo lo mismo. */
  sincronizar = true,
): EstadoReloj {
  const [, latir] = useState(0)

  /* Un latido por segundo mientras corre: sin esto el número se quedaría congelado
     hasta el siguiente render del padre. */
  useEffect(() => {
    if (!reloj.corriendo) return
    const t = setInterval(() => latir((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [reloj.corriendo])

  /* Y de tanto en tanto se pide el estado de vuelta, por si pausaron desde otro lado. */
  useEffect(() => {
    if (!reloj.corriendo || !sincronizar) return
    const t = setInterval(recargar, CADA_CUANTO_RECARGAR_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloj.corriendo, sincronizar])

  const corridos = segundosCorridos(reloj)
  const { tramo, restanteSeg, terminado, nivel, siguienteNivel } = enCurso(estructura, corridos)
  const enDescanso = tramo.tipo === 'descanso'

  return {
    corridos,
    tramo,
    restanteSeg,
    terminado,
    nivel,
    siguienteNivel,
    enDescanso,
    avance: terminado ? 1 : 1 - restanteSeg / (tramo.minutos * 60),
    porSubir: !terminado && !enDescanso && restanteSeg <= 60,
  }
}

/** La hora que va a ser cuando se acabe lo que se está contando. */
export function horaDeVuelta(restanteSeg: number): string {
  /* En 24 horas, como la tabla de ciegas: si ahí dice 22:20, aquí también. */
  return new Date(Date.now() + restanteSeg * 1000).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * El aviso de que cambiaron las ciegas.
 *
 * Vive aparte del reloj visible a propósito: tiene que sonar aunque en ese momento
 * estés en la pestaña del registro apuntando una recompra, que es justo cuando se te
 * pasa que subieron. Por eso se engancha a la pantalla de la partida y no al reloj.
 *
 * La primera vuelta no suena: abrir la app a media noche no es un cambio de nivel.
 */
export function useAvisoDeNivel(estructura: Estructura | null, reloj: RelojTorneo) {
  const ultimoTramo = useRef<number | null>(null)

  useEffect(() => {
    if (!estructura || !reloj.corriendo) {
      ultimoTramo.current = null
      return
    }

    const revisar = () => {
      const segundos = segundosCorridos(reloj)
      const { tramo, terminado } = enCurso(estructura, segundos)
      if (terminado) return
      const cual = tramo.desdeMinuto
      if (ultimoTramo.current === null) {
        ultimoTramo.current = cual
        return
      }
      if (cual !== ultimoTramo.current) {
        ultimoTramo.current = cual
        sonar(sonidoGuardado())
      }
    }

    revisar()
    const t = setInterval(revisar, 1000)
    return () => clearInterval(t)
  }, [estructura, reloj])
}
