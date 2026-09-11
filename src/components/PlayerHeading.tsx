import type { ReactNode } from 'react'
import { useSession } from '../store/session'
import type { Player } from '../store/types'

interface Props {
  player: Player
  index: number
  /** `true` deja editar el nombre y quitar al jugador. */
  editable?: boolean
  right?: ReactNode
}

/** Encabezado de la tarjeta de un jugador: número, nombre y acciones. */
export default function PlayerHeading({ player, index, editable = false, right }: Props) {
  const setPlayerName = useSession((s) => s.setPlayerName)
  const removePlayer = useSession((s) => s.removePlayer)

  return (
    <div className="m-0 mb-3 flex items-center gap-2 font-display text-xl font-semibold tracking-[.5px]">
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-felt text-[13px] text-white">
        {index + 1}
      </span>
      {editable ? (
        <input
          type="text"
          className="name-input"
          placeholder="Nombre del jugador"
          aria-label={`Nombre del jugador ${index + 1}`}
          value={player.name}
          onChange={(e) => setPlayerName(player.id, e.target.value)}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate font-semibold">
          {player.name || `Jugador ${index + 1}`}
        </span>
      )}
      {right}
      {editable && (
        <button
          type="button"
          className="icon-btn icon-btn-danger"
          title="Quitar jugador"
          aria-label={`Quitar a ${player.name || `Jugador ${index + 1}`}`}
          onClick={() => removePlayer(player.id)}
        >
          ✕
        </button>
      )}
    </div>
  )
}
