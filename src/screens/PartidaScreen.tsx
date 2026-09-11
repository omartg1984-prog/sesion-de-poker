import { AlertTriangle, ArrowLeft, Check, Coins, Lock, RotateCcw, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import Chip from '../components/Chip'
import ChipsGrid from '../components/ChipsGrid'
import Medalla from '../components/Medalla'
import MoneyInput from '../components/MoneyInput'
import NumInput from '../components/NumInput'
import Sheet from '../components/Sheet'
import { computeDistribution } from '../lib/distribution'
import type { DealPlayer } from '../lib/distribution'
import { EPS, chipValue, money, num, signed } from '../lib/money'
import { api, leerJson, type DetallePartida, type Miembro, type Participacion } from '../lib/api'
import { conAviso, useApp } from '../store/app'
import type { Chips } from '../store/types'

type Pestana = 'jugadores' | 'reparto' | 'final' | 'resultado'

const PESTANAS: { id: Pestana; label: string }[] = [
  { id: 'jugadores', label: 'Jugadores' },
  { id: 'reparto', label: 'Reparto' },
  { id: 'final', label: 'Final' },
  { id: 'resultado', label: 'Resultado' },
]

/** Junta los cambios seguidos y manda uno solo: escribir dinero no dispara una petición por tecla. */
function useGuardadoDiferido(ms = 600) {
  const pendientes = useRef(new Map<string, () => Promise<unknown>>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  return (clave: string, fn: () => Promise<unknown>) => {
    pendientes.current.set(clave, fn)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const tareas = [...pendientes.current.values()]
      pendientes.current.clear()
      for (const t of tareas) void conAviso(t)
    }, ms)
  }
}

