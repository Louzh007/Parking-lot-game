import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import {
  MathUtils,
  Object3D,
  Vector3,
  PerspectiveCamera,
  Matrix4,
} from "three";
import { CAMERA_VIEWS, useApp } from "./state";

interface CameraProps {
  wheelSpeed: number;
  currentModel: string;
  chetoufangxiang: Vector3; // 从 App 传递的车头方向
}

export function Camera({
  wheelSpeed,
  currentModel,
  chetoufangxiang,
}: CameraProps) {
  const controls = useThree((state) => state.controls) as CameraControlsImpl;
  //设置相机的的 fov 焦距

  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  const carRef = useRef<Object3D | null>(null);

  // const regress = useThree((state) => state.performance.regress);

  // 相机与车的相对位置
  // 使用 useRef 存储相机偏移，避免状态更新延迟
  const cameraOffsetRef = useRef(new Vector3());
  const [isCarStationary, setIsCarStationary] = useState(true);
  const isFollowingRef = useRef(false); // 标记是否处于跟随模式

  // 标记是否已设置初始位置
  const initializedRef = useRef(false);

  // 1. 初始化相机：重置到第一个视角
  useEffect(() => {
    if (!controls || !scene) return;

    // 重新获取车辆中心点（组件重新挂载时可能为 null）
    const targetNode = scene.getObjectByName("car_center_point") as Object3D;
    if (!targetNode) return;
    carRef.current = targetNode;

    const initialOffset = CAMERA_VIEWS[0].offset;
    const carPos = targetNode.getWorldPosition(new Vector3());

    // 立即重置到初始侧视位置
    controls.setLookAt(
      initialOffset.x,
      initialOffset.y,
      initialOffset.z,
      carPos.x,
      carPos.y,
      carPos.z,
      true, // 立即跳转
    );

    // 初始化视角索引为 0
    cameraOffsetRef.current.copy(initialOffset);
    initializedRef.current = true;
  }, [scene, controls]); // 只要场景或控制器准备好，就执行初始化

  const currentCamera = useApp((state) => state.currentCamera); // 获取当前相机索引,currentCamera用于视角切换

  // 1.核心工具函数：根据车头方向旋转相机偏移向量
  // （确保偏移向量始终相对于车辆朝向）
  const rotateOffsetByCarDirection = (offset: Vector3, direction: Vector3) => {
    // 从车头方向向量计算车身 Y 轴旋转角（关键：将方向向量转为旋转角度）
    const carRotationY = Math.atan2(-direction.z, direction.x); // 倒推出旋转角度

    // 创建 Y 轴旋转矩阵，用于旋转偏移向量
    const rotationMatrix = new Matrix4().makeRotationY(carRotationY);

    // 对预设的偏移向量应用旋转，得到“相对于车辆朝向的世界坐标偏移”
    return offset.clone().applyMatrix4(rotationMatrix);
  };

  //2. 初始化：获取车辆中心点（car_center_point，和之前逻辑一致）
  useEffect(() => {
    if (!controls || !carRef.current || !chetoufangxiang) return;

    carRef.current = scene.getObjectByName("xiangjimubiao") as Object3D;
    // 重新初始化时更新相机偏移
    if (carRef.current && chetoufangxiang) {
      const view = CAMERA_VIEWS[currentCamera];
      if (view) {
        const rotatedOffset = rotateOffsetByCarDirection(
          view.offset,
          chetoufangxiang,
        );
        cameraOffsetRef.current = rotatedOffset;
      }
    }

    const view = CAMERA_VIEWS[currentCamera];
    if (!view) return;

    // 获取车辆中心点位置（目标点）
    const carPos = carRef.current.getWorldPosition(new Vector3());

    // 关键：根据车头方向旋转偏移向量
    const rotatedOffset = rotateOffsetByCarDirection(
      view.offset,
      chetoufangxiang,
    );

    // 计算相机最终位置（车辆位置 + 旋转后的偏移）
    const qiehuanCameraPos = carPos.clone().add(rotatedOffset);

    // 更新相机位置和目标点（目标点始终是车辆中心点）
    controls.setLookAt(
      qiehuanCameraPos.x,
      qiehuanCameraPos.y,
      qiehuanCameraPos.z,
      carPos.x,
      carPos.y,
      carPos.z,
      false, // false = 平滑过渡，true = 立即跳转
    );

    // 保存当前旋转后的偏移，用于车辆移动时跟随
    cameraOffsetRef.current = rotatedOffset;

    console.log("相机编号:", currentCamera);
  }, [currentModel, currentCamera]);

  useEffect(() => {
    // 当模型切换时currentModel会发生变化，重新查找车辆中心点
    carRef.current = scene.getObjectByName("car_center_point") as Object3D;
    initializedRef.current = false; // 允许重新初始化相机位置

    // 当模型切换后（initializedRef 已被设为 false），重新设置相机初始位置
    if (carRef.current && controls && !initializedRef.current) {
      const carPos = carRef.current.getWorldPosition(new Vector3());
      const initialCameraPos = carPos.clone().add(cameraOffsetRef.current);

      console.log("模型切换，更新相机位置:", initialCameraPos);
      console.log("新模型车辆位置:", carPos);

      // 重新设置相机位置和目标点
      controls.setLookAt(
        initialCameraPos.x,
        initialCameraPos.y,
        initialCameraPos.z,
        carPos.x,
        carPos.y,
        carPos.z,
        true, // 立即更新，无动画
      );

      initializedRef.current = true; // 标记为已初始化
    }
  }, [scene, currentModel]); // 监听 currentModel 变化

  useEffect(() => {
    // 类型守卫：检查 camera 是否是透视相机
    if (camera instanceof PerspectiveCamera) {
      if (camera.fov !== 35) {
        camera.fov = 35;
        camera.updateProjectionMatrix(); // 更新投影矩阵（修改fov后必须调用）
      }
    }
  }, [camera]);

  useFrame(() => {
    if (!carRef.current || !controls || !camera) return;

    const carPos = carRef.current.getWorldPosition(new Vector3());

    // 1. 判断车辆是否静止
    const wasStationary = isCarStationary;
    const chejingzhi = Math.abs(wheelSpeed) === 0;

    if (chejingzhi !== isCarStationary) {
      setIsCarStationary(chejingzhi);
    }

    // 2. 车辆从运动变为静止时，记录当前相机偏移
    if (chejingzhi && !wasStationary) {
      const cameraPos = camera.getWorldPosition(new Vector3());
      cameraOffsetRef.current = cameraPos.clone().sub(carPos);
      isFollowingRef.current = false;
      // console.log("车辆停止，保存相机偏移:", cameraOffsetRef.current);

      // 然后重新启用控制
      controls.enabled = true;

      // console.log("车辆停止，同步相机状态:", cameraPos);

      return;
    }

    // 3. 车辆静止时，允许用户自由操作相机
    if (chejingzhi) {
      // 更新偏移量（用户可能在调整视角）
      const cameraPos = camera.getWorldPosition(new Vector3());
      cameraOffsetRef.current = cameraPos.clone().sub(carPos);
      return;
    }

    // 4. 车辆开始运动时，强制相机跟随
    if (!chejingzhi) {
      // console.log("车辆运动中，wheelSpeed:", wheelSpeed);

      // 禁用 CameraControls 的用户输入
      if (!isFollowingRef.current) {
        controls.enabled = false;
        isFollowingRef.current = true;
      }

      // 计算新的相机位置
      const newCameraPos = carPos.clone().add(cameraOffsetRef.current);

      // 直接设置相机位置和目标

      controls.setLookAt(
        newCameraPos.x,
        newCameraPos.y,
        newCameraPos.z,
        carPos.x,
        carPos.y,
        carPos.z,
        true,
      );

      // console.log("设置相机位置:", newCameraPos);
    }
  });

  return (
    <>
      <CameraControls
        makeDefault
        minPolarAngle={MathUtils.degToRad(1)}
        // 不设置0是因为0就是顶部90度顶视图视角，会和运动方向的计算有bug冲突，会强制往上开，所以调整成了1
        maxPolarAngle={MathUtils.degToRad(90)}
        maxDistance={25}
        minDistance={0.5}
        // onChange={() => regress()}
        // 取消弹性的关键属性
        smoothTime={0} // 取消移动的缓动效果
      />
    </>
  );
}
