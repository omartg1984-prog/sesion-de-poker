import Chip from './Chip'
import NumInput from './NumInput'
import { useSession } from '../store/session'

/** Panel plegable con el valor y el inventario de cada color de ficha. */
export default function ColorsPanel() {
  const colors = useSession((s) => s.colors)
  const updateColor = useSession((s) => s.updateColor)
  const removeColor = useSession((s) => s.removeColor)
  const addColor = useSession((s) => s.addColor)

  const preview = colors.map((c) => `${(c.label || '?').charAt(0)}:${c.value}`).join('  ')

  return (
    <details className="mb-3.5 rounded-[var(--radius-card)] bg-paper px-4 py-3.5 shadow-[0_8px_20px_rgba(0,0,0,.24)]">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink-soft [&::-webkit-details-marker]:hidden">
        <span>💰 Valor de las fichas</span>
        <span className="font-normal">{preview}</span>
        <span className="ml-auto">▾</span>
      </summary>

      <div className="mt-3">
        {colors.map((c) => (
          <div key={c.key} className="mt-2 rounded-[10px] border border-paper-line bg-paper-soft p-2.5">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={c.color}
                aria-label={`Color de ${c.label || 'la ficha'}`}
                className="h-[34px] w-[34px] shrink-0 cursor-pointer rounded-lg border-none bg-transparent p-0"
                onChange={(e) => updateColor(c.key, { color: e.target.value })}
              />
              <input
                type="text"
                value={c.label}
                placeholder="Color"
                aria-label="Nombre del color"
                className="min-w-0 flex-1 rounded-lg border border-paper-line bg-white p-2 text-sm font-semibold outline-none focus:border-gold"
                onChange={(e) => updateColor(c.key, { label: e.target.value })}
              />
              <Chip color={c} size={30} />
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                title="Quitar color"
                aria-label={`Quitar ${c.label || 'color'}`}
                onClick={() => removeColor(c.key)}
              >
                ✕
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
                    onChange={(v) => updateColor(c.key, { value: v })}
                  />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <span className="field-label">Fichas que tengo</span>
                <div className="field-box">
                  <NumInput
                    value={c.inventory}
                    showZero
                    aria-label={`Inventario de ${c.label || 'la ficha'}`}
                    onChange={(v) => updateColor(c.key, { inventory: v })}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        <button type="button" className="btn-dashed mt-2.5 text-sm" onClick={addColor}>
          ＋ Agregar color de ficha
        </button>
        <p className="mx-0.5 mt-3 text-xs text-ink-soft">
          Toca el círculo de color para cambiarlo. Puedes agregar cuantos colores compren.
        </p>
      </div>
    </details>
  )
}
