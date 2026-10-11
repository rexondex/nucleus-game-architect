import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'

/**
 * 기술 골격을 보여주는 임시 3D 프리미티브다.
 * 최종 섬 테마나 모델이 아니다. 실제 콘텐츠는 카탈로그와 에셋으로 교체한다.
 */
interface IslandPrototypeProps {
  /** Read-only projection of a persistent ledger value. */
  discoveryCount: number
}

export function IslandPrototype({ discoveryCount }: IslandPrototypeProps) {
  const islandRef = useRef<Group>(null)

  useFrame((state) => {
    if (!islandRef.current) return
    islandRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.18) * 0.08
  })

  return (
    <group ref={islandRef} position={[0, -0.15, 0]}>
      <mesh receiveShadow position={[0, -0.35, 0]}>
        <cylinderGeometry args={[2.35, 1.55, 0.8, 8]} />
        <meshStandardMaterial color="#9b806d" flatShading />
      </mesh>
      <mesh receiveShadow position={[0, 0.08, 0]}>
        <cylinderGeometry args={[2.38, 2.38, 0.16, 8]} />
        <meshStandardMaterial color="#9ecb9a" flatShading />
      </mesh>
      <PrototypeTree position={[-0.95, 0.55, -0.5]} scale={0.88} />
      <PrototypeTree position={[0.9, 0.48, -0.25]} scale={0.68} />
      <PrototypeTree position={[0.15, 0.45, 0.95]} scale={0.78} />
      {Array.from({ length: Math.min(discoveryCount, 5) }, (_, index) => (
        <mesh key={index} castShadow position={[-0.5 + index * 0.24, 0.24, 0.42]}>
          <octahedronGeometry args={[0.08, 0]} />
          <meshStandardMaterial color="#f1d785" emissive="#9b7730" emissiveIntensity={0.18} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.45, 0.05]}>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshStandardMaterial color="#f3c98f" roughness={0.85} />
      </mesh>
    </group>
  )
}

interface PrototypeTreeProps {
  position: [number, number, number]
  scale: number
}

/** 재사용 가능한 임시 나무 모양. 실제 나무는 별도 에셋/정의로 교체한다. */
function PrototypeTree({ position, scale }: PrototypeTreeProps) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.09, 0.13, 0.72, 7]} />
        <meshStandardMaterial color="#9a7052" flatShading />
      </mesh>
      <mesh castShadow position={[0, 0.9, 0]}>
        <icosahedronGeometry args={[0.48, 1]} />
        <meshStandardMaterial color="#6d9c78" flatShading roughness={0.95} />
      </mesh>
    </group>
  )
}
