/* oxlint-disable import/no-cycle -- Deliberate negative architecture fixture. */
import { cycleB } from './cycle-b.js'

export const cycleA = cycleB
