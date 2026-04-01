'use client'

import { useRef, useMemo, useEffect, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { useTheme } from 'next-themes'

// Maximum nodes we can have (pre-allocate buffers for performance)
const MAX_NODES = 600
const INITIAL_NODES = 150

function ConnectionNetwork({ isDark }: { isDark: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const linesRef = useRef<THREE.LineSegments>(null)
  const pointsRef = useRef<THREE.Points>(null)
  const glowRef = useRef<THREE.Points>(null)

  const { mouse, viewport } = useThree()
  const nodeCountRef = useRef(INITIAL_NODES)

  // Pre-allocate all buffers at MAX size
  const [positions, velocities, nodeAges] = useMemo(() => {
    const pos = new Float32Array(MAX_NODES * 3)
    const vel: { x: number; y: number; z: number }[] = []
    const ages = new Float32Array(MAX_NODES) // For fade-in animation

    for (let i = 0; i < MAX_NODES; i++) {
      if (i === 0) {
        // Node 0 = mouse cursor
        pos[0] = 0; pos[1] = 0; pos[2] = 0
        vel.push({ x: 0, y: 0, z: 0 })
        ages[0] = 1
        continue
      }

      if (i < INITIAL_NODES) {
        pos[i * 3] = (Math.random() - 0.5) * 22
        pos[i * 3 + 1] = (Math.random() - 0.5) * 16
        pos[i * 3 + 2] = (Math.random() - 0.5) * 6
        ages[i] = 1 // Already fully visible
      } else {
        // Pre-allocate but hide offscreen
        pos[i * 3] = 999
        pos[i * 3 + 1] = 999
        pos[i * 3 + 2] = 999
        ages[i] = 0
      }

      vel.push({
        x: (Math.random() - 0.5) * 0.012,
        y: (Math.random() - 0.5) * 0.012,
        z: (Math.random() - 0.5) * 0.008
      })
    }
    return [pos, vel, ages]
  }, [])

  // Spawn a new node at cursor position
  const spawnNode = useCallback(() => {
    const idx = nodeCountRef.current
    if (idx >= MAX_NODES) return // Buffer full

    const worldX = (mouse.x * viewport.width) / 2
    const worldY = (mouse.y * viewport.height) / 2

    positions[idx * 3] = worldX + (Math.random() - 0.5) * 0.5
    positions[idx * 3 + 1] = worldY + (Math.random() - 0.5) * 0.5
    positions[idx * 3 + 2] = (Math.random() - 0.5) * 3

    velocities[idx].x = (Math.random() - 0.5) * 0.03
    velocities[idx].y = (Math.random() - 0.5) * 0.03
    velocities[idx].z = (Math.random() - 0.5) * 0.01

    nodeAges[idx] = 0.01 // Start with a sliver of visibility for fade-in

    nodeCountRef.current = idx + 1
  }, [mouse, viewport, positions, velocities, nodeAges])

  // Global click/touch listener
  useEffect(() => {
    const handleClick = () => {
      // Spawn a small cluster of 3 nodes per click for a satisfying burst
      spawnNode()
      spawnNode()
      spawnNode()
    }
    window.addEventListener('click', handleClick)
    window.addEventListener('touchstart', handleClick)
    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('touchstart', handleClick)
    }
  }, [spawnNode])

  // Line arrays
  const maxConnections = MAX_NODES * 100
  const linePositions = useMemo(() => new Float32Array(maxConnections * 6), [])
  const lineColors = useMemo(() => new Float32Array(maxConnections * 6), [])

  // Point colors for the glow layer
  const pointColors = useMemo(() => {
    const c = new Float32Array(MAX_NODES * 3)
    for (let i = 0; i < MAX_NODES; i++) {
      c[i * 3] = 0.83
      c[i * 3 + 1] = 0.68
      c[i * 3 + 2] = 0.21
    }
    return c
  }, [])

  const maxDistance = 4.5

  useFrame(() => {
    if (!pointsRef.current || !linesRef.current) return

    const count = nodeCountRef.current
    let vertexpos = 0
    let colorpos = 0
    let numConnected = 0

    const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array

    // Mouse node
    posArray[0] = (mouse.x * viewport.width) / 2
    posArray[1] = (mouse.y * viewport.height) / 2
    posArray[2] = 2

    // Animate alumni nodes
    for (let i = 1; i < count; i++) {
      // Fade in new nodes smoothly
      if (nodeAges[i] < 1) nodeAges[i] = Math.min(1, nodeAges[i] + 0.02)

      posArray[i * 3] += velocities[i].x
      posArray[i * 3 + 1] += velocities[i].y
      posArray[i * 3 + 2] += velocities[i].z

      // Soft boundary bounce
      if (Math.abs(posArray[i * 3]) > 14) velocities[i].x *= -1
      if (Math.abs(posArray[i * 3 + 1]) > 10) velocities[i].y *= -1
      if (Math.abs(posArray[i * 3 + 2]) > 5) velocities[i].z *= -1
    }

    // Calculate connections
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = posArray[i * 3] - posArray[j * 3]
        const dy = posArray[i * 3 + 1] - posArray[j * 3 + 1]
        const dz = posArray[i * 3 + 2] - posArray[j * 3 + 2]
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

        if (dist < maxDistance && numConnected < maxConnections) {
          linePositions[vertexpos++] = posArray[i * 3]
          linePositions[vertexpos++] = posArray[i * 3 + 1]
          linePositions[vertexpos++] = posArray[i * 3 + 2]

          linePositions[vertexpos++] = posArray[j * 3]
          linePositions[vertexpos++] = posArray[j * 3 + 1]
          linePositions[vertexpos++] = posArray[j * 3 + 2]

          const alpha = Math.pow(1.0 - (dist / maxDistance), 1.5) * Math.min(nodeAges[i], nodeAges[j])

          // Mouse connections = gold, normal = champagne
          let r: number, g: number, b: number
          if (i === 0 || j === 0) {
            r = isDark ? 1.0 : 0.8
            g = isDark ? 0.92 : 0.7
            b = isDark ? 0.6 : 0.2
          } else {
            r = isDark ? 0.83 : 0.6
            g = isDark ? 0.68 : 0.5
            b = isDark ? 0.21 : 0.1
          }

          lineColors[colorpos++] = r * alpha
          lineColors[colorpos++] = g * alpha
          lineColors[colorpos++] = b * alpha
          lineColors[colorpos++] = r * alpha
          lineColors[colorpos++] = g * alpha
          lineColors[colorpos++] = b * alpha

          numConnected++
        }
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true
    pointsRef.current.geometry.setDrawRange(0, count)

    if (glowRef.current) {
      const glowPos = glowRef.current.geometry.attributes.position.array as Float32Array
      for (let i = 0; i < count * 3; i++) glowPos[i] = posArray[i]
      glowRef.current.geometry.attributes.position.needsUpdate = true
      glowRef.current.geometry.setDrawRange(0, count)
    }

    linesRef.current.geometry.setDrawRange(0, numConnected * 2)
    linesRef.current.geometry.attributes.position.needsUpdate = true
    linesRef.current.geometry.attributes.color.needsUpdate = true
  })

  return (
    <group ref={groupRef}>
      {/* Soft outer glow halo behind nodes */}
      <points ref={glowRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(positions), 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.35}
          color="#d4af37"
          transparent
          opacity={isDark ? 0.08 : 0.15}
          depthWrite={false}
          blending={isDark ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </points>

      {/* Core alumni nodes */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.07}
          color={isDark ? "#ffffff" : "#222222"}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={isDark ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </points>

      {/* Relationship lines */}
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-color" args={[lineColors, 3]} usage={THREE.DynamicDrawUsage} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={isDark ? 0.9 : 0.6} blending={isDark ? THREE.AdditiveBlending : THREE.NormalBlending} depthWrite={false} />
      </lineSegments>
    </group>
  )
}

export default function ThreeBackground() {
  const [mounted, setMounted] = useState(false)
  const [eventSource, setEventSource] = useState<HTMLElement | null>(null)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
    setEventSource(document.body)
  }, [])

  const isDark = resolvedTheme === 'dark' || (!mounted && typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
  const fogColor = isDark ? '#050505' : '#ffffff'

  return (
    <div className="fixed inset-0 z-0 pointer-events-none bg-background overflow-hidden">
      {/* Premium vignette layers */}
      <div 
        className="absolute inset-0 z-10 pointer-events-none" 
        style={{ background: 'radial-gradient(ellipse at center, transparent 0%, var(--background) 80%)' }} 
      />
      <div className="absolute inset-x-0 bottom-0 h-[35%] bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-[15%] bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />

      {mounted && (
        <Canvas
          camera={{ position: [0, 0, 9], fov: 45 }}
          dpr={[1, 2]}
          eventSource={eventSource || undefined}
          eventPrefix="client"
        >
          <fog attach="fog" args={[fogColor, 5, 20]} />
          <ConnectionNetwork isDark={isDark} />
        </Canvas>
      )}
    </div>
  )
}
