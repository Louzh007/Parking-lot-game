import React, { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

function ParticleWaveGround({
  size = 5, // 地面大小,一半的尺寸
  particleSpacing = 0.3, // 粒子间距
  waveSpeed = 0.25, // 波纹扩散速度
  waveKuandu = 0.5, // 波纹宽度半径
}) {
  const particlesRef = useRef(null);
  const waveRef = useRef({
    radius: 0,
    center: new THREE.Vector2(0, 0),
    time: 0, // 添加时间追踪
  });

  // 创建简单的白色圆形纹理
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // 创建简单的白色圆形
    ctx.fillStyle = "rgba(255, 255, 255, 1)"; // 纯白色
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2); // 稍微小一点，留点边距
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  // 生成均匀排列的粒子
  const { positions, colors, particleCount } = useMemo(() => {
    const countX = Math.floor((size * 2) / particleSpacing) + 1;
    const countZ = Math.floor((size * 2) / particleSpacing) + 1;
    const totalCount = countX * countZ;

    const positions = new Float32Array(totalCount * 3);
    const colors = new Float32Array(totalCount * 3); // RGB

    let index = 0;

    for (let z = 0; z < countZ; z++) {
      for (let x = 0; x < countX; x++) {
        const xPos = -size + x * particleSpacing;
        const zPos = -size + z * particleSpacing;

        positions[index * 3] = xPos;
        positions[index * 3 + 1] = 0;
        positions[index * 3 + 2] = zPos;

        // 初始颜色设为透明（通过alpha通道控制）
        colors[index * 3] = 0.3; // R
        colors[index * 3 + 1] = 0.8; // G
        colors[index * 3 + 2] = 1.0; // B

        index++;
      }
    }

    return { positions, colors, particleCount: totalCount };
  }, [size, particleSpacing]);

  // 处理波纹动画
  useFrame((state, delta) => {
    // 安全检查：确保粒子已经初始化
    if (!particlesRef.current) return;

    const particles = particlesRef.current;
    const geometry = particles.geometry;

    // 检查几何体是否存在
    if (!geometry) return;

    // 在 R3F 中，需要直接访问 BufferGeometry 的属性
    const colorAttribute = geometry.getAttribute("color");
    const positionAttribute = geometry.getAttribute("position");

    // 检查属性是否存在
    if (!colorAttribute || !positionAttribute) return;

    // 更新时间
    waveRef.current.time += delta;

    // 计算波纹半径（使用正弦波让波纹连续循环）
    const maxRadius = size * Math.sqrt(2); // 正方形对角线长度,边长的一半为 size
    waveRef.current.radius =
      (waveRef.current.time * waveSpeed * 10) %
      (maxRadius * 2 + waveKuandu * 2);
    //（%）是取模运算，让其在 0-（值）内循环，通过增加括号内的值，可以延长每个循环的间隔

    // 更新波纹的中心和半径
    const center = waveRef.current.center;
    const radius = waveRef.current.radius;

    for (let i = 0; i < particleCount; i++) {
      // 获取粒子位置（使用正确的访问方式）
      const x = positionAttribute.getX(i);
      const z = positionAttribute.getZ(i);

      // 计算与波纹中心的距离
      const distance = Math.sqrt(
        Math.pow(x - center.x, 2) + Math.pow(z - center.y, 2)
      );

      // 检查粒子是否在波纹环内
      const distanceFromWave = Math.abs(distance - radius);
      const inWave = distanceFromWave < waveKuandu;

      // 创建平滑的强度过渡（在波纹中心的 alpha 为 1，在波纹边缘的 alpha 为 0）
      let alpha = 0;
      //越接近外围，越透明
      let juli = 0;
      if (inWave) {
        //  使用距离计算平滑强度（距离波纹中心越近越亮）
        alpha = 1 - distanceFromWave / waveKuandu;
        alpha = Math.max(0, Math.min(1, alpha)); // 限制在0-1范围
      }
      juli = Math.max(0, 1 - distance / size);

      // 通过颜色的alpha通道控制透明度（使用RGBA）
      // 如果不在波纹中，设置为完全透明

      const baseR = 0.3 * alpha * juli; // 颜色乘以透明度
      const baseG = 0.8 * alpha * juli;
      const baseB = 1.0 * alpha * juli;

      colorAttribute.setXYZ(i, baseR, baseG, baseB);
    }

    colorAttribute.needsUpdate = true;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particleCount}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        size={3}
        alphaTest={0.1}
        transparent={true}
        vertexColors={true}
        depthWrite={false}
        sizeAttenuation={false}
        blending={THREE.AdditiveBlending} // 添加发光效果
      />
    </points>
  );
}

export default ParticleWaveGround;
