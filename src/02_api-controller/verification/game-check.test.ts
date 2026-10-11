/**
 * End-to-end simulation checks for the game nucleus.
 * These scenarios deliberately use only the public GameAPI; they never import nucleus internals.
 * Run with `npm run check:game` on Node 22.6+ (the project uses Node's built-in TS type stripping).
 */
import { deepEqual, equal, ok, notEqual } from 'node:assert/strict'
import { test } from 'node:test'
import { createGameApi } from '../game-api.ts'

function worldMinute(api: ReturnType<typeof createGameApi>): number {
  const { day, minute } = api.read().ledger.world
  return day * 1440 + minute
}

test('new game includes the required world, settings, catalogs, player, and future timeline', () => {
  const { ledger } = createGameApi().read()
  equal(ledger.settings.audience, 'all-ages')
  equal(ledger.settings.initialMode, 'single-player')
  equal(ledger.settings.onlineFeatures, 'future-possible')
  equal(ledger.worldDefinitions[0]?.id, ledger.world.definitionId)
  ok(ledger.characterDefinitions.some((item) => item.id === ledger.player.characterDefinitionId))
  ok(ledger.roleDefinitions.some((role) => role.id === ledger.player.roleId && role.enabled))
  ok(ledger.clothingDefinitions.length >= 5)
  ok(ledger.objectDefinitions.length >= 4)
  ok(ledger.collectionDefinitions.length >= 2)
  ok(ledger.schedule.some((item) => item.status === 'scheduled' && item.effectiveAt > worldMinute(createGameApi())))

  const world = ledger.worldDefinitions.find((item) => item.id === ledger.world.definitionId)
  ok(world)
  for (const objectId of world.spawnObjectIds) {
    ok(ledger.objectDefinitions.some((object) => object.id === objectId), `missing object definition: ${objectId}`)
  }
})

test('read snapshots are detached from the private core ledger', () => {
  const api = createGameApi()
  const exposed = api.read()
  exposed.ledger.player.coins = 9999
  exposed.ledger.player.inventoryItemIds.splice(0)
  equal(api.read().ledger.player.coins, 0)
  ok(api.read().ledger.player.inventoryItemIds.length > 0)
})

test('equipping owned clothing changes only the API-managed state and records history', () => {
  const api = createGameApi()
  const before = api.read().ledger
  const result = api.command({ type: 'equip', itemId: 'cloth.star-cardigan' })
  equal(result.ledger.player.equippedBySlot.top, 'cloth.star-cardigan')
  equal(result.ledger.history.at(-1)?.kind, 'item-equipped')
  equal(result.ledger.player.coins, before.player.coins)

  const invalid = api.command({ type: 'equip', itemId: 'cloth.not-owned' })
  equal(invalid.ledger.player.equippedBySlot.top, 'cloth.star-cardigan')
  matchMessage(invalid.lastMessage, '보유한 의상')
})

test('exploration consumes energy, advances world time, rewards coins, and records a collectible', () => {
  const api = createGameApi()
  const startMinute = worldMinute(api)
  for (let index = 0; index < 3; index += 1) api.command('explore')

  const { ledger } = api.read()
  equal(ledger.player.energy, 2)
  equal(ledger.player.coins, 9)
  equal(ledger.world.discoveries, 3)
  equal(worldMinute(api), startMinute + 3 * ledger.settings.minutesPerExplore)
  deepEqual(ledger.player.collectionItemIds, ['collectible.shimmer-shell'])
  equal(ledger.history.filter((event) => event.kind === 'time-advanced').length, 3)
  ok(ledger.history.every((event) => event.recordedAt >= startMinute && event.effectiveAt <= worldMinute(api)))
})

test('energy cannot be overdrawn and resting restores it without exceeding the configured cap', () => {
  const api = createGameApi()
  for (let index = 0; index < 5; index += 1) api.command('explore')
  const exhausted = api.read()
  const denied = api.command('explore')
  equal(denied.ledger.player.energy, 0)
  equal(denied.ledger.player.coins, exhausted.ledger.player.coins)
  equal(denied.ledger.world.minute, exhausted.ledger.world.minute)
  equal(denied.ledger.world.discoveries, exhausted.ledger.world.discoveries)

  api.command('rest')
  api.command('rest')
  const recovered = api.command('rest')
  equal(recovered.ledger.player.energy, recovered.ledger.settings.maxEnergy)
  ok(recovered.ledger.history.some((event) => event.kind === 'rested'))
})

