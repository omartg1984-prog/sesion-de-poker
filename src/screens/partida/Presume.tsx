import { Megaphone, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../lib/api'
import { conAviso, useApp } from '../../store/app'

/*
 * El derecho a presumir.
 *
 * Lo gana el que gana la noche y no se comparte: es el único que puede dejarle un
 * mensaje al grupo, y vive pegado en la liga hasta que alguien más gane otra noche.
 *
 * Quién ganó no lo decide esta pantalla sino el servidor, con la misma cuenta que arma
 * el podio del lobby. Aquí sólo se pregunta si el micrófono es mío.
 */

const LARGO = 280

interface Props {
  partidaId: string
  /** Lo que ya había escrito, si es que escribió. */
  actual: string | null
  onGuardado: (texto: string | null) => void
}

export default function Presume({ partidaId, actual, onGuardado }: Props) {
  const avisar = useApp((s) => s.avisar)
  const [texto, setTexto] = useState(actual ?? '')
  const [ocupado, setOcupado] = useState(false)

  const guardar = async (nuevo: string) => {
    if (ocupado) return
    setOcupado(true)
    const r = await conAviso(() => api.presumir(partidaId, nuevo))
    setOcupado(false)
    if (!r) return
    onGuardado(r.presume)
    avisar(r.presume ? 'Ya lo vio toda la liga' : 'Mensaje quitado')
  }

  return (
    <section className="panel overflow-hidden bg-noche-honda bg-gradient-to-br from-[#2a1016] to-[#100e12] ring-1 ring-marca/35">
      <p className="panel-title !text-tiza-suave">
        <span>Ganaste la noche</span>
      </p>

      <p className="mt-0 mb-3 text-[13px] leading-snug text-tiza-suave">
        Eres el único que puede dejarle un mensaje a la liga. Se queda ahí hasta que alguien más
        gane una partida.
      </p>

      <textarea
        value={texto}
        rows={3}
        maxLength={LARGO}
        aria-label="Tu mensaje para la liga"
        placeholder="ej. Gracias por la cooperación, caballeros."
        onChange={(e) => setTexto(e.target.value)}
        className="w-full resize-none rounded-xl border border-white/15 bg-white/8 px-3 py-2.5 text-[14px] leading-snug text-white outline-none placeholder:text-tiza-suave/60 focus:border-marca-alta"
      />
      <p className="mt-1 mb-3 text-right text-[11px] text-tiza-suave">
        {texto.length}/{LARGO}
      </p>

      <button
        type="button"
        className="btn btn-marca mb-2 disabled:opacity-45"
        disabled={ocupado || !texto.trim() || texto.trim() === (actual ?? '')}
        onClick={() => void guardar(texto.trim())}
      >
        <Megaphone size={17} strokeWidth={2.4} />
        {actual ? 'Cambiar el mensaje' : 'Presumir'}
      </button>

      {actual && (
        <button
          type="button"
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border-none bg-white/10 py-2.5 text-[13px] font-semibold text-tiza-suave active:scale-[.99]"
          disabled={ocupado}
          onClick={() => {
            setTexto('')
            void guardar('')
          }}
        >
          <Trash2 size={15} strokeWidth={2.4} />
          Quitarlo
        </button>
      )}
    </section>
  )
}
