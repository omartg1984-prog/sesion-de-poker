/** Un color de ficha del inventario de la casa. */
export interface ChipColor {
  key: string
  label: string
  /** Color en hex, p. ej. "#1f8f4e". */
  color: string
  /** Cuánto vale una ficha de este color. */
  value: number
  /** Cuántas fichas de este color hay físicamente. */
  inventory: number
}

/** Cantidad de fichas por color, indexada por `ChipColor.key`. */
export type Chips = Record<string, number>

export interface Recompra {
  money: number
  chips: Chips
}

export interface TourneyPlayer {
  rebuys: number
  addons: number
  /** Lugar en el que quedó (1 = primero). 0 = sin asignar. */
  place: number
}

export interface Player {
  id: string
  name: string
  entrada: { money: number; chips: Chips }
  recompras: Recompra[]
  final: Chips
  tourney: TourneyPlayer
  /** Reparto editado a mano. `null` = el jugador va en automático. */
  deal: Chips | null
}

export interface Payout {
  /** Porcentaje de la bolsa. El lugar es el índice + 1. */
  pct: number
}

export interface Tournament {
  buyIn: number
  rebuyPrice: number
  addOnPrice: number
  payouts: Payout[]
}

export type Mode = 'cash' | 'torneo'

export interface SessionState {
  sessionName: string
  mode: Mode
  colors: ChipColor[]
  players: Player[]
  tournament: Tournament
}

export type CashTab = 'entrada' | 'reparto' | 'recompra' | 'final' | 'resultado'
export type TorneoTab = 't_config' | 't_jugadores' | 'reparto' | 't_resultado'
export type Tab = CashTab | TorneoTab
