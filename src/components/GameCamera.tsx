import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { MathUtils, Vector3, PerspectiveCamera } from "three";

interface GameCameraProps {
  carRBRef: React.RefObject<any>; // 玩家车辆的刚体引用
  initialPos?: [number, number, number]; // 初始位置（用于立即对焦）
}

export function GameCamera({ carRBRef, initialPos }: GameCameraProps) {
  const controls = useThree((state) => state.controls) as CameraControlsImpl;
  const camera = useThree((state) => state.camera);
  // const scene = useThree((state) => state.scene);

  // 相机偏移量（相对于车的位置）
  const cameraOffset = useRef(new Vector3(0, 3, 6)); // 默认：车后方、上方
  const carPos = useRef(new Vector3());
  const lastCarPos = useRef(new Vector3());

  // 初始化：立即跳转到初始位置
  useEffect(() => {
    if (!controls || !initialPos) return;

    // 立即对焦到初始位置
    const initialCarPos = new Vector3(...initialPos);
    const targetCameraPos = initialCarPos.clone().add(cameraOffset.current);

    controls.setLookAt(
      targetCameraPos.x,
      targetCameraPos.y,
      targetCameraPos.z,
      initialCarPos.x,
      initialCarPos.y,
      initialCarPos.z,
      true, // 立即跳转，无过渡
    );

    lastCarPos.current.copy(initialCarPos);
  }, [controls, initialPos]);

  // 设置 FOV
  useEffect(() => {
    if (camera instanceof PerspectiveCamera) {
      camera.fov = 40;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  useFrame(() => {
    if (!controls || !carRBRef.current) return;

    // 从刚体获取当前实时世界位置
    const translation = carRBRef.current.translation();
    carPos.current.set(translation.x, translation.y, translation.z);

    // 关键：使用 moveTo 移动控制器目标，同时相机会保持相对偏移跟随
    // 这样在移动时，用户依然可以自由旋转和缩放视角
    controls.moveTo(
      carPos.current.x,
      carPos.current.y,
      carPos.current.z,
      true, // 平滑过渡
    );
  });

  return (
    <CameraControls
      makeDefault
      // smoothTime={0.1} // 游戏模式下增加轻微平滑感
      minPolarAngle={MathUtils.degToRad(10)} // 防止穿地
      maxPolarAngle={MathUtils.degToRad(85)} // 限制俯视角度
      maxDistance={7} // 游戏模式摄像头最远距离
      minDistance={2}
    />
  );
}
