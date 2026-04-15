import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

export function PerformanceMonitor() {
  const statsRef = useRef<HTMLDivElement>(null);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const fpsRef = useRef(60);

  useFrame((_, delta) => {
    if (!statsRef.current) return;

    frameCountRef.current++;
    const currentTime = performance.now();

    // 每秒更新一次FPS
    if (currentTime - lastTimeRef.current >= 1000) {
      fpsRef.current = Math.round(
        (frameCountRef.current * 1000) / (currentTime - lastTimeRef.current),
      );
      frameCountRef.current = 0;
      lastTimeRef.current = currentTime;
    }

    // 更新显示
    const frameTime = delta * 1000; // 转换为毫秒
    statsRef.current.innerHTML = `
      <div style="
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 12px;
        z-index: 10000;
        min-width: 120px;
      ">
        <div>FPS: ${fpsRef.current}</div>
        <div>Frame: ${frameTime.toFixed(2)}ms</div>
        <div>Memory: ${Math.round(
          (performance as any).memory?.usedJSHeapSize / 1024 / 1024 || 0,
        )}MB</div>
      </div>
    `;
  });

  return <div ref={statsRef} />;
}
