import Chip from './Chip'
import NumInput from './NumInput'
import type { ChipColor, Chips } from '../store/types'

interface Props {
  colors: ChipColor[]
  chips: Chips
  onChange: (colorKey: string, value: number) => void
  showZero?: boolean
}

/** Una casilla por color: la ficha dibujada arriba y cuántas van debajo. */
export default function ChipsGrid({ colors, chips, onChange, showZero = false }: Props) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(58px,1fr))] gap-1.5">
      {colors.map((c) => (
        <label key={c.key} className="flex flex-col items-center gap-1">
          <Chip color={c} />
          <span className="sr-only">{c.label || 'Color'}</span>
          <NumInput
            value={chips[c.key] ?? 0}
            onChange={(v) => onChange(c.key, v)}
            showZero={showZero}
            aria-label={`Fichas ${c.label || c.key} (valor ${c.value})`}
            className="w-full rounded-lg border border-paper-line bg-white px-0.5 py-2 text-center text-[15px] font-semibold outline-none focus:border-gold"
          />
        </label>
      ))}
    </div>
  )
}
