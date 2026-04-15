// The author of the original code is @mrdoob https://twitter.com/mrdoob
// https://threejs.org/examples/?q=con#webgl_shadow_contact

import { useFrame, useThree } from "@react-three/fiber";
import * as React from "react";
import * as THREE from "three";
import { HorizontalBlurShader, VerticalBlurShader } from "three-stdlib";

function isMesh(obj: THREE.Object3D): obj is THREE.Mesh {
  return (obj as THREE.Mesh).isMesh;
}

export type ContactShadowsProps = {
  opacity?: number;
  width?: number;
  height?: number;
  blur?: number;
  near?: number;
  far?: number;
  smooth?: boolean;
  resolution?: number;
  frames?: number;
  scale?: number | [x: number, y: number];
  color?: THREE.ColorRepresentation;
  depthWrite?: boolean;
};

export const ContactShadows = React.forwardRef(
  (
    {
      scale = 10,
      frames = Infinity,
      opacity = 1,
      width = 1,
      height = 1,
      blur = 1,
      near = 0,
      far = 10,
      resolution = 512,
      smooth = true,
      color = "#000000",
      depthWrite = false,
      renderOrder,
      ...props
    }: Omit<React.JSX.IntrinsicElements["group"], "scale"> &
      ContactShadowsProps,
    fref
  ) => {
    const ref = React.useRef<THREE.Group>(null!);
    const scene = useThree((state) => state.scene);
    const gl = useThree((state) => state.gl);
    const shadowCamera = React.useRef<THREE.OrthographicCamera>(null!);

    width = width * (Array.isArray(scale) ? scale[0] : scale || 1);
    height = height * (Array.isArray(scale) ? scale[1] : scale || 1);

    const [
      renderTarget,
      planeGeometry,
      depthMaterial,
      horizontalBlurMaterial,
      verticalBlurMaterial,
      renderTargetBlur,
      // 添加一个默认材质给 blurPlane 使用
      defaultBlurMaterial,
    ] = React.useMemo(() => {
      const renderTarget = new THREE.WebGLRenderTarget(resolution, resolution);
      const renderTargetBlur = new THREE.WebGLRenderTarget(
        resolution,
        resolution
      );
      renderTargetBlur.texture.generateMipmaps =
        renderTarget.texture.generateMipmaps = false;
      const planeGeometry = new THREE.PlaneGeometry(width, height).rotateX(
        Math.PI / 2
      );
      const depthMaterial = new THREE.MeshDepthMaterial();
      depthMaterial.depthTest = depthMaterial.depthWrite = false;
      depthMaterial.onBeforeCompile = (shader) => {
        shader.uniforms = {
          ...shader.uniforms,
          ucolor: { value: new THREE.Color(color) },
        };
        shader.fragmentShader = shader.fragmentShader.replace(
          `void main() {`,
          `uniform vec3 ucolor;
           void main() {
          `
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "vec4( vec3( 1.0 - fragCoordZ ), opacity );",
          // Colorize the shadow, multiply by the falloff so that the center can remain darker
          "vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );"
        );
      };

      const horizontalBlurMaterial = new THREE.ShaderMaterial(
        HorizontalBlurShader
      );
      const verticalBlurMaterial = new THREE.ShaderMaterial(VerticalBlurShader);
      verticalBlurMaterial.depthTest = horizontalBlurMaterial.depthTest = false;

      // 创建一个默认的基础材质
      const defaultBlurMaterial = new THREE.MeshBasicMaterial({
        visible: false,
        transparent: true,
        opacity: 0,
      });

      return [
        renderTarget,
        planeGeometry,
        depthMaterial,
        horizontalBlurMaterial,
        verticalBlurMaterial,
        renderTargetBlur,
        defaultBlurMaterial,
      ];
    }, [resolution, width, height, scale, color]);

    // 创建一个 ref 用于引用挂载到组件树的 blurPlane
    const blurPlaneRef = React.useRef<THREE.Mesh>(null!);

    const blurShadows = (blur: number) => {
      if (!blurPlaneRef.current) {
        console.log("blurPlaneRef.current is null");
        return;
      }

      const blurPlane = blurPlaneRef.current;
      blurPlane.visible = true;

      console.log("Blur plane position:", blurPlane.position);
      console.log("Shadow camera position:", shadowCamera.current.position);

      // 第一次模糊（水平）
      blurPlane.material = horizontalBlurMaterial;
      horizontalBlurMaterial.uniforms.tDiffuse.value = renderTarget.texture;
      horizontalBlurMaterial.uniforms.h.value = (blur * 1) / 256;

      gl.setRenderTarget(renderTargetBlur);
      gl.render(blurPlane, shadowCamera.current);

      // 第二次模糊（垂直）
      blurPlane.material = verticalBlurMaterial;
      verticalBlurMaterial.uniforms.tDiffuse.value = renderTargetBlur.texture;
      verticalBlurMaterial.uniforms.v.value = (blur * 1) / 256;

      gl.setRenderTarget(renderTarget);
      gl.render(blurPlane, shadowCamera.current);

      // 恢复默认状态
      blurPlane.material = defaultBlurMaterial;
      blurPlane.visible = false;
    };

    let count = 0;
    useFrame(() => {
      if (shadowCamera.current && (frames === Infinity || count < frames)) {
        gl.autoClear = false;
        count++;

        gl.setRenderTarget(renderTarget);
        gl.clear();

        scene.traverse((obj) => {
          if (isMesh(obj)) {
            if (obj.castShadow) {
              const originalMaterial = obj.material;
              obj.material = obj.customDepthMaterial || depthMaterial;
              gl.render(obj, shadowCamera.current);
              obj.material = originalMaterial;
            }
          }
        });

        blurShadows(blur);
        if (smooth) blurShadows(blur * 0.4);

        gl.setRenderTarget(null);
        gl.autoClear = true;
      }
    });

    React.useImperativeHandle(fref, () => ref.current, []);

    React.useEffect(
      () => () => {
        renderTarget.dispose();
        renderTargetBlur.dispose();
        planeGeometry.dispose();
        depthMaterial.dispose();
        horizontalBlurMaterial.dispose();
        verticalBlurMaterial.dispose();
        defaultBlurMaterial.dispose();
      },
      []
    );

    return (
      <group rotation-x={Math.PI / 2} {...props} ref={ref}>
        <mesh
          // renderOrder={renderOrder}   //手动指定物体的渲染顺序
          geometry={planeGeometry}
          scale={[1, -1, 1]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <meshBasicMaterial
            transparent
            map={renderTarget.texture}
            opacity={opacity}
            depthWrite={depthWrite}
          />
        </mesh>
        {/* 添加 blurPlane 到组件树，使其跟随父级移动 */}
        <mesh
          ref={blurPlaneRef}
          geometry={planeGeometry}
          material={defaultBlurMaterial} // 给它一个默认材质
          visible={false} // 默认不显示
        />
        <orthographicCamera
          ref={shadowCamera}
          args={[-width / 2, width / 2, height / 2, -height / 2, near, far]}
        />
      </group>
    );
  }
);
