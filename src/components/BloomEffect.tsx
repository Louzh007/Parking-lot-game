import {
  Bloom,
  EffectComposer,
  ToneMapping,
} from "@react-three/postprocessing";

export function BloomEffect() {
  return (
    <EffectComposer>
      <Bloom intensity={1} mipmapBlur luminanceThreshold={7} />
      <ToneMapping />
    </EffectComposer>
  );
}
