import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const GROUND_SIZE = 140;
const GROUND_Y = -0.02;
const REPOSITION_STEP = 10;

const vertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = `
  varying vec3 vWorldPosition;

  uniform vec2 uCameraXZ;
  uniform float uTime;

  float gridLine(vec2 worldXZ, float cellSize, float lineWidth) {
    vec2 cell = abs(fract(worldXZ / cellSize - 0.5) - 0.5) / fwidth(worldXZ / cellSize);
    float line = min(cell.x, cell.y);
    return 1.0 - smoothstep(lineWidth, lineWidth + 1.0, line);
  }

  float crossMask(vec2 local, float extent, float thickness) {
    float horizontal = 1.0 - smoothstep(thickness, thickness + 0.012, abs(local.y));
    horizontal *= 1.0 - smoothstep(extent, extent + 0.04, abs(local.x));

    float vertical = 1.0 - smoothstep(thickness, thickness + 0.012, abs(local.x));
    vertical *= 1.0 - smoothstep(extent, extent + 0.04, abs(local.y));

    return max(horizontal, vertical);
  }

  void main() {
    vec2 worldXZ = vWorldPosition.xz;
    float distanceToCamera = distance(worldXZ, uCameraXZ);

    float fineGrid = gridLine(worldXZ, 0.45, 0.8);
    float majorGrid = gridLine(worldXZ, 2.7, 1.1);

    vec2 dotCell = fract(worldXZ / 5.4) - 0.5;
    float dotDistance = length(dotCell);
    float pulse = 0.78 + 0.22 * sin(uTime * 1.35 + floor(worldXZ.x / 5.4) * 0.7 + floor(worldXZ.y / 5.4) * 1.1);
    float glowDot = smoothstep(0.16, 0.0, dotDistance) * pulse;

    vec2 crossCell = mod(worldXZ + 4.05, 8.1) - 4.05;
    float cross = crossMask(crossCell, 0.38, 0.02);

    vec3 baseColor = vec3(0.028, 0.036, 0.05);
    vec3 fineColor = vec3(0.08, 0.13, 0.18) * fineGrid;
    vec3 majorColor = vec3(0.18, 0.34, 0.48) * majorGrid * 1.6;
    vec3 dotColor = vec3(3.4, 6.8, 9.5) * glowDot;
    vec3 crossColor = vec3(1.4, 2.9, 4.4) * cross;

    float centerGlow = smoothstep(42.0, 0.0, distanceToCamera) * 0.14;
    vec3 color = baseColor + fineColor + majorColor + dotColor + crossColor + vec3(centerGlow * 0.12, centerGlow * 0.22, centerGlow * 0.3);

    float fade = 1.0 - smoothstep(42.0, 66.0, distanceToCamera);
    float alpha = clamp((fineGrid * 0.22) + (majorGrid * 0.45) + (glowDot * 0.65) + (cross * 0.3) + 0.08, 0.0, 1.0);
    alpha *= fade;

    gl_FragColor = vec4(color, alpha);
  }
`;

export default function ShowroomGround() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uCameraXZ: { value: new THREE.Vector2() },
          uTime: { value: 0 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useFrame((state) => {
    if (!meshRef.current) return;

    const snappedX =
      Math.round(state.camera.position.x / REPOSITION_STEP) * REPOSITION_STEP;
    const snappedZ =
      Math.round(state.camera.position.z / REPOSITION_STEP) * REPOSITION_STEP;

    meshRef.current.position.set(snappedX, GROUND_Y, snappedZ);

    material.uniforms.uCameraXZ.value.set(camera.position.x, camera.position.z);
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-2}>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
