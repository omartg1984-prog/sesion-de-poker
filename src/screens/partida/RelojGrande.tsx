import { Coffee, Minimize2, Pause, Play, Recycle } from 'lucide-react'
import { useEffect } from 'react'
import {
  arrancarReloj,
  pausarReloj,
  reloj as formatear,
  type Estructura,
  type RelojTorneo,
} from '../../lib/torneo'
import { horaDeVuelta, usarReloj } from './usarReloj'

/*
 * El reloj a pantalla completa, para la tele o la laptop junto a la mesa.
 *
 * Lo que importa desde el otro lado del cuarto son tres cosas: cuánto falta, de cuánto
 * son las ciegas y si ya casi suben. Todo lo demás es chico o no está.
 *
 * Las medidas van en `vmin` para que el número llene la pantalla que sea —un teléfono
 * de lado, una laptop, una tele— sin salirse.
 */

interface Props {
  estructura: Estructura
  reloj: RelojTorneo
  puedeEditar: boolean
  onReloj: (r: RelojTorneo) => void
  recargar: () => void
  onCerrar: () => void
}

/* El navegador tiene candado de pantalla desde hace poco y no en todos lados, así que
   se pide con cuidado y si no se puede, ni modo: sigue siendo un reloj. */
type Candado = { release: () => Promise<void> }
type ConCandado = Navigator & {
  wakeLock?: { request: (tipo: 'screen') => Promise<Candado> }
}

export default function RelojGrande({
  estructura,
  reloj,
  puedeEditar,
  onReloj,
  recargar,
  onCerrar,
}: Props) {
  const { corridos, restanteSeg, terminado, nivel, siguienteNivel, enDescanso, avance, porSubir, retira } =
    usarReloj(estructura, reloj, recargar)

  /* Pantalla completa de verdad y pantalla que no se apaga. Las dos son un lujo: si el
     navegador no las da, la vista funciona igual. */
  useEffect(() => {
    void document.documentElement.requestFullscreen?.().catch(() => {})

    let candado: Candado | null = null
    const pedir = async () => {
      try {
        candado = (await (navigator as ConCandado).wakeLock?.request('screen')) ?? null
      } catch {
        candado = null
      }
    }
    void pedir()

    /* Al volver de otra app el candado se suelta solo; hay que volver a pedirlo. */
    const alVolver = () => document.visibilityState === 'visible' && void pedir()
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    document.addEventListener('visibilitychange', alVolver)
    document.addEventListener('keydown', alTeclear)

    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      document.removeEventListener('keydown', alTeclear)
      void candado?.release().catch(() => {})
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rotulo = terminado
    ? 'Se acabaron los niveles'
    : enDescanso
      ? retira
        ? 'Cambio de fichas'
        : 'Descanso'
      : `Nivel ${nivel.nivel} de ${estructura.niveles.length}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reloj del torneo en grande"
      className="fixed inset-0 z-[60] flex flex-col bg-noche-honda bg-gradient-to-br from-[#2a1016] to-[#0b0a0d] px-[3vmin] pt-[max(2vmin,env(safe-area-inset-top))] pb-[max(2vmin,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-start gap-3">
        <p
          className="m-0 flex-1 font-display font-bold tracking-[.18em] text-tiza-suave uppercase"
          style={{ fontSize: 'clamp(0.75rem, 3.2vmin, 2rem)' }}
        >
          {rotulo}
        </p>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Salir del reloj grande"
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-white/12 text-white active:scale-90"
        >
          <Minimize2 size={20} strokeWidth={2.4} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        <div
          className={`font-display leading-[0.85] font-bold tabular-nums ${
            porSubir ? 'text-marca-alta' : 'text-white'
          }`}
          style={{ fontSize: 'clamp(4rem, 34vmin, 22rem)' }}
        >
          {terminado ? formatear(0) : formatear(restanteSeg)}
        </div>

        {enDescanso ? (
          <>
            <div
              className={`mt-[2vmin] flex items-center justify-center gap-[2vmin] font-display font-bold ${
                retira ? 'text-marca-alta' : 'text-win-alto'
              }`}
              style={{ fontSize: 'clamp(1.5rem, 9vmin, 6rem)' }}
            >
              {retira ? (
                <>
                  <Recycle size="1em" strokeWidth={2.4} />
                  Salen las de {retira.map((v) => v.toLocaleString('es-MX')).join(' y ')}
                </>
              ) : (
                <>
                  <Coffee size="1em" strokeWidth={2.4} />
                  Vuelven a las {horaDeVuelta(restanteSeg)}
                </>
              )}
            </div>
            <div
              className="mt-[1vmin] text-tiza-suave"
              style={{ fontSize: 'clamp(0.9rem, 4vmin, 2.5rem)' }}
            >
              {retira && `Se cambian por grandes · `}
              Se sigue con {nivel.chica} / {nivel.grande}
            </div>
          </>
        ) : (
          <>
            <div
              className="mt-[2vmin] font-display font-bold text-win-alto"
              style={{ fontSize: 'clamp(2rem, 15vmin, 10rem)' }}
            >
              {nivel.chica} / {nivel.grande}
            </div>
            {siguienteNivel && (
              <div
                className="mt-[1vmin] text-tiza-suave"
                style={{ fontSize: 'clamp(0.9rem, 4vmin, 2.5rem)' }}
              >
                Sigue {siguienteNivel.chica} / {siguienteNivel.grande}
              </div>
            )}
          </>
        )}
      </div>

      <div className="h-[1.2vmin] min-h-[6px] overflow-hidden rounded-full bg-white/12">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
            porSubir ? 'bg-marca-alta' : enDescanso ? 'bg-tiza' : 'bg-win-alto'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, avance * 100))}%` }}
        />
      </div>

      <div className="mt-[2vmin] flex items-center gap-3">
        <p
          className="m-0 flex-1 text-tiza-suave"
          style={{ fontSize: 'clamp(0.7rem, 3vmin, 1.6rem)' }}
        >
          Llevan {formatear(corridos)} de {estructura.duracionMinutos} minutos
        </p>
        {puedeEditar && (
          <button
            type="button"
            onClick={() => onReloj(reloj.corriendo ? pausarReloj(reloj) : arrancarReloj(reloj))}
            className="flex h-14 min-w-[7rem] cursor-pointer items-center justify-center gap-2 rounded-2xl border-none bg-marca px-5 font-display text-lg font-bold text-white active:scale-95"
          >
            {reloj.corriendo ? (
              <>
                <Pause size={20} strokeWidth={2.6} />
                Pausa
              </>
            ) : (
              <>
                <Play size={20} strokeWidth={2.6} />
                {corridos > 0 ? 'Seguir' : 'Arrancar'}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
