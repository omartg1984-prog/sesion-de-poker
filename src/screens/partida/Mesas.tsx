import { useEffect, useState } from 'react'
import {
  Bell,
  Coins,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Sparkles,
  Timer,
  Users,
  X,
} from 'lucide-react'
import Cara from '../../components/Cara'
import NumInput from '../../components/NumInput'
import Sheet from '../../components/Sheet'
import { api, type DetallePartida } from '../../lib/api'
import { money, moneyShort, num } from '../../lib/money'
import {
  MINIMO_PARA_MESAS,
  MINUTOS_SUGERIDOS,
  cuantasMesasSugeridas,
  faltaParaElCambio,
  maximoDeMesas,
  mesasVacias,
  nivelesDeLaLiga,
  resumenDeMesas,
  sinMesa,
  sortearMesas,
  tocaCambiar,
  type JugadorParaSortear,
  type Mesas as Reparto,
} from '../../lib/mesas'
import { despertarAudio } from '../../lib/sonidos'
import {
  RELOJ_PARADO,
  arrancarReloj,
  pausarReloj,
  reloj as formatear,
} from '../../lib/torneo'
import { conAviso } from '../../store/app'
import { invertidoDe } from './comun'

/*
 * El sorteo de mesas de la noche.
 *
 * Vive dentro de la partida y no en la liga porque es cosa de una noche: a quién le
 * tocó con quién hoy no tiene nada que ver con la de la semana que viene. Lo que sí
 * viene de la liga es el nivel de cada quien, que es con lo que se reparten los buenos
 * entre las dos mesas en vez de dejarlos juntos.
 *
 * Todo es opcional: la mesa de seis no usa nada de esto.
 */

interface Props {
  datos: DetallePartida
  mesas: Reparto
  puedeEditar: boolean
  onMesas: (m: Reparto) => void
}

