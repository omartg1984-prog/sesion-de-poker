import { ChevronRight, Coffee, Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  RELOJ_PARADO,
  arrancarReloj,
  enCurso,
  pausarReloj,
  reloj as formatear,
  segundosCorridos,
  type Estructura,
  type RelojTorneo,
} from '../../lib/torneo'

/*
 * El reloj del torneo.
 *
 * El estado vive en el servidor (desde cuándo corre, cuánto llevaba antes de la pausa),
 * así que cualquiera que abra la app ve el mismo nivel. Aquí sólo se late cada segundo
 * para redibujar, y se vuelve a pedir el estado de vez en cuando por si alguien más le
 * dio pausa desde otro teléfono.
 */

const CADA_CUANTO_RECARGAR_MS = 20_000

interface Props {
  estructura: Estructura
  reloj: RelojTorneo
  puedeEditar: boolean
  onReloj: (r: RelojTorneo) => void
  recargar: () => void
}

export default function Reloj({ estructura, reloj, puedeEditar, onReloj, recargar }: Props) {
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
    if (!reloj.corriendo) return
    const t = setInterval(recargar, CADA_CUANTO_RECARGAR_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloj.corriendo])

  const corridos = segundosCorridos(reloj)
  const { tramo, restanteSeg, terminado, nivel, siguienteNivel } = enCurso(estructura, corridos)
  const enDescanso = tramo.tipo === 'descanso'
  const duracionTramo = tramo.minutos * 60
  const avance = terminado ? 1 : 1 - restanteSeg / duracionTramo
  /* El último minuto se pinta en rojo: es el aviso de que ya van a subir. */
  const porSubir = !terminado && !enDescanso && restanteSeg <= 60

  /* El color de fondo va aparte del degradado: `.panel` trae crema y el degradado es una
     imagen encima. Si esa imagen no pintara, quedaría blanco sobre crema. */
  return (
    <section className="panel overflow-hidden bg-noche-honda bg-gradient-to-br from-[#2a1016] to-[#100e12] ring-1 ring-marca/35">
      <p className="panel-title !text-tiza-suave">
        <span>
          {terminado
            ? 'Se acabaron los niveles'
            : enDescanso
              ? 'Descanso'
              : `Nivel ${nivel.nivel} de ${estructura.niveles.length}`}
        </span>
      </p>

      <div className="text-center">
        <div
          className={`font-display text-[56px] leading-none font-bold tabular-nums ${
            porSubir ? 'text-marca-alta' : 'text-white'
          }`}
        >
          {terminado ? formatear(0) : formatear(restanteSeg)}
        </div>
        {enDescanso ? (
          <div className="mt-1 flex items-center justify-center gap-1.5 font-display text-2xl font-bold text-win-alto">
            <Coffee size={20} strokeWidth={2.4} />
            Al volver {nivel.chica} / {nivel.grande}
          </div>
        ) : (
          <>
            <div className="mt-1 font-display text-2xl font-bold text-win-alto">
              {nivel.chica} / {nivel.grande}
            </div>
            {siguienteNivel && (
              <div className="mt-1 flex items-center justify-center gap-1 text-[12px] text-tiza-suave">
                <ChevronRight size={13} strokeWidth={2.6} />
                Sigue {siguienteNivel.chica} / {siguienteNivel.grande}
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/12">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
            porSubir ? 'bg-marca-alta' : enDescanso ? 'bg-tiza' : 'bg-win-alto'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, avance * 100))}%` }}
        />
      </div>

      <p className="mt-2 mb-0 text-center text-[12px] text-tiza-suave">
        Llevan {formatear(corridos)} de {estructura.duracionMinutos} minutos
      </p>

      {puedeEditar && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="btn btn-marca"
            onClick={() => onReloj(reloj.corriendo ? pausarReloj(reloj) : arrancarReloj(reloj))}
          >
            {reloj.corriendo ? (
              <>
                <Pause size={17} strokeWidth={2.6} />
                Pausa
              </>
            ) : (
              <>
                <Play size={17} strokeWidth={2.6} />
                {corridos > 0 ? 'Seguir' : 'Arrancar'}
              </>
            )}
          </button>
          <button
            type="button"
            aria-label="Volver a empezar el reloj"
            className="flex w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border-none bg-white/12 text-white active:scale-95"
            onClick={() => onReloj(RELOJ_PARADO)}
          >
            <RotateCcw size={17} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </section>
  )
}
