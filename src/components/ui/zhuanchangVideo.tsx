import { useEffect, useRef, useState } from "react";
import "../../style.css";

// 定义接收的参数类型
interface ZhuanchangVideoProps {
  currentModel: string; // 当前模型（用于判断播放哪个视频）
}

export const ZhuanchangVideo = ({ currentModel }: ZhuanchangVideoProps) => {
  // 状态：控制转场视频是否显示
  const [isShow, setIsShow] = useState(false);
  // 记录上一次的模型，用于判断是否切换了模型
  const prevModelRef = useRef(currentModel);
  // 视频元素的引用
  const videoRefs = useRef<{
    "video-su7"?: HTMLVideoElement;
    "video-ultra"?: HTMLVideoElement;
  }>({});

  // 1. 监听模型变化：当currentModel改变时，触发转场视频
  useEffect(() => {
    // 如果模型没变，不做处理
    if (currentModel === prevModelRef.current) return;

    // 模型变了，显示转场视频并播放
    setIsShow(true);
    const videoId =
      currentModel === "xiaomi su7-action3" ? "video-su7" : "video-ultra";
    const videoElement = videoRefs.current[videoId];

    if (videoElement) {
      videoElement.currentTime = 0; // 重置视频到开头
      videoElement.play(); // 播放视频
    }

    // 更新上一次的模型记录
    prevModelRef.current = currentModel;
  }, [currentModel]);

  // 2. 视频播放结束后，隐藏转场视频
  const handleVideoEnd = () => {
    setIsShow(false);
  };

  return (
    // 转场视频容器：isShow为true时显示，z-index确保在最上层
    <div
      id="guochang-video"
      className="guochang-video"
      style={{ display: isShow ? "flex" : "none" }}
    >
      {/* 视频1：SU7转场 */}
      <video
        ref={(el) => {
          // 用大括号包裹，明确不返回值
          if (el) {
            videoRefs.current["video-su7"] = el;
          }
        }}
        id="video-su7"
        className="fullscreen-video"
        preload="auto"
        onEnded={handleVideoEnd} // 视频结束时触发
        style={{
          display: currentModel === "xiaomi su7-action3" ? "block" : "none",
        }}
      >
        <source src="./image/流光彩虹.mp4" type="video/mp4" />
      </video>

      {/* 视频2：ultra转场 */}
      <video
        ref={(el) => {
          if (el) {
            videoRefs.current["video-ultra"] = el;
          }
        }}
        id="video-ultra"
        className="fullscreen-video"
        preload="auto"
        onEnded={handleVideoEnd} // 视频结束时触发
        style={{
          display: currentModel !== "xiaomi su7-action3" ? "block" : "none",
        }}
      >
        <source src="./image/su7 转场动画 4k.mp4" type="video/mp4" />
      </video>
    </div>
  );
};
