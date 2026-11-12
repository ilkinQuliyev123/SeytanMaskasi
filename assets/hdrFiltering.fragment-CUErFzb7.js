import{t as e}from"./shaderStore-D-XQlhUT.js";import{t}from"./helperFunctions-qGTG1bM_.js";import{n,t as r}from"./hdrFilteringFunctions-Da1yugu7.js";import{t as i}from"./pbrBRDFFunctions-DxfbxN23.js";var a=`hdrFilteringPixelShader`,o=`#include<helperFunctions>
#include<importanceSampling>
#include<pbrBRDFFunctions>
#include<hdrFilteringFunctions>
uniform alphaG: f32;var inputTextureSampler: sampler;var inputTexture: texture_cube<f32>;uniform vFilteringInfo: vec2f;uniform hdrScale: f32;varying direction: vec3f;@fragment
fn main(input: FragmentInputs)->FragmentOutputs {var color: vec3f=radiance(uniforms.alphaG,inputTexture,inputTextureSampler,input.direction,uniforms.vFilteringInfo);fragmentOutputs.color= vec4f(color*uniforms.hdrScale,1.0);}`;e.ShadersStoreWGSL[a]||(e.ShadersStoreWGSL[a]=o);var s=[t,n,i,r];for(let t of s)e.IncludesShadersStoreWGSL[t.name]||(e.IncludesShadersStoreWGSL[t.name]=t.shader);var c={name:a,shader:o};export{c as t};