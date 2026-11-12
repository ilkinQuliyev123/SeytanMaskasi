import{t as e}from"./shaderStore-D-XQlhUT.js";import{t}from"./sceneFragmentDeclaration-ql3RpL9u.js";import{t as n}from"./sceneUboDeclaration-B5VhSG0v.js";import{t as r}from"./helperFunctions-D89zo_74.js";import{t as i}from"./lightFragmentDeclaration-gxhjod80.js";import{t as a}from"./lightUboDeclaration-DK1S79Am.js";import{t as o}from"./lightsFragmentFunctions-D7mYUodM.js";import{t as s}from"./shadowsFragmentFunctions-Co6NG7kN.js";import{t as c}from"./clipPlaneFragmentDeclaration-LJdlhFDo.js";import{t as l}from"./logDepthDeclaration-3gXGtHbI.js";import{t as u}from"./fogFragmentDeclaration-kXoGw5iI.js";import{t as d}from"./clipPlaneFragment-B_IgbgTE.js";import{t as f}from"./lightFragment-5DmvFIcs.js";import{t as p}from"./logDepthFragment-C5lxT4l1.js";import{t as m}from"./fogFragment-CKCGTcJi.js";import{t as h}from"./imageProcessingCompatibility-D6_4f0FX.js";var g=`shadowOnlyPixelShader`,_=`precision highp float;
#include<__decl__sceneFragment>
uniform float alpha;uniform vec3 shadowColor;
#define ADDITIONAL_FRAGMENT_DECLARATION
varying vec3 vPositionW;
#ifdef NORMAL
varying vec3 vNormalW;
#endif
#include<helperFunctions>
#include<__decl__lightFragment>[0..maxSimultaneousLights]
#include<lightsFragmentFunctions>
#include<shadowsFragmentFunctions>
#include<clipPlaneFragmentDeclaration>
#ifdef LOGARITHMICDEPTH
#extension GL_EXT_frag_depth : enable
#endif
#include<logDepthDeclaration>
#include<fogFragmentDeclaration>
#if defined(CLUSTLIGHT_BATCH) && CLUSTLIGHT_BATCH>0
varying float vViewDepth;
#endif
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
vec3 viewDirectionW=normalize(vEyePosition.xyz-vPositionW);
#ifdef NORMAL
vec3 normalW=normalize(vNormalW);
#else
vec3 normalW=vec3(1.0,1.0,1.0);
#endif
vec3 diffuseBase=vec3(0.,0.,0.);lightingInfo info;float shadow=1.;float glossiness=0.;float aggShadow=0.;float numLights=0.;
#include<lightFragment>[0..1]
#define CUSTOM_FRAGMENT_BEFORE_LIGHT_COMPOSITION
vec4 color=vec4(shadowColor,(1.0-clamp(shadow,0.,1.))*alpha);
#include<logDepthFragment>
#include<fogFragment>
gl_FragColor=color;
#include<imageProcessingCompatibility>
#define CUSTOM_FRAGMENT_MAIN_END
}`;e.ShadersStore[g]||(e.ShadersStore[g]=_);var v=[t,n,r,i,a,o,s,c,l,u,d,f,p,m,h];for(let t of v)e.IncludesShadersStore[t.name]||(e.IncludesShadersStore[t.name]=t.shader);var y={name:g,shader:_};export{y as shadowOnlyPixelShader};