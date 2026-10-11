/**
 * The game's nucleus: authoritative definitions, settings, timeline, and player state.
 * Mutable state stays private to createGameNucleus; callers receive detached snapshots.
 * Keep this module independent from React, R3F, browser storage, and presentation.
 */
export type ClothingSlot = 'hair' | 'top' | 'bottom' | 'shoes' | 'accessory'
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
export type EventKind = 'game-started' | 'time-advanced' | 'explored' | 'rested' | 'reward-applied' | 'item-equipped' | 'object-interacted' | 'character-renamed' | 'action-scheduled' | 'action-cancelled'

export interface GameEvent {
  id: string
  kind: EventKind
  recordedAt: number
  effectiveAt: number
  summary: string
}

export interface ScheduledAction {
  id: string
  kind: 'daily-gift' | 'island-event'
  title: string
  effectiveAt: number
  status: 'scheduled' | 'applied' | 'cancelled'
  rewardCoins: number
}

export interface GameLedger {
  settings: {
    title: string
    audience: 'all-ages'
    initialMode: 'single-player'
    onlineFeatures: 'future-possible'
    minutesPerExplore: number
    minutesPerRest: number
    coinsPerExplore: number
    maxEnergy: number
  }
  worldDefinitions: Array<{ id: string; name: string; theme: string; description: string; spawnObjectIds: string[] }>
  objectDefinitions: Array<{ id: string; name: string; kind: 'landmark' | 'rest-point' | 'bulletin-board' | 'portal'; description: string; externalUrl?: string }>
  characterDefinitions: Array<{ id: string; name: string; rigId: string; description: string }>
  clothingDefinitions: Array<{ id: string; name: string; slot: ClothingSlot; rarity: Rarity; styleTags: string[]; compatibleRigIds: string[] }>
  collectionDefinitions: Array<{ id: string; name: string; rarity: Rarity; description: string }>
  roleDefinitions: Array<{ id: string; name: string; permissions: string[]; enabled: boolean }>
  world: { definitionId: string; minute: number; day: number; locationObjectId: string; discoveries: number }
  player: {
    name: string
    characterDefinitionId: string
    energy: number
    coins: number
    level: number
    equippedBySlot: Partial<Record<ClothingSlot, string>>
    inventoryItemIds: string[]
    collectionItemIds: string[]
    roleId: string
  }
  history: GameEvent[]
  schedule: ScheduledAction[]
}

export type GameCommand =
  | 'explore'
  | 'rest'
  | 'advance-time'
  | { type: 'equip'; itemId: string }
  | { type: 'interact'; objectId: string }
  | { type: 'rename'; name: string }
  | { type: 'schedule-event'; title: string; minutesFromNow: number; rewardCoins: number }
  | { type: 'cancel-event'; scheduleId: string }

export interface GameSnapshot {
  ledger: Readonly<GameLedger>
  lastMessage: string
}

export interface GameNucleus {
  read(): GameSnapshot
  command(command: GameCommand): GameSnapshot
}

function cloneLedger(source: GameLedger): GameLedger {
  return {
    ...source,
    settings: { ...source.settings },
    worldDefinitions: source.worldDefinitions.map((row) => ({ ...row, spawnObjectIds: [...row.spawnObjectIds] })),
    objectDefinitions: source.objectDefinitions.map((row) => ({ ...row })),
    characterDefinitions: source.characterDefinitions.map((row) => ({ ...row })),
    clothingDefinitions: source.clothingDefinitions.map((row) => ({ ...row, styleTags: [...row.styleTags], compatibleRigIds: [...row.compatibleRigIds] })),
    collectionDefinitions: source.collectionDefinitions.map((row) => ({ ...row })),
    roleDefinitions: source.roleDefinitions.map((row) => ({ ...row, permissions: [...row.permissions] })),
    world: { ...source.world },
    player: { ...source.player, equippedBySlot: { ...source.player.equippedBySlot }, inventoryItemIds: [...source.player.inventoryItemIds], collectionItemIds: [...source.player.collectionItemIds] },
    history: source.history.map((row) => ({ ...row })),
    schedule: source.schedule.map((row) => ({ ...row })),
  }
}

