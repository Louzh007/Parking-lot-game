import { Environment, Lightformer } from "@react-three/drei";

export function Lights() {
  return (
    <>
      <Environment
        files="./image/zwartkops_straight_afternoon_1k.hdr"
        background={false}
        backgroundIntensity={0}
        environmentIntensity={0.25}
        //这里调节环境光 hdr 贴图强度为 0.25，下面灯光强度就改成了原来的 4 倍
        resolution={512}
        frames={1}
      >
        <group>
          {/* Top */}
          <Lightformer
            form="rect"
            color="white"
            intensity={20}
            onUpdate={(self) => self.lookAt(0, 0, 0)}
            position={[0, 10, 0]}
            scale={[20, 5, 1]}
          />
          {/* Back */}
          <Lightformer
            form="rect"
            color="white"
            intensity={40}
            onUpdate={(self) => self.lookAt(0, 0, 0)}
            position={[0, 0, -2]}
            scale={[4, 2, 1]}
          />
          {/* Bottom */}
          <Lightformer
            form="rect"
            color="white"
            intensity={20}
            onUpdate={(self) => self.lookAt(0, 0, 0)}
            position={[0, -10, 0]}
            scale={[20, 7, 1]}
          />
          {/* // front left */}
          <Lightformer
            form="ring"
            color="white"
            intensity={20}
            onUpdate={(self) => self.lookAt(0, 0, 0)}
            position={[-10, 2, 5]}
            scale={[10, 10, 1]}
          />
          {/* // front right */}
          <Lightformer
            form="ring"
            color="white"
            intensity={20}
            onUpdate={(self) => self.lookAt(0, 0, 0)}
            position={[10, 2, 5]}
            scale={[-5, 5, 1]}
          />
        </group>
      </Environment>

      <ambientLight intensity={0.1} />
      <directionalLight
        castShadow
        position={[0, 10, 0]}
        intensity={4}
        shadow-radius={1} // 轻微柔和
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0002}
      />
    </>
  );
}
