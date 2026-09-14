import { Plus, X } from 'lucide-react'
import Chip from './Chip'
import NumInput from './NumInput'
import { dineroDeLaCaja } from '../lib/distribution'
import { money } from '../lib/money'
import { EXTRA_PALETTE, uid } from '../store/defaults'
import type { ChipColor } from '../store/types'

interface Props {
  colores: ChipColor[]
  onChange: (colores: ChipColor[]) => void
  /** Sin permisos solo se muestra, no se edita. */
  soloLectura?: boolean
}

/**
 * Valor e inventario de cada color de ficha. Controlado: no toca ningún estado
 * global, así sirve igual para crear una liga que para editarla.
 */
export default function EditorFichas({ colores, onChange, soloLectura = false }: Props) {
  const caja = dineroDeLaCaja(colores)

  const cambiar = (key: string, cambios: Partial<ChipColor>) =>
    onChange(colores.map((c) => (c.key === key ? { ...c, ...cambios } : c)))

  const quitar = (key: string) => {
    if (colores.length <= 1) return
    onChange(colores.filter((c) => c.key !== key))
  }

  const agregar = () => {
    const usados = colores.map((c) => c.color)
    const color = EXTRA_PALETTE.find((c) => !usados.includes(c)) ?? '#7c4dff'
    onChange([...colores, { key: uid(), label: 'Nuevo', color, value: 1, inventory: 50 }])
  }

  if (soloLectura) {
    return (
      <ul className="m-0 list-none p-0">
        {colores.map((c) => (
          <li
            key={c.key}
            className="flex items-center gap-2.5 border-b border-dashed border-paper-line py-2.5 last:border-b-0"
          >
            <Chip color={c} size={30} />
            <span className="flex-1 font-semibold text-ink">{c.label}</span>
            <span className="font-display font-bold text-ink-soft">{c.inventory} fichas</span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <>
      {colores.map((c) => (
        <div key={c.key} className="mb-2 rounded-xl border border-paper-line bg-paper-soft p-2.5">
          <div className="flex items-center gap-2">
            <label className="relative shrink-0 cursor-pointer">
              <Chip color={c} size={34} />
              <input
                type="color"
                value={c.color}
                aria-label={`Color de ${c.label || 'la ficha'}`}
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(e) => cambiar(c.key, { color: e.target.value })}
              />
            </label>
            <input
              type="text"
              value={c.label}
              placeholder="Color"
              aria-label="Nombre del color"
              className="min-w-0 flex-1 rounded-lg border border-paper-line bg-white p-2 text-sm font-semibold outline-none focus:border-marca"
              onChange={(e) => cambiar(c.key, { label: e.target.value })}
            />
            <button
              type="button"
              disabled={colores.length <= 1}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-ink/8 text-ink-soft transition-colors hover:bg-loss/12 hover:text-loss disabled:opacity-35"
              aria-label={`Quitar ${c.label || 'color'}`}
              onClick={() => quitar(c.key)}
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          <div className="mt-2 flex gap-2.5">
            <div className="flex flex-1 flex-col gap-1">
              <span className="field-label">Valor</span>
              <div className="field-box">
                <span className="font-bold text-ink-soft">$</span>
                <NumInput
                  value={c.value}
                  mode="decimal"
                  showZero
                  aria-label={`Valor de ${c.label || 'la ficha'}`}
                  onChange={(v) => cambiar(c.key, { value: v })}
                />
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <span className="field-label">Cuántas hay</span>
              <div className="field-box">
                <NumInput
                  value={c.inventory}
                  showZero
                  aria-label={`Inventario de ${c.label || 'la ficha'}`}
                  onChange={(v) => cambiar(c.key, { inventory: v })}
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* La pregunta de la mesa no es cuántas fichas hay sino hasta cuánto alcanzan. */}
      <div className="mt-1 flex items-baseline justify-between rounded-xl border border-paper-line bg-paper-soft px-3.5 py-2.5">
        <span className="text-[11px] font-semibold tracking-[.5px] text-ink-soft uppercase">
          Se puede repartir hasta
        </span>
        <b className="font-display text-xl font-bold text-ink tabular-nums">{money(caja.total)}</b>
      </div>
      <p className="mt-1.5 mb-3 text-[12px] leading-snug text-ink-soft">
        Es la suma de cada color por su valor. Más de eso no se puede poner sobre la mesa,
        aunque entre más gente.
      </p>

      {!soloLectura && (
        <button
          type="button"
          className="btn-dashed flex items-center justify-center gap-1.5"
          onClick={agregar}
        >
          <Plus size={16} strokeWidth={2.5} />
          Agregar color de ficha
        </button>
      )}
    </>
  )
}
