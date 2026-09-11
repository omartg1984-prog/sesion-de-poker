import { Plus, X } from 'lucide-react'
import Chip from './Chip'
import NumInput from './NumInput'
import { useSession } from '../store/session'

/** Valor e inventario de cada color de ficha. Vive dentro de la hoja de ajustes. */
export default function ColorsPanel() {
  const colors = useSession((s) => s.colors)
  const updateColor = useSession((s) => s.updateColor)
  const removeColor = useSession((s) => s.removeColor)
  const addColor = useSession((s) => s.addColor)

  return (
    <section>
      <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
        Pon el valor de cada ficha y cuántas tienes. El reparto usa estas cantidades para que
        alcance a todos.
      </p>

      {colors.map((c) => (
        <div key={c.key} className="mb-2 rounded-xl border border-paper-line bg-paper-soft p-2.5">
          <div className="flex items-center gap-2">
            <label className="relative shrink-0 cursor-pointer">
              <Chip color={c} size={34} />
              <input
                type="color"
                value={c.color}
                aria-label={`Color de ${c.label || 'la ficha'}`}
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(e) => updateColor(c.key, { color: e.target.value })}
              />
            </label>
            <input
              type="text"
              value={c.label}
              placeholder="Color"
              aria-label="Nombre del color"
              className="min-w-0 flex-1 rounded-lg border border-paper-line bg-white p-2 text-sm font-semibold outline-none focus:border-gold"
              onChange={(e) => updateColor(c.key, { label: e.target.value })}
            />
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-ink/8 text-ink-soft transition-colors active:scale-95 hover:bg-loss/12 hover:text-loss"
              aria-label={`Quitar ${c.label || 'color'}`}
              onClick={() => removeColor(c.key)}
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

      <button type="button" className="btn-dashed mt-1 flex items-center justify-center gap-1.5" onClick={addColor}>
        <Plus size={16} strokeWidth={2.5} />
        Agregar color de ficha
      </button>

      <p className="mx-0.5 mt-3 text-xs text-ink-soft">
        Toca el círculo para cambiar el color. Agrega cuantos colores tengan en la mesa.
      </p>
    </section>
  )
}
