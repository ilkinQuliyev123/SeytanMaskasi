// PBR materiallar: Poly Haven (CC0) toxumaları — rəng, normal, AO/kobudluq/metal (arm). HDRI mühit işığı.
import { HDRCubeTexture, PBRMaterial, Scene, Texture, type BaseTexture } from "@babylonjs/core";
import { PBRCustomMaterial } from "@babylonjs/materials";

export const TEX_M = 3; // 1 toxuma təkrarı = 3 m (faceUV hesabı üçün)
const BASE = import.meta.env.BASE_URL + "assets/tex/";

function tex(scene: Scene, file: string) {
  const t = new Texture(BASE + file, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
  t.anisotropicFilteringLevel = 4;
  return t;
}

/** toxumalı PBR material (səhnə başına bir dəfə yaradılır) */
export function pbr(scene: Scene, name: string, opts: { metal?: number; tint?: string } = {}): PBRMaterial {
  const id = "pbr_" + name;
  const old = scene.getMaterialByName(id) as PBRMaterial | null;
  if (old) return old;
  const m = new PBRMaterial(id, scene);
  m.albedoTexture = tex(scene, `${name}_diff.jpg`);
  m.bumpTexture = tex(scene, `${name}_nor.jpg`);
  m.invertNormalMapX = true; // glTF/OpenGL normal xəritəsi → Babylon (sol əlli)
  m.metallicTexture = tex(scene, `${name}_arm.jpg`);
  m.useAmbientOcclusionFromMetallicTextureRed = true;
  m.useRoughnessFromMetallicTextureGreen = true;
  m.useMetallnessFromMetallicTextureBlue = true;
  m.metallic = opts.metal ?? 0; m.roughness = 1;
  m.environmentIntensity = 1.1;
  return m;
}

/** gecə HDRI-si: real ay işığı əksi və mühit işığı */
export function environment(scene: Scene): BaseTexture {
  const env = new HDRCubeTexture(import.meta.env.BASE_URL + "assets/sky/night.hdr", scene, 128, false, true, false, true);
  scene.environmentTexture = env;
  return env;
}

/** relyef: vertex rəngi çəkiləri ilə 4 toxuma qarışığı (r — meşə, g — ot, b — qaya, qalanı — torpaq) */
export function terrainMaterial(scene: Scene): PBRCustomMaterial {
  const m = new PBRCustomMaterial("terrain", scene);
  const names = ["forest", "grass", "rock", "dirt"];
  names.forEach((n, i) => m.AddUniform("t" + i, "sampler2D", tex(scene, `${n}_diff.jpg`)));
  m.bumpTexture = tex(scene, "forest_nor.jpg");
  m.bumpTexture.level = 0.6;
  m.invertNormalMapX = true;
  m.metallic = 0; m.roughness = 0.95; m.environmentIntensity = 0.35;
  m.Fragment_Custom_Albedo(`
    vec2 tuv = vPositionW.xz / 6.0;
    vec3 w = clamp(vColor.rgb, 0.0, 1.0); float wd = max(0.0, 1.0 - w.r - w.g - w.b);
    vec3 c = texture2D(t0, tuv).rgb * w.r + texture2D(t1, tuv * 1.3).rgb * w.g + texture2D(t2, tuv * 0.5).rgb * w.b + texture2D(t3, tuv).rgb * wd;
    surfaceAlbedo = pow(c, vec3(2.2));
  `);
  return m;
}
