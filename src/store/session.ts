import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { count, num } from '../lib/money'
import {
  DEFAULT_TOURNAMENT,
  EXTRA_PALETTE,
  STORAGE_KEY,
  emptyChips,
  newPlayer,
  newSession,
  uid,
} from './defaults'
import type { ChipColor, Chips, Mode, Player, SessionState, Tab } from './types'

export const TABS: Record<Mode, { id: Tab; label: string }[]> = {
  cash: [
    { id: 'entrada', label: 'Entrada' },
    { id: 'reparto', label: 'Reparto' },
    { id: 'recompra', label: 'Recompra' },
    { id: 'final', label: 'Final' },
    { id: 'resultado', label: 'Resultado' },
  ],
  torneo: [
    { id: 't_config', label: 'Torneo' },
    { id: 't_jugadores', label: 'Jugadores' },
    { id: 'reparto', label: 'Reparto' },
    { id: 't_resultado', label: 'Resultado' },
  ],
}

/**
 * Deja el estado consistente: rellena lo que falte y sincroniza las fichas de
 * todos los jugadores con la lista de colores actual (al agregar o quitar un color).
 */
export function reconcile(s: SessionState): SessionState {
  const mode: Mode = s.mode === 'torneo' ? 'torneo' : 'cash'
  const colors: ChipColor[] = (s.colors ?? []).map((c) => ({
    key: c.key || uid(),
    label: c.label ?? '',
    color: c.color || '#7c4dff',
    value: num(c.value),
    inventory: count(c.inventory),
  }))

  const fill = (chips: Chips | undefined): Chips => {
    const next: Chips = {}
    for (const c of colors) next[c.key] = count(chips?.[c.key])
    return next
  }

  const tournament = {
    buyIn: num(s.tournament?.buyIn),
    rebuyPrice: num(s.tournament?.rebuyPrice),
    addOnPrice: num(s.tournament?.addOnPrice),
    payouts:
      s.tournament?.payouts?.length
        ? s.tournament.payouts.map((p) => ({ pct: num(p.pct) }))
        : DEFAULT_TOURNAMENT.payouts.map((p) => ({ ...p })),
  }

  const players: Player[] = (s.players ?? []).map((p) => ({
    id: p.id || uid(),
    name: p.name ?? '',
    entrada: { money: num(p.entrada?.money), chips: fill(p.entrada?.chips) },
    recompras: (p.recompras ?? []).map((r) => ({ money: num(r.money), chips: fill(r.chips) })),
    final: fill(p.final),
    tourney: {
      rebuys: count(p.tourney?.rebuys),
      addons: count(p.tourney?.addons),
      place: count(p.tourney?.place),
    },
    deal: p.deal ? fill(p.deal) : null,
  }))

  if (!players.length) players.push(newPlayer(colors, 'Jugador 1'))
  if (!colors.length) colors.push({ key: uid(), label: 'Fichas', color: '#1f8f4e', value: 1, inventory: 100 })

  return { sessionName: s.sessionName ?? '', mode, colors, players, tournament }
}

interface UiState {
  activeTab: Tab
  /** Repartir sin límite de fichas. Vive solo en la sesión abierta. */
  ignoreInventory: boolean
  toast: string | null
}

interface Actions {
  setSessionName: (v: string) => void
  setMode: (m: Mode) => void
  setTab: (t: Tab) => void
  setIgnoreInventory: (v: boolean) => void
  showToast: (msg: string) => void
  clearToast: () => void

  addColor: () => void
  updateColor: (key: string, patch: Partial<ChipColor>) => void
  removeColor: (key: string) => void

  addPlayer: () => void
  removePlayer: (id: string) => void
  setPlayerName: (id: string, name: string) => void

  setEntradaMoney: (id: string, v: number) => void
  setEntradaChip: (id: string, colorKey: string, v: number) => void

  addRecompra: (id: string) => void
  removeRecompra: (id: string, index: number) => void
  setRecompraMoney: (id: string, index: number, v: number) => void
  setRecompraChip: (id: string, index: number, colorKey: string, v: number) => void

