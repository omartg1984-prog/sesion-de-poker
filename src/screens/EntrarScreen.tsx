import { AlertTriangle, Loader2 } from 'lucide-react'
import { useState } from 'react'
import PinInput from '../components/PinInput'
import { ErrorApi } from '../lib/api'
import { useApp } from '../store/app'

const LARGO_PIN = 6

export default function EntrarScreen() {
  const entrar = useApp((s) => s.entrar)
  const registrarse = useApp((s) => s.registrarse)

  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar')
  const [usuario, setUsuario] = useState('')
  const [nombre, setNombre] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cambiarModo = (m: 'entrar' | 'crear') => {
    setModo(m)
    setError(null)
    setPin('')
    setPin2('')
  }

  const listo =
    usuario.trim().length >= 3 &&
    pin.length === LARGO_PIN &&
    (modo === 'entrar' || (nombre.trim().length > 0 && pin2.length === LARGO_PIN))

  const enviar = async () => {
    if (!listo || ocupado) return
    setError(null)

    if (modo === 'crear' && pin !== pin2) {
      setError('Los dos PIN no son iguales')
      setPin2('')
      return
    }

    setOcupado(true)
    try {
      if (modo === 'entrar') await entrar(usuario, pin)
      else await registrarse(usuario, nombre, pin)
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo conectar')
      setPin('')
      setPin2('')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[420px] flex-col justify-center px-5 py-8">
      <header className="mb-7 text-center">
        <div className="text-sm tracking-[8px] text-gold">♠ ♥ ♣ ♦</div>
        <h1 className="mt-2 font-display text-[34px] leading-none font-bold tracking-[1.5px] text-gold-soft uppercase [text-shadow:0_2px_0_rgba(0,0,0,.35)]">
          Sesión de Póker
        </h1>
      </header>

      <div className="panel mb-0">
        <div role="tablist" className="mb-5 flex gap-1 rounded-xl bg-ink/8 p-1">
          {(
            [
              ['entrar', 'Entrar'],
              ['crear', 'Crear cuenta'],
            ] as const
          ).map(([m, texto]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={modo === m}
              onClick={() => cambiarModo(m)}
              className={`flex-1 cursor-pointer rounded-[9px] border-none py-2.5 text-sm font-bold transition-colors ${
                modo === m ? 'bg-gold text-[#2e1a11] shadow-sm' : 'bg-transparent text-ink-soft'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          <label className="mb-4 block">
            <span className="field-label">Tu usuario</span>
            <input
              type="text"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value.toLowerCase().replace(/\s/g, ''))}
              placeholder="ej. omar"
              className="mt-1 w-full rounded-xl border border-paper-line bg-white px-3 py-3 text-base font-semibold text-ink outline-none focus:border-gold"
            />
          </label>

          {modo === 'crear' && (
            <label className="mb-4 block">
              <span className="field-label">Tu nombre</span>
              <input
                type="text"
                autoComplete="name"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Como quieres que te vean"
                className="mt-1 w-full rounded-xl border border-paper-line bg-white px-3 py-3 text-base font-semibold text-ink outline-none focus:border-gold"
              />
            </label>
          )}

          <div className="mb-4">
            <span className="field-label mb-1.5 block text-center">
              {modo === 'crear' ? `Inventa un PIN de ${LARGO_PIN} dígitos` : 'Tu PIN'}
            </span>
            <PinInput value={pin} onChange={setPin} label="PIN" />
          </div>

          {modo === 'crear' && (
            <div className="mb-4">
              <span className="field-label mb-1.5 block text-center">Repítelo</span>
              <PinInput value={pin2} onChange={setPin2} label="Repite el PIN" />
            </div>
          )}

          {error && (
            <div className="balance balance-off">
              <AlertTriangle size={16} strokeWidth={2.4} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn btn-gold" disabled={!listo || ocupado}>
            {ocupado && <Loader2 size={17} className="animate-spin" />}
            {modo === 'entrar' ? 'Entrar' : 'Crear mi cuenta'}
          </button>
        </form>

        {modo === 'crear' && (
          <p className="mt-3.5 mb-0 text-center text-xs leading-snug text-ink-soft">
            No pedimos correo. Eso significa que <b>si olvidas tu PIN no se puede recuperar
            solo</b>: tendrá que reiniciártelo quien administra la app.
          </p>
        )}
      </div>
    </div>
  )
}
