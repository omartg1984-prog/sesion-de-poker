import { useState } from 'react'
import type { Miembro } from '../../lib/api'
import Entrenador from './Entrenador'
import Simulador from './Simulador'

/*
 * Las dos mitades de la misma pregunta.
 *
 * "En la mesa" es para una mano que está pasando ahorita: se ponen las cartas que se
 * ven, lo que hay en el bote y lo que te piden, y contesta. "Entrenar" reparte manos
 * contra la máquina para agarrar el modo en la semana, sin que cueste dinero.
 *
 * Las dos contestan igual y con los mismos colores a propósito: lo que se aprende
 * entrenando tiene que servir tal cual el viernes.
 */
export default function VoyONoVoy({ miembros, liga }: { miembros: Miembro[]; liga: string }) {
  const [modo, setModo] = useState<'mesa' | 'entrenar'>('mesa')

  return (
    <>
      <div className="mb-3 flex gap-1 rounded-xl bg-black/25 p-1">
        {(
          [
            ['mesa', 'En la mesa'],
            ['entrenar', 'Entrenar'],
          ] as const
        ).map(([id, texto]) => (
          <button
            key={id}
            type="button"
            aria-pressed={modo === id}
            onClick={() => setModo(id)}
            className={`flex-1 cursor-pointer rounded-[9px] border-none py-1.5 text-[12.5px] font-bold transition-colors ${
              modo === id ? 'bg-white text-marca-tinta' : 'bg-transparent text-tiza-suave'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {modo === 'mesa' ? (
        <Simulador miembros={miembros} />
      ) : (
        <Entrenador miembros={miembros} liga={liga} />
      )}
    </>
  )
}
