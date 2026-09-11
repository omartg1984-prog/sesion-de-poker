import { textOn } from '../lib/money'
import type { ChipColor } from '../store/types'

interface Props {
  color: ChipColor
  /** Tamaño en píxeles del círculo. */
  size?: number
}

/** La ficha física: círculo del color con su valor y el borde punteado del canto. */
export default function Chip({ color, size = 28 }: Props) {
  const fg = textOn(color.color)
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full border-2 border-dashed font-display font-bold shadow-[0_2px_4px_rgba(0,0,0,.25),inset_0_0_0_2px_rgba(0,0,0,.08)]"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        background: color.color,
        color: fg,
        borderColor: fg === '#222222' ? 'rgba(0,0,0,.2)' : 'rgba(255,255,255,.85)',
      }}
    >
      {color.value}
    </span>
  )
}
