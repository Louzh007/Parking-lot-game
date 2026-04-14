import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface CarShadowProps {
  width?: number; // 阴影宽度
  height?: number; // 阴影长度
  opacity?: number;
}

export function CarShadow({
  width = 8,
  height = 8,
  opacity = 0.8,
}: CarShadowProps) {
  // 1. 加载你的 PNG 贴图
  const shadowTexture = useTexture("./image/car-shadow.png");

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.01, 0]} // 稍微高出地面，防止 Z-fighting 闪烁
    >
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={shadowTexture}
        transparent={true}
        opacity={opacity}
        depthWrite={false} // 必须为 false，否则透明边缘可能会遮挡地面贴图
        blending={THREE.MultiplyBlending} // 可选：正片叠底模式，让阴影与地面颜色融合更好
        premultipliedAlpha={true}
      />
    </mesh>
  );
}
