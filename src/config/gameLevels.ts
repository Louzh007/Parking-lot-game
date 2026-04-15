// src/config/gameLevels.ts
//
// 【这个文件是干什么的】
// 集中配置每一关：倒计时、罚款、玩家出生点、结算文案、墙体、车位怎么摆等。
// 改关卡难度、换停车场形状，主要都在这里改。
//
// 【车位怎么配】
// 用 parkingLayout 数组，里面每一项要么是：
//   - kind: "yipai" → 一整排自动生成（写 anchor、count、rotationY 即可）
//   - kind: "yige"  → 单独一个车位，自己写 position / rotation（适合怪位置）
// 游戏运行时会在 ParkingLevel 里调用 expandParkingLayoutToSpots() 展开成「扁平车位列表」。
// 车位「宽度」= spotWidth（关卡默认 + 每排/单个可覆盖）；「进深/长度」= spotDepth（同上，默认 PARKING_SPOT_DEPTH）。
//
// 【注意】以后改代码请尽量保留这些中文注释，方便新手对照。

export interface WallConfig {
  /** 墙体中心在世界坐标里的位置 [x, y, z] */
  position: [number, number, number];
  /** 墙体盒子尺寸 [长, 高, 厚]，和 Three 里 box 一致 */
  args: [number, number, number];
}

/** 游戏模式额外道具障碍：对应 public/models 下 glb 文件名（不含路径） */
export type PropObstacleKind = "xuegaotong" | "dianpingche" | "lixiangbaimo";

export interface PropObstacleConfig {
  kind: PropObstacleKind;
  /** 刚体原点在世界坐标中的位置（一般 y=0 贴地） */
  position: [number, number, number];
  /** 欧拉角 [rx, ry, rz]，弧度；不写为 [0,0,0] */
  rotation?: [number, number, number];
  /** 模型统一缩放；不写为 1 */
  scale?: number;
  /** Rapier 长方体碰撞半尺寸 [hx, hy, hz]；不写用 ParkingLevel 里各 kind 的默认值，可在关卡里单独覆盖以贴合模型 */
  colliderHalfExtents?: [number, number, number];
  /** 碰撞盒中心相对刚体原点的偏移；不写则按「盒底贴 y=0」自动算 */
  colliderPosition?: [number, number, number];
  /** 质量，越大越难顶开；不写用各 kind 默认 */
  mass?: number;
}

/** 展开后每个车位的最终数据（ParkingLevel 里画线、放占位车用） */
export interface ParkingSpotDef {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  spotWidth?: number;
  /** 车位进深（画线框深度）；展开时由关卡/行配置写入 */
  spotDepth?: number;
}

/** 单个车位：完全手写，适合不规则位置 */
export type ParkingLayoutSpot = {
  kind: "yige";
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  spotWidth?: number;
  /** 单个车位进深；不写用关卡 spotDepth / 全局默认 */
  spotDepth?: number;
};

/** 一整排自动生成：给一个锚点 + rotationY，按 count 排开（类似以前单侧 rows=N） */
export type ParkingLayoutRow = {
  kind: "yipai";
  /** 车位 ID 前缀：会生成 idPrefix-1、idPrefix-2 … 直到 idPrefix-count */
  idPrefix: string;
  /** 这一排的几何中心（世界坐标）；多个车位沿中心左右/前后对称铺开 */
  anchor: [number, number, number];
  /** 这一排连续几个车位（你要 6 个就写 6） */
  count: number;
  /** 整排绕 Y 轴转多少弧度；每个车位的线框 + 白模车都用这个朝向 */
  rotationY: number;
  /**
   * 车位的排布方向（在旋转 rotationY 之前的「局部坐标」里）：
   * - 默认不写 = "x"：沿局部 X 方向并排，间距 = spotWidth
   * - "z"：沿局部 Z 方向排成一列，间距 = 本排或关卡的 spotDepth
   */
  along?: "x" | "z";
  /** 这一排每个车位多宽；不写就用关卡里的 spotWidth */
  spotWidth?: number;
  /** 这一排车位进深（画线 + along:"z" 时间距）；不写用关卡 spotDepth / 全局默认 */
  spotDepth?: number;
};

export type ParkingLayoutItem = ParkingLayoutSpot | ParkingLayoutRow;

/** 车位进深默认值；关卡里可写 `spotDepth` 覆盖，与 ParkingLevel 画线一致 */
export const PARKING_SPOT_DEPTH = 3.4;

/**
 * 把一关的 parkingLayout 展开成 ParkingSpotDef[]（纯数组，方便后面遍历）。
 * 顺序 = parkingLayout 里写的顺序：先处理完第一个 yipai/yige，再处理下一个。
 */
