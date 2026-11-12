import{t as e}from"./shaderStore-D-XQlhUT.js";import{t}from"./clipPlaneFragmentDeclaration-DYuu9Qqk.js";import{t as n}from"./logDepthDeclaration-DYYUVTrx.js";import{t as r}from"./logDepthFragment-CxtJswLx.js";import{t as i}from"./clipPlaneFragment-F6cElb9_.js";var a=`linePixelShader`,o=`#include<clipPlaneFragmentDeclaration>
uniform color: vec4f;
#include<logDepthDeclaration>
#define CUSTOM_FRAGMENT_DEFINITIONS
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<logDepthFragment>
#include<clipPlaneFragment>
fragmentOutputs.color=uniforms.color;
#define CUSTOM_FRAGMENT_MAIN_END
}`;e.ShadersStoreWGSL[a]||(e.ShadersStoreWGSL[a]=o);var s=[t,n,r,i];for(let t of s)e.IncludesShadersStoreWGSL[t.name]||(e.IncludesShadersStoreWGSL[t.name]=t.shader);var c={name:a,shader:o};export{c as t};