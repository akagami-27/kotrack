import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Sparkles, Sphere } from '@react-three/drei'
import { useRef } from 'react'
import type { Mesh } from 'three'

function Orb() {
  const mesh = useRef<Mesh>(null)

  useFrame((state, delta) => {
    if (!mesh.current) return

    mesh.current.rotation.x += delta * 0.08
    mesh.current.rotation.y += delta * 0.14

    const targetX = state.pointer.y * 0.12
    const targetY = state.pointer.x * 0.18

    mesh.current.rotation.x +=
      (targetX - mesh.current.rotation.x) * 0.01

    mesh.current.rotation.y +=
      (targetY - mesh.current.rotation.y) * 0.01
  })

  return (
    <Float
      speed={1}
      rotationIntensity={0.15}
      floatIntensity={0.5}
    >
      <Sphere ref={mesh} args={[1.55, 64, 64]}>
        <meshPhysicalMaterial
          transmission={1}
          thickness={0.9}
          roughness={0.08}
          metalness={0.15}
          clearcoat={1}
          clearcoatRoughness={0.08}
          transparent
          opacity={0.72}
        />
      </Sphere>
    </Float>
  )
}

export default function HeroScene() {
  return (
    <Canvas
      camera={{
        position: [0, 0, 5],
        fov: 42,
      }}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: true,
      }}
    >
      <ambientLight intensity={1.8} />

      <directionalLight
        position={[4, 4, 5]}
        intensity={4}
      />

      <pointLight
        position={[-3, 1, 2]}
        intensity={18}
        distance={7}
      />

      <pointLight
        position={[3, -2, 1]}
        intensity={12}
        distance={6}
      />

      <Sparkles
        count={55}
        scale={5}
        size={1.2}
        speed={0.25}
      />

      <Orb />
    </Canvas>
  )
}