export function expandParkingLayoutToSpots(level: GameLevel): ParkingSpotDef[] {
  const defaultW = level.spotWidth;
  const defaultD = level.spotDepth ?? PARKING_SPOT_DEPTH;
  const out: ParkingSpotDef[] = [];

  for (const item of level.parkingLayout) {
    // ---------- 单个手写车位 ----------
    if (item.kind === "yige") {
      out.push({
        id: item.id,
        position: item.position,
        rotation: item.rotation,
        spotWidth: item.spotWidth,
        spotDepth: item.spotDepth ?? defaultD,
      });
      continue;
    }

    // ---------- 一整排自动生成 ----------
    const w = item.spotWidth ?? defaultW;
    const d = item.spotDepth ?? defaultD;
    const n = item.count;
    const ry = item.rotationY;
    const cos = Math.cos(ry);
    const sin = Math.sin(ry);
    const along = item.along ?? "x";

    for (let i = 0; i < n; i++) {
      // 先在局部平面里算偏移（along=x 横向排开；along=z 纵向一列）
      let lx = 0;
      let lz = 0;
      if (along === "x") {
        lx = (i - (n - 1) / 2) * w;
      } else {
        lz = (i - (n - 1) / 2) * d;
      }
      const ax = item.anchor[0];
      const ay = item.anchor[1];
      const az = item.anchor[2];
      // 再绕 Y 轴旋转到世界坐标（和以前的 groupRotation 算法一致）
      const wx = ax + lx * cos - lz * sin;
      const wz = az + lx * sin + lz * cos;
      out.push({
        id: `${item.idPrefix}-${i + 1}`,
        position: [wx, ay, wz],
        rotation: [0, ry, 0],
        spotWidth: item.spotWidth,
        spotDepth: d,
      });
    }
  }

  return out;
}

export interface GameLevel {
  id: number;
  label: string;
  difficultyStars: 1 | 2 | 3 | 4; // 难度星级（1～4），HUD 里画星星用
  winText: string; // 胜利结算弹窗主文案
  loseText: string; // 失败结算弹窗主文案
  /** 胜利结算弹窗副文案（提示框内） */
  winSubText: string;
  /** 失败结算弹窗副文案（提示框内） */
  loseSubText: string;
  timeLimitSec: number; // 本关倒计时（秒）
  wallet: number; // 开局「罚款额度」有多少钱
  penaltyPerHit: number; // 撞一次扣多少钱
  initialPos: [number, number, number]; // 玩家车出生位置
  initialRotY: number; // 玩家车出生朝向（弧度）
  /** 画车位线默认宽度；yipai / yige 里都可以单独覆盖 */
  spotWidth: number;
  /**
   * 车位进深（白线框「长度」方向、along:"z" 的排间距）；
   * 不写则使用 PARKING_SPOT_DEPTH（默认 3.4）
   */
  spotDepth?: number;
  /** 优先从这些车位 ID 里抽「空位」当目标；可写多个再随机 */
  targetSpots: string[];
  /**
   * 额外空车位（不显示绿色目标引导）：
   * - 这些车位会留空（不放占位白模车）
   * - 但不会显示绿色半透明提示
   */
  silentEmptySpots?: string[];
  /** 本关要随机几个空位（会先尽量满足 targetSpots） */
  emptySpotsCount: number;
  /** 墙体列表：每堵墙 position + args，和车位一样手写 */
  walls: WallConfig[];
  /**
   * 车位布局：数组里可混用
   *   kind: "yipai" → 一排自动生成
   *   kind: "yige"  → 一个一个手写
   * 例：先写两排 yipai，再插一个 yige 当特殊车位，完全可以。
   */
  parkingLayout: ParkingLayoutItem[];
  /**
   * 道具障碍（雪糕筒 / 电瓶车等）：每关单独写位置、旋转、缩放；
   * 不写或写 [] 则本关不放。模型路径见 ParkingLevel 内 PROP_MODEL_PATH。
   */
  propObstacles?: PropObstacleConfig[];
}

// =============================================================================
// 下面 GAME_LEVELS 里是三关的具体数据；改坐标前建议先备份一行。
// =============================================================================