export default function Mesas({ datos, mesas, puedeEditar, onMesas }: Props) {
  /* El nivel sale de la tabla de la liga, que es otra consulta. Se pide al abrir la
     pestaña y no al cargar la partida: la mayoría de las noches nadie entra aquí. */
  const [niveles, setNiveles] = useState<Record<string, number> | null>(null)
  const [contando, setContando] = useState(false)
  const [borrador, setBorrador] = useState<Record<string, number>>({})
  const [quitando, setQuitando] = useState(false)

  const hayReparto = mesas.ronda > 0 && mesas.mesas.length > 0
  const [cuantas, setCuantas] = useState(() =>
    hayReparto
      ? mesas.mesas.length
      : cuantasMesasSugeridas(datos.participaciones.length),
  )

  useEffect(() => {
    let cancelado = false
    void (async () => {
      const t = await conAviso(() => api.posiciones(datos.partida.liga_id))
      if (!cancelado) setNiveles(nivelesDeLaLiga(t?.posiciones ?? []))
    })()
    return () => {
      cancelado = true
    }
  }, [datos.partida.liga_id])

  /* Un latido por segundo para que la cuenta atrás se mueva sola. */
  const [, latir] = useState(0)
  useEffect(() => {
    if (!mesas.reloj.corriendo) return
    const t = setInterval(() => latir((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [mesas.reloj.corriendo])

  /*
   * Al que ya cobró y se fue no se le vuelve a sentar en ninguna mesa. Los demás
   * entran todos, incluidos los que llegaron después del último sorteo: por eso el
   * sorteo se rehace, no se parcha.
   */
  const enJuego = datos.participaciones.filter((p) => p.cerrado_en === null)
  const jugadores: JugadorParaSortear[] = enJuego.map((p) => ({
    id: p.usuario_id,
    nombre: p.nombre,
    nivel: niveles?.[p.usuario_id] ?? null,
    dinero: p.usuario_id in mesas.dinero ? num(mesas.dinero[p.usuario_id]) : null,
  }))

  const resumen = resumenDeMesas(mesas.mesas, jugadores)
  const tarde = sinMesa(mesas.mesas, jugadores)
  const falta = faltaParaElCambio(mesas)
  const yaToca = tocaCambiar(mesas)
  const tope = Math.max(2, maximoDeMesas(jugadores.length))
  const opciones = Array.from({ length: Math.min(tope, 4) - 1 }, (_, i) => i + 2)

  const sortear = (dinero: Record<string, number> | null) => {
    const lista = jugadores.map((j) => ({
      ...j,
      dinero: dinero ? (j.id in dinero ? num(dinero[j.id]) : null) : null,
    }))
    const reparto = sortearMesas(lista, cuantas)
    despertarAudio()
    onMesas({
      ...mesas,
      mesas: reparto,
      ronda: mesas.ronda + 1,
      sorteadoEn: new Date().toISOString(),
      conDinero: !!dinero,
      /* Lo contado se guarda aunque el sorteo no lo use: sirve para la próxima vez,
         que así no arranca de cero. */
      dinero: dinero ?? mesas.dinero,
      /* El reloj vuelve a empezar: el rato de la mesa nueva se cuenta desde ahora. */
      reloj: arrancarReloj(RELOJ_PARADO),
    })
    setContando(false)
  }

  const abrirConteo = () => {
    const b: Record<string, number> = {}
    for (const p of enJuego)
      b[p.usuario_id] =
        p.usuario_id in mesas.dinero ? num(mesas.dinero[p.usuario_id]) : invertidoDe(p)
    setBorrador(b)
    setContando(true)
  }

  const enLaMesa = enJuego.reduce((a, p) => a + invertidoDe(p), 0)
  const contado = Object.values(borrador).reduce((a, v) => a + num(v), 0)

  /* ---- todavía no se ha sorteado nada ---- */
  if (!hayReparto) {
    return (
      <>
        <section className="panel">
          <p className="panel-title">
            <span>Partir la noche en dos mesas</span>
          </p>
          <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
            {jugadores.length < MINIMO_PARA_MESAS ? (
              <>
                Con {jugadores.length} caben todos en una mesa y esto no hace falta. Si aun
                así quieres partirla, aquí está.
              </>
            ) : (
              <>
                Son {jugadores.length} y no caben en una sola. El sorteo reparte a los que
                mejor juegan entre las mesas, en vez de dejarlos todos juntos.
              </>
            )}
          </p>

          <ElegirCuantas
            cuantas={cuantas}
            opciones={opciones}
            jugadores={jugadores.length}
            onCambiar={setCuantas}
            puedeEditar={puedeEditar}
          />

          {puedeEditar ? (
            <button
              type="button"
              className="btn btn-marca mt-3"
              disabled={jugadores.length < 2}
              onClick={() => sortear(null)}
            >
              <Shuffle size={17} strokeWidth={2.4} />
              Sortear las mesas
            </button>
          ) : (
            <p className="mt-3 mb-0 text-[12px] text-ink-soft">
              El sorteo lo hace quien lleva la noche.
            </p>
          )}
        </section>

        <ComoFunciona />
      </>
    )
  }

  /* ---- ya hay mesas ---- */
  return (
    <>
      {/* El reloj del cambio. Arriba de todo porque es lo que se viene a mirar. */}
      <section
        className={`panel overflow-hidden bg-noche-honda bg-gradient-to-br ring-1 ${
          yaToca ? 'from-[#3a1118] to-[#1a0e12] ring-marca' : 'from-[#2a1016] to-[#100e12] ring-marca/35'
        }`}
      >
        <p className="panel-title !text-tiza-suave">
          <span>{yaToca ? 'Toca cambiar de mesa' : 'Para el cambio de mesa'}</span>
        </p>

        <div className="text-center">
          <div
            className={`font-display text-[52px] leading-none font-bold tabular-nums ${
              yaToca ? 'text-marca-alta' : 'text-white'
            }`}
          >
            {formatear(Math.abs(falta))}
          </div>
          <p className="mt-1 mb-0 text-[12px] text-tiza-suave">
            {yaToca
              ? 'De más. Cuenten las fichas y vuelvan a sortear.'
              : mesas.reloj.corriendo
                ? `Cada ${mesas.minutos} minutos`
                : 'En pausa'}
          </p>
        </div>

        {puedeEditar && (
          <>
            <div className="no-scrollbar -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1">
              {MINUTOS_SUGERIDOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mesas.minutos === m}
                  onClick={() => onMesas({ ...mesas, minutos: m })}
                  className={`shrink-0 cursor-pointer rounded-full border-none px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    mesas.minutos === m ? 'bg-marca text-white' : 'bg-white/12 text-tiza-suave'
                  }`}
                >
                  {m} min
                </button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn btn-marca"
                onClick={() => {
                  despertarAudio()
                  onMesas({
                    ...mesas,
                    reloj: mesas.reloj.corriendo
                      ? pausarReloj(mesas.reloj)
                      : arrancarReloj(mesas.reloj),
                  })
                }}
              >
                {mesas.reloj.corriendo ? (
                  <>
                    <Pause size={17} strokeWidth={2.6} />
                    Pausa
                  </>
                ) : (
                  <>
                    <Play size={17} strokeWidth={2.6} />
                    Seguir
                  </>
                )}
              </button>
              <button
                type="button"
                aria-label="Volver a empezar la cuenta"
                className="flex w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border-none bg-white/12 text-white active:scale-95"
                onClick={() => onMesas({ ...mesas, reloj: arrancarReloj(RELOJ_PARADO) })}
              >
                <RotateCcw size={17} strokeWidth={2.4} />
              </button>
            </div>

            <p className="mt-2 mb-0 flex items-center justify-center gap-1.5 text-[11px] text-tiza-suave">
              <Bell size={11} strokeWidth={2.6} />
              Suena aunque estés en otra pestaña
            </p>
          </>
        )}
      </section>

      {mesas.mesas.map((ids, i) => (
        <LaMesa key={i} numero={i + 1} resumen={resumen[i]} ids={ids} />
      ))}

      {tarde.length > 0 && (
        <section className="panel">
          <p className="panel-title">
            <span>Llegaron después del sorteo</span>
          </p>
          <p className="mt-0 mb-2 text-[13px] leading-snug text-ink-soft">
            {tarde.map((j) => j.nombre).join(', ')}{' '}
            {tarde.length === 1 ? 'no tiene' : 'no tienen'} mesa todavía.{' '}
            {tarde.length === 1 ? 'Siéntalo' : 'Siéntalos'} donde haga falta o vuelve a
            sortear.
          </p>
        </section>
      )}

      <section className="panel">
        <p className="panel-title">
          <span>
            Sorteo {mesas.ronda}
            {mesas.conDinero ? ' · con las fichas contadas' : ' · por nivel'}
          </span>
        </p>
        {puedeEditar ? (
          <>
            <button type="button" className="btn btn-marca mb-2" onClick={abrirConteo}>
              <Shuffle size={17} strokeWidth={2.4} />
              Cambio de mesa
            </button>
            <ElegirCuantas
              cuantas={cuantas}
              opciones={opciones}
              jugadores={jugadores.length}
              onCambiar={setCuantas}
              puedeEditar={puedeEditar}
            />
            <button
              type="button"
              className="btn btn-ghost mt-2"
              onClick={() => setQuitando(true)}
            >
              <X size={17} strokeWidth={2.4} />
              Volver a una sola mesa
            </button>
          </>
        ) : (
          <p className="mt-0 mb-0 text-[12px] text-ink-soft">
            El cambio de mesa lo hace quien lleva la noche.
          </p>
        )}
      </section>

      <ComoFunciona />

      {/* ---- el conteo rápido ---- */}
      <Sheet
        abierta={contando}
        onCerrar={() => setContando(false)}
        titulo="¿Cuánto trae cada quien?"
      >
        <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
          A ojo y en dinero, no ficha por ficha: con que ande cerca basta para que las mesas
          queden parejas. Lo exacto se cuenta al final, en el cash out.
        </p>

        <ul className="m-0 mb-3 list-none p-0">
          {enJuego.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2.5 border-b border-dashed border-paper-line py-2 last:border-b-0"
            >
              <Cara nombre={p.nombre} foto={p.foto} size={28} />
              <b className="min-w-0 flex-1 truncate text-[15px] text-ink">{p.nombre}</b>
              <div className="flex w-[120px] shrink-0 items-center rounded-lg border border-paper-line bg-white px-2">
                <span className="font-bold text-ink-soft">$</span>
                <NumInput
                  value={borrador[p.usuario_id] ?? 0}
                  mode="decimal"
                  showZero
                  aria-label={`Fichas de ${p.nombre}`}
                  className="w-full border-none bg-transparent px-1 py-2 text-[15px] font-semibold outline-none"
                  onChange={(v) => setBorrador((b) => ({ ...b, [p.usuario_id]: v }))}
                />
              </div>
            </li>
          ))}
        </ul>

        {/* Lo contado contra lo que entró. No tiene que cuadrar —es a ojo— pero una
            diferencia enorme casi siempre es un cero de más al teclear. */}
        <div className="mb-3 flex items-baseline justify-between rounded-xl border border-paper-line bg-paper-soft px-3.5 py-2.5">
          <span className="text-[11px] font-semibold tracking-[.5px] text-ink-soft uppercase">
            Contado · en la mesa
          </span>
          <b className="font-display text-[17px] font-bold text-ink tabular-nums">
            {money(contado)} · {money(enLaMesa)}
          </b>
        </div>

        <button type="button" className="btn btn-marca mb-2" onClick={() => sortear(borrador)}>
          <Shuffle size={17} strokeWidth={2.4} />
          Sortear con esto
        </button>
        <button type="button" className="btn btn-ghost mb-2" onClick={() => sortear(null)}>
          <Sparkles size={17} strokeWidth={2.4} />
          Sortear sin contar
        </button>
      </Sheet>

      {/* ---- quitar las mesas ---- */}
      <Sheet
        abierta={quitando}
        onCerrar={() => setQuitando(false)}
        titulo="Volver a una sola mesa"
      >
        <p className="mt-0 mb-4 text-[13px] leading-snug text-ink-soft">
          Se borra el reparto y el reloj del cambio. Lo que hayas contado se queda guardado
          por si vuelves a sortear.
        </p>
        <button
          type="button"
          className="btn btn-marca mb-2"
          onClick={() => {
            onMesas({ ...mesasVacias(), minutos: mesas.minutos, dinero: mesas.dinero })
            setQuitando(false)
          }}
        >
          <X size={17} strokeWidth={2.4} />
          Sí, una sola mesa
        </button>
        <button type="button" className="btn btn-ghost mb-2" onClick={() => setQuitando(false)}>
          Mejor no
        </button>
      </Sheet>
    </>
  )
}

/** En cuántas mesas se parte. Dos casi siempre; tres cuando llega media liga. */
function ElegirCuantas({
  cuantas,
  opciones,
  jugadores,
  onCambiar,
  puedeEditar,
}: {
  cuantas: number
  opciones: number[]
  jugadores: number
  onCambiar: (n: number) => void
  puedeEditar: boolean
}) {
  if (!puedeEditar || opciones.length < 2) return null
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold tracking-[.6px] text-ink-soft uppercase">
        ¿En cuántas mesas?
      </p>
      <div className="flex gap-1.5">
        {opciones.map((n) => {
          const base = Math.floor(jugadores / n)
          const sobran = jugadores % n
          return (
            <button
              key={n}
              type="button"
              aria-pressed={cuantas === n}
              onClick={() => onCambiar(n)}
              className={`flex-1 cursor-pointer rounded-xl border px-2 py-2 text-center transition-colors ${
                cuantas === n
                  ? 'border-marca bg-marca text-white'
                  : 'border-paper-line bg-paper-soft text-ink'
              }`}
            >
              <span className="block font-display text-[17px] font-bold">{n} mesas</span>
              <span
                className={`block text-[11px] ${cuantas === n ? 'text-white/80' : 'text-ink-soft'}`}
              >
                {sobran === 0 ? `de ${base}` : `de ${base + 1} y ${base}`}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Una mesa con su gente y cómo quedó de pareja. */
function LaMesa({
  numero,
  resumen,
  ids,
}: {
  numero: number
  resumen: { jugadores: JugadorParaSortear[]; dinero: number; dineroPorCabeza: number; nivel: number | null; nuevos: number }
  ids: string[]
}) {
  if (!resumen || ids.length === 0) return null
  const hayDinero = resumen.dinero > 0
  return (
    <section className="panel">
      <p className="panel-title">
        <span>Mesa {numero}</span>
      </p>

      <ul className="m-0 list-none p-0">
        {resumen.jugadores.map((j) => (
          <li
            key={j.id}
            className="flex items-center gap-2.5 border-b border-dashed border-paper-line py-1.5 last:border-b-0"
          >
            <b className="min-w-0 flex-1 truncate text-[15px] text-ink">{j.nombre}</b>
            {j.dinero !== null && (
              <span className="shrink-0 font-display text-[15px] text-ink tabular-nums">
                {money(j.dinero)}
              </span>
            )}
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                j.nivel === null ? 'bg-marca/15 text-marca-tinta' : 'bg-ink/8 text-ink-soft'
              }`}
            >
              {j.nivel === null ? 'Nuevo' : `Nivel ${j.nivel.toFixed(1)}`}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2.5 mb-0 flex items-baseline justify-between border-t border-paper-line pt-2 text-[12px] text-ink-soft">
        <span className="flex items-center gap-1.5">
          <Users size={12} strokeWidth={2.6} />
          {resumen.jugadores.length} ·{' '}
          {resumen.nivel === null ? 'sin nivel' : `nivel ${resumen.nivel.toFixed(1)}`}
        </span>
        {hayDinero && (
          <b className="font-display text-[15px] text-ink tabular-nums">
            {money(resumen.dinero)}{' '}
            <span className="font-sans text-[11px] font-normal text-ink-soft">
              ({moneyShort(resumen.dineroPorCabeza)} cada uno)
            </span>
          </b>
        )}
      </p>
    </section>
  )
}

function ComoFunciona() {
  return (
    <section className="panel">
      <p className="panel-title">
        <span>Cómo reparte</span>
      </p>
      <ul className="m-0 list-none space-y-2 p-0 text-[13px] leading-snug text-ink-soft">
        <li className="flex gap-2">
          <Sparkles size={15} strokeWidth={2.4} className="mt-0.5 shrink-0 text-marca" />
          <span>
            Usa el <b className="text-ink">Nivel</b> de la tabla —los puntos por noche— para
            que los que mejor juegan queden repartidos. El que lleva menos de dos noches en la
            liga entra como <b className="text-ink">nuevo</b> y se reparte igual.
          </span>
        </li>
        <li className="flex gap-2">
          <Coins size={15} strokeWidth={2.4} className="mt-0.5 shrink-0 text-marca" />
          <span>
            En el cambio de mesa mira además{' '}
            <b className="text-ink">cuánto trae cada quien</b>, para que no queden todas las
            torres de fichas del mismo lado. No tiene que cuadrar al peso.
          </span>
        </li>
        <li className="flex gap-2">
          <Timer size={15} strokeWidth={2.4} className="mt-0.5 shrink-0 text-marca" />
          <span>
            Es un sorteo: dos seguidos con la misma gente dan mesas distintas. Lo que evita
            son los repartos malos, no elegir el perfecto.
          </span>
        </li>
      </ul>
    </section>
  )
}