function absoluteMinute(world: GameLedger['world']): number {
  return world.day * 1440 + world.minute
}

/** Internal simulation. The API controller is the only application layer allowed to import this module. */
export function createGameNucleus(): GameNucleus {
  const ledger: GameLedger = {
    settings: {
      title: '구름섬의 하루', audience: 'all-ages', initialMode: 'single-player', onlineFeatures: 'future-possible',
      minutesPerExplore: 30, minutesPerRest: 60, coinsPerExplore: 3, maxEnergy: 5,
    },
    worldDefinitions: [{
      id: 'world.cloud-island', name: '구름섬', theme: '하늘에 떠 있는 동화섬',
      description: '캐릭터를 꾸미고 머물며 가볍게 탐험하고 수집하는 작은 생활 공간.',
      spawnObjectIds: ['object.wind-bell', 'object.cloud-bench', 'object.memory-board', 'object.link-arch'],
    }],
    objectDefinitions: [
      { id: 'object.wind-bell', name: '바람 종', kind: 'landmark', description: '탐험할 때마다 새로운 섬의 발견을 남기는 상징물.' },
      { id: 'object.cloud-bench', name: '구름 벤치', kind: 'rest-point', description: '잠시 쉬며 기운을 회복하는 장소.' },
      { id: 'object.memory-board', name: '기억 게시판', kind: 'bulletin-board', description: '게임 안팎의 소식과 링크를 연결할 게시판.' },
      { id: 'object.link-arch', name: '별빛 아치', kind: 'portal', description: '외부 웹 콘텐츠로 이어질 수 있는 관문. 안전한 링크 정책은 추후 설정.' },
    ],
    characterDefinitions: [
      { id: 'character.soft-traveler', name: '포근한 여행자', rigId: 'rig.stylized-humanoid', description: '다양한 체형·헤어·의상을 조합할 수 있는 기본 아바타.' },
      { id: 'character.cloud-spirit', name: '구름 정령', rigId: 'rig.stylized-spirit', description: '동화섬의 분위기에 맞춘 비인간형 캐릭터 후보.' },
    ],
    clothingDefinitions: [
      { id: 'cloth.cloud-beret', name: '구름 베레모', slot: 'hair', rarity: 'common', styleTags: ['soft', 'classic'], compatibleRigIds: ['rig.stylized-humanoid'] },
      { id: 'cloth.star-cardigan', name: '별빛 카디건', slot: 'top', rarity: 'uncommon', styleTags: ['soft', 'feminine', 'masculine'], compatibleRigIds: ['rig.stylized-humanoid'] },
      { id: 'cloth.sky-shorts', name: '하늘 산책 반바지', slot: 'bottom', rarity: 'common', styleTags: ['casual', 'masculine', 'feminine'], compatibleRigIds: ['rig.stylized-humanoid'] },
      { id: 'cloth.moon-boots', name: '달빛 부츠', slot: 'shoes', rarity: 'rare', styleTags: ['fantasy', 'bold'], compatibleRigIds: ['rig.stylized-humanoid', 'rig.stylized-spirit'] },
      { id: 'cloth.shell-charm', name: '조개 참 장식', slot: 'accessory', rarity: 'uncommon', styleTags: ['collectible', 'soft'], compatibleRigIds: ['rig.stylized-humanoid', 'rig.stylized-spirit'] },
    ],
    collectionDefinitions: [
      { id: 'collectible.shimmer-shell', name: '반짝 조개', rarity: 'common', description: '바람 종 주변에서 발견되는 작은 수집품.' },
      { id: 'collectible.cloud-fragment', name: '구름 조각', rarity: 'rare', description: '섬의 숨은 곳에서 가끔 발견되는 희귀 조각.' },
    ],
    roleDefinitions: [
      { id: 'role.player', name: '플레이어', permissions: ['play', 'customize', 'collect'], enabled: true },
      { id: 'role.host', name: '공간 진행자', permissions: ['play', 'customize', 'collect', 'manage-links', 'moderate-visitors'], enabled: false },
      { id: 'role.visitor', name: '방문자', permissions: ['visit', 'message'], enabled: false },
    ],
    world: { definitionId: 'world.cloud-island', minute: 9 * 60, day: 1, locationObjectId: 'object.wind-bell', discoveries: 0 },
    player: {
      name: '새싹 여행자', characterDefinitionId: 'character.soft-traveler', energy: 5, coins: 0, level: 1,
      equippedBySlot: {}, inventoryItemIds: ['cloth.cloud-beret', 'cloth.star-cardigan', 'cloth.sky-shorts', 'cloth.moon-boots', 'cloth.shell-charm'],
      collectionItemIds: [], roleId: 'role.player',
    },
    history: [],
    schedule: [{ id: 'gift-day-2', kind: 'daily-gift', title: '두 번째 날의 별빛 선물', effectiveAt: 2 * 1440, status: 'scheduled', rewardCoins: 10 }],
  }
  let sequence = 0
  let scheduleSequence = 0
  let lastMessage = '구름섬에 도착했어요. 캐릭터를 꾸미고 섬을 둘러보세요.'

  function appendEvent(kind: EventKind, effectiveAt: number, summary: string) {
    sequence += 1
    ledger.history.push({ id: `event-${sequence}`, kind, recordedAt: absoluteMinute(ledger.world), effectiveAt, summary })
  }

  function advance(minutes: number) {
    const absolute = absoluteMinute(ledger.world) + minutes
    ledger.world.day = Math.floor(absolute / 1440)
    ledger.world.minute = absolute % 1440
    for (const action of ledger.schedule) {
      if (action.status === 'scheduled' && action.effectiveAt <= absolute) {
        action.status = 'applied'
        ledger.player.coins += action.rewardCoins
        appendEvent('reward-applied', action.effectiveAt, `${action.title}: 별빛 코인 ${action.rewardCoins}개.`)
      }
    }
    appendEvent('time-advanced', absolute, `게임 시간이 ${minutes}분 진행됐어요.`)
  }

  return {
    read() { return { ledger: cloneLedger(ledger), lastMessage } },
    command(command) {
      if (command === 'explore') {
        if (ledger.player.energy <= 0) { lastMessage = '기운이 부족해요. 구름 벤치에서 쉬어 보세요.'; return this.read() }
        ledger.player.energy -= 1
        ledger.player.coins += ledger.settings.coinsPerExplore
        ledger.world.discoveries += 1
        if (ledger.world.discoveries % 3 === 0 && !ledger.player.collectionItemIds.includes('collectible.shimmer-shell')) ledger.player.collectionItemIds.push('collectible.shimmer-shell')
        advance(ledger.settings.minutesPerExplore)
        appendEvent('explored', absoluteMinute(ledger.world), '섬을 탐험하고 별빛 코인과 발견 기록을 얻었어요.')
        lastMessage = ledger.world.discoveries % 3 === 0 ? '반짝 조개를 발견했어요! 코인과 수집품이 장부에 기록됐어요.' : '바람 종 옆에서 반짝이는 흔적을 발견했어요. 코인과 탐험 기록이 장부에 추가됐어요.'
      } else if (command === 'rest') {
        ledger.player.energy = Math.min(ledger.settings.maxEnergy, ledger.player.energy + 2)
        advance(ledger.settings.minutesPerRest)
        appendEvent('rested', absoluteMinute(ledger.world), '구름 벤치에서 한 시간 쉬었어요.')
        lastMessage = '구름 벤치에서 쉬었어요. 기운을 조금 회복했어요.'
      } else if (command === 'advance-time') {
        advance(60)
        lastMessage = '게임 시간이 한 시간 흘렀어요. 장부의 미래 일정을 확인했어요.'
      } else if (command.type === 'equip') {
        const item = ledger.clothingDefinitions.find((row) => row.id === command.itemId)
        if (!item || !ledger.player.inventoryItemIds.includes(command.itemId)) { lastMessage = '보유한 의상만 장착할 수 있어요.'; return this.read() }
        const rigId = ledger.characterDefinitions.find((row) => row.id === ledger.player.characterDefinitionId)?.rigId
        if (!rigId || !item.compatibleRigIds.includes(rigId)) { lastMessage = '현재 캐릭터와 호환되지 않는 의상이에요.'; return this.read() }
        ledger.player.equippedBySlot[item.slot] = item.id
        appendEvent('item-equipped', absoluteMinute(ledger.world), `${item.name}을(를) 장착했어요.`)
        lastMessage = `${item.name}을(를) 장착했어요. 장착 상태가 장부에 기록됐어요.`
      } else if (command.type === 'interact') {
        const object = ledger.objectDefinitions.find((row) => row.id === command.objectId)
        if (!object || !ledger.worldDefinitions.find((row) => row.id === ledger.world.definitionId)?.spawnObjectIds.includes(object.id)) { lastMessage = '현재 공간에서 찾을 수 없는 오브젝트예요.'; return this.read() }
        ledger.world.locationObjectId = object.id
        appendEvent('object-interacted', absoluteMinute(ledger.world), `${object.name}과(와) 상호작용했어요.`)
        lastMessage = object.kind === 'rest-point' ? '벤치가 포근한 구름빛으로 반짝여요.' : object.kind === 'bulletin-board' ? '게시판에는 앞으로 외부 링크와 소식을 연결할 수 있어요.' : object.kind === 'portal' ? '별빛 아치는 외부 콘텐츠 연결 지점으로 준비 중이에요.' : '바람 종이 울리고 섬의 발견 기록이 남았어요.'
      } else if (command.type === 'schedule-event') {
        const title = command.title.trim().slice(0, 40)
        if (!title || !Number.isInteger(command.minutesFromNow) || command.minutesFromNow < 1 || !Number.isInteger(command.rewardCoins) || command.rewardCoins < 0) {
          lastMessage = '미래 일정에는 이름, 1분 이상의 시간, 0 이상의 정수 보상이 필요해요.'
          return this.read()
        }
        scheduleSequence += 1
        const action: ScheduledAction = {
          id: `scheduled-${scheduleSequence}`, kind: 'island-event', title,
          effectiveAt: absoluteMinute(ledger.world) + command.minutesFromNow, status: 'scheduled', rewardCoins: command.rewardCoins,
        }
        ledger.schedule.push(action)
        appendEvent('action-scheduled', absoluteMinute(ledger.world), `${title} 일정을 예약했어요.`)
        lastMessage = `${title} 일정이 게임 시간 기준으로 예약됐어요.`
      } else if (command.type === 'cancel-event') {
        const action = ledger.schedule.find((row) => row.id === command.scheduleId && row.status === 'scheduled')
        if (!action) { lastMessage = '취소할 수 있는 미래 예약을 찾지 못했어요.'; return this.read() }
        action.status = 'cancelled'
        appendEvent('action-cancelled', absoluteMinute(ledger.world), `${action.title} 예약을 취소했어요.`)
        lastMessage = `${action.title} 예약을 취소했어요.`
      } else {
        const name = command.name.trim().slice(0, 24)
        if (!name) { lastMessage = '캐릭터 이름을 입력해 주세요.'; return this.read() }
        ledger.player.name = name
        appendEvent('character-renamed', absoluteMinute(ledger.world), `캐릭터 이름을 ${name}(으)로 정했어요.`)
        lastMessage = `${name}(으)로 캐릭터 이름을 정했어요.`
      }
      return this.read()
    },
  }
}
