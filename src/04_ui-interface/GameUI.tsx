import { useState } from 'react'
import { createGameApi, type GameCommand } from '../02_api-controller/game-api'
import { GameCanvas } from '../03_graphics-projection/GameCanvas'
import { ActionButton } from './components/ActionButton'
import { InfoPanel } from './components/InfoPanel'
import './game-ui.css'

const gameApi = createGameApi()

/** DOM game interface. It composes the graphics projection and sends every action through the public API. */
export default function App() {
  const [snapshot, setSnapshot] = useState(() => gameApi.read())
  const { ledger } = snapshot
  const hour = Math.floor(ledger.world.minute / 60).toString().padStart(2, '0')
  const minute = (ledger.world.minute % 60).toString().padStart(2, '0')

  function act(command: GameCommand) {
    setSnapshot(gameApi.command(command))
  }

  return (
    <main className="sim-shell">
      <header className="sim-header">
        <a className="brand-mark" href="#home"><span className="brand-mark__icon">✦</span><span>장부 시뮬레이션</span></a>
        <span className="header-status">싱글플레이 · 장부 API 연결</span>
      </header>

      <section className="sim-grid">
        <div className="sim-main">
          <div className="sim-heading">
            <span className="stage-caption__eyebrow">LEDGER GAME · DAY {ledger.world.day}</span>
            <h1>{ledger.settings.title}</h1>
            <p>텍스트 명령으로 섬을 탐험하세요. 행동은 장부 API를 통해 기록되고, 이 화면은 장부를 읽어 표시합니다.</p>
          </div>

          <div className="world-projection" aria-label="장부 상태의 3D 투영">
            <GameCanvas discoveryCount={ledger.world.discoveries} />
            <span className="projection-caption">장부 투영 · {ledger.worldDefinitions.find((world) => world.id === ledger.world.definitionId)?.name}</span>
          </div>

          <InfoPanel eyebrow="현재 장면" title={ledger.objectDefinitions.find((object) => object.id === ledger.world.locationObjectId)?.name ?? ledger.worldDefinitions.find((world) => world.id === ledger.world.definitionId)?.name ?? '구름섬'}>
            <p className="sim-message" role="status">{snapshot.lastMessage}</p>
            <div className="sim-actions">
              <ActionButton onClick={() => act('explore')}>섬 탐험하기</ActionButton>
              <ActionButton onClick={() => act('rest')}>벤치에서 쉬기</ActionButton>
              <ActionButton onClick={() => act('advance-time')}>시간 1시간 보내기</ActionButton>
            </div>
          </InfoPanel>

          <InfoPanel eyebrow="캐릭터와 옷장" title={`${ledger.player.name} · ${ledger.characterDefinitions.find((item) => item.id === ledger.player.characterDefinitionId)?.name ?? '아바타'}`}>
            <div className="catalog-list">
              {ledger.clothingDefinitions.map((item) => (
                <div className="catalog-row" key={item.id}>
                  <span><strong>{item.name}</strong><small>{item.slot} · {item.rarity} · {item.styleTags.join(' / ')}</small></span>
                  <ActionButton onClick={() => act({ type: 'equip', itemId: item.id })}>
                    {ledger.player.equippedBySlot[item.slot] === item.id ? '착용 중' : '착용'}
                  </ActionButton>
                </div>
              ))}
            </div>
            <p className="panel-note">스타일 태그는 성별 제한이 아니며, 취향에 따라 자유롭게 조합하는 방향입니다.</p>
          </InfoPanel>

          <InfoPanel eyebrow="섬 오브젝트" title="상호작용 장소">
            <div className="sim-actions">
              {ledger.objectDefinitions.map((object) => (
                <ActionButton key={object.id} onClick={() => act({ type: 'interact', objectId: object.id })}>{object.name}</ActionButton>
              ))}
            </div>
            <p className="panel-note">게시판과 별빛 아치는 향후 외부 링크 연결 위치로 장부에 정의되어 있습니다.</p>
          </InfoPanel>

          <InfoPanel eyebrow="장부 이력" title="최근 기록">
            {ledger.history.length === 0 ? <p className="panel-copy">아직 기록이 없어요. 첫 행동을 하면 이력 시트에 기록됩니다.</p> : (
              <ol className="history-list">
                {[...ledger.history].reverse().slice(0, 6).map((event) => (
                  <li key={event.id}><span>제{Math.floor(event.effectiveAt / 1440)}일 {Math.floor((event.effectiveAt % 1440) / 60).toString().padStart(2, '0')}:{(event.effectiveAt % 60).toString().padStart(2, '0')}</span><p>{event.summary}</p></li>
                ))}
              </ol>
            )}
          </InfoPanel>
        </div>

        <aside className="sim-sidebar" aria-label="장부 현재 상태">
          <InfoPanel eyebrow="현재 장부 투영" title={ledger.player.name}>
            <dl className="ledger-table">
              <div><dt>세계 시각</dt><dd>제{ledger.world.day}일 {hour}:{minute}</dd></div>
              <div><dt>기운</dt><dd>{ledger.player.energy} / 5</dd></div>
              <div><dt>별빛 코인</dt><dd>{ledger.player.coins}</dd></div>
              <div><dt>발견</dt><dd>{ledger.world.discoveries}</dd></div>
              <div><dt>레벨</dt><dd>{ledger.player.level}</dd></div>
              <div><dt>수집품</dt><dd>{ledger.player.collectionItemIds.length} 종</dd></div>
            </dl>
          </InfoPanel>
          <InfoPanel eyebrow="미래 예약" title="장부 일정">
            {ledger.schedule.map((entry) => <div className="schedule-row" key={entry.id}><span>{entry.title} · 제{Math.floor(entry.effectiveAt / 1440)}일</span><strong>{entry.status === 'scheduled' ? '예약됨' : entry.status === 'applied' ? '지급 완료' : '취소됨'}</strong></div>)}
            <p className="panel-note">예약 시각이 되면 시간 진행 명령이 선물을 자동 반영합니다.</p>
          </InfoPanel>
          <InfoPanel eyebrow="장부 콘텐츠" title="수집 기록">
            {ledger.player.collectionItemIds.length === 0 ? <p className="panel-copy">탐험을 이어가면 발견한 수집품이 여기에 기록돼요.</p> : ledger.player.collectionItemIds.map((id) => {
              const item = ledger.collectionDefinitions.find((definition) => definition.id === id)
              return item ? <div className="schedule-row" key={id}><span>{item.name}</span><strong>{item.rarity}</strong></div> : null
            })}
            <p className="panel-note">온라인 방문과 역할 권한은 장부에 미래 확장 정의로 준비되어 있고, 현재 싱글플레이에서는 꺼져 있습니다.</p>
          </InfoPanel>
          <p className="architecture-note">이 프로토타입은 React/R3F를 게임 규칙에 사용하지 않습니다. 버튼은 공개 API만 호출하고, 장부의 현재 상태와 변경 이력을 다시 읽습니다.</p>
        </aside>
      </section>
      <footer className="app-footer"><span>헤드리스 장부 시뮬레이션 프로토타입</span><span>현재 저장은 메모리 기반이며 새로고침하면 초기화됩니다.</span></footer>
    </main>
  )
}
