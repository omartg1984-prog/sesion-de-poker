import {
  Bell,
  ChevronRight,
  Coffee,
  Maximize2,
  Pause,
  Play,
  Recycle,
  RotateCcw,
} from 'lucide-react'
import { useState } from 'react'
import {
  SONIDOS,
  despertarAudio,
  guardarSonido,
  sonar,
  sonidoGuardado,
  type NombreSonido,
} from '../../lib/sonidos'
import {
  RELOJ_PARADO,
  arrancarReloj,
  pausarReloj,
  reloj as formatear,
  type Estructura,
  type RelojTorneo,
} from '../../lib/torneo'
import RelojGrande from './RelojGrande'
import { usarReloj } from './usarReloj'

/*
 * El reloj del torneo dentro de la pestaña, junto a todo lo demás.
 *
 * Para la mesa hay otro: el de pantalla completa (RelojGrande), que es el que se pone en
 * la tele o en el teléfono de lado para que se lea desde el otro lado del cuarto.
 */

interface Props {
  estructura: Estructura
  reloj: RelojTorneo
  puedeEditar: boolean
  onReloj: (r: RelojTorneo) => void
  recargar: () => void
}

export default function Reloj({ estructura, reloj, puedeEditar, onReloj, recargar }: Props) {
  const [grande, setGrande] = useState(false)
  /* El sonido es de este teléfono, no de la partida: si fuera de la partida sonarían
     cinco aparatos a la vez. */
  const [sonido, setSonido] = useState<NombreSonido>(sonidoGuardado)

  /* Con el grande abierto, éste deja de pedirle el estado al servidor: el de arriba ya
     lo está haciendo y serían dos peticiones para lo mismo. */
  const { corridos, restanteSeg, terminado, nivel, siguienteNivel, enDescanso, avance, porSubir, retira } =
    usarReloj(estructura, reloj, recargar, !grande)

  /* El color de fondo va aparte del degradado: `.panel` trae crema y el degradado es una
     imagen encima. Si esa imagen no pintara, quedaría blanco sobre crema. */
  return (
    <>
      <section className="panel overflow-hidden bg-noche-honda bg-gradient-to-br from-[#2a1016] to-[#100e12] ring-1 ring-marca/35">
        <p className="panel-title !text-tiza-suave">
          <span>
            {terminado
              ? 'Se acabaron los niveles'
              : enDescanso
                ? retira
                  ? 'Cambio de fichas'
                  : 'Descanso'
                : `Nivel ${nivel.nivel} de ${estructura.niveles.length}`}
          </span>
          <button
            type="button"
            onClick={() => setGrande(true)}
            aria-label="Ver el reloj en grande"
            /* `order-1` lo manda después de la rayita que `.panel-title` pinta con
               ::after; si no, quedaría a media línea en vez de a la derecha. */
            className="order-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-white/12 text-white active:scale-90"
          >
            <Maximize2 size={15} strokeWidth={2.4} />
          </button>
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
            retira ? (
              /* Cambiar fichas no es descansar: es un trámite con la mesa parada, y
                 decirlo distinto evita que alguien se vaya a fumar. */
              <div className="mt-1 flex flex-col items-center gap-0.5">
                <span className="flex items-center gap-1.5 font-display text-2xl font-bold text-marca-alta">
                  <Recycle size={20} strokeWidth={2.4} />
                  Salen las de {retira.map((v) => v.toLocaleString('es-MX')).join(' y ')}
                </span>
                <span className="text-[12px] text-tiza-suave">
                  Se cambian por grandes · al volver {nivel.chica} / {nivel.grande}
                </span>
              </div>
            ) : (
              <div className="mt-1 flex items-center justify-center gap-1.5 font-display text-2xl font-bold text-win-alto">
                <Coffee size={20} strokeWidth={2.4} />
                Al volver {nivel.chica} / {nivel.grande}
              </div>
            )
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

        {/* El aviso de que suben las ciegas. Se prueba al tocarlo, que además es el
            toque que el navegador necesita para dejar sonar algo después. */}
        <div className="mt-3 border-t border-white/10 pt-2.5">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-[.6px] text-tiza-suave uppercase">
            <Bell size={11} strokeWidth={2.6} />
            Aviso al subir las ciegas
          </p>
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {SONIDOS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  despertarAudio()
                  setSonido(s.id)
                  guardarSonido(s.id)
                  sonar(s.id)
                }}
                className={`shrink-0 cursor-pointer rounded-full border-none px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  sonido === s.id ? 'bg-marca text-white' : 'bg-white/12 text-tiza-suave'
                }`}
              >
                {s.etiqueta}
              </button>
            ))}
          </div>
        </div>

        {puedeEditar && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn btn-marca"
              onClick={() => {
                despertarAudio()
                onReloj(reloj.corriendo ? pausarReloj(reloj) : arrancarReloj(reloj))
              }}
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

      {grande && (
        <RelojGrande
          estructura={estructura}
          reloj={reloj}
          puedeEditar={puedeEditar}
          onReloj={onReloj}
          recargar={recargar}
          onCerrar={() => setGrande(false)}
        />
      )}
    </>
  )
}
