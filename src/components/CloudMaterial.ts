import * as THREE from "three";

export class CloudMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      // --- 关键点 1: 必须开启透明度 ---
      transparent: true,
      depthWrite: false, // 云朵通常不需要写入深度，防止方块感

      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldPosition;

        void main() {
          vUv = uv;
          vWorldPosition = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldPosition;

        uniform sampler2D uMap;
        // --- 关键点 2: 定义接收透明度的变量 ---
        uniform float uOpacity;

        void main() {
            vec4 mapColor = texture2D(uMap, vUv);
            gl_FragColor = mapColor;

            float mask = vWorldPosition.y;
            mask = clamp(mask / 3.0, 0.0, 1.0); // Ensure mask is between 0 and 1
            mask = smoothstep(0.1, 1.0, mask); // Smooth transition

            float cameraFacingZ = dot(normalize(cameraPosition), vec3(0.0, 0.0, 1.0));
            cameraFacingZ = clamp(cameraFacingZ, 0.0, 1.0); // Ensure value is between 0 and 1

            

          
            // --- 关键点 3: 应用外部透明度 ---
            // 注意：你原来的 0.05 太低了，可能导致看不见，我建议调高或者由外部控制
            gl_FragColor.a *= mask * uOpacity * cameraFacingZ;
        }
      `,
      uniforms: {
        uMap: { value: null },
        // --- 关键点 4: 初始化透明度数值 ---
        uOpacity: { value: 0.0 },
      },
    });
  }

  set map(texture: THREE.Texture) {
    this.uniforms.uMap.value = texture;
    this.needsUpdate = true;
  }

  // 添加设置透明度的快捷方法
  set cloudOpacity(value: number) {
    if (this.uniforms && this.uniforms.uOpacity) {
      this.uniforms.uOpacity.value = value;
    }
  }
}