test('interactions and character naming go through commands and enter the event history', () => {
  const api = createGameApi()
  const before = worldMinute(api)
  const interacted = api.command({ type: 'interact', objectId: 'object.memory-board' })
  equal(interacted.ledger.world.locationObjectId, 'object.memory-board')
  equal(worldMinute(api), before)
  const renamed = api.command({ type: 'rename', name: '달빛 산책자' })
  equal(renamed.ledger.player.name, '달빛 산책자')
  ok(renamed.ledger.history.some((event) => event.kind === 'object-interacted'))
  ok(renamed.ledger.history.some((event) => event.kind === 'character-renamed'))

  const invalid = api.command({ type: 'interact', objectId: 'object.not-in-this-world' })
  matchMessage(invalid.lastMessage, '찾을 수 없는')
})

test('future events stay pending until their effective time and apply exactly once', () => {
  const api = createGameApi()
  const scheduled = api.command({ type: 'schedule-event', title: '달빛 음악회', minutesFromNow: 120, rewardCoins: 7 })
  const event = scheduled.ledger.schedule.find((item) => item.title === '달빛 음악회')
  ok(event)
  equal(event.status, 'scheduled')
  equal(event.effectiveAt, worldMinute(api) + 120)

  api.command('advance-time')
  equal(api.read().ledger.player.coins, 0)
  equal(api.read().ledger.schedule.find((item) => item.id === event.id)?.status, 'scheduled')

  const applied = api.command('advance-time')
  equal(applied.ledger.player.coins, 7)
  equal(applied.ledger.schedule.find((item) => item.id === event.id)?.status, 'applied')
  const afterAnotherHour = api.command('advance-time')
  equal(afterAnotherHour.ledger.player.coins, 7)
  equal(afterAnotherHour.ledger.history.filter((item) => item.kind === 'reward-applied').length, 1)
  equal(afterAnotherHour.ledger.history.filter((item) => item.kind === 'time-advanced').length, 3)
  const appliedEvent = afterAnotherHour.ledger.history.find((item) => item.kind === 'reward-applied')
  ok(appliedEvent)
  equal(appliedEvent.effectiveAt, event.effectiveAt)
  equal(appliedEvent.recordedAt, event.effectiveAt)
})

test('future events can be cancelled and invalid schedules do not enter the timeline', () => {
  const api = createGameApi()
  const scheduled = api.command({ type: 'schedule-event', title: '섬 축제', minutesFromNow: 60, rewardCoins: 20 })
  const event = scheduled.ledger.schedule.find((item) => item.title === '섬 축제')
  ok(event)
  const cancelled = api.command({ type: 'cancel-event', scheduleId: event.id })
  equal(cancelled.ledger.schedule.find((item) => item.id === event.id)?.status, 'cancelled')
  const invalid = api.command({ type: 'schedule-event', title: '', minutesFromNow: 0, rewardCoins: -1 })
  equal(invalid.ledger.schedule.length, scheduled.ledger.schedule.length)
  matchMessage(invalid.lastMessage, '미래 일정')

  for (let index = 0; index < 2; index += 1) api.command('advance-time')
  equal(api.read().ledger.player.coins, 0)
})

test('the seeded day-two gift is applied once when the world clock crosses its effective time', () => {
  const api = createGameApi()
  const initialGift = api.read().ledger.schedule.find((item) => item.id === 'gift-day-2')
  ok(initialGift)
  const minutesUntilGift = initialGift.effectiveAt - worldMinute(api)
  for (let index = 0; index < minutesUntilGift / 60; index += 1) api.command('advance-time')

  const applied = api.read()
  equal(applied.ledger.schedule.find((item) => item.id === initialGift.id)?.status, 'applied')
  equal(applied.ledger.player.coins, initialGift.rewardCoins)
  notEqual(applied.ledger.world.day, 1)
  api.command('advance-time')
  equal(api.read().ledger.player.coins, initialGift.rewardCoins)
  equal(api.read().ledger.history.filter((item) => item.kind === 'reward-applied').length, 1)
})

function matchMessage(actual: string, expectedPart: string): void {
  ok(actual.includes(expectedPart), `expected message to include "${expectedPart}", received "${actual}"`)
}
