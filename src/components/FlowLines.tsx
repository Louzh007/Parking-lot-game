import React, { useMemo, useEffect, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface FlowLinesProps {
  modelPath: string;
  speedRef: React.MutableRefObject<number>;
  color: THREE.Color | [number, number, number];
}

const FlowLines: React.FC<FlowLinesProps> = ({
  modelPath,
  speedRef,
  color,
}) => {
  const { scene } = useGLTF(modelPath);
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  const groupRef = useRef<THREE.Group>(null);

  // 用于存储每个线条独立的材质，方便在 useFrame 中统一更新
  const materialsRef = useRef<THREE.ShaderMaterial[]>([]);

  const colorRef = useRef(color);
  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  // 1. 初始化材质模板与独立实例
  useMemo(() => {
    // 每次模型改变时清空引用
    materialsRef.current = [];

    // 定义基础 Shader 模板
    const baseMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: 0 },
        uOffset: { value: 0 }, // 每个线条独有的偏移量
        uColor: {
          value: new THREE.Color(
            ...(Array.isArray(color) ? color : [color.r, color.g, color.b]),
          ),
        },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uSpeed;
        uniform float uOffset;
        uniform vec3 uColor;
        varying vec2 vUv;

        void main() {
            // 核心修改：在时间基础上加上随机偏移量，并可以微调每个线条的速度随机性
            // 这样不同线条的 fract 循环进度就不一样了
            // 前进与后退使用相反方向的流动
            float dir = uSpeed >= 0.0 ? 1.0 : -1.0;
            float progress = fract(uOffset - (uTime * 0.9 * dir)); 
            
            float glowWidth = 0.2; 
            float dist = abs(vUv.x - progress);
            
            float alpha = smoothstep(glowWidth, 0.0, dist);
            
            // 两头淡入淡出，增加流动的呼吸感
            alpha *= sin(vUv.x * 3.14159);

            float speedFactor = clamp(abs(uSpeed) * 3.0, 0.0, 1.0);
            
            // 增强流动感：增加一个亮度扰动
            float sparkle = 1.0 + sin(uTime * 0.2 + uOffset * 10.0) * 0.5;
            //光线的透明度设置
            vec3 finalColor = uColor * alpha * 0.4 * sparkle; 

            gl_FragColor = vec4(finalColor, alpha * speedFactor);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // 遍历模型，为每个 Mesh 创建独立材质副本
    clonedScene.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;

        // 克隆基础材质，使其成为独立实例
        const individualMat = baseMaterial.clone();

        // 赋予随机偏移量 (0.0 到 10.0 之间的随机数)
        individualMat.uniforms.uOffset.value = Math.random() * 10.0;

        // 如果想让有的线快有的线慢，甚至可以再加一个随机速度倍率
        // individualMat.uniforms.uTimeScale = { value: 0.5 + Math.random() };

        mesh.material = individualMat;
        materialsRef.current.push(individualMat);
      }
    });
  }, [clonedScene]);

  // 2. 每一帧更新所有材质的 Uniform
  useFrame((state) => {
    if (!groupRef.current) return;

    const currentSpeed = speedRef.current;
    const isMoving = Math.abs(currentSpeed) > 0.05;

    groupRef.current.visible = isMoving;

    if (isMoving) {
      const elapsedTime = state.clock.getElapsedTime();
      const [r, g, b] = colorRef.current as [number, number, number];

      // 批量更新材质，避免在 useFrame 里使用 traverse（性能更好）
      materialsRef.current.forEach((mat) => {
        mat.uniforms.uTime.value = elapsedTime;
        mat.uniforms.uSpeed.value = currentSpeed;
        mat.uniforms.uColor.value.setRGB(r, g, b); // 🔑 每帧同步颜色
      });
    }
  });

  return (
    <primitive
      ref={groupRef}
      object={clonedScene}
      scale={0.5}
      position={[0.1, -0.68, 0]} // 根据你的 SU7 模型位置微调
    />
  );
};

export default FlowLines;
