import { useState, useEffect, useRef } from "react";

const SpeedMeter = ({ wheelSpeed, maxWheelSpeed, maxDisplaySpeed, style }) => {
  // 状态管理
  const [frameData1, setFrameData1] = useState([]);
  const [frameData2, setFrameData2] = useState([]);
  const [isMaxSpeedReached, setIsMaxSpeedReached] = useState(false);
  const [speedAnimation2Frame, setSpeedAnimation2Frame] = useState(0);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // DOM引用
  const element1Ref = useRef(null);
  const element2Ref = useRef(null);
  const animationIntervalRef = useRef(null);

  // 1. 加载雪碧图JSON配置数据
  useEffect(() => {
    const loadFrameData = async () => {
      try {
        const [data1Response, data2Response] = await Promise.all([
          fetch("textures/speedanimation1.json"),
          fetch("textures/speedanimation2.json"),
        ]);

        const data1 = await data1Response.json();
        const data2 = await data2Response.json();

        // 将frames对象转换为数组
        setFrameData1(Object.values(data1.frames));
        setFrameData2(Object.values(data2.frames));
        setIsDataLoaded(true);

        console.log("码表雪碧图数据加载完成");
      } catch (error) {
        console.error("加载雪碧图数据失败:", error);
      }
    };

    loadFrameData();
  }, []);

  // 2. 通用更新帧函数
  const updateFrame = (element, frameData) => {
    if (!element || !frameData) return;

    const frame = frameData.frame;
    const spriteSourceSize = frameData.spriteSourceSize;

    // 更新背景位置和尺寸
    element.style.backgroundPosition = `-${frame.x}px -${frame.y}px`;
    element.style.width = `${frame.w}px`;
    element.style.height = `${frame.h}px`;
    element.style.left = `${spriteSourceSize.x}px`;
    element.style.top = `${spriteSourceSize.y}px`;
  };

  // 3. 根据速度更新动画的核心函数
  const updateSpeedAnimation = () => {
    if (!isDataLoaded || frameData1.length === 0 || frameData2.length === 0)
      return;

    // 将轮胎速度转换为km/h
    const speedKmh = Math.min(
      (Math.abs(wheelSpeed) / maxWheelSpeed) * maxDisplaySpeed,
      maxDisplaySpeed
    );

    // 更新第一个雪碧图（0-120km/h）
    if (!isMaxSpeedReached) {
      const frameIndex = Math.min(
        Math.floor((speedKmh / maxDisplaySpeed) * frameData1.length),
        frameData1.length - 1
      );
      updateFrame(element1Ref.current, frameData1[frameIndex]);
    }

    // 极速状态切换
    if (speedKmh >= maxDisplaySpeed && !isMaxSpeedReached) {
      setIsMaxSpeedReached(true);
      if (element1Ref.current) element1Ref.current.style.display = "none";
      if (element2Ref.current) element2Ref.current.style.display = "block";
    } else if (speedKmh < maxDisplaySpeed && isMaxSpeedReached) {
      setIsMaxSpeedReached(false);
      if (element1Ref.current) element1Ref.current.style.display = "block";
      if (element2Ref.current) element2Ref.current.style.display = "none";
    }

    // 更新第二个雪碧图（循环播放）
    if (isMaxSpeedReached) {
      setSpeedAnimation2Frame((prev) => (prev + 1) % frameData2.length);
      updateFrame(element2Ref.current, frameData2[speedAnimation2Frame]);
    }
  };

  // 4. 启动定时器动画
  useEffect(() => {
    if (isDataLoaded) {
      // 清除之前的定时器
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }

      // 启动新的定时器（每25ms更新一次，对应40fps）
      animationIntervalRef.current = setInterval(updateSpeedAnimation, 16.7);
    }

    // 清理函数
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, [
    isDataLoaded,
    wheelSpeed,
    isMaxSpeedReached,
    speedAnimation2Frame,
    frameData1,
    frameData2,
  ]);

  // 5. 监听wheelSpeed变化，实时更新动画
  useEffect(() => {
    if (isDataLoaded) {
      updateSpeedAnimation();
    }
  }, [wheelSpeed]);

  return (
    <div
      id="speedanimation"
      style={{
        position: "fixed",
        right: "8%",
        bottom: "-10px",
        width: "200px",
        height: "200px",
        zIndex: 1003,
        ...style,
      }}
    >
      {/* 第一个雪碧图：正常速度0-120km/h */}
      <div
        ref={element1Ref}
        id="speedanimation1"
        style={{
          position: "absolute",
          background: "url(./image/speedanimation1.png) no-repeat",
          backgroundSize: "auto", // 保持雪碧图原始尺寸
          display: "block",
        }}
      />

      {/* 第二个雪碧图：极速状态循环动画 */}
      <div
        ref={element2Ref}
        id="speedanimation2"
        style={{
          position: "absolute",
          background: "url(./image/speedanimation2.png) no-repeat",
          backgroundSize: "auto",
          display: "none",
        }}
      />
    </div>
  );
};

export default SpeedMeter;
