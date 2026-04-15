/**
 * ParkingLevel.tsx —— 停车场关卡 3D 部分
 *
 * - 从 gameLevels 读当前关配置，用 expandParkingLayoutToSpots 得到每个车位位置
 * - 画地面、车位线、占位白模车、墙体；用 useFrame 做「停进空位」判定
 * - 停车成功条件（见下方 useFrame）：车速足够低 + 玩家车碰撞盒底面四角全部落在
 *   目标空位的矩形框内（spotWidth × spotDepth，与画白线一致）；不再用「离中心距离」判定
 * - 具体数值、注释以 src/config/gameLevels.ts 为准；改关卡优先改那边
 */
import React, {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { Text, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import {
  GAME_LEVELS,
  expandParkingLayoutToSpots,
  PARKING_SPOT_DEPTH,
  type PropObstacleConfig,
  type PropObstacleKind,
} from "../config/gameLevels";

// --- 玩家车 footprint（用于「停进车位」矩形判定，与 GameCar 物理碰撞体近似即可）---
// 小米 SU7 在 GameCar 中已改用凸包 MeshCollider；此处仍为原长方体底面投影，若要对齐真车轮廓需再算凸包在 XZ 上的外包矩形或改用多点检测
const GAMECAR_COLLIDER_HALF_X = 1.17;
const GAMECAR_COLLIDER_HALF_Y = 0.35;
const GAMECAR_COLLIDER_HALF_Z = 0.5;
const GAMECAR_COLLIDER_CENTER = new THREE.Vector3(0.15, 0.35, 0);

/** 车身在地面投影的四个角（刚体局部坐标；取碰撞盒底面，与车位判定同一套几何） */
const CAR_FOOTPRINT_LOCAL: THREE.Vector3[] = (() => {
  const cx = GAMECAR_COLLIDER_CENTER.x;
  const cz = GAMECAR_COLLIDER_CENTER.z;
  const y = GAMECAR_COLLIDER_CENTER.y - GAMECAR_COLLIDER_HALF_Y;
  const hx = GAMECAR_COLLIDER_HALF_X;
  const hz = GAMECAR_COLLIDER_HALF_Z;
  return [
    new THREE.Vector3(cx - hx, y, cz - hz),
    new THREE.Vector3(cx + hx, y, cz - hz),
    new THREE.Vector3(cx + hx, y, cz + hz),
    new THREE.Vector3(cx - hx, y, cz + hz),
  ];
})();

/** 浮点容差：角点在边界上也算在内 */
const EPS = 1e-3;
/** 车位旋转转四元数时复用，避免每帧 new Euler */
const _spotEulerForParking = new THREE.Euler();

/** 世界坐标下四角是否全部落在车位局部 XZ 矩形内（含边界；Y 不参与，只看平面停车） */
function carCornersFullyInsideSpot(
  cornersWorld: THREE.Vector3[],
  spotPos: [number, number, number],
  spotRot: [number, number, number],
  spotWidth: number,
  spotDepth: number,
  invSpotQuat: THREE.Quaternion,
  delta: THREE.Vector3,
): boolean {
  const hw = spotWidth / 2 + EPS;
  const hd = spotDepth / 2 + EPS;
  const cx = spotPos[0];
  const cz = spotPos[2];
  // 世界偏移变到车位局部：local = inverse(q_spot) * (world - center)
  _spotEulerForParking.set(spotRot[0], spotRot[1], spotRot[2], "XYZ");
  invSpotQuat.setFromEuler(_spotEulerForParking).invert();

  for (let i = 0; i < 4; i++) {
    const c = cornersWorld[i];
    delta.set(c.x - cx, 0, c.z - cz);
    delta.applyQuaternion(invSpotQuat);
    // 与 ParkingSpotLines 里局部 X=宽、Z=深 一致
    if (Math.abs(delta.x) > hw || Math.abs(delta.z) > hd) {
      return false;
    }
  }
  return true;
}

// =================================================================
// --- 车辆配置---
// =================================================================
const CAR_CONFIGS = [
  {
    modelName: "car1",
    colliderSize: [0.5, 0.36, 1.18] as [number, number, number],
    scale: 0.65,
    modelOffset: [0, 0, 0.08] as [number, number, number],
  },
  {
    modelName: "car2",
    colliderSize: [0.55, 0.52, 1.42] as [number, number, number],
    scale: 0.68,
    modelOffset: [0, 0, 0] as [number, number, number],
  },
  {
    modelName: "car3",
    colliderSize: [0.5, 0.37, 1.25] as [number, number, number],
    scale: 0.65,
    modelOffset: [0, 0, 0.05] as [number, number, number],
  },
  {
    modelName: "car4",
    colliderSize: [0.5, 0.4, 1.25] as [number, number, number],
    scale: 0.65,
    modelOffset: [0, 0, 0] as [number, number, number],
  },
];

// =================================================================
// --- Props ---
// =================================================================
interface ParkingLevelProps {
  carRigidBodyRef: React.RefObject<any>;
  wheelSpeedRef: React.RefObject<number>;
  levelIndex: number; // 改为必填，用于回调
  onExitGame: () => void;
  onObstacleCollision: () => void; // ← 新增：告知 App 撞到障碍车了
  onParked: (levelIdx: number) => void; // ← 改为接收关卡索引
  onInitTarget: (id: string) => void; // ← 新增：告知 App 目标车位 ID
}

// =================================================================
// --- 车位线 ---
// =================================================================
const ParkingSpotLines = ({
  spotNumber,
  position,
  rotation,
  isTarget,
  spotWidth, // 从关卡 / 车位定义传入（与停车判定矩形宽一致）
  spotDepth, // 车位进深（与停车判定矩形深一致）
}: {
  spotNumber: string;
  position: [number, number, number];
  rotation: [number, number, number];
  isTarget: boolean;
  spotWidth: number;
  spotDepth: number;
}) => {
  const lineWidth = 0.06;
  const lineHeight = 0.001;

  return (
    <group position={position} rotation={rotation}>
      {/* 前边线（局部 +Z 方向一端） */}
      <mesh position={[0, lineHeight / 2, spotDepth / 2]} receiveShadow>
        <boxGeometry args={[spotWidth + 0.1, lineHeight, lineWidth]} />
        <meshStandardMaterial color="white" />
      </mesh>
      {/* 左右侧边线 */}
      <mesh position={[-spotWidth / 2, lineHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[lineWidth, lineHeight, spotDepth]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[spotWidth / 2, lineHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[lineWidth, lineHeight, spotDepth]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* 目标空位：半透明绿，方便辨认 */}
      {isTarget && (
        <mesh position={[0, 0.01, 0]}>
          <planeGeometry args={[spotWidth / 1.2, spotDepth / 1.2]} />
          <meshStandardMaterial color="#00ff00" transparent opacity={0.4} />
        </mesh>
      )}

      <Text
        position={[0, 0.05, spotDepth / 2 - 0.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.6}
        color={isTarget ? "#00ff88" : "white"}
      >
        {spotNumber}
      </Text>

      {/* 后边挡轮条（黄色） */}
      <mesh position={[0, 0, -spotDepth / 2 + 0.2]}>
        <boxGeometry args={[spotWidth - 0.4, 0.06, 0.06]} />
        <meshStandardMaterial color="#fdfd33" />
      </mesh>
    </group>
  );
};

// =================================================================
// --- 障碍车（碰撞变色）---
// =================================================================
const ParkedCar = ({
  position,
  rotation,
  modelIndex,
  onCollision,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  modelIndex: number;
  onCollision: () => void;
}) => {
  const { scene } = useGLTF("./models/qichebaimo.glb");
  const config = CAR_CONFIGS[modelIndex % 4];
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  const clonedCar = useMemo(() => {
    const carNode = scene.getObjectByName(config.modelName);
    if (!carNode) return null;
    const clone = carNode.clone();
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.material = new THREE.MeshStandardMaterial({
          color: "#ffffff",
          metalness: 0.3,
          roughness: 0.7,
        });
      }
    });
    return clone;
  }, [config.modelName]);

  useEffect(() => {
    if (!clonedCar) return;
    materialsRef.current = [];
    clonedCar.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh)
          .material as THREE.MeshStandardMaterial;
        if (mat) materialsRef.current.push(mat);
      }
    });
  }, [clonedCar]);

  const handleCollision = useCallback(() => {
    onCollision();
    // 变红 + 发光
    materialsRef.current.forEach((mat) => {
      mat.color.set("#ff2200");
      mat.emissive.set("#ff0000");
      mat.emissiveIntensity = 1.5;
    });
    setTimeout(() => {
      materialsRef.current.forEach((mat) => {
        mat.color.set("#ffffff");
        mat.emissive.set("#000000");
        mat.emissiveIntensity = 0;
      });
    }, 400);
  }, [onCollision]);

  if (!clonedCar) return null;

  return (
    <RigidBody
      type="dynamic"
      position={position}
      rotation={rotation}
      colliders={false}
      mass={1200}
      linearDamping={0.8}
      angularDamping={0.8}
      onCollisionEnter={handleCollision}
    >
      <CuboidCollider
        args={config.colliderSize}
        position={[0, config.colliderSize[1], 0]}
      />
      <group position={config.modelOffset}>
        <primitive
          object={clonedCar}
          scale={config.scale}
          rotation={[0, -Math.PI / 2, 0]}
        />
      </group>
      {/* 调试框 */}
      <mesh position={[0, config.colliderSize[1], 0]}>
        <boxGeometry
          args={[
            config.colliderSize[0] * 2,
            config.colliderSize[1] * 2,
            config.colliderSize[2] * 2,
          ]}
        />
        <meshStandardMaterial
          color="#ff7b16"
          transparent
          opacity={0}
          wireframe
        />
      </mesh>
    </RigidBody>
  );
};