  setFinalChip: (id: string, colorKey: string, v: number) => void

  setDeal: (id: string, chips: Chips) => void
  clearDeal: (id: string) => void
  clearAllDeals: () => void

  setTournamentField: (field: 'buyIn' | 'rebuyPrice' | 'addOnPrice', v: number) => void
  setPayoutPct: (index: number, pct: number) => void
  addPayout: () => void
  removePayout: (index: number) => void
  applyPayoutPreset: (pcts: number[]) => void
  setTourneyCount: (id: string, field: 'rebuys' | 'addons', v: number) => void
  assignPlace: (place: number, playerId: string | null) => void

  replaceSession: (s: SessionState) => void
  resetSession: () => void
}

export type Store = SessionState & UiState & Actions

const safeStorage = createJSONStorage<SessionState>(() => ({
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch {
      /* modo privado o sin cuota: la app sigue funcionando, solo no guarda */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      /* ignorar */
    }
  },
}))

export const useSession = create<Store>()(
  persist(
    (set, get) => {
      /** Aplica `fn` al jugador `id` y devuelve la lista nueva. */
      const mapPlayer = (id: string, fn: (p: Player) => Player) => ({
        players: get().players.map((p) => (p.id === id ? fn(p) : p)),
      })

      return {
        ...newSession(),
        activeTab: 'entrada',
        ignoreInventory: false,
        toast: null,

        setSessionName: (v) => set({ sessionName: v }),
        setMode: (m) => {
          if (get().mode === m) return
          set({ mode: m, activeTab: TABS[m][0].id })
        },
        setTab: (t) => set({ activeTab: t }),
        setIgnoreInventory: (v) => set({ ignoreInventory: v }),
        showToast: (msg) => set({ toast: msg }),
        clearToast: () => set({ toast: null }),

        addColor: () => {
          const used = get().colors.map((c) => c.color)
          const color = EXTRA_PALETTE.find((c) => !used.includes(c)) ?? '#7c4dff'
          const next = [...get().colors, { key: uid(), label: 'Nuevo', color, value: 1, inventory: 50 }]
          set(reconcile({ ...get(), colors: next }))
        },
        updateColor: (key, patch) =>
          set({ colors: get().colors.map((c) => (c.key === key ? { ...c, ...patch } : c)) }),
        removeColor: (key) => {
          if (get().colors.length <= 1) {
            get().showToast('Deja al menos un color')
            return
          }
          set(reconcile({ ...get(), colors: get().colors.filter((c) => c.key !== key) }))
        },

        addPlayer: () => {
          const { colors, players } = get()
          set({ players: [...players, newPlayer(colors, `Jugador ${players.length + 1}`)] })
        },
        removePlayer: (id) => {
          const rest = get().players.filter((p) => p.id !== id)
          set({ players: rest.length ? rest : [newPlayer(get().colors, 'Jugador 1')] })
        },
        setPlayerName: (id, name) => set(mapPlayer(id, (p) => ({ ...p, name }))),

        setEntradaMoney: (id, v) =>
          set(mapPlayer(id, (p) => ({ ...p, entrada: { ...p.entrada, money: v } }))),
        setEntradaChip: (id, colorKey, v) =>
          set(
            mapPlayer(id, (p) => ({
              ...p,
              entrada: { ...p.entrada, chips: { ...p.entrada.chips, [colorKey]: v } },
            })),
          ),

        addRecompra: (id) =>
          set(
            mapPlayer(id, (p) => ({
              ...p,
              recompras: [...p.recompras, { money: 0, chips: emptyChips(get().colors) }],
            })),
          ),
        removeRecompra: (id, index) =>
          set(mapPlayer(id, (p) => ({ ...p, recompras: p.recompras.filter((_, i) => i !== index) }))),
        setRecompraMoney: (id, index, v) =>
          set(
            mapPlayer(id, (p) => ({
              ...p,
              recompras: p.recompras.map((r, i) => (i === index ? { ...r, money: v } : r)),
            })),
          ),
        setRecompraChip: (id, index, colorKey, v) =>
          set(
            mapPlayer(id, (p) => ({
              ...p,
              recompras: p.recompras.map((r, i) =>
                i === index ? { ...r, chips: { ...r.chips, [colorKey]: v } } : r,
              ),
            })),
          ),

        setFinalChip: (id, colorKey, v) =>
          set(mapPlayer(id, (p) => ({ ...p, final: { ...p.final, [colorKey]: v } }))),

        setDeal: (id, chips) => set(mapPlayer(id, (p) => ({ ...p, deal: { ...chips } }))),
        clearDeal: (id) => set(mapPlayer(id, (p) => ({ ...p, deal: null }))),
        clearAllDeals: () => set({ players: get().players.map((p) => ({ ...p, deal: null })) }),

        setTournamentField: (field, v) => set({ tournament: { ...get().tournament, [field]: v } }),
        setPayoutPct: (index, pct) =>
          set({
            tournament: {
              ...get().tournament,
              payouts: get().tournament.payouts.map((p, i) => (i === index ? { pct } : p)),
            },
          }),
        addPayout: () =>
          set({
            tournament: { ...get().tournament, payouts: [...get().tournament.payouts, { pct: 0 }] },
          }),
        removePayout: (index) => {
          const t = get().tournament
          if (t.payouts.length <= 1) {
            get().showToast('Deja al menos un lugar')
            return
          }
          const place = index + 1
          set({
            tournament: { ...t, payouts: t.payouts.filter((_, i) => i !== index) },
            // los lugares por debajo del que se borró se recorren uno arriba
            players: get().players.map((p) =>
              p.tourney.place === place
                ? { ...p, tourney: { ...p.tourney, place: 0 } }
                : p.tourney.place > place
                  ? { ...p, tourney: { ...p.tourney, place: p.tourney.place - 1 } }
                  : p,
            ),
          })
        },
        applyPayoutPreset: (pcts) =>
          set({
            tournament: { ...get().tournament, payouts: pcts.map((pct) => ({ pct })) },
            players: get().players.map((p) =>
              p.tourney.place > pcts.length ? { ...p, tourney: { ...p.tourney, place: 0 } } : p,
            ),
          }),
        setTourneyCount: (id, field, v) =>
          set(mapPlayer(id, (p) => ({ ...p, tourney: { ...p.tourney, [field]: Math.max(0, v) } }))),
        assignPlace: (place, playerId) =>
          set({
            players: get().players.map((p) => {
              if (p.id === playerId) return { ...p, tourney: { ...p.tourney, place } }
              if (p.tourney.place === place) return { ...p, tourney: { ...p.tourney, place: 0 } }
              return p
            }),
          }),

        replaceSession: (s) => {
          const clean = reconcile(s)
          set({ ...clean, activeTab: TABS[clean.mode][0].id })
        },
        resetSession: () => {
          const clean = newSession(get().mode)
          set({ ...clean, activeTab: TABS[clean.mode][0].id })
        },
      }
    },
    {
      name: STORAGE_KEY,
      storage: safeStorage,
      version: 1,
      // Solo se guarda la sesión; la pestaña abierta y el toast son de la vista.
      partialize: (s): SessionState => ({
        sessionName: s.sessionName,
        mode: s.mode,
        colors: s.colors,
        players: s.players,
        tournament: s.tournament,
      }),
      merge: (persisted, current) => {
        const clean = reconcile(persisted as SessionState)
        return { ...current, ...clean, activeTab: TABS[clean.mode][0].id }
      },
    },
  ),
)

/** Lo que se exporta e importa como respaldo. */
export function currentSession(s: Store): SessionState {
  return {
    sessionName: s.sessionName,
    mode: s.mode,
    colors: s.colors,
    players: s.players,
    tournament: s.tournament,
  }
}
