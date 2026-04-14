import { Vector3, Group } from "three"; // 导入 Vector3
import { useRef, useState, useEffect, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier"; //导入物理组件
import Car from "./components/Car"; //展示版汽车控制
import GameCar from "./components/GameCar"; // 游戏版汽车控制
import ParkingLevel from "./components/ParkingLevel"; // 把车位游戏组件导入

import { Camera } from "./components/Camera";
import { GameCamera } from "./components/GameCamera"; // 新增：游戏相机
import { Lights } from "./components/Lights";

// 导入拆分的UI组件
import Logo from "./components/ui/Logo";
import ControlButtons from "./components/ui/ControlButtons"; // 展示版控制按钮
import ControlButtonsGame from "./components/ui/ControlButtonsGame"; // 新增：游戏版控制按钮
import ModelSelector from "./components/ui/ModelSelector";
import LoadingScreen from "./components/ui/LoadingScreen";
import SpeedMeter from "./components/ui/SpeedMeter";
import { ZhuanchangVideo } from "./components/ui/zhuanchangVideo";
import { UI } from "./components/ui";
import { BloomEffect } from "./components/BloomEffect";
import { useApp } from "./components/state";
import Huangjing from "./components/huangjing";
import { GameHUD } from "./components/ui/GameHUD";
import { GameStartIntro } from "./components/ui/GameStartIntro";
import { GAME_LEVELS } from "./config/gameLevels";

function App() {
  // 1. 全局状态管理（对应原JS的全局变量）
  const [currentModel, setCurrentModel] = useState("xiaomi su7-action3"); // 当前模型

  const [isGameMode, setIsGameMode] = useState(false); // 是否游戏模式（控制 Car 组件 vs GameCar 组件）
  const [gameIntroActive, setGameIntroActive] = useState(false);

  const gameCarRBRef = useRef(null); // 游戏版车辆的刚体引用（传递给 ParkingLevel 组件）

  const [keyPressed, setKeyPressed] = useState({
    w: false,
    a: false,
    s: false,
    d: false,
  }); // WASD按键状态
  const [isLoading, setIsLoading] = useState(true); // 是否加载中
  const [loadingProgress, setLoadingProgress] = useState(0); // 加载进度

  const [wheelSpeed, setWheelSpeed] = useState(0); // 车轮转速（控制码表、灯光）
  const wheelSpeedRef = useRef(0); // 增加 Ref 同步速度，用于碰撞检测
  const lastWheelSpeedUIUpdateAtRef = useRef(0);
  const lastWheelSpeedUIValueRef = useRef(0);

  // 包装 setWheelSpeed，同时更新 State 和 Ref
  const syncWheelSpeed = useCallback(
    (speed: number) => {
      wheelSpeedRef.current = speed;

      if (!isGameMode) {
        lastWheelSpeedUIUpdateAtRef.current = performance.now();
        lastWheelSpeedUIValueRef.current = speed;
        setWheelSpeed(speed);
        return;
      }

      const now = performance.now();
      const prevUISpeed = lastWheelSpeedUIValueRef.current;
      const shouldSyncUI =
        now - lastWheelSpeedUIUpdateAtRef.current >= 50 ||
        Math.abs(speed) < 0.01 ||
        Math.sign(speed) !== Math.sign(prevUISpeed);

      if (shouldSyncUI) {
        lastWheelSpeedUIUpdateAtRef.current = now;
        lastWheelSpeedUIValueRef.current = speed;
        setWheelSpeed(speed);
      }
    },
    [isGameMode],
  );

  const [chetoufangxiang, setChetoufangxiang] = useState<Vector3>(
    new Vector3(1, 0, 0), // 初始方向：沿 X 轴正方向（可根据车型默认朝向调整）
  );

  const [health, setHealth] = useState(100); // 车辆健康度

  // --- 游戏逻辑相关状态 ---
  const [levelIndex, setLevelIndex] = useState(0);
  const [maxUnlockedLevelIndex, setMaxUnlockedLevelIndex] = useState(0);
  const [wallet, setWallet] = useState(GAME_LEVELS[0].wallet);
  const [collisionCount, setCollisionCount] = useState(0);
  const [gameResult, setGameResult] = useState<"win" | "lose" | null>(null);
  const [targetSpotId, setTargetSpotId] = useState("");
  const [remainingTime, setRemainingTime] = useState(
    GAME_LEVELS[0].timeLimitSec,
  );
  const [resetKey, setResetKey] = useState(0); // 用于强制重置组件
  const gameEndedRef = useRef(false);

  // 切换关卡或重置时
  const resetGame = useCallback(
    (idx = levelIndex) => {
      const config = GAME_LEVELS[idx];
      setWallet(config.wallet);
      setCollisionCount(0);
      setGameResult(null);
      setRemainingTime(config.timeLimitSec);
      setWheelSpeed(0);
      wheelSpeedRef.current = 0;
      lastWheelSpeedUIValueRef.current = 0;
      lastWheelSpeedUIUpdateAtRef.current = performance.now();
      gameEndedRef.current = false;
      setHealth(100);
      setResetKey((prev) => prev + 1); // 增加 key 触发重新挂载
    },
    [levelIndex],
  );

  useEffect(() => {
    if (!isGameMode || gameResult || gameEndedRef.current) return;

    const timer = window.setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            setGameResult("lose");
          }
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isGameMode, gameResult, resetKey]);

  // 处理下一关
  const handleNextLevel = () => {
    if (levelIndex < GAME_LEVELS.length - 1) {
      const nextIdx = levelIndex + 1;
      setMaxUnlockedLevelIndex((prev) => Math.max(prev, nextIdx));
      setLevelIndex(nextIdx);
      resetGame(nextIdx);
    } else {
      // 最后一关成功后，回到第一关
      setLevelIndex(0);
      resetGame(0);
    }
  };

  useEffect(() => {
    if (!isGameMode) {
      setGameIntroActive(false);
    }
  }, [isGameMode]);

  useEffect(() => {
    if (isGameMode) {
      resetGame();
    } else {
      // 切回展厅模式时：
      // 1. 重置相机索引到 0
      useApp.getState().setCurrentCamera(0);
      // 2. 关键：重置车头方向到初始值，确保展厅相机计算位置正确
      setChetoufangxiang(new Vector3(1, 0, 0));
      // 3. 强制触发相机重置
      setResetKey((prev) => prev + 1);
    }
  }, [isGameMode, resetGame]);

  // 创建父级 Group 的 Ref（用于后续手动控制父级位置）
  const parentGroupRef = useRef<Group>(null);

  const handleCollision = (damage: number) => {
    if (gameEndedRef.current || gameResult) return;

    setHealth((prev) => Math.max(0, prev - damage));

    if (isGameMode) {
      setCollisionCount((c) => c + 1);
      const penalty = GAME_LEVELS[levelIndex].penaltyPerHit;
      setWallet((w) => {
        const next = Math.max(0, w - penalty);
        if (next <= 0 && !gameEndedRef.current) {
          gameEndedRef.current = true;
          setGameResult("lose");
        }
        return next;
      });
    }
  };

  const handleParked = useCallback(
    (parkedLevelIdx: number) => {
      // 关键修复：确保只有当前活跃关卡的成功回调才有效
      // 避免旧关卡组件在卸载前的最后一帧触发成功回调
      if (parkedLevelIdx !== levelIndex || gameEndedRef.current || gameResult)
        return;

      gameEndedRef.current = true;
      const unlocked = Math.min(parkedLevelIdx + 1, GAME_LEVELS.length - 1);
      setMaxUnlockedLevelIndex((prev) => Math.max(prev, unlocked));
      setGameResult("win");
    },
    [levelIndex, gameResult],
  );

  const handleSelectLevel = useCallback(
    (nextLevelIndex: number) => {
      const safeIndex = Math.max(
        0,
        Math.min(nextLevelIndex, maxUnlockedLevelIndex, GAME_LEVELS.length - 1),
      );
      setLevelIndex(safeIndex);
      resetGame(safeIndex);
    },
    [maxUnlockedLevelIndex, resetGame],
  );

  // 2. 事件处理：更新WASD按键状态（传递给ControlButtons和Car组件）
  const handleKeyChange = (key: string, isPressed: boolean) => {
    setKeyPressed((prev) => ({ ...prev, [key]: isPressed })); //...prev 是 ES6 中的扩展运算符（spread operator），主要用于复制对象的属性
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Canvas
        // style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }}
        // camera={{ position: xiangjiweizhi }}
        // shadows={false}
        dpr={[1, 2]} // 设置渲染分辨率，范围从1到2，适配高DPI屏幕
        shadows
        performance={{ min: 0.5 }} // 设置性能阈值
      >
        <color
          attach="background"
          args={[isGameMode ? "#1F0903" : "#323438"]}
        />

        {/* 只有在游戏模式下才启用物理引擎 */}
        <Physics paused={!isGameMode}>
          {isGameMode ? (
            // 游戏模式
            <>
              <GameCar
                key={`car-${resetKey}`} // 强制重置
                currentModel={currentModel}
                keyPressed={keyPressed}
                health={health} // 传递健康值
                onCollision={handleCollision} // 传递碰撞处理
                setWheelSpeed={syncWheelSpeed} // 使用同步函数更新
                setChetoufangxiang={setChetoufangxiang}
                carRBRef={gameCarRBRef} // 把 ref 传给 GameCar
                initialPos={GAME_LEVELS[levelIndex].initialPos}
                initialRotY={GAME_LEVELS[levelIndex].initialRotY}
              />
              {/* 副本里的车位、障碍物 */}
              <ParkingLevel
                key={`level-${resetKey}`} // 强制重置
                carRigidBodyRef={gameCarRBRef}
                wheelSpeedRef={wheelSpeedRef}
                levelIndex={levelIndex}
                onExitGame={() => setIsGameMode(false)}
                onObstacleCollision={() => handleCollision(0)} // 障碍车碰撞由 ParkingLevel 触发，伤害由 App 统一处理
                onParked={handleParked} // 修正：现在 handleParked 接收参数
                onInitTarget={(id) => setTargetSpotId(id)}
              />
            </>
          ) : (
            // 展示模式
            <Car
              currentModel={currentModel}
              keyPressed={keyPressed}
              setIsLoading={setIsLoading}
              setLoadingProgress={setLoadingProgress}
              setWheelSpeed={syncWheelSpeed} // 使用同步函数更新
              setChetoufangxiang={setChetoufangxiang}
            />
          )}

          <group
            ref={parentGroupRef} // 绑定 Ref，方便后续手动控制
          ></group>
        </Physics>

        <Lights />

        {/* 根据模式切换相机 */}
        {isGameMode ? (
          <GameCamera
            key={`game-camera-${resetKey}`} // 重置关卡时重新对焦
            carRBRef={gameCarRBRef}
            initialPos={GAME_LEVELS[levelIndex].initialPos}
          />
        ) : (
          <Camera
            wheelSpeed={wheelSpeed}
            currentModel={currentModel}
            chetoufangxiang={chetoufangxiang}
          />
        )}

        <BloomEffect />
        <Huangjing isGameMode={isGameMode} />
      </Canvas>

      {/* 游戏 UI - 移到 Canvas 外部，不受相机影响 */}
      {isGameMode && (
        <GameHUD
          wallet={wallet}
          maxWallet={GAME_LEVELS[levelIndex].wallet}
          collisionCount={collisionCount}
          difficultyStars={GAME_LEVELS[levelIndex].difficultyStars}
          winText={GAME_LEVELS[levelIndex].winText}
          loseText={GAME_LEVELS[levelIndex].loseText}
          winSubText={GAME_LEVELS[levelIndex].winSubText}
          loseSubText={GAME_LEVELS[levelIndex].loseSubText}
          timeLimitSec={GAME_LEVELS[levelIndex].timeLimitSec}
          targetSpotId={targetSpotId}
          remainingTime={remainingTime}
          currentLevelIndex={levelIndex}
          maxUnlockedLevelIndex={maxUnlockedLevelIndex}
          currentLevel={levelIndex + 1}
          totalLevels={GAME_LEVELS.length}
          gameResult={gameResult}
          onRetry={() => resetGame()}
          onNextLevel={handleNextLevel}
          onExit={() => setIsGameMode(false)}
          onSelectLevel={handleSelectLevel}
          isLastLevel={levelIndex === GAME_LEVELS.length - 1}
        />
      )}

      <Logo style={{ zIndex: 999 }} isGameMode={isGameMode} />

      {isGameMode ? (
        <ControlButtonsGame
          keyPressed={keyPressed}
          onKeyChange={handleKeyChange}
          style={{ zIndex: 1000 }}
        />
      ) : (
        <ControlButtons
          keyPressed={keyPressed}
          onKeyChange={handleKeyChange}
          style={{ zIndex: 1000 }}
        />
      )}
      <ModelSelector
        currentModel={currentModel}
        setCurrentModel={setCurrentModel}
        style={{ zIndex: 997 }}
      />
      <ZhuanchangVideo currentModel={currentModel} />
      <SpeedMeter
        wheelSpeed={wheelSpeed}
        maxWheelSpeed={0.79} // 对应Car组件中的MAX_WHEEL_SPEED
        maxDisplaySpeed={120}
        style={{ zIndex: 1003 }}
      />
      <UI showCameraControls={!isGameMode} />
      {/* 入口 UI */}
      {!isGameMode && (
        <div
          className="parking-button-wrapper"
          onClick={() => {
            setIsGameMode(true);
            setGameIntroActive(true);
          }}
        >
          <div className="parking-button-bg">
            <button className="parking-button-inner">炼狱停车场</button>
          </div>
        </div>
      )}

      {/* 退出 UI */}
      {isGameMode && (
        <button
          onClick={() => setIsGameMode(false)}
          className="exit-button"
          aria-label="返回展厅"
        >
          返回展厅
        </button>
      )}

      {/* 3. 加载动画（z-index最高，加载时显示） */}
      {isLoading && (
        <LoadingScreen progress={loadingProgress} style={{ zIndex: 9999 }} />
      )}

      <GameStartIntro
        active={gameIntroActive}
        onComplete={() => setGameIntroActive(false)}
      />
    </div>
  );
}

export default App;
