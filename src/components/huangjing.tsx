import { useRef, useEffect, useMemo } from "react";
import { useFrame, extend } from "@react-three/fiber";
import * as THREE from "three";
import { Water } from "three/examples/jsm/objects/Water2.js";

// 扩展 Water 组件供 R3F 使用
extend({ Water });

/** 展厅 / 炼狱停车场 两套粒子参数（数量、范围、漂移、边界） */
export type ParticleSceneMode = "showroom" | "game";

const GAME_PARTICLE_COLORS = ["#FFD466", "#FFFFFF", "#AC1C1C"] as const;

function hexToRgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** 红黄白之间随机插值，得到每颗粒子颜色 */
function buildGameParticleColors(count: number): Float32Array {
  const palette = GAME_PARTICLE_COLORS.map((h) => {
    const [r, g, b] = hexToRgb01(h);
    return { r, g, b };
  });
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const a = palette[Math.floor(Math.random() * palette.length)];
    const b = palette[Math.floor(Math.random() * palette.length)];
    const t = Math.random();
    colors[i3] = a.r + (b.r - a.r) * t;
    colors[i3 + 1] = a.g + (b.g - a.g) * t;
    colors[i3 + 2] = a.b + (b.b - a.b) * t;
  }
  return colors;
}

// 自定义光晕粒子系统（展厅柔和白光 / 游戏模式红黄白 + 更密 + 不同漂移与边界）
function CustomParticles({ mode = "showroom" }: { mode?: ParticleSceneMode }) {
  const isGame = mode === "game";
  const count = isGame ? 8000 : 4000;

  const particlesRef = useRef<THREE.Points | null>(null);
  const randomFactorsRef = useRef<Float32Array | null>(null);

  // 圆形渐变贴图（与顶点色相乘；展厅相当于白粒子）
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(1, "rgba(158, 158, 158, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  const { positions, randomFactors, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const randomFactors = new Float32Array(count * 3);

    // ========== 粒子「出生 / 重置后」落点范围（与 useFrame 里越界重置用的是同一套 spread、yMin、yMax）==========
    // spreadX、spreadZ：水平面分布宽度。坐标公式 (rand-0.5)*spread → 落在 [-spread/2, +spread/2]
    // yMin、yMax：高度方向只在这段区间内随机生成（不是边界，是重生带）
    const spreadX = isGame ? 200 : 300;
    const spreadZ = isGame ? 200 : 300;
    const yMin = isGame ? 0 : 0;
    const yMax = isGame ? 5 : 5;

    for (let i = 0; i < count * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * spreadX;
      positions[i + 1] = yMin + Math.random() * (yMax - yMin);
      positions[i + 2] = (Math.random() - 0.5) * spreadZ;

      randomFactors[i] = (Math.random() - 0.5) * 3.0;
      randomFactors[i + 1] = (Math.random() - 0.5) * 3.0;
      randomFactors[i + 2] = (Math.random() - 0.5) * 3.0;
    }

    const colors = isGame ? buildGameParticleColors(count) : null;

    return { positions, randomFactors, colors };
  }, [count, isGame]);

  useEffect(() => {
    randomFactorsRef.current = randomFactors;
  }, [randomFactors]);

  useFrame((state) => {
    if (!particlesRef.current || !randomFactorsRef.current) return;

    const posArr = particlesRef.current.geometry.attributes.position
      .array as Float32Array;
    const time = state.clock.elapsedTime;

    // ========== 边界相关：只在下面「越界则重置」里使用 ==========
    // spreadX / spreadZ：粒子被拉回水平面时，重新随机到 [-spread/2, +spread/2]（与上方 useMemo 初始生成一致）
    const spreadX = isGame ? 320 : 300;
    const spreadZ = isGame ? 320 : 300;
    // yMin / yMax：高度越界后，重新随机到 [yMin, yMax]
    const yMin = isGame ? 0.2 : 0;
    const yMax = isGame ? 11 : 5;
    // boundX / boundZ：水平「软边界」。|x| > boundX 或 |z| > boundZ 时，该轴重新赋值为 (rand-0.5)*spread
    const boundX = isGame ? 310 : 300;
    const boundZ = isGame ? 310 : 300;
    // yLo / yHi：竖直出界阈值。y < yLo 或 y > yHi 则把 y 重置到 [yMin, yMax] 随机（可略宽于 yMin~yMax，防止飘太远才拉回）
    const yLo = isGame ? -0.5 : 0;
    const yHi = isGame ? 13 : 5;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const rx = randomFactorsRef.current[i3];
      const ry = randomFactorsRef.current[i3 + 1];
      const rz = randomFactorsRef.current[i3 + 2];

      if (isGame) {
        // 游戏：双层 sin/cos，略快、幅度略大，偏「火星飘动」
        posArr[i3] +=
          Math.sin(time * 0.14 + rx) * 0.016 +
          Math.cos(time * 0.06 + rz * 0.7) * 0.009;
        posArr[i3 + 1] +=
          Math.sin(time * 0.22 + ry) * 0.012 +
          Math.sin(time * 0.11 + rx * 0.8) * 0.005;
        posArr[i3 + 2] +=
          Math.cos(time * 0.13 + rz) * 0.015 +
          Math.sin(time * 0.08 + ry) * 0.008;
      } else {
        // 展厅：原逻辑
        posArr[i3] += Math.sin(time * 0.1 + rx) * 0.01;
        posArr[i3 + 1] += Math.sin(time * 0.2 + ry) * 0.005;
        posArr[i3 + 2] += Math.cos(time * 0.1 + rz) * 0.01;
      }

      // ---------- 边界检查：超出则单轴随机重置（粒子不会消失，只是瞬移回区域内）----------
      if (Math.abs(posArr[i3]) > boundX) {
        posArr[i3] = (Math.random() - 0.5) * spreadX;
      }
      if (posArr[i3 + 1] > yHi || posArr[i3 + 1] < yLo) {
        posArr[i3 + 1] = yMin + Math.random() * (yMax - yMin);
      }
      if (Math.abs(posArr[i3 + 2]) > boundZ) {
        posArr[i3 + 2] = (Math.random() - 0.5) * spreadZ;
      }
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  const pointSize = isGame ? 0.26 : 0.2;

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
          args={[positions, 3, false]}
        />
        <bufferAttribute
          attach="attributes-randomFactor"
          count={count}
          array={randomFactors}
          itemSize={3}
          args={[randomFactors, 3, false]}
        />
        {colors && (
          <bufferAttribute
            attach="attributes-color"
            count={count}
            array={colors}
            itemSize={3}
            args={[colors, 3, false]}
          />
        )}
      </bufferGeometry>
      <pointsMaterial
        size={pointSize}
        map={texture}
        alphaTest={0.1}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        fog={true}
        vertexColors={Boolean(colors)}
      />
    </points>
  );
}

// 雾效组件
function FogEffect({ mode }: { mode: ParticleSceneMode }) {
  const fogColor = mode === "game" ? "#130C0C" : "#323438";
  return (
    <fog
      attach="fog"
      args={[fogColor, 10, 80]} // 颜色，近距离，远距离
    />
  );
}

type HuangjingProps = {
  /** 游戏停车场：粒子更密、红黄白、漂移与边界单独一套 */
  isGameMode?: boolean;
};

export default function Huangjing({ isGameMode = false }: HuangjingProps) {
  const mode: ParticleSceneMode = isGameMode ? "game" : "showroom";

  return (
    <>
      <FogEffect mode={mode} />

      {/* key 保证展厅/游戏切换时粒子缓冲与颜色重新生成 */}
      <CustomParticles key={mode} mode={mode} />
    </>
  );
}