// =================================================================
// --- 墙体障碍物（不可移动）---
// =================================================================
const Wall = ({
  position,
  args,
  onCollision,
}: {
  position: [number, number, number];
  args: [number, number, number];
  onCollision: () => void;
}) => {
  return (
    <RigidBody
      type="dynamic" // 改为 dynamic，让其能与 kinematic 碰撞
      position={position}
      onCollisionEnter={onCollision}
      friction={1}
      restitution={0.2}
      mass={5000} // 设置极大质量，模拟墙体
      linearDamping={0.9} // 极大的线性阻尼，使其撞了也几乎不动
      angularDamping={0.9} // 极大的角阻尼
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={args} />
        <meshStandardMaterial color="#a0a0a0" roughness={0.5} metalness={0.2} />
      </mesh>
      <CuboidCollider args={[args[0] / 2, args[1] / 2, args[2] / 2]} />
    </RigidBody>
  );
};

// =================================================================
// --- 关卡配置的道具障碍（雪糕筒 / 电瓶车等 glb）---
// =================================================================
const PROP_MODEL_PATH: Record<PropObstacleKind, string> = {
  xuegaotong: "./models/xuegaotong.glb",
  dianpingche: "./models/dianpingche.glb",
  lixiangbaimo: "./models/lixiangbaimo.glb",
};

