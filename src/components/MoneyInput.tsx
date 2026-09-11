import NumInput from './NumInput'

interface Props {
  label: string
  value: number
  onChange: (v: number) => void
  /** `row` pone la etiqueta a la izquierda; `inline` la deja pegada al campo. */
  layout?: 'row' | 'inline'
}

/** Campo de dinero con su "$" al frente. */
export default function MoneyInput({ label, value, onChange, layout = 'row' }: Props) {
  return (
    <div
      className={
        layout === 'row'
          ? 'mb-3 flex items-center justify-between gap-2.5'
          : 'mb-3 flex items-center gap-2.5'
      }
    >
      <span className="text-[13px] font-semibold text-ink-soft">{label}</span>
      <div className="flex max-w-[170px] flex-1 items-center rounded-[10px] border border-paper-line bg-white px-2.5">
        <span className="font-bold text-ink-soft">$</span>
        <NumInput
          value={value}
          onChange={onChange}
          mode="decimal"
          aria-label={label}
          className="w-full border-none bg-transparent px-1 py-2.5 text-[17px] font-semibold outline-none"
        />
      </div>
    </div>
  )
}
