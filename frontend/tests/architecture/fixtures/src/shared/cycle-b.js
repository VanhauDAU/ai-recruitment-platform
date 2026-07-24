/* oxlint-disable import/no-cycle -- Deliberate negative architecture fixture. */
import { cycleA } from './cycle-a.js'

export const cycleB = cycleA
