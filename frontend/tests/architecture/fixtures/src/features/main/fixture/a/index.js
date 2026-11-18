// Cùng cổng và module vẫn không được import feature khác.
import { fixtureFeatureB } from '../b/index.js'

export const fixtureFeatureA = fixtureFeatureB
