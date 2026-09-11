import type { ChipColor, Player, SessionState, Tournament } from './types'

export const STORAGE_KEY = 'poker_session_v5'

export const DEFAULT_COLORS: ChipColor[] = [
  { key: 'green', label: 'Verdes', color: '#1f8f4e', value: 25, inventory: 100 },
  { key: 'black', label: 'Negras', color: '#2b2b2b', value: 10, inventory: 100 },
  { key: 'red', label: 'Rojas', color: '#d0342c', value: 5, inventory: 150 },
  { key: 'blue', label: 'Azules', color: '#2563c9', value: 2, inventory: 150 },
  { key: 'white', label: 'Blancas', color: '#f2f2ea', value: 1, inventory: 200 },
]

/** Paleta para los colores que se agregan después de los que vienen por defecto. */
export const EXTRA_PALETTE = [
  '#7c4dff',
  '#ff9800',
  '#e91e8c',
  '#00bcd4',
  '#8d6e63',
  '#cddc39',
  '#607d8b',
]

export const DEFAULT_TOURNAMENT: Tournament = {
  buyIn: 0,
  rebuyPrice: 0,
  addOnPrice: 0,
  payouts: [{ pct: 50 }, { pct: 30 }, { pct: 20 }],
}

export const PAYOUT_PRESETS: { label: string; pcts: number[] }[] = [
  { label: 'Ganador único', pcts: [100] },
  { label: 'Top 2', pcts: [60, 40] },
  { label: 'Top 3', pcts: [50, 30, 20] },
  { label: 'Top 4', pcts: [40, 30, 20, 10] },
]

export function uid(): string {
  return Math.random().toString(36).slice(2, 9)
}

export function emptyChips(colors: ChipColor[]) {
  const c: Record<string, number> = {}
  for (const col of colors) c[col.key] = 0
  return c
}

export function newPlayer(colors: ChipColor[], name = ''): Player {
  return {
    id: uid(),
    name,
    entrada: { money: 0, chips: emptyChips(colors) },
    recompras: [],
    final: emptyChips(colors),
    tourney: { rebuys: 0, addons: 0, place: 0 },
    deal: null,
  }
}

export function newSession(mode: SessionState['mode'] = 'cash'): SessionState {
  const colors = DEFAULT_COLORS.map((c) => ({ ...c }))
  return {
    sessionName: '',
    mode,
    colors,
    players: [newPlayer(colors, 'Jugador 1')],
    tournament: { ...DEFAULT_TOURNAMENT, payouts: DEFAULT_TOURNAMENT.payouts.map((p) => ({ ...p })) },
  }
}
