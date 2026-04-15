import { useRef, useState, useEffect, useMemo } from "react";
import { useGLTF, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { COLORS, useApp } from "./state";
import { CarPaintMaterial } from "../Carpaint/CarPaintMaterial";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RigidBody, MeshCollider } from "@react-three/rapier";

/** 设为 true 可线框查看凸包与车身是否对齐 */
const DEBUG_CAR_HULL = false;
/** 凸包缩放：可直接调这里（同时影响碰撞与可视化） */
const HULL_SCALE = [1, 1, 1];

const HULL_GLB_PATH_SU7 = "./models/su7 pengzhuangtibaobian.glb";
const HULL_GLB_PATH_SU7U = "./models/su7U pengzhuangtibaobian.glb";

const GameCar = ({
  currentModel = "xiaomi su7-action3",
  keyPressed,
  health,
  onCollision,
  setWheelSpeed = (speed) => {},
  setChetoufangxiang,
  carRBRef, // 从 App 传入，供 ParkingLevel 读取碰撞/位置信息
  initialPos = [0, 0, 0], // 新增：初始位置
  initialRotY = 0, // 新增：初始旋转
}) => {
  const wheelSpeedRef = useRef(0);
  const tempVec3 = useRef(new THREE.Vector3()); // 预分配 Vector3 减少 GC
  const upAxisRef = useRef(new THREE.Vector3(0, 1, 0));
  const sideVecRef = useRef(new THREE.Vector3());
  const turnCenterRef = useRef(new THREE.Vector3());
  const relativePosRef = useRef(new THREE.Vector3());

  // 根据健康值获取颜色（模拟车辆状态变化）
  const getHealthColor = () => {
    if (health > 90) return "#ffffec";
    if (health > 60) return "#ffcd17";
    if (health > 30) return "#ff7f17";
    if (health > 10) return "#ff0400";
    return "black";
  };

  const handleCollision = (event) => {
    const otherBody = event.other.rigidBody;
    if (otherBody?.userData?.type === "ground") return;

    // 获取当前车速计算伤害
    const speed = Math.abs(wheelSpeedRef.current);

    const minSpeedForDamage = 0.05;
    if (speed > minSpeedForDamage) {
      const damage = Math.floor(speed * 50);
      onCollision(damage);

      // 💥 碰撞瞬间停车：逻辑 1
      wheelSpeedRef.current = 0;
      setWheelSpeed(0);

      // 🛡️ 坐标回退：逻辑 2 (防止穿墙卡死)
      if (lastValidPos.current) {
        worldPos.current.copy(lastValidPos.current);
      }
    }
  };

  // ✅ 用 ref 自己追踪世界坐标和朝向角
  const worldPos = useRef(new Vector3(...initialPos));
  const lastValidPos = useRef(new Vector3(...initialPos)); // 新增：记录上一帧有效位置
  const worldRotY = useRef(initialRotY);

  // ✅ 挂载后立即把初始位置同步到 RigidBody，避免第一帧前出现瞬移
  useEffect(() => {
    if (!carRBRef?.current) return;
    carRBRef.current.setNextKinematicTranslation({
      x: initialPos[0],
      y: initialPos[1],
      z: initialPos[2],
    });
    carRBRef.current.setNextKinematicRotation({
      x: 0,
      y: Math.sin(initialRotY / 2),
      z: 0,
      w: Math.cos(initialRotY / 2),
    });
  }, []); // 仅挂载时执行一次

  // 动态加载模型
  const modelPath =
    currentModel === "xiaomi su7-action3"
      ? "./models/xiaomi su7-action3.glb"
      : "./models/su7U2.glb";
  const { scene } = useGLTF(modelPath);
  // 两个车型各自的低模凸包：用于 Rapier convex hull 碰撞代理
  const { scene: hullRootSU7 } = useGLTF(HULL_GLB_PATH_SU7);
  const { scene: hullRootSU7U } = useGLTF(HULL_GLB_PATH_SU7U);

  const isXiaomiSu7 = currentModel === "xiaomi su7-action3";
  const activeHullRoot = isXiaomiSu7 ? hullRootSU7 : hullRootSU7U;

  const mergedHullGeometry = useMemo(() => {
    const geoms = [];
    activeHullRoot.updateWorldMatrix(true, true);
    activeHullRoot.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const g = child.geometry.clone();
        g.applyMatrix4(child.matrixWorld);
        geoms.push(g);
      }
    });
    if (geoms.length === 0) return null;
    return mergeGeometries(geoms);
  }, [activeHullRoot]);

  const colorIndex = useApp((state) => state.colorIndex);

  // 车辆参数
  const jiasudu = 0.003;
  const MAX_WHEEL_SPEED = 0.3;
  const friction = 0.95;
  const TURN_ANGLE = 0.01;
  const WHEEL_RADIUS = 0.175;
  const zhouju = 1.5;
  const MAX_TURN_ANGLE = 0.52;

  const carbodyRotationz = useRef(0);
  const carbodyRotationx = useRef(0);

  const xuanguajiasu = 0.0045;
  const MAX_xuanguajiao = 0.039;
  const MIN_xuanguajiao = -0.03;
  const xuanguajiasuzuoyou = 0.0015;
  const MAX_xuanguajiaozuoyou = 0.04;

  // 模型节点引用
  const modelRef = useRef(null);

  // ✅ carParent 作为 RigidBody 的子级
  // 本地坐标保持 (0,0,0)，位置由父级 RigidBody 控制
  // 这个 ref 只用于悬挂视觉动画（rotation）
  const carParent = useRef(null);
  const carbodyParent = useRef(null);
  const car_center_point = useRef(null);
  const cheyuandian = useRef(null);
  const zuoqianlunParent = useRef(null);
  const youqianlunParent = useRef(null);

  const wheelRefs = {
    zuoqianlun: useRef(null),
    youqianlun: useRef(null),
    zuohoulun: useRef(null),
    youhoulun: useRef(null),
  };

  const carbodyMaterialsRef = useRef([]);
  const glassMaterialRef = useRef(null);
  const backlightMaterialRef = useRef(null);
  const dadengMaterialRef = useRef(null);

  // 初始化：找到模型中的轮胎节点和材质
  useEffect(() => {
    if (!modelRef.current) return;

    carbodyMaterialsRef.current = [];

    modelRef.current.traverse((node) => {
      if (node.userData.yuanshiMaterial) {
        node.material = node.userData.yuanshiMaterial;
        delete node.userData.yuanshiMaterial;
      }
    });

    modelRef.current.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }

      if (node.name in wheelRefs) wheelRefs[node.name].current = node;
      if (node.name === "zuoqianlunParent") zuoqianlunParent.current = node;
      if (node.name === "youqianlunParent") youqianlunParent.current = node;
      if (node.name === "carbodyParent") carbodyParent.current = node;
      if (node.name === "car_center_point") car_center_point.current = node;
      if (node.name === "cheyuandian") {
        cheyuandian.current = node;
        console.log(`找到车中心点节点: ${cheyuandian.current.name}`);
      }

      const visitMaterial = (material, slotIndex) => {
        if (!material) return;
        if (material.name === "Car_body") {
          if (!node.userData.yuanshiMaterial) {
            node.userData.yuanshiMaterial = Array.isArray(node.material)
              ? [...node.material]
              : node.material.clone();
          }
          const customPaint = new CarPaintMaterial(material);
          if (Array.isArray(node.material)) {
            node.material[slotIndex] = customPaint;
          } else {
            node.material = customPaint;
          }
          carbodyMaterialsRef.current.push(customPaint);
        }
        if (material.name === "Car_window") glassMaterialRef.current = material;
        if (material.name === "Car_backlight")
          backlightMaterialRef.current = material;
        if (material.name === "dadeng") dadengMaterialRef.current = material;
      };

      if (Array.isArray(node.material)) {
        node.material.forEach((m, i) => visitMaterial(m, i));
      } else {
        visitMaterial(node.material, 0);
      }
    });
  }, [currentModel]);

  // 颜色切换
  useEffect(() => {
    const targetColor = COLORS[colorIndex];
    if (carbodyMaterialsRef.current.length > 0 && targetColor) {
      requestAnimationFrame(() => {
        carbodyMaterialsRef.current.forEach((material) => {
          material.setColors(
            targetColor.color,
            targetColor.perl,
            targetColor.flake,
          );
        });
      });
    }
  }, [colorIndex]);

  // 尾灯/大灯
  useEffect(() => {
    if (backlightMaterialRef.current) {
      if (keyPressed.s) {
        backlightMaterialRef.current.color.set(1, 0, 0);
        backlightMaterialRef.current.emissive.set(1, 0, 0);
        backlightMaterialRef.current.emissiveIntensity = 50;
      } else {
        backlightMaterialRef.current.color.set(1, 1, 1);
        backlightMaterialRef.current.emissive.set(1, 1, 1);
        backlightMaterialRef.current.emissiveIntensity = 0;
      }
      if (keyPressed.w) {
        dadengMaterialRef.current.emissiveIntensity = 100;
      } else {
        dadengMaterialRef.current.emissiveIntensity = 0;
      }
    }
  }, [keyPressed.s, keyPressed.w]);

  // 悬挂：加速/刹车抬头压头（纯视觉，只改 carbodyParent 本地旋转）
  function update_xuangua(step) {
    if (!carbodyParent.current) return;
    let currentRotationz = carbodyRotationz.current;
    const atMaxSpeed =
      Math.abs(wheelSpeedRef.current) >= MAX_WHEEL_SPEED - 0.01;

    if (keyPressed.w && !atMaxSpeed) {
      currentRotationz = Math.min(
        currentRotationz + xuanguajiasu * step,
        MAX_xuanguajiao,
      );
    } else if (keyPressed.s && !atMaxSpeed) {
      currentRotationz = Math.max(
        currentRotationz - xuanguajiasu * step,
        MIN_xuanguajiao,
      );
    } else {
      const suspensionDamping = Math.pow(0.98, step);
      if (currentRotationz > 0) {
        currentRotationz *= suspensionDamping;
        if (currentRotationz < 0.001) currentRotationz = 0;
      } else if (currentRotationz < 0) {
        currentRotationz *= suspensionDamping;
        if (currentRotationz > -0.001) currentRotationz = 0;
      }
    }
    carbodyRotationz.current = currentRotationz;
    carbodyParent.current.rotation.z = currentRotationz;
  }

  // 悬挂：左右转弯摆动（纯视觉）
  function update_xuangua_zuoyou(step) {
    if (!carbodyParent.current) return;
    if (Math.abs(wheelSpeedRef.current) < 0.015) return;

    let currentRotationx = carbodyRotationx.current;
    if (keyPressed.a) {
      currentRotationx = Math.min(
        currentRotationx + xuanguajiasuzuoyou * step,
        MAX_xuanguajiaozuoyou,
      );
    } else if (keyPressed.d) {
      currentRotationx = Math.max(
        currentRotationx - xuanguajiasuzuoyou * step,
        -MAX_xuanguajiaozuoyou,
      );
    } else {
      if (Math.abs(currentRotationx) > 0) {
        currentRotationx *= Math.pow(0.98, step);
        if (Math.abs(currentRotationx) < 0.001) currentRotationx = 0;
      }
    }
    carbodyRotationx.current = currentRotationx;
    carbodyParent.current.rotation.x = currentRotationx;
  }

  useFrame((_, delta) => {
    if (
      !modelRef.current ||
      !carRBRef?.current ||
      !zuoqianlunParent.current ||
      !youqianlunParent.current ||
      !carbodyParent.current
    )
      return;

    // 帧率无关：以 60fps 为基准进行步长归一化，避免低帧机器车速变慢
    const dt = Math.min(delta, 1 / 30);
    const step = dt * 60;

    // ---- 轮速更新 ----
    if (keyPressed.w) {
      const newSpeed = Math.min(
        wheelSpeedRef.current + jiasudu * step,
        MAX_WHEEL_SPEED,
      );
      wheelSpeedRef.current = newSpeed;
      setWheelSpeed(newSpeed);
    }
    if (keyPressed.s) {
      const newSpeed = Math.max(
        wheelSpeedRef.current - jiasudu * step,
        -MAX_WHEEL_SPEED,
      );
      wheelSpeedRef.current = newSpeed;
      setWheelSpeed(newSpeed);
    }
    if (keyPressed.s && keyPressed.w) {
      const brakeFactor = Math.pow(0.9, step);
      const finalSpeed =
        Math.abs(wheelSpeedRef.current * brakeFactor) < 0.01
          ? 0
          : wheelSpeedRef.current * brakeFactor;
      wheelSpeedRef.current = finalSpeed;
      setWheelSpeed(finalSpeed);
    }
    if (!keyPressed.s && !keyPressed.w) {
      const frictionFactor = Math.pow(friction, step);
      const finalSpeed =
        Math.abs(wheelSpeedRef.current * frictionFactor) < 0.01
          ? 0
          : wheelSpeedRef.current * frictionFactor;
      wheelSpeedRef.current = finalSpeed;
      setWheelSpeed(finalSpeed);
    }

    // ---- 旋转轮胎（纯视觉，改本地旋转完全没问题）----
    Object.values(wheelRefs).forEach((wheel) => {
      if (wheel.current) wheel.current.rotation.z -= wheelSpeedRef.current * step;
    });

    // ---- 转向（纯视觉，改前轮父级本地旋转）----
    if (keyPressed.a) {
      zuoqianlunParent.current.rotation.y = Math.min(
        zuoqianlunParent.current.rotation.y + TURN_ANGLE * step,
        MAX_TURN_ANGLE,
      );
      youqianlunParent.current.rotation.y = Math.min(
        youqianlunParent.current.rotation.y + TURN_ANGLE * step,
        MAX_TURN_ANGLE,
      );
    }
    if (keyPressed.d) {
      zuoqianlunParent.current.rotation.y = Math.max(
        zuoqianlunParent.current.rotation.y - TURN_ANGLE * step,
        -MAX_TURN_ANGLE,
      );
      youqianlunParent.current.rotation.y = Math.max(
        youqianlunParent.current.rotation.y - TURN_ANGLE * step,
        -MAX_TURN_ANGLE,
      );
    }
    if ((!keyPressed.a && !keyPressed.d) || (keyPressed.a && keyPressed.d)) {
      const steerReturnFactor = Math.pow(0.9, step);
      zuoqianlunParent.current.rotation.y *= steerReturnFactor;
      youqianlunParent.current.rotation.y *= steerReturnFactor;

      const newRotation = carbodyRotationx.current * Math.pow(0.95, step);
      carbodyRotationx.current =
        Math.abs(newRotation) < 0.002 ? 0 : newRotation;
      carbodyParent.current.rotation.x = carbodyRotationx.current;
    }
    if (Math.abs(zuoqianlunParent.current.rotation.y) < 0.001) {
      zuoqianlunParent.current.rotation.y = 0;
      youqianlunParent.current.rotation.y = 0;
    }

    // ---- 停车时不计算移动，直接返回 ----
    if (Math.abs(wheelSpeedRef.current) < 0.01) {
      lastValidPos.current.copy(worldPos.current); // 即使静止也更新有效位置
      return;
    }

    // 在计算新位置之前，记录当前有效位置
    lastValidPos.current.copy(worldPos.current);

    // ---- 核心移动逻辑：计算新位置写入 worldPos/worldRotY ----
    const zhuanxiangjiao = zuoqianlunParent.current.rotation.y;
    const zuoyoufangxiang = Math.sign(zhuanxiangjiao);

    // 基于自己追踪的 worldRotY 计算前进方向
    const forwardDir = tempVec3.current
      .set(Math.cos(worldRotY.current), 0, -Math.sin(worldRotY.current))
      .normalize();

    if (setChetoufangxiang) setChetoufangxiang(forwardDir.clone());

    if (Math.abs(zhuanxiangjiao) < 0.01) {
      // 直行
      const moveDistance = wheelSpeedRef.current * WHEEL_RADIUS * step;
      worldPos.current.add(forwardDir.multiplyScalar(moveDistance));
    } else {
      // 转弯（阿克曼转向公式，逻辑和原来完全一样）
      const moveDistance =
        zuoyoufangxiang * wheelSpeedRef.current * WHEEL_RADIUS * step;
      const turnRadius = zhouju / Math.tan(Math.abs(zhuanxiangjiao));
      const turnAngle = moveDistance / turnRadius;

      const side = sideVecRef.current
        .copy(forwardDir)
        .cross(upAxisRef.current)
        .multiplyScalar(zuoyoufangxiang || 1)
        .normalize();
      const turnCenter = turnCenterRef.current
        .copy(worldPos.current)
        .addScaledVector(side, turnRadius);
      const relativePos = relativePosRef.current
        .copy(worldPos.current)
        .sub(turnCenter);
      relativePos.applyAxisAngle(upAxisRef.current, -turnAngle);
      worldPos.current.copy(turnCenter).add(relativePos);
      worldRotY.current += turnAngle;
    }

    // ✅ 通过物理 API 驱动 RigidBody，carParent 作为子级自动跟随
    // 碰到障碍物时，物理引擎会阻止 RigidBody 移动，worldPos 也就停在那里
    carRBRef.current.setNextKinematicTranslation({
      x: worldPos.current.x,
      y: worldPos.current.y,
      z: worldPos.current.z,
    });
    carRBRef.current.setNextKinematicRotation({
      x: 0,
      y: Math.sin(worldRotY.current / 2),
      z: 0,
      w: Math.cos(worldRotY.current / 2),
    });

    // 悬挂视觉动画
    update_xuangua(step);
    update_xuangua_zuoyou(step);
  });

  return (
    // ✅ RigidBody 负责物理位置和碰撞
    // carParent 作为子级，本地坐标 (0,0,0) 不动，只做悬挂 rotation 动画
    <RigidBody
      ref={carRBRef}
      type="kinematicPosition"
      colliders={false} //禁用汽车自动生成的物理碰撞盒，用下方自定义的碰撞盒
      includeInvisible
      onCollisionEnter={handleCollision}
    >
      {/* 碰撞：SU7 / SU7U 统一使用各自凸包 GLB。停车判定仍看 ParkingLevel 的矩形逻辑 */}
      <MeshCollider type="hull">
        <mesh
          geometry={mergedHullGeometry}
          scale={HULL_SCALE}
          visible={false}
          raycast={() => null}
        >
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </MeshCollider>
      {/* 车辆发光条（模拟霓虹灯/状态灯） */}
      {/* <mesh castShadow receiveShadow position={[0.15, 1, 0]}>
        <boxGeometry args={[0.03, 0.03, 0.5]} />
        <meshStandardMaterial
          color={getHealthColor()}
          emissive={getHealthColor()} // 发光颜色与健康值关联
          emissiveIntensity={1}
        />
      </mesh> */}
      {DEBUG_CAR_HULL && mergedHullGeometry ? (
        <mesh
          geometry={mergedHullGeometry}
          scale={HULL_SCALE}
          raycast={() => null}
        >
          <meshBasicMaterial
            color="#00ff00"
            wireframe
            transparent
            opacity={0.35}
            depthTest
          />
        </mesh>
      ) : (
        <mesh position={[0.15, 0.35, 0]}>
          <boxGeometry args={[2.34, 0.7, 1]} />
          <meshStandardMaterial color="red" transparent opacity={0} wireframe />
        </mesh>
      )}
      {/* 视觉模型：位置由父级 RigidBody 驱动，本地 position 保持 (0,0,0) */}
      <group ref={carParent}>
        <primitive object={scene} ref={modelRef} />
      </group>
    </RigidBody>
  );
};

useGLTF.preload(HULL_GLB_PATH_SU7);
useGLTF.preload(HULL_GLB_PATH_SU7U);

export default GameCar;