/** Rapier CuboidCollider 半尺寸默认值；可在 gameLevels 里按项覆盖 colliderHalfExtents */
const PROP_DEFAULT_COLLIDER: Record<
  PropObstacleKind,
  [number, number, number]
> = {
  xuegaotong: [0.14, 0.16, 0.14],
  dianpingche: [0.12, 0.28, 0.4],
  /** 白模车占位：半尺寸需按模型在 gameLevels 里用 colliderHalfExtents 微调 */
  lixiangbaimo: [1.2, 0.45, 0.5],
};

const PROP_DEFAULT_MASS: Record<PropObstacleKind, number> = {
  xuegaotong: 12,
  dianpingche: 75,
  lixiangbaimo: 900,
};

/** 与 CuboidCollider 同尺寸同位置的线框，调完 gameLevels 里 collider 后改为 false */
const DEBUG_PROP_COLLIDERS = false;

function propDebugWireframeColor(kind: PropObstacleKind): string {
  if (kind === "xuegaotong") return "#00e5ff";
  if (kind === "dianpingche") return "#e040fb";
  if (kind === "lixiangbaimo") return "#ffea00";
  return "#ffea00";
}

const PropObstacleItem = ({
  config,
  onCollision,
}: {
  config: PropObstacleConfig;
  onCollision: () => void;
}) => {
  const path = PROP_MODEL_PATH[config.kind];
  const { scene } = useGLTF(path);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const resetTimerRef = useRef<number | null>(null);
  const scale = config.scale ?? 1;
  const rotation = config.rotation ?? [0, 0, 0];
  const half = config.colliderHalfExtents ?? PROP_DEFAULT_COLLIDER[config.kind];
  const mass = config.mass ?? PROP_DEFAULT_MASS[config.kind];
  const colliderPos: [number, number, number] = config.colliderPosition ?? [
    0,
    half[1],
    0,
  ];

  const visual = useMemo(() => {
    const root = scene.clone(true);
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return root;
  }, [scene]);

  useEffect(() => {
    materialsRef.current = [];
    visual.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
              materialsRef.current.push(m as THREE.MeshStandardMaterial);
            }
          });
        } else if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          materialsRef.current.push(mat as THREE.MeshStandardMaterial);
        }
      }
    });
  }, [visual]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCollision = useCallback(() => {
    onCollision();

    materialsRef.current.forEach((mat) => {
      mat.color.set("#ff2200");
      mat.emissive.set("#ff0000");
      mat.emissiveIntensity = 1.2;
    });

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      materialsRef.current.forEach((mat) => {
        mat.color.set("#ffffff");
        mat.emissive.set("#000000");
        mat.emissiveIntensity = 0;
      });
      resetTimerRef.current = null;
    }, 400);
  }, [onCollision]);

  return (
    <RigidBody
      type="dynamic"
      position={config.position}
      rotation={rotation}
      colliders={false}
      mass={mass}
      linearDamping={0.82}
      angularDamping={0.82}
      friction={0.9}
      restitution={0.08}
      onCollisionEnter={handleCollision}
    >
      <CuboidCollider args={half} position={colliderPos} />
      {DEBUG_PROP_COLLIDERS && (
        <mesh position={colliderPos} raycast={() => null}>
          <boxGeometry args={[half[0] * 2, half[1] * 2, half[2] * 2]} />
          <meshBasicMaterial
            color={propDebugWireframeColor(config.kind)}
            wireframe
            transparent
            opacity={0.9}
            depthTest
          />
        </mesh>
      )}
      <primitive object={visual} scale={scale} />
    </RigidBody>
  );
};

