import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const GROUND_SIZE = 140;
const GROUND_Y = -0.02;
const REPOSITION_STEP = 10;

// 地面基础尺寸：改这里会影响整体网格密度。
const GRID_UNIT = 0.15;
// 细网格线粗细：越大越粗。
const FINE_GRID_LINE_WIDTH = 0.0001;
// 主网格线粗细：越大越粗。
const MAJOR_GRID_LINE_WIDTH = 0.0001;
// 发光点大小：越大越明显。
const DOT_RADIUS = 0.01;
// 十字标记长度：越大十字越长。
const CROSS_EXTENT = 0.02;
// 十字标记粗细：越大十字越粗。
const CROSS_THICKNESS = 0.0001;

// 地面斑驳遮罩：用世界坐标噪声打散网格，让地面局部若隐若现。
// 斑驳主纹理缩放：数值越小，斑块越大、过渡越开阔；数值越大，斑块越密、变化越碎。
const DISTRESS_MASK_SCALE = 0.5;
// 细节颗粒缩放：数值越小，细碎噪点越少越柔；数值越大，边缘和空缺处的颗粒感越明显。
const DISTRESS_MASK_DETAIL_SCALE = 0.95;
// 遮罩开始显现阈值：数值越低，保留下来的地面越多；数值越高，更多区域会被压暗或隐藏。
const DISTRESS_MASK_LOW = 0.2;
// 遮罩完全显现阈值：数值越低，明暗对比越硬、完整区域更多；数值越高，过渡更长、更雾化。
const DISTRESS_MASK_HIGH = 0.6;
// 遮罩作用强度：0 等于不使用斑驳遮罩，1 等于完整使用遮罩；越大地面断裂感越强。
const DISTRESS_MASK_STRENGTH = 0.9;
// 最低透明度保留量：数值越低，消失区域越接近完全看不见；数值越高，暗处仍会保留一层淡淡网格。
const DISTRESS_MASK_MIN_ALPHA = 0.04;

// 亮主网格颜色：这是复制出来的那一层更亮的主网格颜色。
const BRIGHT_MAJOR_GRID_COLOR = [0.7, 0.8, 0.8] as const;
// 亮主网格强度：越大越亮。
const BRIGHT_MAJOR_GRID_INTENSITY = 0.1;
// 亮主网格出现概率：越小越稀疏，只有少数几条会亮。
const BRIGHT_MAJOR_GRID_CHANCE = 0.06;
// 第二层亮主网格颜色：比第一层更克制一点，适合做补充。
const BRIGHT_MAJOR_GRID_COLOR_2 = [0.55, 0.75, 0.75] as const;
// 第二层亮主网格强度。
const BRIGHT_MAJOR_GRID_INTENSITY_2 = 0.1;
// 第二层亮主网格出现概率：通常比第一层高一点。
const BRIGHT_MAJOR_GRID_CHANCE_2 = 0.05;

// 整体颜色和光感：数值越高越亮、越有存在感。
const BASE_COLOR = [0.01, 0.01, 0.01] as const;
const FINE_GRID_COLOR = [0.03, 0.03, 0.04] as const;
const MAJOR_GRID_COLOR = [0.008, 0.008, 0.008] as const;
const DOT_COLOR = [0.5, 0.5, 1] as const;
const CROSS_COLOR = [0.5, 0.5, 0.5] as const;