export default function PartidaScreen() {
  const partidaId = useApp((s) => s.partidaId)!
  const ligaId = useApp((s) => s.ligaId)
  const irALiga = useApp((s) => s.irALiga)
  const irAHome = useApp((s) => s.irAHome)
  const avisar = useApp((s) => s.avisar)

  const [datos, setDatos] = useState<DetallePartida | null>(null)
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [pestana, setPestana] = useState<Pestana>('jugadores')
  const [cargando, setCargando] = useState(true)
  const [eligiendo, setEligiendo] = useState(false)
  const [seleccion, setSeleccion] = useState<Record<string, number>>({})
  const [ocupado, setOcupado] = useState(false)

  const diferido = useGuardadoDiferido()

  const cargar = async () => {
    const d = await conAviso(() => api.partida(partidaId))
    if (d) {
      setDatos(d)
      const l = await conAviso(() => api.liga(d.partida.liga_id))
      if (l) setMiembros(l.miembros)
    }
    setCargando(false)
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidaId])

  const colores = datos?.liga.colores ?? []
  const cerrada = datos?.partida.estado === 'cerrada'
  const puedeEditar = !!datos?.soyAdmin && !cerrada

  /** Cambia una participación en pantalla al instante y la manda al servidor con retraso. */
  const tocar = (id: string, cambios: Partial<Participacion>, aGuardar: Parameters<typeof api.guardarParticipacion>[1]) => {
    setDatos((d) =>
      d
        ? { ...d, participaciones: d.participaciones.map((p) => (p.id === id ? { ...p, ...cambios } : p)) }
        : d,
    )
    diferido(id + Object.keys(aGuardar).join(), () => api.guardarParticipacion(id, aGuardar))
  }

  const reparto = useMemo(() => {
    if (!datos) return null
    const jugadores: DealPlayer[] = datos.participaciones.map((p) => ({
      id: p.id,
      name: p.nombre,
      buyIn: Math.round(num(p.entrada)),
      deal: p.fichas_manual ? leerJson<Chips>(p.fichas_manual, {}) : null,
    }))
    return computeDistribution(jugadores, colores)
  }, [datos, colores])

  if (cargando) return <p className="mt-20 text-center text-sm text-mint-soft">Cargando…</p>
  if (!datos) return null

  const volver = () => (ligaId ? irALiga(ligaId) : irAHome())

  const abrirSelector = () => {
    const actual: Record<string, number> = {}
    for (const p of datos.participaciones) actual[p.usuario_id] = p.entrada
    setSeleccion(actual)
    setEligiendo(true)
  }

  const guardarJugadores = async () => {
    if (ocupado) return
    setOcupado(true)
    const jugadores = Object.entries(seleccion).map(([usuarioId, entrada]) => ({ usuarioId, entrada }))
    const r = await conAviso(() => api.cargarJugadores(partidaId, jugadores))
    setOcupado(false)
    if (r) {
      setEligiendo(false)
      void cargar()
    }
  }

  const cerrarPartida = async () => {
    if (!window.confirm('¿Cerrar la partida? Ya no se podrá editar.')) return
    const r = await conAviso(() => api.guardarPartida(partidaId, { estado: 'cerrada' }))
    if (r) {
      avisar('Partida cerrada')
      void cargar()
    }
  }

  /* ---- cálculos ---- */
  const conResultados = datos.participaciones.map((p) => {
    const recompras = leerJson<{ dinero: number }[]>(p.recompras, [])
    const invertido = num(p.entrada) + recompras.reduce((a, r) => a + num(r.dinero), 0)
    const final = chipValue(leerJson<Chips>(p.fichas_final, {}), colores)
    return { ...p, invertido, final, pl: final - invertido }
  })
  const totalInvertido = conResultados.reduce((a, p) => a + p.invertido, 0)
  const totalFinal = conResultados.reduce((a, p) => a + p.final, 0)
  const diferencia = totalFinal - totalInvertido
  const ranking = [...conResultados].sort((a, b) => b.pl - a.pl)

  return (
    <div className="mx-auto max-w-[640px] px-3.5 pb-10">
      <header className="sticky top-0 z-30 -mx-3.5 mb-3 border-b border-white/8 bg-[#1b241a]/85 px-3.5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={volver}
            aria-label="Volver a la liga"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-white/8 text-mint active:scale-90"
          >
            <ArrowLeft size={18} strokeWidth={2.4} />
          </button>
          <h1 className="m-0 min-w-0 flex-1 truncate font-display text-[17px] font-bold tracking-[.5px] text-gold-soft uppercase">
            {datos.partida.nombre || datos.partida.fecha}
          </h1>
          {cerrada && <Lock size={15} className="shrink-0 text-mint-soft" />}
        </div>

        <div className="no-scrollbar mt-2 flex gap-1 overflow-x-auto rounded-xl bg-black/30 p-1">
          {PESTANAS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={pestana === t.id ? 'page' : undefined}
              onClick={() => setPestana(t.id)}
              className={`flex-1 cursor-pointer rounded-[9px] border-none px-3 py-2 text-[12.5px] font-bold whitespace-nowrap transition-colors ${
                pestana === t.id ? 'bg-gold text-[#2e1a11]' : 'bg-transparent text-mint-soft'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {datos.participaciones.length === 0 && (
        <section className="panel text-center">
          <Users size={30} className="mx-auto mb-2 text-ink-soft/45" strokeWidth={1.8} />
          <p className="m-0 mb-1 font-display text-lg font-semibold text-ink">Nadie cargado aún</p>
          <p className="mx-auto mb-3 max-w-[300px] text-[13px] leading-snug text-ink-soft">
            {datos.soyAdmin
              ? 'Elige quiénes llegaron y con cuánto entra cada uno.'
              : 'Un admin de la liga tiene que cargar a los jugadores.'}
          </p>
          {puedeEditar && (
            <button type="button" className="btn btn-gold" onClick={abrirSelector}>
              <UserPlus size={18} strokeWidth={2.5} />
              Cargar jugadores
            </button>
          )}
        </section>
      )}

      {/* ---------- JUGADORES ---------- */}
      {pestana === 'jugadores' && datos.participaciones.length > 0 && (
        <>
          {conResultados.map((p, i) => (
            <section key={p.id} className="panel">
              <div className="mb-2 flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-felt font-display text-[13px] text-white">
                  {i + 1}
                </span>
                <b className="min-w-0 flex-1 truncate font-display text-xl font-semibold text-ink">
                  {p.nombre}
                </b>
              </div>
              {puedeEditar ? (
                <MoneyInput
                  label="Entra con"
                  value={p.entrada}
                  onChange={(v) => tocar(p.id, { entrada: v }, { entrada: v })}
                />
              ) : (
                <p className="m-0 text-[13px] text-ink-soft">
                  Entra con <b className="text-ink">{money(p.entrada)}</b>
                </p>
              )}
            </section>
          ))}
          {puedeEditar && (
            <button type="button" className="btn btn-ghost" onClick={abrirSelector}>
              <UserPlus size={17} strokeWidth={2.4} />
              Cambiar quiénes juegan
            </button>
          )}
        </>
      )}

      {/* ---------- REPARTO ---------- */}
      {pestana === 'reparto' && reparto && datos.participaciones.length > 0 && (
        <>
          <section className="panel">
            <p className="panel-title">
              <span>Reparto de fichas</span>
            </p>
            <p className="mt-0 mb-0 text-[13px] leading-snug text-ink-soft">
              Calculado con las fichas de la liga. Puedes editar a mano y los demás se reacomodan.
            </p>
          </section>

          {reparto.rows.map((r) => (
            <section key={r.id} className="panel">
                <div className="mb-2.5 flex items-center gap-2">
                  <b className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-ink">
                    {r.name}
                  </b>
                  {r.manual && (
                    <button
                      type="button"
                      disabled={!puedeEditar}
                      onClick={() => tocar(r.id, { fichas_manual: null }, { fichasManual: null })}
                      className="flex cursor-pointer items-center gap-1 rounded-full border-none bg-gold/20 px-2 py-1 text-[11px] font-bold text-[#7a5d20]"
                    >
                      <RotateCcw size={11} strokeWidth={3} />
                      Auto
                    </button>
                  )}
                  <span className="font-bold text-ink-soft">{money(r.buyIn)}</span>
                </div>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(58px,1fr))] gap-1.5">
                  {colores.map((c) => (
                    <label key={c.key} className="flex flex-col items-center gap-1">
                      <Chip color={c} />
                      <span className="sr-only">{c.label}</span>
                      <NumInput
                        value={r.counts[c.key] ?? 0}
                        showZero
                        aria-label={`Fichas ${c.label} para ${r.name}`}
                        className="w-full rounded-lg border border-paper-line bg-white px-0.5 py-2 text-center text-[15px] font-semibold outline-none focus:border-gold disabled:opacity-60"
                        onChange={(v) => {
                          if (!puedeEditar) return
                          const nuevas = { ...r.counts, [c.key]: v }
                          tocar(r.id, { fichas_manual: JSON.stringify(nuevas) }, { fichasManual: nuevas })
                        }}
                      />
                    </label>
                  ))}
                </div>

                <p className="mt-2.5 mb-0 flex items-center gap-1.5 text-xs text-ink-soft">
                  Total: <b className="text-ink">{money(r.total)}</b>
                  {Math.abs(r.leftover) < EPS ? (
                    <Check size={13} strokeWidth={3} className="text-win" />
                  ) : (
                    <>
                      <span>· {r.leftover > 0 ? `faltan ${money(r.leftover)}` : `te pasas ${money(-r.leftover)}`}</span>
                      <AlertTriangle size={13} strokeWidth={2.6} className="text-loss" />
                    </>
                  )}
                </p>
            </section>
          ))}

          <section className="panel">
            <p className="panel-title">
              <span>Inventario usado</span>
            </p>
            {reparto.anyOver && (
              <div className="balance balance-off">
                <AlertTriangle size={16} strokeWidth={2.4} />
                <span>Estás repartiendo más fichas de las que tiene la liga en algún color.</span>
              </div>
            )}
            <ul className="m-0 list-none p-0">
              {colores.map((c) => {
                const u = reparto.usage[c.key]
                return (
                  <li
                    key={c.key}
                    className="flex items-center justify-between border-b border-dashed border-paper-line py-2.5 last:border-b-0"
                  >
                    <span className="flex items-center gap-2">
                      <Chip color={c} />
                      <span className="font-semibold text-ink">{c.label}</span>
                    </span>
                    <span className={`font-display font-bold ${u.over ? 'text-loss' : 'text-ink-soft'}`}>
                      {u.used} / {u.inventory}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}

      {/* ---------- FINAL ---------- */}
      {pestana === 'final' && datos.participaciones.length > 0 && (
        <>
          {conResultados.map((p) => {
            const finales = leerJson<Chips>(p.fichas_final, {})
            return (
              <section key={p.id} className="panel">
                <b className="mb-2.5 block truncate font-display text-lg font-semibold text-ink">
                  {p.nombre}
                </b>
                <ChipsGrid
                  colors={colores}
                  chips={finales}
                  onChange={(key, v) => {
                    if (!puedeEditar) return
                    const nuevas = { ...finales, [key]: v }
                    tocar(p.id, { fichas_final: JSON.stringify(nuevas) }, { fichasFinal: nuevas })
                  }}
                />
                <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-felt-line px-3.5 py-2.5 text-[#eafff2]">
                  <span className="text-[10px] tracking-[.6px] uppercase opacity-70">Invertido</span>
                  <b className="font-display">{money(p.invertido)}</b>
                  <span className="ml-auto font-display text-lg font-bold" style={{ color: p.pl > EPS ? '#d9b063' : p.pl < -EPS ? '#e4695e' : '#9d9483' }}>
                    {signed(p.pl)}
                  </span>
                </div>
              </section>
            )
          })}
        </>
      )}

      {/* ---------- RESULTADO ---------- */}
      {pestana === 'resultado' && datos.participaciones.length > 0 && (
        <section className="panel">
          <p className="panel-title">
            <span>Resultado</span>
          </p>

          <div className="mb-3 grid grid-cols-2 gap-2.5">
            <div className="stat">
              <div className="stat-k">Total en la mesa</div>
              <div className="stat-v">{money(totalInvertido)}</div>
            </div>
            <div className="stat">
              <div className="stat-k">Fichas contadas</div>
              <div className="stat-v">{money(totalFinal)}</div>
            </div>
          </div>

          {Math.abs(diferencia) < EPS ? (
            <div className="balance balance-ok">
              <Check size={16} strokeWidth={2.6} />
              Las fichas cuadran con el dinero
            </div>
          ) : (
            <div className="balance balance-off">
              <AlertTriangle size={16} strokeWidth={2.4} />
              {diferencia > 0
                ? `Hay ${money(diferencia)} de más en fichas contadas`
                : `Faltan ${money(-diferencia)} en fichas contadas`}
            </div>
          )}

          <ul className="m-0 mb-3 list-none p-0">
            {ranking.map((r, i) => (
              <li
                key={r.id}
                className="flex items-center justify-between border-b border-dashed border-paper-line py-2.5 last:border-b-0 font-semibold"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {r.pl > EPS && <Medalla lugar={i + 1} />}
                  <span className="truncate text-ink">{r.nombre}</span>
                </span>
                <span
                  className={`font-display font-bold ${r.pl > EPS ? 'text-win' : r.pl < -EPS ? 'text-loss' : 'text-ink-soft'}`}
                >
                  {signed(r.pl)}
                </span>
              </li>
            ))}
          </ul>

          {puedeEditar && (
            <button type="button" className="btn btn-ghost" onClick={() => void cerrarPartida()}>
              <Lock size={17} strokeWidth={2.4} />
              Cerrar partida
            </button>
          )}
        </section>
      )}

      {/* ---- elegir quiénes jugaron ---- */}
      <Sheet abierta={eligiendo} onCerrar={() => setEligiendo(false)} titulo="¿Quiénes jugaron?">
        <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
          Marca a los que llegaron y pon con cuánto entra cada uno.
        </p>
        <ul className="m-0 mb-4 list-none p-0">
          {miembros.map((m) => {
            const puesto = m.id in seleccion
            return (
              <li key={m.id} className="border-b border-dashed border-paper-line py-2.5 last:border-b-0">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={puesto}
                    aria-label={`${m.nombre} jugó`}
                    className="h-5 w-5 shrink-0"
                    onChange={(e) =>
                      setSeleccion((s) => {
                        const n = { ...s }
                        if (e.target.checked) n[m.id] = 0
                        else delete n[m.id]
                        return n
                      })
                    }
                  />
                  <b className="min-w-0 flex-1 truncate text-[15px] text-ink">{m.nombre}</b>
                  {puesto && (
                    <div className="flex w-[120px] shrink-0 items-center rounded-lg border border-paper-line bg-white px-2">
                      <span className="font-bold text-ink-soft">$</span>
                      <NumInput
                        value={seleccion[m.id]}
                        mode="decimal"
                        aria-label={`Dinero de ${m.nombre}`}
                        className="w-full border-none bg-transparent px-1 py-2 text-[15px] font-semibold outline-none"
                        onChange={(v) => setSeleccion((s) => ({ ...s, [m.id]: v }))}
                      />
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        <button type="button" className="btn btn-gold mb-2" disabled={ocupado} onClick={() => void guardarJugadores()}>
          <Coins size={17} strokeWidth={2.4} />
          Guardar y repartir fichas
        </button>
      </Sheet>
    </div>
  )
}
