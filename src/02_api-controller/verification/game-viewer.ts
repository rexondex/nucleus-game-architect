/**
 * Persistent terminal window into the running game nucleus.
 * All reads and gameplay actions pass through GameAPI; this viewer never imports nucleus internals.
 * Start with `npm run view:game`; stop with Ctrl+C. `--ticks=N` is for short automated smoke runs.
 */
import { createInterface } from 'node:readline'
import { stdin, stdout } from 'node:process'
import { createGameApi, type GameCommand, type GameSnapshot } from '../game-api.ts'

const DEFAULT_TICK_MS = 1000
const api = createGameApi()
const readline = createInterface({ input: stdin, crlfDelay: Infinity, terminal: false })
let tickMs = getNumericArgument('--tick-ms', DEFAULT_TICK_MS)
const requestedTicks = getOptionalNumericArgument('--ticks')
let completedTicks = 0
let clockTimer: ReturnType<typeof setInterval> | undefined
let stopped = false

function getNumericArgument(name: string, fallback: number): number {
  return getOptionalNumericArgument(name) ?? fallback
}

function getOptionalNumericArgument(name: string): number | undefined {
  const argument = process.argv.find((value) => value.startsWith(`${name}=`))
  if (!argument) return undefined
  const value = Number(argument.slice(name.length + 1))
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} 값은 1 이상의 정수여야 합니다.`)
  return value
}

function formatTime(absoluteMinute: number): string {
  const day = Math.floor(absoluteMinute / 1440)
  const minuteOfDay = absoluteMinute % 1440
  const hour = Math.floor(minuteOfDay / 60).toString().padStart(2, '0')
  const minute = (minuteOfDay % 60).toString().padStart(2, '0')
  return `제${day}일 ${hour}:${minute}`
}

function renderLedger(snapshot: GameSnapshot, cause: string): void {
  const { ledger } = snapshot
  const now = ledger.world.day * 1440 + ledger.world.minute
  const world = ledger.worldDefinitions.find((row) => row.id === ledger.world.definitionId)
  const character = ledger.characterDefinitions.find((row) => row.id === ledger.player.characterDefinitionId)
  const location = ledger.objectDefinitions.find((row) => row.id === ledger.world.locationObjectId)
  const inventory = ledger.player.inventoryItemIds
    .map((id) => ledger.clothingDefinitions.find((row) => row.id === id)?.name ?? id)
  const clothes = Object.values(ledger.player.equippedBySlot)
    .map((id) => ledger.clothingDefinitions.find((row) => row.id === id)?.name ?? id)
  const collections = ledger.player.collectionItemIds
    .map((id) => ledger.collectionDefinitions.find((row) => row.id === id)?.name ?? id)

  stdout.write(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
  stdout.write(`[장부 라이브 뷰] ${cause} · 실제 ${new Date().toLocaleTimeString()}\n`)
  stdout.write(`${ledger.settings.title} | ${world?.name ?? ledger.world.definitionId} | ${formatTime(now)}\n`)
  stdout.write(`설정: ${ledger.settings.audience} · ${ledger.settings.initialMode} · 온라인 확장 ${ledger.settings.onlineFeatures}\n`)
  stdout.write(`세계 정의: ${world?.theme ?? '테마 미정'} · 오브젝트 ${ledger.objectDefinitions.length}종 · 의상 ${ledger.clothingDefinitions.length}종 · 수집품 ${ledger.collectionDefinitions.length}종\n`)
  stdout.write(`캐릭터: ${ledger.player.name} (${character?.name ?? ledger.player.characterDefinitionId}) · 위치: ${location?.name ?? ledger.world.locationObjectId}\n`)
  stdout.write(`기운 ${ledger.player.energy}/${ledger.settings.maxEnergy} · 코인 ${ledger.player.coins} · 레벨 ${ledger.player.level} · 발견 ${ledger.world.discoveries}\n`)
  stdout.write(`보유 의상 ${inventory.length}종: ${inventory.join(', ') || '없음'}\n`)
  stdout.write(`장착: ${clothes.length > 0 ? clothes.join(', ') : '없음'}\n`)
  stdout.write(`수집: ${collections.length > 0 ? collections.join(', ') : '아직 없음'}\n`)
  stdout.write(`역할: ${ledger.roleDefinitions.find((role) => role.id === ledger.player.roleId)?.name ?? ledger.player.roleId} · 활성 역할 정의 ${ledger.roleDefinitions.filter((role) => role.enabled).length}/${ledger.roleDefinitions.length}\n`)
  stdout.write(`장부 일정 ${ledger.schedule.length}건:\n`)
  for (const action of ledger.schedule) {
    stdout.write(`  [${action.status}] ${action.title} @ ${formatTime(action.effectiveAt)} · 보상 ${action.rewardCoins} 코인\n`)
  }
  stdout.write(`장부 이벤트 ${ledger.history.length}건 (기록/효력 시각 포함)\n`)
  for (const event of ledger.history.slice(-4)) {
    stdout.write(`  ${formatTime(event.recordedAt)} 기록 · ${formatTime(event.effectiveAt)} 효력 · ${event.summary}\n`)
  }
  stdout.write(`마지막 응답: ${snapshot.lastMessage}\n`)
  stdout.write(`명령: help 입력 시 목록 · 자동 시계 간격 ${tickMs}ms마다 게임 1시간 진행\n`)
}

function showHelp(): void {
  stdout.write(`\n사용 가능한 API 명령\n`)
  stdout.write(`  explore                         섬 탐험\n`)
  stdout.write(`  rest                            기운 회복\n`)
  stdout.write(`  time                            게임 시간 1시간 진행\n`)
  stdout.write(`  equip <item-id>                 보유 의상 장착\n`)
  stdout.write(`  interact <object-id>            월드 오브젝트 상호작용\n`)
  stdout.write(`  rename <이름>                   캐릭터 이름 변경\n`)
  stdout.write(`  schedule <분> <코인> <제목>     미래 이벤트 예약\n`)
  stdout.write(`  cancel <schedule-id>            예약 취소\n`)
  stdout.write(`  pause | resume                  자동 시간 진행 멈춤/재개\n`)
  stdout.write(`  speed <밀리초>                  자동 시간 진행 속도 변경\n`)
  stdout.write(`  status | events | dump          장부 요약/이력/전체 JSON 보기\n`)
  stdout.write(`  quit                            뷰어 종료 (또는 Ctrl+C)\n\n`)
}

function stopViewer(reason: string): void {
  if (stopped) return
  stopped = true
  if (clockTimer) clearInterval(clockTimer)
  stdout.write(`\n장부 라이브 뷰를 종료합니다: ${reason}\n`)
  readline.close()
  stdin.pause()
}

function startClock(): void {
  if (clockTimer) clearInterval(clockTimer)
  clockTimer = setInterval(() => {
    const snapshot = api.command('advance-time')
    completedTicks += 1
    renderLedger(snapshot, '자동 시계 진행')
    if (requestedTicks !== undefined && completedTicks >= requestedTicks) stopViewer(`${requestedTicks}회 스모크 실행 완료`)
  }, tickMs)
}

function runCommand(line: string): void {
  const input = line.trim()
  if (!input) return
  const [verb, ...args] = input.split(/\s+/)

  if (verb === 'help') return showHelp()
  if (verb === 'quit' || verb === 'exit') return stopViewer('사용자 요청')
  if (verb === 'pause') {
    if (clockTimer) clearInterval(clockTimer)
    clockTimer = undefined
    stdout.write('자동 시계를 멈췄습니다. `time` 명령으로 한 시간씩 진행할 수 있어요.\n')
    return
  }
  if (verb === 'resume') {
    startClock()
    stdout.write(`자동 시계를 다시 시작했습니다 (${tickMs}ms마다 게임 1시간).\n`)
    return
  }
  if (verb === 'speed') {
    const nextSpeed = Number(args[0])
    if (!Number.isInteger(nextSpeed) || nextSpeed < 100 || nextSpeed > 60000) {
      stdout.write('속도는 100~60000 밀리초 범위로 입력해 주세요. 예: speed 2000\n')
      return
    }
    tickMs = nextSpeed
    if (clockTimer) startClock()
    stdout.write(`자동 시계 간격을 ${tickMs}ms로 바꿨습니다.\n`)
    return
  }
  if (verb === 'status') return renderLedger(api.read(), '현재 상태 조회')
  if (verb === 'events') {
    const { history } = api.read().ledger
    stdout.write(history.length ? `${history.map((event) => `${formatTime(event.recordedAt)} 기록 / ${formatTime(event.effectiveAt)} 효력 · ${event.kind} · ${event.summary}`).join('\n')}\n` : '아직 기록된 게임 행동이 없습니다.\n')
    return
  }
  if (verb === 'dump') {
    stdout.write(`${JSON.stringify(api.read().ledger, null, 2)}\n`)
    return
  }

  const command = parseGameCommand(verb, args)
  if (!command) {
    stdout.write(`알 수 없는 명령: ${input} (help로 명령 목록 보기)\n`)
    return
  }
  renderLedger(api.command(command), `플레이어 명령: ${input}`)
}

function parseGameCommand(verb: string | undefined, args: string[]): GameCommand | undefined {
  if (verb === 'explore' || verb === 'rest' || verb === 'time') {
    return verb === 'time' ? 'advance-time' : verb
  }
  if (verb === 'equip' && args[0]) return { type: 'equip', itemId: args[0] }
  if (verb === 'interact' && args[0]) return { type: 'interact', objectId: args[0] }
  if (verb === 'rename' && args.length) return { type: 'rename', name: args.join(' ') }
  if (verb === 'cancel' && args[0]) return { type: 'cancel-event', scheduleId: args[0] }
  if (verb === 'schedule' && args.length >= 3) {
    const [minutesText, coinsText, ...titleParts] = args
    return { type: 'schedule-event', minutesFromNow: Number(minutesText), rewardCoins: Number(coinsText), title: titleParts.join(' ') }
  }
  return undefined
}

readline.on('line', (line) => runCommand(line))
readline.on('close', () => {
  // A finite --ticks run must continue after piped stdin reaches EOF; live sessions stop on EOF.
  if (requestedTicks === undefined) stopViewer('입력이 닫힘')
})
process.on('SIGINT', () => stopViewer('Ctrl+C'))

stdout.write('게임 코어 장부 라이브 뷰어를 시작합니다. 자동으로 게임 시간이 진행됩니다.\n')
stdout.write('help를 입력해 조작하고, Ctrl+C 또는 quit으로 종료하세요.\n')
showHelp()
renderLedger(api.read(), '시작 시점')
startClock()
