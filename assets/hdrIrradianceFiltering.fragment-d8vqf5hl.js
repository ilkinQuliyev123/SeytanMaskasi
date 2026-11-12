import{t as e}from"./shaderStore-D-XQlhUT.js";import{t}from"./helperFunctions-qGTG1bM_.js";import{n,t as r}from"./hdrFilteringFunctions-Da1yugu7.js";import{t as i}from"./pbrBRDFFunctions-DxfbxN23.js";var a=`hdrIrradianceFilteringPixelShader`,o=`#include<helperFunctions>
#include<importanceSampling>
#include<pbrBRDFFunctions>
#include<hdrFilteringFunctions>
var inputTextureSampler: sampler;var inputTexture: texture_cube<f32>;
#ifdef IBL_CDF_FILTERING
var icdfTextureSampler: sampler;var icdfTexture: texture_2d<f32>;
#endif
uniform vFilteringInfo: vec2f;uniform hdrScale: f32;varying direction: vec3f;@fragment
fn main(input: FragmentInputs)->FragmentOutputs {var color: vec3f=irradiance(inputTexture,inputTextureSampler,input.direction,uniforms.vFilteringInfo,0.0,vec3f(1.0),input.direction
#ifdef IBL_CDF_FILTERING
,icdfTexture,icdfTextureSampler
#endif
);fragmentOutputs.color= vec4f(color*uniforms.hdrScale,1.0);}`;e.ShadersStoreWGSL[a]||(e.ShadersStoreWGSL[a]=o);var s=[t,n,i,r];for(let t of s)e.IncludesShadersStoreWGSL[t.name]||(e.IncludesShadersStoreWGSL[t.name]=t.shader);var c={name:a,shader:o};export{c as t};