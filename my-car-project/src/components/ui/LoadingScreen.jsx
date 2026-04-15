import { useRef, useState, useEffect } from "react";

export default function LoadingScreen({ progress, style }) {
  // 1. 状态管理
  const [frameData, setFrameData] = useState([]); // 雪碧图帧数据
  const [currentFrame, setCurrentFrame] = useState(0); // 当前帧索引
  const loadingPngRef = useRef(null); // 动画元素ref
  const animationRef = useRef(null); // 动画帧ID
  const startTimeRef = useRef(null); // 动画开始时间

  // 2. 加载雪碧图帧数据（对应原生的Promise.all加载sprite2.json）
  useEffect(() => {
    const loadFrameData = async () => {
      try {
        const response = await fetch("./textures/sprite2.json");
        const data = await response.json();
        // 转换为和原生一致的帧数组（Object.values提取frames对象的值）
        setFrameData(Object.values(data.frames));
        startTimeRef.current = Date.now(); // 记录开始时间
      } catch (error) {
        console.error("加载雪碧图帧数据失败：", error);
      }
    };

    loadFrameData();

    // 组件卸载时清理动画
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // 3. 动画循环（对应原生的updateLoadingAnimation）
  useEffect(() => {
    // 帧数据未加载完成则不执行
    if (frameData.length === 0) return;

    const updateFrame = () => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current; // 已流逝时间
      const frameDuration = 30; // 每帧持续时间（毫秒），和原生保持一致
      const totalFrames = frameData.length;

      // 计算当前帧（循环播放）
      const targetFrame = Math.floor(elapsed / frameDuration) % totalFrames;
      setCurrentFrame(targetFrame);

      // 继续下一帧动画
      animationRef.current = requestAnimationFrame(updateFrame);
    };

    // 启动动画
    animationRef.current = requestAnimationFrame(updateFrame);

    // 清理函数
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [frameData]); // 帧数据加载完成后启动动画

  // 4. 根据当前帧更新样式（对应原生的更新backgroundPosition等）
  useEffect(() => {
    if (!loadingPngRef.current || frameData.length === 0) return;

    const frame = frameData[currentFrame].frame;
    const sourceSize = frameData[currentFrame].spriteSourceSize;
    const element = loadingPngRef.current;

    // 更新雪碧图位置和尺寸（和原生逻辑完全一致）
    element.style.backgroundPosition = `-${frame.x}px -${frame.y}px`;
    element.style.width = `${frame.w}px`;
    element.style.height = `${frame.h}px`;
    element.style.left = `${sourceSize.x}px`;
    element.style.top = `${sourceSize.y}px`;
  }, [currentFrame, frameData]); // 当前帧变化时更新样式

  return (
    <div id="loading_bg" style={style}>
      <div id="loading_f">
        {/* 雪碧图元素：通过ref关联DOM，初始样式保持和原生一致 */}
        <div
          id="loading_png"
          ref={loadingPngRef}
          style={{
            width: 340,
            height: 125,
            backgroundImage: "url(./image/sprite2.png)",
            backgroundRepeat: "no-repeat",
            position: "relative", // 确保left/top生效
          }}
        ></div>
      </div>
      {/* 进度条保持不变 */}
      <div id="loading_progress">
        <div
          className="progress_bar"
          style={{ width: `${Math.min(progress || 0, 98)}%` }}
        ></div>
      </div>
    </div>
  );
}
