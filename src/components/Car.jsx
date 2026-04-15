import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import {
  useGLTF,
  useTexture,
  Cloud,
  Clouds,
  useAnimations,
  Select,
  useCursor,
  Html,
} from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Vector3,
  AnimationMixer,
  AnimationAction,
  Vector2,
  LoopOnce,
} from "three";
import { COLORS, useApp } from "./state";
import { CarPaintMaterial } from "../Carpaint/CarPaintMaterial"; // 导入自定义材质
import * as THREE from "three";
import { CarShadow } from "./CarShadow"; //导入阴影组件
import ParticleWaveGround from "./background";
import { CloudMaterial } from "./CloudMaterial";
import FlowLines from "./FlowLines";

// }
const Car = ({
  currentModel = "xiaomi su7-action3", // 默认模型
  keyPressed, // 从props接收keyPressed，不再本地定义
  setIsLoading,
  setLoadingProgress, // 默认空函数
  setWheelSpeed = (speed) => {}, // 类型：(speed: number) => void
  setChetoufangxiang,
}) => {
  const cloudOpacityRef = useRef(0); // 云朵初始透明度为 0
  const cloudGroupRef = useRef(null); // 引用云朵组

  const wheelSpeedRef = useRef(0); // 保留 ref 存储实时值（避免异步问题）
  //速度状态记录上一次的速度（用于判断状态变化）
  // 记录车上一次位置，用于判断车辆是否移动
  const prevCarPosition = useRef(null);
  const tempVec3 = useRef(new THREE.Vector3()); // 预分配 Vector3 减少 GC

  const { raycaster, camera } = useThree(); // 从 react-three-fiber 上下文获取 raycaster
  const [raycastEnabled, setRaycastEnabled] = useState(true); // 控制是否启用射线检测
  // 提前收集可交互节点
  const interactiveNodes = useRef([]);

  // 1. 动态加载模型（根据currentModel）
  const modelPath =
    currentModel === "xiaomi su7-action3"
      ? "./models/xiaomi su7-action3.glb"
      : "./models/su7U2.glb"; // 根据选择的车型动态设置路径
  const { scene, animations } = useGLTF(modelPath);

  // 正确的状态监听
  const colorIndex = useApp((state) => state.colorIndex);

  // 定义流光配置映射
  const flowConfig = {
    "xiaomi su7-action3": {
      path: "./models/xiaomi su7_xiantiao.glb",
      color: [0.2, 0.5, 1.0], // 蓝色
    },
    su7U2: {
      path: "./models/xiaomi su7utrl_xiantiao.glb",
      color: [1.0, 0.83, 0.34], // 金黄色
    },
  };

  const currentFlow =
    flowConfig[currentModel] || flowConfig["xiaomi su7-action3"]; //根据当前模型选择对应的流光配置，提供默认值

  const currentPaintColor = useMemo(() => {
    const targetColor = COLORS[colorIndex];
    if (!targetColor) return currentFlow.color; // 兜底用模型默认色

    const c = new THREE.Color(targetColor.flake); // hex 转 THREE.Color
    return [c.r, c.g, c.b]; // 转成 [r, g, b] 数组传给 FlowLines
  }, [colorIndex, currentFlow.color]);

  // 车辆状态管理

  const jiasudu = 0.006; // 加速度
  const MAX_WHEEL_SPEED = 0.79; // 最大转速
  const friction = 0.95; // 摩擦力（减速用）
  const TURN_ANGLE = 0.01; //设置轮胎旋转角度
  const WHEEL_RADIUS = 0.175; //设置轮胎半径
  const zhouju = 1.5; //轴距，前后轮中心点距离
  const MAX_TURN_ANGLE = 0.52; //轮胎最大转向角度

  //定义车身悬挂初始角度,悬架两个轴旋转，一个绕z轴也就是前后，一个是绕x轴也就是左右
  // let carbodyRotationz = 0;
  const carbodyRotationz = useRef(0);
  const carbodyRotationx = useRef(0);

  //定义车悬挂启动后加速度，这里用在起步和刹车的压头和抬头时候
  const xuanguajiasu = 0.0045;
  //定义 加速时车身悬挂最大翘起角度
  const MAX_xuanguajiao = 0.039;
  //定义刹车时车身悬挂最大压下角度
  const MIN_xuanguajiao = -0.03;
  //定义车悬挂左转右转的比例
  const xuanguajiasuzuoyou = 0.0015;
  //定义刹车时车身悬挂左右摆动最大角度
  const MAX_xuanguajiaozuoyou = 0.04;

  // 模型相关 Ref
  // 整个模型的引用，在 return 里通过 primitive 组件的 ref 属性关联，这里才是将模型与 modelRef 关联的关键
  const modelRef = useRef(null);

  //一个车身父级，控制启动的悬挂;一个整车父级，控制车身的旋转;还有一个车中心点，用于绑定摄像机目标点
  const carParent = useRef(null);
  const carbodyParent = useRef(null);
  const car_center_point = useRef(null);
  const cheyuandian = useRef(null);
  //给两个前轮绑定一个父级，来控制左右转向，定义这两个父级的名字
  const zuoqianlunParent = useRef(null);
  const youqianlunParent = useRef(null);

  // 定义左前门和右前门和尾翼
  const zuoqianmen = useRef(null);
  const youqianmen = useRef(null);
  const cheweiyi = useRef(null);

  // 定义车门开关状态
  const [leftdoorOpen, setLeftdoorOpen] = useState(false);
  const [rightdoorOpen, setRightdoorOpen] = useState(false);

  // 尾翼状态管理
  const [weiyiOpen, setWeiyiOpen] = useState(false);

  // 鼠标悬停状态
  // 获取state 中悬浮 div 的全局状态和更新方法
  const { setTip } = useApp();

  //添加动画相关引用
  const mixerRef = useRef(null);
  const zuomenActionsRef = useRef(null);
  const youmenActionsRef = useRef(null);
  const cheweiyiActionsRef = useRef(null);

  const wheelRefs = {
    zuoqianlun: useRef(null), // 左前轮
    youqianlun: useRef(null), // 右前轮
    zuohoulun: useRef(null), // 左后轮
    youhoulun: useRef(null), // 右后轮
  };

  // 定义材质引用（存储捕获到的材质）
  // 定义材质引用 - 使用数组
  const carbodyMaterialsRef = useRef([]); // 改为数组
  const glassMaterialRef = useRef(null);
  const backlightMaterialRef = useRef(null);
  const dadengMaterialRef = useRef(null);
  const yingziMaterialRef = useRef(null);

  // 正确的状态监听
  // const colorIndex = useApp((state) => state.colorIndex);

  // ✅ 动画初始化
  useEffect(() => {
    if (!scene || !modelRef.current || !animations.length) return;

    // 创建动画混合器
    mixerRef.current = new AnimationMixer(scene);

    const findAnimation = (name) => {
      return animations.find((clip) => clip.name === name);
    };

    // 查找并初始化左车门动画
    const leftDoorClip = findAnimation("zuoqianmen动作");

    if (leftDoorClip) {
      const action = mixerRef.current.clipAction(leftDoorClip);
      action.setLoop(LoopOnce); // 只播放一次
      action.clampWhenFinished = true; // 停在最后一帧
      zuomenActionsRef.current = action;
      // console.log("左门动画初始化成功:", leftDoorClip.name);
    } else {
      console.warn("未找到左门动画");
    }

    // 查找并初始化右车门动画
    const rightDoorClip = findAnimation("youqianmen动作");

    if (rightDoorClip) {
      const action = mixerRef.current.clipAction(rightDoorClip);
      action.setLoop(LoopOnce);
      action.clampWhenFinished = true;
      youmenActionsRef.current = action;
      // console.log("右门动画初始化成功:", rightDoorClip.name);
    } else {
      console.warn("未找到右门动画");
    }

    // 查找 cheweiyi 动画
    const cheweiyiClip = findAnimation("cheweiyi动作") || null;
    if (cheweiyiClip) {
      const action = mixerRef.current.clipAction(cheweiyiClip);
      action.setLoop(LoopOnce);
      action.clampWhenFinished = true;
      cheweiyiActionsRef.current = action;
      // console.log("车尾翼动画初始化成功:", cheweiyiClip.name);
    } else {
      console.warn("未找到车尾翼动画");
    }

    // 调试：打印所有可用的动画
    // console.log(
    //   "所有动画clips:",
    //   animations.map((clip) => clip.name)
    // );

    return () => {
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }
    };
  }, [scene, animations]);

  // 加载模型
  // const { scene } = useGLTF("./models/xiaomi su7-action3.glb");

  // 1. 初始化：找到模型中的轮胎节点
  useEffect(() => {
    if (!modelRef.current) return;

    // 清空之前的引用,在开发模式下，React 会故意运行两次 useEffect 来帮助发现副作用问题。我去关闭了main.tsx里的StrictMode
    carbodyMaterialsRef.current = [];

    // 新增：如果有旧模型，先恢复其原始材质（避免修改残留）
    if (modelRef.current) {
      modelRef.current.traverse((node) => {
        if (node.userData.yuanshiMaterial) {
          // 存储过原始材质才恢复
          node.material = node.userData.yuanshiMaterial;
          delete node.userData.yuanshiMaterial; // 恢复后删除标记
        }
      });
    }

    // 遍历模型找到轮胎
    modelRef.current.traverse((node) => {
      // 为所有 Mesh 开启阴影投射和接收
      if (node.isMesh) {
        node.castShadow = true; // 模型投射阴影
        // node.receiveShadow = true; // 模型接收其他物体的阴影
      }

      if (node.name in wheelRefs) {
        wheelRefs[node.name].current = node; // 绑定轮胎节点到对应 ref
        // console.log(`找到轮胎节点: ${node.name}`);
      }

      // 捕获 左前轮和右前轮的父级
      if (node.name === "zuoqianlunParent") {
        zuoqianlunParent.current = node; // 直接使用导出的父级
        // console.log(`找到轮胎父级节点: ${zuoqianlunParent.current.name}`);
      }
      if (node.name === "youqianlunParent") {
        youqianlunParent.current = node;
        // console.log(`找到轮胎父级节点: ${youqianlunParent.current.name}`);
      }
      //捕获 车身父级 和车父级,还有车中心点
      if (node.name === "carbodyParent") {
        carbodyParent.current = node;
        // console.log(`找到车身父级节点: ${carbodyParent.current.name}`);
      }
      // if (node.name === "carParent") {
      // carParent.current = node;
      //   // console.log(`找到车父级节点: ${carParent.current.name}`);
      // }
      if (node.name === "car_center_point") {
        car_center_point.current = node;
        // console.log(`找到车中心点节点: ${car_center_point.current.name}`);
      }
      if (node.name === "cheyuandian") {
        cheyuandian.current = node;
        console.log(`找到车中心点节点: ${cheyuandian.current.name}`);
      }

      // 找到可交互的mesh (关键：只收集mesh类型的节点,select只于模型下面的mesh网格交互)
      // 精准识别可交互Mesh（左前门/右前门/尾翼）
      // 捕获门节点
      if (node.name === "zuoqianmen" || node.name.startsWith("zuoqianmen")) {
        zuoqianmen.current = node;
        // console.log(`找到左前门节点: ${node.name}`);
      }
      if (node.name === "youqianmen" || node.name.startsWith("youqianmen")) {
        youqianmen.current = node;
        // console.log(`找到右前门节点: ${node.name}`);
      }
      if (node.name === "cheweiyi" || node.name.startsWith("cheweiyi")) {
        cheweiyi.current = node;
        // console.log(`找到尾翼节点: ${node.name}`);
      }
      // 把与鼠标交互的模型部分添加到 interactiveNodes 数组中：
      if (
        node.name.includes("zuoqianmen") ||
        node.name.includes("youqianmen") ||
        node.name.includes("cheweiyi")
      ) {
        interactiveNodes.current.push(node);
      }

      // 处理单个/多个材质的情况
      // 处理glb中是单个或多个材质的情况，统一转换成数组并过滤无效值
      let materials;
      if (Array.isArray(node.material)) {
        materials = node.material.filter((m) => m != null); // 过滤数组中的null/undefined
      } else {
        materials = node.material ? [node.material] : []; // 单个材质存在才包装成数组
      }

      materials.forEach((material) => {
        // 捕获车身材质
        if (material.name === "Car_body") {
          // 存储原始材质到节点的 userData 中
          if (!node.userData.yuanshiMaterial) {
            node.userData.yuanshiMaterial = Array.isArray(node.material)
              ? [...node.material] // 多材质深拷贝
              : node.material.clone(); // 单材质克隆
          }
          // 创建自定义材质实例（可继承原始材质属性）
          // 传入基础材质，不直接在构造函数中设置颜色
          const customPaint = new CarPaintMaterial(material);

          // 替换材质
          if (Array.isArray(node.material)) {
            node.material[materialIndex] = customPaint; // 使用 materialIndex，不是 index
          } else {
            node.material = customPaint;
          }

          // 存储到数组中
          carbodyMaterialsRef.current.push(customPaint);
        }
        // 捕获玻璃材质
        if (material.name === "Car_window") {
          glassMaterialRef.current = material;
          // 玻璃材质初始化（可选）
        }
        // 捕获车尾灯材质
        if (material.name === "Car_backlight") {
          backlightMaterialRef.current = material;
          // 尾灯材质初始化（可选）
        }
        // 捕获车大灯材质
        if (material.name === "dadeng") {
          dadengMaterialRef.current = material;
          // 大灯灯材质初始化（可选）
        }
      });
    });
    // console.log(`找到 ${carbodyMaterialsRef.current.length} 个车身材质`);
  }, [currentModel]); // 模型加载完成后执行, currentModel变化时重新执行

  // 2. 监听模型加载状态的正确方式
  const [loadingStarted, setLoadingStarted] = useState(false); // 避免重复启动加载

  useEffect(() => {
    if (!loadingStarted) {
      setLoadingStarted(true);
      setIsLoading(true);
      setLoadingProgress(0);
    }

    // 模拟加载进度或使用实际加载状态
    let progressInterval;
    let currentProgress = 0;

    const updateProgress = () => {
      currentProgress += Math.random() * 15; // 随机增加进度
      if (currentProgress >= 100) {
        currentProgress = 100;
        setLoadingProgress(100);
        setTimeout(() => {
          setIsLoading(false); // 延迟一点隐藏加载界面，让用户看到100%
        }, 500);
        clearInterval(progressInterval);
      } else {
        setLoadingProgress(Math.round(currentProgress));
      }
    };

    // 检查场景是否已经加载
    if (scene) {
      // 如果场景已存在，快速完成加载
      progressInterval = setInterval(updateProgress, 50);
    } else {
      // 否则等待场景加载
      const checkScene = setInterval(() => {
        if (scene) {
          clearInterval(checkScene);
          progressInterval = setInterval(updateProgress, 100);
        }
      }, 100);
    }

    return () => {
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [modelPath, scene, setIsLoading, setLoadingProgress, loadingStarted]);

  // 3.汽车材质变化
  // 3.1监听颜色切换，更新车身材质（核心：与状态联动）
  // 优化材质更新逻辑
  useEffect(() => {
    const targetColor = COLORS[colorIndex];

    if (carbodyMaterialsRef.current.length > 0 && targetColor) {
      // 批量更新，减少不必要的循环
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
  }, [colorIndex]); // 仅在 colorIndex 变化时更新

  //3.2 汽车车尾灯材质变化
  useEffect(() => {
    if (backlightMaterialRef.current) {
      if (keyPressed.s) {
        backlightMaterialRef.current.color.set(1, 0, 0); // 基础颜色（白色）
        backlightMaterialRef.current.emissive.set(1, 0, 0); // 红色 (r, g, b) 范围 0-1
        backlightMaterialRef.current.emissiveIntensity = 50;
      } else {
        backlightMaterialRef.current.color.set(1, 1, 1); // 基础颜色（白色）
        backlightMaterialRef.current.emissive.set(1, 1, 1); // 白色
        backlightMaterialRef.current.emissiveIntensity = 0;
      }

      if (keyPressed.w) {
        dadengMaterialRef.current.emissiveIntensity = 100;
      } else {
        dadengMaterialRef.current.emissiveIntensity = 0;
      }
    }
  }, [keyPressed.s, keyPressed.w]); // 监听刹车和前进状态

  // 4.鼠标和车门交互相关
  // 4.1点击检测逻辑
  const handleCarClick = useCallback(
    (event) => {
      if (!raycastEnabled || !modelRef.current || !camera) return;

      // 获取鼠标在canvas上的标准化坐标
      const canvas = event.target;
      if (!canvas.getBoundingClientRect) return;

      const rect = canvas.getBoundingClientRect();
      const mouse = new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );

      // 设置射线
      raycaster.setFromCamera(mouse, camera);

      // 摄像检测，目前只检测左前门，右前门，和尾翼
      const intersects = raycaster.intersectObjects(
        interactiveNodes.current,
        false,
      );

      // console.log(`射线检测到 ${intersects.length} 个对象`);

      if (intersects.length > 0) {
        // 遍历所有相交对象，寻找门相关的节点
        for (let i = 0; i < Math.min(intersects.length, 5); i++) {
          const clickedObject = intersects[i].object;
          let nodeName = clickedObject.name;

          // 检查是否点击了门
          if (nodeName) {
            if (nodeName.includes("zuoqianmen")) {
              console.log("点击了左前门");
              openDoor(zuomenActionsRef.current, "left");
              return;
            } else if (nodeName.includes("youqianmen")) {
              console.log("点击了右前门");
              openDoor(youmenActionsRef.current, "right");
              return;
            } else if (nodeName.includes("cheweiyi")) {
              console.log("点击了尾翼");
              openDoor(cheweiyiActionsRef.current, "cheweiyi");
              return;
            }
          }
        }

        // console.log("未识别到可交互的门部件");
      }
    },
    [raycastEnabled, camera, raycaster],
  );

  // 4.1.2 鼠标悬停检测和提示显示逻辑
  const handleMouseMove = useCallback(
    (event) => {
      if (!raycastEnabled || !modelRef.current || !camera) return;

      // 获取鼠标在canvas上的标准化坐标
      const canvas = event.target;
      if (!canvas.getBoundingClientRect) return;

      const rect = canvas.getBoundingClientRect();
      const mouse = new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );

      // 设置射线
      raycaster.setFromCamera(mouse, camera);

      // 检测相交对象
      const intersects = raycaster.intersectObjects(
        modelRef.current.children,
        true,
      );

      if (intersects.length > 0) {
        const nodeName = intersects[0].object.name;
        const { clientX, clientY } = event;

        // 根据悬停的部件和状态，更新提示框状态
        if (nodeName.includes("zuoqianmen")) {
          if (leftdoorOpen) {
            // 左前门已打开 → 显示"关闭车门"
            setTip({
              visible: true,
              type: "doorClose",
              position: { x: clientX + 15, y: clientY + 15 },
            });
          } else {
            // 左前门关闭 → 显示"打开车门"
            setTip({
              visible: true,
              type: "doorOpen",
              position: { x: clientX + 15, y: clientY + 15 },
            });
          }
        } else if (nodeName.includes("youqianmen")) {
          // 右前门逻辑（类似左前门）
          if (rightdoorOpen) {
            setTip({
              visible: true,
              type: "doorClose",
              position: { x: clientX + 15, y: clientY + 15 },
            });
          } else {
            setTip({
              visible: true,
              type: "doorOpen",
              position: { x: clientX + 15, y: clientY + 15 },
            });
          }
        } else if (nodeName.includes("cheweiyi")) {
          // 尾翼逻辑
          if (weiyiOpen) {
            setTip({
              visible: true,
              type: "weiyiClose",
              position: { x: clientX + 15, y: clientY + 15 },
            });
          } else {
            setTip({
              visible: true,
              type: "weiyiOpen",
              position: { x: clientX + 15, y: clientY + 15 },
            });
          }
        } else {
          // 未悬停在目标部件上 → 隐藏提示框
          setTip({ visible: false });
        }
      } else {
        // 无相交对象 → 隐藏提示框
        setTip({ visible: false });
      }
    },
    [raycastEnabled, camera, raycaster, leftdoorOpen, rightdoorOpen, weiyiOpen],
  );

  // 4.2 点击事件监听，click 和 mousemove的时候，触发点击检测函数
  useEffect(() => {
    const canvas = document.querySelector("canvas");
    if (canvas) {
      canvas.addEventListener("click", handleCarClick);
      canvas.addEventListener("mousemove", handleMouseMove);
      return () => {
        canvas.removeEventListener("click", handleCarClick);
        canvas.removeEventListener("mousemove", handleMouseMove);
      };
    }
  }, [handleCarClick, handleMouseMove]);

  // 4.3开关门控制函数

  //开门函数
  function openDoor(action, doorType) {
    // 根据 doorType 判断是左门还是右门
    const isLeftDoor = doorType === "left";
    const isRightDoor = doorType === "right";
    const ischewei = doorType === "cheweiyi";

    if (isLeftDoor) {
      // 处理左前门动画
      if (action.time === 0) {
        action.timeScale = 1; //正向播放动画，速度为1
        action.reset(); // 重置动画
        action.play(); //手动播放动画
        setLeftdoorOpen(true);
      } else {
        action.timeScale = -2;
        action.paused = false;
        setLeftdoorOpen(false);
        //如果动画已经结束，重置后，从头开始倒放,getClip().duration动画的总时长（单位：秒）
        if (action.time === action.getClip().duration) {
          action.time = action.getClip().duration; // 关键：设置起点
          action.play();
        } else {
          //如果动画未结束，从当前时间倒放
          action.play();
        }
      }
    }

    if (isRightDoor) {
      // 处理右前门动画
      if (action.time === 0) {
        action.timeScale = 1;
        action.reset();
        action.play();
        setRightdoorOpen(true);
      } else {
        action.timeScale = -2;
        action.paused = false;
        setRightdoorOpen(false);
        if (action.time === action.getClip().duration) {
          action.time = action.getClip().duration;
          action.play();
        } else {
          action.play();
        }
      }
    }
    if (ischewei) {
      // 处理车尾门动画
      if (action.time === 0) {
        action.timeScale = 1;
        action.reset();
        action.play();
        setWeiyiOpen(true);
      } else {
        action.timeScale = -2;
        action.paused = false;
        setWeiyiOpen(false);
        if (action.time === action.getClip().duration) {
          action.time = action.getClip().duration;
          action.play();
        } else {
          action.play();
        }
      }
    }
  }

  //关门函数
  function closeDoor(action, doorType) {
    // 和 openDoor 类似，设置 action 播放反向动画以关闭门
    if (doorType === "left") {
      action.timeScale = -2;
      action.paused = false;
      action.play();
      setLeftdoorOpen(false); // 标记左门已关闭
    }

    if (doorType === "right") {
      action.timeScale = -2;
      action.paused = false;
      action.play();
      setRightdoorOpen(false); // 标记右门已关闭
    }

    if (doorType === "cheweiyi") {
      action.timeScale = -2;
      action.paused = false;
      action.play();
      setWeiyiOpen(false); // 标记车尾已关闭
    }
  }
  // 4.4安全检测逻辑
  function zidongguanmen() {
    const wheelSpeed2 = wheelSpeedRef.current;
    // 车速大于阈值时自动关门
    if (Math.abs(wheelSpeed2) > 0.01) {
      if (leftdoorOpen) {
        closeDoor(zuomenActionsRef.current, "left");
      }
      if (rightdoorOpen) {
        closeDoor(youmenActionsRef.current, "right");
      }
    }

    // 尾翼自动控制逻辑
    if (wheelSpeed2 > 0.35 && !weiyiOpen) {
      openDoor(cheweiyiActionsRef.current, "cheweiyi");
    }
    if (wheelSpeed2 < 0.35 && weiyiOpen && !keyPressed.w) {
      closeDoor(cheweiyiActionsRef.current, "cheweiyi");
    }
  }

  // --- 处理车轮转速 ---

  //这是车悬挂加速减速抬头压头的函数
  // 悬挂更新函数
  function update_xuangua() {
    // 安全检查：如果车身父节点不存在，直接返回
    if (!carbodyParent.current) return;

    // 从状态中获取当前角度（不能直接修改状态变量，用临时变量处理）
    let currentRotationz = carbodyRotationz.current;

    //是否达到最大速度
    const atMaxSpeed =
      Math.abs(wheelSpeedRef.current) >= MAX_WHEEL_SPEED - 0.01;

    // 1. 处理加速（W键）抬头逻辑
    if (keyPressed.w && !atMaxSpeed) {
      // 逐步增加角度，不超过最大值（允许微小误差，解决浮点数精度问题）
      currentRotationz = Math.min(
        currentRotationz + xuanguajiasu,
        MAX_xuanguajiao,
      );
    }
    // 2. 处理刹车（S键）压头逻辑
    else if (keyPressed.s && !atMaxSpeed) {
      // 逐步减小角度，不低于最小值
      currentRotationz = Math.max(
        currentRotationz - xuanguajiasu,
        MIN_xuanguajiao,
      );
    }
    // 3. 既不加速也不刹车：缓慢回正
    else {
      // 根据当前角度方向，用不同系数回正（模拟物理阻尼）
      if (currentRotationz > 0) {
        currentRotationz *= 0.98; // 抬头后回正（慢）
        // 角度接近0时强制归0，避免微小抖动
        if (currentRotationz < 0.001) currentRotationz = 0;
      } else if (currentRotationz < 0) {
        currentRotationz *= 0.98; // 刹车后回正（快）
        if (currentRotationz > -0.001) currentRotationz = 0;
      }
    }

    // 关键：通过 ref 更新
    carbodyRotationz.current = currentRotationz;
    // 应用到模型
    carbodyParent.current.rotation.z = currentRotationz;
  }

  //这是车悬挂左右转弯时车摆动的函数
  function update_xuangua_zuoyou() {
    // 安全检查：如果车身父节点不存在，直接返回
    if (!carbodyParent.current) return;

    //如果速度很小，就不处理
    if (Math.abs(wheelSpeedRef.current) < 0.015) return;
    // 车速过低时，缓慢回正

    // 从状态中获取当前角度（不能直接修改状态变量，用临时变量处理）
    let currentRotationx = carbodyRotationx.current;
    // 1. 处理左转（A）逻辑
    if (keyPressed.a) {
      // 逐步增加角度，不超过最大值（允许微小误差，解决浮点数精度问题）
      currentRotationx = Math.min(
        currentRotationx + xuanguajiasuzuoyou,
        MAX_xuanguajiaozuoyou,
      );
    }
    // 2. 处理右转（D）逻辑
    else if (keyPressed.d) {
      // 逐步减小角度，不低于最小值
      currentRotationx = Math.max(
        currentRotationx - xuanguajiasuzuoyou,
        -MAX_xuanguajiaozuoyou,
      );
    } // 3. 松开后 缓慢回正
    else {
      // 根据当前角度方向，用不同系数回正（模拟物理阻尼）
      if (Math.abs(currentRotationx) > 0) {
        currentRotationx *= 0.98; // 抬头后回正（慢）
        // 角度接近0时强制归0，避免微小抖动
        if (Math.abs(currentRotationx) < 0.001) currentRotationx = 0;
      }
    }

    // 关键：通过 ref 更新
    carbodyRotationx.current = currentRotationx;
    // 应用到模型
    carbodyParent.current.rotation.x = currentRotationx;
  }

  // 计算基于汽车车身Y轴旋转后，新的前进方向，得到一个矢量值
  const getForwardqianhoufangxiang = (rotationY) => {
    // 根据Y轴旋转角度计算前进方向向量
    return tempVec3.current
      .set(
        Math.cos(rotationY), // X分量
        0, // Y分量（保持在同一平面）
        -Math.sin(rotationY), // Z分量
      )
      .normalize();
  };

  useFrame((state, delta) => {
    // --------------- 所有操作前先判空 ---------------
    if (
      !modelRef.current ||
      !carParent.current ||
      !zuoqianlunParent.current ||
      !youqianlunParent.current ||
      !carbodyParent.current
    ) {
      return; // 未找到节点时直接退出，避免报错
    }

    //车的开关门动画和车尾翼动画
    if (mixerRef.current) {
      mixerRef.current.update(delta / 2);
    }

    // 根据 W/S 键更新车轮转速
    if (keyPressed.w) {
      // 计算新转速
      const newSpeed = Math.min(
        wheelSpeedRef.current + jiasudu,
        MAX_WHEEL_SPEED,
      );
      wheelSpeedRef.current = newSpeed;
      setWheelSpeed(newSpeed); // 关键：同步到 App 的 wheelSpeed 状态
      // console.log("wheelSpeed:", wheelSpeedRef.current);
    }
    if (keyPressed.s) {
      const newSpeed = Math.max(
        wheelSpeedRef.current - jiasudu,
        -MAX_WHEEL_SPEED,
      );
      wheelSpeedRef.current = newSpeed;
      setWheelSpeed(newSpeed); // 同步到 App
    }
    if (keyPressed.s && keyPressed.w) {
      // 同时按下时急刹车
      const newSpeed = wheelSpeedRef.current * 0.9;
      wheelSpeedRef.current = newSpeed;
      // 转速接近 0 时强制归 0，避免微小值干扰
      const finalSpeed = Math.abs(newSpeed) < 0.01 ? 0 : newSpeed;
      wheelSpeedRef.current = finalSpeed;
      setWheelSpeed(finalSpeed); // 同步到 App
    }
    if (!keyPressed.s && !keyPressed.w) {
      // 没按键时减速
      const newSpeed = wheelSpeedRef.current * friction;
      wheelSpeedRef.current = newSpeed;
      // 转速接近 0 时强制归 0，避免微小值干扰
      const finalSpeed = Math.abs(newSpeed) < 0.01 ? 0 : newSpeed;
      wheelSpeedRef.current = finalSpeed;
      setWheelSpeed(finalSpeed); // 同步到 App
    }

    // --- 旋转轮胎 ---
    Object.values(wheelRefs).forEach((wheel) => {
      if (wheel.current) {
        wheel.current.rotation.z -= wheelSpeedRef.current; // 轮胎绕 z 轴旋转（根据模型朝向调整轴）
      }
    });

    // --- 处理转向 ---

    // 如果按下了 A 键（左转）
    if (keyPressed.a) {
      zuoqianlunParent.current.rotation.y += TURN_ANGLE;
      zuoqianlunParent.current.rotation.y = Math.min(
        zuoqianlunParent.current.rotation.y,
        MAX_TURN_ANGLE,
      );
      youqianlunParent.current.rotation.y += TURN_ANGLE;
      youqianlunParent.current.rotation.y = Math.min(
        youqianlunParent.current.rotation.y,
        MAX_TURN_ANGLE,
      );
    }
    // 如果按下了 D 键（右转）
    if (keyPressed.d) {
      zuoqianlunParent.current.rotation.y -= TURN_ANGLE;
      zuoqianlunParent.current.rotation.y = Math.max(
        zuoqianlunParent.current.rotation.y,
        -MAX_TURN_ANGLE,
      );
      youqianlunParent.current.rotation.y -= TURN_ANGLE;
      youqianlunParent.current.rotation.y = Math.max(
        youqianlunParent.current.rotation.y,
        -MAX_TURN_ANGLE,
      );
    }

    // 松开转向键后轮胎自动回正
    if ((!keyPressed.a && !keyPressed.d) || (keyPressed.a && keyPressed.d)) {
      zuoqianlunParent.current.rotation.y *= 0.9;
      youqianlunParent.current.rotation.y *= 0.9;

      // 车身回正
      const newRotation = carbodyRotationx.current * 0.95;
      carbodyRotationx.current =
        Math.abs(newRotation) < 0.002 ? 0 : newRotation;
      carbodyParent.current.rotation.x = carbodyRotationx.current;
    }

    // 接近零时强制归零
    if (Math.abs(zuoqianlunParent.current.rotation.y) < 0.001) {
      zuoqianlunParent.current.rotation.y = 0;
      youqianlunParent.current.rotation.y = 0;
    }

    // --- 云朵过渡逻辑 ---
    const isStopped = Math.abs(wheelSpeedRef.current) < 0.01;
    const fadeSpeed = 0.8; // 渐变速度，数值越大越快

    if (isStopped) {
      // 停车：透明度向 1 靠拢 (淡入)
      cloudOpacityRef.current = THREE.MathUtils.lerp(
        cloudOpacityRef.current,
        0.1,
        delta * fadeSpeed,
      );
    } else {
      // 运动：透明度向 0 靠拢 (淡出)
      cloudOpacityRef.current = THREE.MathUtils.lerp(
        cloudOpacityRef.current,
        0,
        delta * fadeSpeed * 3,
      ); // 消失可以快一点
    }

    // 将计算好的值应用到云朵
    if (cloudGroupRef.current) {
      // 性能优化：完全透明时关闭显示
      cloudGroupRef.current.visible = cloudOpacityRef.current > 0.01;

      // 找到云朵的 Mesh 并更新自定义 Uniform
      cloudGroupRef.current.traverse((node) => {
        if (node.isMesh && node.material && node.material.uniforms) {
          // 直接设置 uniform 的值最为稳妥
          if (node.material.uniforms.uOpacity) {
            node.material.uniforms.uOpacity.value = cloudOpacityRef.current;
          }
        }
      });
    }

    // --------------- 6. 新核心：基于物理的转向+移动 ---------------
    if (Math.abs(wheelSpeedRef.current) < 0.01) return; // 以下都是车运动后才会执行的操作，车速过慢，不处理转向

    // 6.1 计算转弯半径（核心公式）
    let turnRadius;
    const zhuanxiangjiao = zuoqianlunParent.current.rotation.y; // 前轮转向角（假设左转为正）
    const zuoyoufangxiang = Math.sign(zhuanxiangjiao); // 转向方向：1=按下a左转，-1= 按下d右转
    // console.log("zuoyoufangxiang:", zuoyoufangxiang);
    // console.log("qianhoufangxiang:", qianhoufangxiang);
    const chetoufangxiang = getForwardqianhoufangxiang(
      carParent.current.rotation.y,
    ).clone(); // 车身当前前进方向

    // 6.2调用 App 传来的函数，将最新车头方向传递给 App
    if (setChetoufangxiang) {
      setChetoufangxiang(chetoufangxiang);
    }

    if (Math.abs(zhuanxiangjiao) < 0.01) {
      // 轮胎滚动的距离
      const moveDistance = wheelSpeedRef.current * WHEEL_RADIUS;
      // 应用位移
      carParent.current.position.add(
        chetoufangxiang.multiplyScalar(moveDistance),
      );
    } else {
      const wspeed = zuoyoufangxiang * wheelSpeedRef.current; // 轮胎转速（正负表示前进或倒车）
      const moveDistance = wspeed * WHEEL_RADIUS;
      // 真实物理公式：转弯半径 = 轴距 / tan(前轮转向角)
      turnRadius = zhouju / Math.tan(Math.abs(zhuanxiangjiao));

      // 6.3 计算车身旋转角度（弧长公式：弧长 = 半径 × 弧度 → 弧度 = 弧长 / 半径）
      const turnAngle = moveDistance / turnRadius; // moveDistance有正负值

      // 6.4 计算转弯中心位置（车身绕这个点旋转）
      const side = chetoufangxiang
        .clone()
        .cross(new Vector3(0, zuoyoufangxiang, 0)) //叉乘，右手法则
        .normalize(); // 垂直前进方向（向左为正）
      // 转弯中心 = 车身位置 + 垂直方向 × 转弯半径 × 运动方向（倒车时中心在另一侧）
      const turnCenter = carParent.current.position
        .clone()
        .add(side.multiplyScalar(turnRadius));

      // 6.5 绕转弯中心旋转车身（同步更新位置和旋转）
      // 步骤：1. 车身位置相对转弯中心偏移 → 2. 偏移向量绕Y轴旋转 → 3. 加回转弯中心得到新位置
      const relativePos = carParent.current.position.clone().sub(turnCenter); // 相对转弯中心的向量
      //  x.applyAxisAngle(n,m)将当前向量x绕一个 ​自定义轴n,旋转指定的 ​弧度角度m，将得到的向量offset绕y轴旋转指定角度

      relativePos.applyAxisAngle(new Vector3(0, 1, 0), -1 * turnAngle); // 绕Y轴旋转turnAngle
      carParent.current.position.copy(turnCenter.add(relativePos)); // 更新新位置

      carParent.current.rotation.y += turnAngle; // 更新车身偏航角
    }

    // --------------------------
    // 车自动关门函数
    // --------------------------
    zidongguanmen();

    // --------------------------
    // 车身悬挂逻辑
    // --------------------------
    update_xuangua(); // 调用悬挂函数（上面定义的）
    update_xuangua_zuoyou(); // 调用悬挂左右摆动函数
  });

  return (
    <>
      {/* 车辆逻辑组 */}
      <group ref={carParent}>
        <CarShadow width={3.1} height={3.6} opacity={0.8} />
        <ParticleWaveGround />

        {/* 注入流光线条组件 */}
        <FlowLines
          modelPath={currentFlow.path}
          // wheelSpeed={wheelSpeedRef.current}
          // wheelSpeed={wheelSpeedRef}
          speedRef={wheelSpeedRef} // 传递整个 Ref 对象
          color={currentPaintColor}
        />

        {/* 云朵逻辑组 - */}
        <group ref={cloudGroupRef}>
          <Clouds material={CloudMaterial}>
            <Cloud
              seed={42}
              position={[0, 0, -7]}
              speed={0.1}
              segments={20}
              volume={6}
              bounds={[20, 0.5, 1]}
            />
          </Clouds>
        </group>
        <primitive object={scene} ref={modelRef} />
      </group>
    </>
  );
};

export default Car;
