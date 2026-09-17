import { Flag, Play, Undo2 } from 'lucide-react'
import { duracionLarga, horaCorta } from '../../lib/tiempo'

/*
 * De qué hora a qué hora se jugó.
 *
 * Son dos cosas distintas y la app las tenía confundidas en una. Terminar es la última
 * mano: a partir de ahí ya no se reparte y empieza el cash out. Cerrar la partida es
 * mucho después, cuando ya se contó todo y cada quien tiene su dinero en la mano —a
 * veces al día siguiente—.
 *
 * Contar el tiempo de juego hasta el cierre daría noches de nueve horas que nadie jugó.
 *
 * En cash las dos horas se aprietan aquí. En torneo la de arranque la apunta sola el
 * primer play del reloj, así que ahí sólo sale la de terminar.
 */

interface Props {
  arrancoEn: string | null
  terminoEn: string | null
  /** Cualquiera que esté jugando puede moverlo; el que mira, no. */
  puede: boolean
  ocupado: boolean
  /** `null` en torneo: allá la hora de arranque la pone el reloj. */
  onArrancar: (() => void) | null
  onTerminar: () => void
  onSeguir: () => void
  /** Sobre el fondo oscuro de la pestaña de torneo los textos van claros. */
  oscuro?: boolean
}

export default function TiempoDeJuego({
  arrancoEn,
  terminoEn,
  puede,
  ocupado,
  onArrancar,
  onTerminar,
  onSeguir,
  oscuro = false,
}: Props) {
  /* Ya se jugó y ya se terminó: queda el dato de la noche, que es lo que se presume. */
  if (terminoEn) {
    const cuanto = arrancoEn ? duracionLarga(arrancoEn, terminoEn) : ''
    return (
      <div className="mb-3">
        <div className="balance balance-ok mb-0">
          <Flag size={16} strokeWidth={2.4} />
          {/* Sin hora de arranque —torneos de antes de que se apuntara— al menos queda
              la de la última mano, que es la que hace falta para el cash out. */}
          {arrancoEn ? (
            <span>
              Jugaron de <b>{horaCorta(arrancoEn)}</b> a <b>{horaCorta(terminoEn)}</b>
              {cuanto && <> · {cuanto}</>}
            </span>
          ) : (
            <span>
              Se acabó el juego a las <b>{horaCorta(terminoEn)}</b>
            </span>
          )}
        </div>
        {puede && (
          <button
            type="button"
            disabled={ocupado}
            onClick={onSeguir}
            className={`mx-auto mt-1.5 flex cursor-pointer items-center gap-1 border-none bg-transparent p-1 text-[11.5px] font-semibold disabled:opacity-45 ${
              oscuro ? 'text-tiza-suave' : 'text-ink-soft'
            }`}
          >
            <Undo2 size={12} strokeWidth={2.8} />
            No, seguimos jugando
          </button>
        )}
      </div>
    )
  }

  /*
   * La noche está corriendo: lo único que hace falta es poder pararla.
   *
   * En torneo el botón sale aunque no haya hora de arranque: ahí lo que se está
   * jugando lo dice el reloj, y hay torneos de antes de que la hora se apuntara.
   */
  const jugando = !!arrancoEn || !onArrancar
  if (jugando)
    return (
      <div className="mb-3">
        {arrancoEn && (
          <div className={`balance balance-ok ${puede ? 'mb-2' : 'mb-0'}`}>
            <Play size={16} strokeWidth={2.4} />
            <span>
              Arrancó a las <b>{horaCorta(arrancoEn)}</b>
            </span>
          </div>
        )}
        {puede && (
          <button
            type="button"
            className="btn btn-ghost disabled:opacity-45"
            disabled={ocupado}
            onClick={onTerminar}
          >
            <Flag size={17} strokeWidth={2.4} />
            Terminar el juego
          </button>
        )}
      </div>
    )

  /* Todavía no empieza. */
  if (!onArrancar || !puede) return null

  return (
    <button
      type="button"
      className="btn btn-marca mb-3 disabled:opacity-45"
      disabled={ocupado}
      onClick={onArrancar}
    >
      <Play size={17} strokeWidth={2.4} />
      Arrancar la partida
    </button>
  )
}
