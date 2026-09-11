interface Props {
  value: number
  onChange: (v: number) => void
  label: string
}

/** −/+ con botones grandes, pensado para usarse con una mano. */
export default function Stepper({ value, onChange, label }: Props) {
  return (
    <div className="flex items-center overflow-hidden rounded-[10px] border border-paper-line bg-white">
      <button
        type="button"
        aria-label={`Quitar un ${label}`}
        className="h-10 w-10 cursor-pointer border-none bg-[#efe8d6] text-xl leading-none font-bold text-ink hover:bg-[#e6dcbf]"
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        −
      </button>
      <span aria-live="polite" className="min-w-[44px] text-center font-display text-[17px] font-bold">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Agregar un ${label}`}
        className="h-10 w-10 cursor-pointer border-none bg-[#efe8d6] text-xl leading-none font-bold text-ink hover:bg-[#e6dcbf]"
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  )
}