function glslVec3(values: readonly [number, number, number]) {
  return `vec3(${values.join(", ")})`;
}

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


      float gridAxisLine(float coord, float cellSize, float lineWidth) {
    float distanceToLine = abs(fract(coord / cellSize - 0.5) - 0.5) * cellSize;
    float aa = max(fwidth(coord) * 1.5, 0.0005);
    return 1.0 - smoothstep(lineWidth, lineWidth + aa, distanceToLine);
  }

  float gridLine(vec2 worldXZ, float cellSize, float lineWidth) {
    float lineX = gridAxisLine(worldXZ.x, cellSize, lineWidth);
    float lineZ = gridAxisLine(worldXZ.y, cellSize, lineWidth);
    return max(lineX, lineZ);
  }

  float hash11(float p) {
    return fract(sin(p * 127.1) * 43758.5453123);
  }

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 cell = floor(p);
    vec2 local = fract(p);
    local = local * local * (3.0 - 2.0 * local);

    float bottom = mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), local.x);
    float top = mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0, 1.0)), local.x);
    return mix(bottom, top, local.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 5; i++) {
      value += amplitude * valueNoise(p);
      p = p * 2.03 + vec2(17.13, 9.27);
      amplitude *= 0.5;
    }

    return value;
  }

  float distressedGroundMask(vec2 worldXZ) {
    float broadWear = fbm(worldXZ * ${DISTRESS_MASK_SCALE} + vec2(12.4, 5.7));
    float midWear = fbm(worldXZ * ${DISTRESS_MASK_SCALE * 2.8} + vec2(41.2, 19.6));
    float grain = valueNoise(worldXZ * ${DISTRESS_MASK_DETAIL_SCALE} + vec2(3.3, 71.8));
    float wear = broadWear * 0.66 + midWear * 0.25 + grain * 0.09;
    float mask = smoothstep(${DISTRESS_MASK_LOW}, ${DISTRESS_MASK_HIGH}, wear);
    return mix(${DISTRESS_MASK_MIN_ALPHA}, 1.0, mix(1.0, mask, ${DISTRESS_MASK_STRENGTH}));
  }

  float isolatedLineMask(float lineId, float seed, float chance) {
    float selfMask = step(1.0 - chance, hash11(lineId + seed));
    float prevMask = step(1.0 - chance, hash11(lineId - 1.0 + seed));
    float nextMask = step(1.0 - chance, hash11(lineId + 1.0 + seed));
    return selfMask * (1.0 - max(prevMask, nextMask));
  }

  float isolatedLineMaskWithBlockers(
    float lineId,
    float seed,
    float chance,
    float blockerPrev,
    float blockerSelf,
    float blockerNext
  ) {
    float selfMask = step(1.0 - chance, hash11(lineId + seed));
    float prevMask = step(1.0 - chance, hash11(lineId - 1.0 + seed));
    float nextMask = step(1.0 - chance, hash11(lineId + 1.0 + seed));
    float localIsolation = selfMask * (1.0 - max(prevMask, nextMask));
    float blocked = max(blockerSelf, max(blockerPrev, blockerNext));
    return localIsolation * (1.0 - blocked);
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
    float majorGridSize = ${GRID_UNIT * 6.0};

    float fineGrid = gridLine(worldXZ, ${GRID_UNIT}, ${FINE_GRID_LINE_WIDTH});
    float majorGrid = gridLine(worldXZ, majorGridSize, ${MAJOR_GRID_LINE_WIDTH});

    float majorLineX = gridAxisLine(worldXZ.x, majorGridSize, ${MAJOR_GRID_LINE_WIDTH});
    float majorLineZ = gridAxisLine(worldXZ.y, majorGridSize, ${MAJOR_GRID_LINE_WIDTH});
    float majorLineIdX = floor(worldXZ.x / majorGridSize);
    float majorLineIdZ = floor(worldXZ.y / majorGridSize);
    float brightLineMaskX = isolatedLineMask(majorLineIdX, 17.0, ${BRIGHT_MAJOR_GRID_CHANCE});
    float brightLineMaskZ = isolatedLineMask(majorLineIdZ, 53.0, ${BRIGHT_MAJOR_GRID_CHANCE});
    float brightMajorGrid = max(
      majorLineX * brightLineMaskX,
      majorLineZ * brightLineMaskZ
    );
    float brightLineMaskXPrev = isolatedLineMask(majorLineIdX - 1.0, 17.0, ${BRIGHT_MAJOR_GRID_CHANCE});
    float brightLineMaskXNext = isolatedLineMask(majorLineIdX + 1.0, 17.0, ${BRIGHT_MAJOR_GRID_CHANCE});
    float brightLineMaskZPrev = isolatedLineMask(majorLineIdZ - 1.0, 53.0, ${BRIGHT_MAJOR_GRID_CHANCE});
    float brightLineMaskZNext = isolatedLineMask(majorLineIdZ + 1.0, 53.0, ${BRIGHT_MAJOR_GRID_CHANCE});
    float brightLineMaskX2 = isolatedLineMaskWithBlockers(
      majorLineIdX,
      117.0,
      ${BRIGHT_MAJOR_GRID_CHANCE_2},
      brightLineMaskXPrev,
      brightLineMaskX,
      brightLineMaskXNext
    );
    float brightLineMaskZ2 = isolatedLineMaskWithBlockers(
      majorLineIdZ,
      153.0,
      ${BRIGHT_MAJOR_GRID_CHANCE_2},
      brightLineMaskZPrev,
      brightLineMaskZ,
      brightLineMaskZNext
    );
    float brightMajorGrid2 = max(
      majorLineX * brightLineMaskX2,
      majorLineZ * brightLineMaskZ2
    );

    vec2 dotCell = fract(worldXZ / ${GRID_UNIT * 12}) - 0.5;
    float dotDistance = length(dotCell);
    float pulse = 0.78 + 0.22 * sin(uTime * 1.35 + floor(worldXZ.x / ${GRID_UNIT * 12}) * 0.7 + floor(worldXZ.y / ${GRID_UNIT * 12}) * 1.1);
    float glowDot = smoothstep(${DOT_RADIUS}, 0.0, dotDistance) * pulse;

    vec2 crossCell = mod(worldXZ + ${GRID_UNIT * 9}, ${GRID_UNIT * 18}) - ${GRID_UNIT * 9};
    float cross = crossMask(crossCell, ${CROSS_EXTENT}, ${CROSS_THICKNESS});

    vec3 baseColor = ${glslVec3(BASE_COLOR)};
    vec3 fineColor = ${glslVec3(FINE_GRID_COLOR)} * fineGrid;
    vec3 majorColor = ${glslVec3(MAJOR_GRID_COLOR)} * majorGrid * 1.6;
    vec3 brightMajorColor =
      ${glslVec3(BRIGHT_MAJOR_GRID_COLOR)} *
      brightMajorGrid *
      ${BRIGHT_MAJOR_GRID_INTENSITY};
    vec3 brightMajorColor2 =
      ${glslVec3(BRIGHT_MAJOR_GRID_COLOR_2)} *
      brightMajorGrid2 *
      ${BRIGHT_MAJOR_GRID_INTENSITY_2};
    vec3 dotColor = ${glslVec3(DOT_COLOR)} * glowDot;
    vec3 crossColor = ${glslVec3(CROSS_COLOR)} * cross;

    float centerGlow = smoothstep(4.0, 0.0, distanceToCamera) * 0.14;
    vec3 color = baseColor + fineColor + majorColor + brightMajorColor + brightMajorColor2 + dotColor + crossColor + vec3(centerGlow * 0.12, centerGlow * 0.22, centerGlow * 0.3);

    float fade = 1.0 - smoothstep(4.0, 16.0, distanceToCamera);
    float alpha = clamp((fineGrid * 0.22) + (majorGrid * 0.45) + (brightMajorGrid * 0.45) + (brightMajorGrid2 * 0.28) + (glowDot * 0.65) + (cross * 0.3) + 0.08, 0.0, 1.0);
    float distressMask = distressedGroundMask(worldXZ);
    alpha *= distressMask;
    alpha *= fade;
    color *= 0.45 + distressMask * 0.55;

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
