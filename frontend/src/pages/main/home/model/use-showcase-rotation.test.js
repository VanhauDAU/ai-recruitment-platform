import { expect, test } from 'vitest'
import { showcaseSlot } from './use-showcase-rotation'

const slots = (center, count) => Array.from({ length: count }, (_, index) => showcaseSlot(index, center, count))

test('three templates sit left, centre and right of the current one', () => {
  expect(slots(1, 3)).toEqual(['left-1', 'center', 'right-1'])
  expect(slots(0, 3)).toEqual(['center', 'right-1', 'left-1'])
})

test('ten templates fill two layers per side and wait behind, wrapping around the ring', () => {
  expect(slots(5, 10)).toEqual([
    'back', 'back', 'back', 'left-2', 'left-1', 'center', 'right-1', 'right-2', 'back', 'back',
  ])
  expect(slots(0, 10)).toEqual([
    'center', 'right-1', 'right-2', 'back', 'back', 'back', 'back', 'back', 'left-2', 'left-1',
  ])
})

test('a single template is always centred', () => {
  expect(slots(0, 1)).toEqual(['center'])
})
