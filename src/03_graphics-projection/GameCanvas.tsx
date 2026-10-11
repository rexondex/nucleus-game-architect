import { Canvas } from '@react-three/fiber'
import { IslandPrototype } from './scene/IslandPrototype'

/**
 * 장부 스냅샷에서 전달된 표현 데이터로 3D 세계를 그리는 진입점.
 * 명령 규칙이나 저장된 상태를 소유하지 않는다.
 */
interface GameCanvasProps {
  discoveryCount: number
}

export function GameCanvas({ discoveryCount }: GameCanvasProps) {
  return (
    <div className="game-canvas" aria-label="3D 장면">
      <Canvas camera={{ position: [5, 5, 8], fov: 38 }} dpr={[1, 1.75]}>
        <color attach="background" args={['#dceeff']} />
        <ambientLight intensity={1.6} />
        <directionalLight position={[4, 8, 5]} intensity={2.2} castShadow />
        <IslandPrototype discoveryCount={discoveryCount} />
      </Canvas>
    </div>
  )
}