// =================================================================
// --- 游戏模式地面（PBR 金属板贴图，仅 ParkingLevel 使用）---
// 贴图放在 public/image/；若另有 Metal046B_1K-JPG_Metalness.jpg，可改为四张并加上 metalnessMap
// =================================================================
const PARKING_GROUND_TEXTURE_REPEAT = 12; // 根据你的地面大小调整（越大重复越密集）

const PARKING_GROUND_TEXTURES = [
  "./image/Road009C_1K-JPG_Color.jpg",
  "./image/Road009C_1K-JPG_NormalGL.jpg",
  "./image/Road009C_1K-JPG_Roughness.jpg",
  "./image/Road009C_1K-JPG_Roughness.jpg",
] as const;

function ParkingGroundTexturedMesh() {
  const [colorMap, normalMap, roughnessMap, metalnessMap] = useTexture([
    ...PARKING_GROUND_TEXTURES,
  ]);

  useLayoutEffect(() => {
    const repeat = PARKING_GROUND_TEXTURE_REPEAT;
    for (const map of [colorMap, normalMap, roughnessMap]) {
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(repeat, repeat);
    }
    colorMap.colorSpace = THREE.SRGBColorSpace;
  }, [colorMap, normalMap, roughnessMap]);

  return (
    <mesh
      receiveShadow
      rotation={[-Math.PI / 2, 0, Math.PI / 2]}
      position={[0, -0.05, 0]}
    >
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial
        map={colorMap}
        normalMap={normalMap}
        roughnessMap={roughnessMap}
        metalnessMap={metalnessMap}
        color="#999"
        roughness={1.2}
        metalness={1}
      />
    </mesh>
  );
}

