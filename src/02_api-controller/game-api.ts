/**
 * Public game control surface.
 * UI and graphics may read snapshots or send commands only through this boundary.
 * Keep nucleus storage and mutation details private from presentation modules.
 */
import { createGameNucleus } from '../01_nucleus-core/ledger.ts'
import type { GameCommand, GameSnapshot } from '../01_nucleus-core/ledger.ts'

export type { GameCommand, GameSnapshot } from '../01_nucleus-core/ledger.ts'

export interface GameAPI {
  read(): GameSnapshot
  command(command: GameCommand): GameSnapshot
}

/** Constructs the controller facade over a private simulation nucleus. */
export function createGameApi(): GameAPI {
  const nucleus = createGameNucleus()
  return {
    read: () => nucleus.read(),
    command: (command) => nucleus.command(command),
  }
}