export const GAME_LEVELS: GameLevel[] = [
  // ---------------------------------------------------------------------------
  // 第 1 关：简单 —— 上下各一排（yipai），中间是过道；墙在两侧挡一下
  // ---------------------------------------------------------------------------
  {
    id: 1,
    label: "简单 (EASY)",
    difficultyStars: 1,
    winText: "AUV 我就知道你可以的",
    loseText: "你会玩个刁",
    winSubText: "国内哪还有这么宽的车位啊",
    loseSubText: "这种车位不是闭着眼睛停的吗",
    timeLimitSec: 60,
    wallet: 5000,
    penaltyPerHit: 1000,
    initialPos: [0, 0, 10], // 在中间准备倒车
    initialRotY: Math.PI, // 面向 Z 轴负方向
    spotWidth: 1.8,
    targetSpots: ["A-2", "B-3"], // 在 A-2 / B-3 里随机出空位（共 emptySpotsCount 个）
    emptySpotsCount: 2,
    walls: [
      { position: [0, 0.5, -6], args: [8, 1, 0.2] },
      { position: [0, 0.5, 6], args: [8, 1, 0.2] },
    ],
    parkingLayout: [
      // 上侧一排 4 个，车头默认朝 -Z
      {
        kind: "yipai",
        idPrefix: "A",
        anchor: [0, 0, -3.7],
        count: 4,
        rotationY: 0,
      },
      // 下侧一排 4 个，车头朝 +Z（旋转 π）
      {
        kind: "yipai",
        idPrefix: "B",
        anchor: [0, 0, 3.7],
        count: 4,
        rotationY: Math.PI,
      },
    ],
    // 示例：xuegaotong / dianpingche / lixiangbaimo 对应 public/models 同名 .glb
    propObstacles: [
      // { kind: "xuegaotong", position: [2.2, 0, 0] },
      { kind: "dianpingche", position: [-2.2, 0, 0], rotation: [0, 0.4, 0] },
      // { kind: "lixiangbaimo", position: [0, 0, 0] },
    ],
  },

  // ---------------------------------------------------------------------------
  // 第 2 关：中等 —— 侧方停车
  // ---------------------------------------------------------------------------
  {
    id: 2,
    label: "中等 (MEDIUM)",
    difficultyStars: 2,
    winText: "就这样吧，算你过了",
    loseText: "不是，这都倒不进去吗",
    winSubText: "侧方停车是我永远的痛 第一次出险就给了ta",
    loseSubText: "小胡，明年保费给他涨个5000",
    timeLimitSec: 100,
    wallet: 3000,
    penaltyPerHit: 1000,
    initialPos: [0, 0, 8], // 偏一点出生，方便进车位
    initialRotY: 2 * Math.PI, // 和 Math.PI 同向，数值上写成 2π
    spotWidth: 1.3,
    spotDepth: 3.2,
    targetSpots: ["A-3"], // 中等模式常只空一个，这里指定优先 A-6
    emptySpotsCount: 1,
    walls: [{ position: [0, 0, -1], args: [13, 1, 0.4] }],
    parkingLayout: [
      {
        kind: "yipai",
        idPrefix: "A",
        anchor: [0, 0, 0],
        count: 4,
        rotationY: -Math.PI / 2,
        along: "z",
      },
    ],
    propObstacles: [
      { kind: "xuegaotong", position: [3, 0, 2] },
      { kind: "xuegaotong", position: [-4, 0, 2] },
      // { kind: "dianpingche", position: [-2.2, 0, 5], rotation: [0, 0.4, 0] },
      // { kind: "lixiangbaimo", position: [0, 0, 0] },
    ],
  }, // 第 3 关：困难 —— 每侧 6 个车位，过道更窄一点，右侧多一堵墙
  // ---------------------------------------------------------------------------
  {
    id: 3,
    label: "困难 (HARD)",
    difficultyStars: 3,
    winText: "还行吧",
    loseText: "玩的明白吗你",
    winSubText: "这种车位我一般扭头就走了",
    loseSubText: "可能是车的问题，换理想就随便停了",
    timeLimitSec: 45,
    wallet: 3000,
    penaltyPerHit: 1000,
    initialPos: [0, 0, 8], // 偏一点出生，方便进车位
    initialRotY: 2 * Math.PI, // 和 Math.PI 同向，数值上写成 2π
    spotWidth: 1.3,
    targetSpots: ["A-6"], // 中等模式常只空一个，这里指定优先 A-6
    silentEmptySpots: ["B-6", "B-5"],
    emptySpotsCount: 1,
    walls: [
      { position: [0, 0.5, -4.7], args: [8, 0.8, 0.8] },
      { position: [4.4, 0.5, 0], args: [0.8, 0.8, 8.5] },
    ],
    parkingLayout: [
      {
        kind: "yipai",
        idPrefix: "A",
        anchor: [0, 0, -2.5],
        count: 6,
        rotationY: 0,
      },
      {
        kind: "yipai",
        idPrefix: "B",
        anchor: [0, 0, 2.5],
        count: 6,
        rotationY: Math.PI,
      },
    ],
    propObstacles: [
      // { kind: "xuegaotong", position: [3, 0, 2] },
      // { kind: "dianpingche", position: [-2.2, 0, 5], rotation: [0, 0.4, 0] },
      {
        kind: "lixiangbaimo",
        position: [-2.65, 0, 2.6],
        rotation: [0, -0.2, 0],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 第 4 关：炼狱 —— U 形墙，左上/左下各横排 3，右侧竖列 4（along:"z" + 旋转贴墙）
  // ---------------------------------------------------------------------------
  {
    id: 4,
    label: "炼狱 (HELL)",
    difficultyStars: 4,
    winText: "算你厉害",
    loseText: "没用的东西",
    winSubText: "这种车位我一般也不停",
    loseSubText: "你先打方向，然后再踩油门啊",
    timeLimitSec: 100,
    wallet: 3000,
    penaltyPerHit: 2000,
    initialPos: [-9, 0, 0], // 左侧开口，从左边开进场地
    initialRotY: 0,
    spotWidth: 1.5,
    targetSpots: ["R-1"], // 右侧一列里最靠外那个当目标空位；若游戏里上下反了可改成 R-4
    emptySpotsCount: 1,
    // U 形墙：上、下、右三面；左边不封，当入口
    walls: [
      { position: [0, 0.5, -5], args: [10, 1, 0.5] },
      { position: [0, 0.5, 5], args: [10, 1, 0.5] },
      { position: [5, 0.5, 0], args: [0.5, 1, 9] },
    ],
    parkingLayout: [
      {
        kind: "yipai",
        idPrefix: "TL",
        anchor: [-3.2, 0, -2.5],
        count: 3,
        rotationY: 0,
      },
      {
        kind: "yipai",
        idPrefix: "BL",
        anchor: [-3.2, 0, 2.5],
        count: 3,
        rotationY: Math.PI,
      },
      // 右侧沿墙一列：先在局部 Z 上铺 4 个，再整排 rotationY = π/2 转到贴右墙
      {
        kind: "yipai",
        idPrefix: "R",
        anchor: [2.5, 0, 0],
        count: 6,
        rotationY: -Math.PI / 2,
        along: "x",
      },
    ],
    propObstacles: [
      { kind: "xuegaotong", position: [3.6, 0, 4] },
      { kind: "dianpingche", position: [0, 0, -3], rotation: [0, -1, 0] },
      // { kind: "lixiangbaimo", position: [0, 0, 0] },
    ],
  },
  // ---------------------------------------------------------------------------
  // 第 5 关：炼狱 —— U 形墙，左上/左下各横排 3，右侧竖列 4（along:"z" + 旋转贴墙）
  // ---------------------------------------------------------------------------
  {
    id: 5,
    label: "炼狱 (HELL)",
    difficultyStars: 4,
    winText: "愣头青，这种车位都停",
    loseText: "别挪了，再挪也就那样了",
    winSubText: "小胡，明年保费给他涨个5000",
    loseSubText: "小胡，明年保费给他涨个2000",
    timeLimitSec: 120,
    wallet: 3000,
    penaltyPerHit: 2000,
    initialPos: [-10, 0, 0], // 左侧开口，从左边开进场地
    initialRotY: 0,
    spotWidth: 1.2,
    targetSpots: ["B-4"], // 目标空位
    silentEmptySpots: ["B-3"],
    emptySpotsCount: 1,
    // U 形墙：上、下、右三面；左边不封，当入口
    walls: [
      { position: [0, 0, -2.8], args: [13.5, 0.2, 1] },
      { position: [0, 0, 2.8], args: [13.5, 0.2, 1] },
      { position: [7, 0.5, 0], args: [0.5, 1, 5.5] },
    ],
    parkingLayout: [
      {
        kind: "yipai",
        idPrefix: "A",
        anchor: [0, 0, 1.6],
        count: 4,
        rotationY: -Math.PI / 2,
        along: "z",
      },
      // 右侧沿墙一列：先在局部 Z 上铺 4 个，再整排 rotationY = π/2 转到贴右墙
      {
        kind: "yipai",
        idPrefix: "B",
        anchor: [0, 0, -1.6],
        count: 4,
        rotationY: -Math.PI / 2,
        along: "z",
      },
    ],
    propObstacles: [
      // { kind: "xuegaotong", position: [3.6, 0, 4] },
      { kind: "dianpingche", position: [6, 0.5, 0], rotation: [0, -3.14, 0] },
      {
        kind: "lixiangbaimo",
        position: [1.4, 0, -1.1],
        rotation: [0, 0.15, 0],
      },
    ],
  },
];