function ParkingGround() {
  return (
    <RigidBody
      type="fixed"
      friction={2}
      restitution={0.1}
      userData={{ type: "ground" }}
    >
      <Suspense
        fallback={
          <mesh
            receiveShadow
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.05, 0]}
          >
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#000000" roughness={0.9} />
          </mesh>
        }
      >
        <ParkingGroundTexturedMesh />
      </Suspense>
      <CuboidCollider args={[50, 0.05, 50]} position={[0, -0.05, 0]} />
    </RigidBody>
  );
}

// =================================================================
// --- 主关卡组件 ---
// =================================================================
const ParkingLevel: React.FC<ParkingLevelProps> = ({
  carRigidBodyRef,
  wheelSpeedRef,
  levelIndex,
  onObstacleCollision,
  onParked,
  onInitTarget,
}) => {
  const levelConfig = GAME_LEVELS[Math.min(levelIndex, GAME_LEVELS.length - 1)];
  const lastParkingCheckAt = useRef(0);
  // 矩形停车判定：复用四元数/向量，避免 useFrame 里每帧分配
  const carQuatRef = useRef(new THREE.Quaternion());
  const carTransRef = useRef(new THREE.Vector3());
  const carCornersWorldRef = useRef([
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);
  const invSpotQuatRef = useRef(new THREE.Quaternion());
  const parkingDeltaRef = useRef(new THREE.Vector3());

  // 关键：锁定组件实例对应的关卡索引，防止在切换关卡时的最后一帧触发错误的回调
  const currentInstanceLevel = useRef(levelIndex);
  useEffect(() => {
    currentInstanceLevel.current = levelIndex;
  }, [levelIndex]);

  // parkingLayout 展开成扁平车位列表；
  // 1) targetSpots/emptySpotsCount -> 带绿色提示的空位
  // 2) silentEmptySpots -> 额外空位（无绿色提示）
  const { parkingSpots, targetEmptySpotIndices, allEmptySpotIndices } =
    useMemo(() => {
      const spots = expandParkingLayoutToSpots(levelConfig);

      // 绿色目标空位：根据 targetSpots 和 emptySpotsCount 选择
      const targetChosenIndices = new Set<number>();
      const count = Math.min(levelConfig.emptySpotsCount, spots.length);

      // 1. 先尝试从指定的 targetSpots 中选
      if (levelConfig.targetSpots && levelConfig.targetSpots.length > 0) {
        const availableTargetIds = [...levelConfig.targetSpots];
        // 洗牌算法随机挑选指定数量
        for (let i = availableTargetIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [availableTargetIds[i], availableTargetIds[j]] = [
            availableTargetIds[j],
            availableTargetIds[i],
          ];
        }

        for (const id of availableTargetIds) {
          if (targetChosenIndices.size >= count) break;
          const idx = spots.findIndex((s) => s.id === id);
          if (idx !== -1) targetChosenIndices.add(idx);
        }
      }

      // 2. 如果数量还不够，从所有车位中随机补齐
      while (targetChosenIndices.size < count) {
        const randomIdx = Math.floor(Math.random() * spots.length);
        targetChosenIndices.add(randomIdx);
      }

      // 无提示额外空位：按 ID 精确指定，不显示绿色
      const silentChosenIndices = new Set<number>();
      for (const id of levelConfig.silentEmptySpots ?? []) {
        const idx = spots.findIndex((s) => s.id === id);
        if (idx !== -1) {
          silentChosenIndices.add(idx);
        }
      }

      return {
        parkingSpots: spots,
        targetEmptySpotIndices: targetChosenIndices,
        allEmptySpotIndices: new Set([
          ...targetChosenIndices,
          ...silentChosenIndices,
        ]),
      };
    }, [levelConfig]);

  // 初始化时通知 App 目标车位 (支持多个 ID)
  useEffect(() => {
    const ids = Array.from(targetEmptySpotIndices)
      .map((idx) => parkingSpots[idx]?.id)
      .filter(Boolean)
      .join(", ");
    if (ids) {
      onInitTarget(ids);
    }
  }, [parkingSpots, targetEmptySpotIndices, onInitTarget]);

  // 碰撞处理：告知 App
  const handleObstacleCollision = useCallback(() => {
    const speed = Math.abs(wheelSpeedRef?.current ?? 0);
    if (speed < 0.01) return;
    onObstacleCollision();
  }, [onObstacleCollision, wheelSpeedRef]);

  // 停车判定：车身碰撞盒底面四角全部落在任意车位矩形内即可
  // 该车位的局部 XZ 矩形内（宽=spotWidth，深=spotDepth，与上面 ParkingSpotLines 一致）。
  // 旧逻辑「离车位中心距离 < 0.8」已废弃。
  useFrame((state) => {
    if (!carRigidBodyRef.current) return;

    const speed = Math.abs(wheelSpeedRef?.current ?? 0);
    // 车还在动：不算停稳，不触发成功
    if (speed >= 0.001) return;

    const elapsed = state.clock.elapsedTime;
    // 降低检测频率，避免同一时间段内重复触发 onParked
    if (elapsed - lastParkingCheckAt.current < 0.1) return;
    lastParkingCheckAt.current = elapsed;

    const rb = carRigidBodyRef.current;
    const t = rb.translation();
    const rq = rb.rotation();
    carQuatRef.current.set(rq.x, rq.y, rq.z, rq.w);
    carTransRef.current.set(t.x, t.y, t.z);

    // 把刚体局部下的四角变换到世界坐标：world = R * local + T
    const corners = carCornersWorldRef.current;
    for (let i = 0; i < 4; i++) {
      corners[i]
        .copy(CAR_FOOTPRINT_LOCAL[i])
        .applyQuaternion(carQuatRef.current)
        .add(carTransRef.current);
    }

    // 隐藏通关：遍历所有车位；顶开障碍车后停进原占位车位也算成功
    for (const spot of parkingSpots) {
      if (!spot) continue;
      const sw = spot.spotWidth ?? levelConfig.spotWidth;
      const sd = spot.spotDepth ?? levelConfig.spotDepth ?? PARKING_SPOT_DEPTH;
      if (
        carCornersFullyInsideSpot(
          corners,
          spot.position,
          spot.rotation,
          sw,
          sd,
          invSpotQuatRef.current,
          parkingDeltaRef.current,
        )
      ) {
        // 四角均落入矩形框 → 本关停车成功
        onParked(currentInstanceLevel.current);
        break;
      }
    }
  });

  return (
    <group>
      {/* 地面：游戏模式 PBR 贴图大平面 */}
      <ParkingGround />

      {/* 车位 + 障碍车 */}
      {parkingSpots.map((spot, index) => {
        const isTarget = targetEmptySpotIndices.has(index);
        const isEmpty = allEmptySpotIndices.has(index);
        return (
          <group key={spot.id}>
            <ParkingSpotLines
              spotNumber={spot.id}
              position={spot.position}
              rotation={spot.rotation}
              isTarget={isTarget}
              spotWidth={spot.spotWidth ?? levelConfig.spotWidth}
              spotDepth={
                spot.spotDepth ?? levelConfig.spotDepth ?? PARKING_SPOT_DEPTH
              }
            />
            {!isEmpty && (
              <ParkedCar
                position={spot.position}
                rotation={spot.rotation}
                modelIndex={index}
                onCollision={handleObstacleCollision}
              />
            )}
          </group>
        );
      })}

      {/* 边界墙 - 从关卡配置动态加载 */}
      {levelConfig.walls.map((wall, idx) => (
        <Wall
          key={`wall-${idx}`}
          position={wall.position}
          args={wall.args}
          onCollision={handleObstacleCollision}
        />
      ))}

      {(levelConfig.propObstacles ?? []).map((prop, idx) => (
        <PropObstacleItem
          key={`prop-${levelConfig.id}-${idx}-${prop.kind}`}
          config={prop}
          onCollision={handleObstacleCollision}
        />
      ))}
    </group>
  );
};

useGLTF.preload("./models/xuegaotong.glb");
useGLTF.preload("./models/dianpingche.glb");
useGLTF.preload("./models/lixiangbaimo.glb");

export default ParkingLevel;
