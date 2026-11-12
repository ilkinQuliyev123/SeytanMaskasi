import{t as e}from"./shaderStore-D-XQlhUT.js";import{t}from"./bonesDeclaration-oDxSsnww.js";import{n,t as r}from"./bakedVertexAnimation-7XIMgH6x.js";import{t as i}from"./instancesDeclaration-CJBvtBV5.js";import{t as a}from"./sceneVertexDeclaration-CluTp-RC.js";import{t as o}from"./sceneUboDeclaration-B5VhSG0v.js";import{t as s}from"./clipPlaneVertexDeclaration-Be-obVGF.js";import{t as c}from"./logDepthDeclaration-3gXGtHbI.js";import{t as l}from"./fogVertexDeclaration-Bb9kDbrL.js";import{t as u}from"./lightFragmentDeclaration-gxhjod80.js";import{t as d}from"./lightUboDeclaration-DK1S79Am.js";import{t as f}from"./instancesVertex-C-FoRQR1.js";import{t as p}from"./bonesVertex-BZbvWQw2.js";import{t as m}from"./clipPlaneVertex-6IHcna3I.js";import{t as h}from"./logDepthVertex-D5IUM6qd.js";import{t as g}from"./fogVertex-B90wzaBe.js";import{t as _}from"./shadowsVertex-DIqkUAF8.js";var v=`shadowOnlyVertexShader`,y=`precision highp float;attribute vec3 position;
#ifdef NORMAL
attribute vec3 normal;
#endif
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<instancesDeclaration>
#include<__decl__sceneVertex>
#ifdef POINTSIZE
uniform float pointSize;
#endif
varying vec3 vPositionW;
#ifdef NORMAL
varying vec3 vNormalW;
#endif
#ifdef VERTEXCOLOR
varying vec4 vColor;
#endif
#include<clipPlaneVertexDeclaration>
#include<logDepthDeclaration>
#include<fogVertexDeclaration>
#include<__decl__lightFragment>[0..maxSimultaneousLights]
#if defined(CLUSTLIGHT_BATCH) && CLUSTLIGHT_BATCH>0
varying float vViewDepth;
#endif
#define CUSTOM_VERTEX_DEFINITIONS
void main(void) {
#define CUSTOM_VERTEX_MAIN_BEGIN
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
vec4 worldPos=finalWorld*vec4(position,1.0);gl_Position=viewProjection*worldPos;vPositionW=vec3(worldPos);
#ifdef NORMAL
vNormalW=normalize(vec3(finalWorld*vec4(normal,0.0)));
#endif
#include<clipPlaneVertex>
#include<logDepthVertex>
#include<fogVertex>
#include<shadowsVertex>[0..maxSimultaneousLights]
#if defined(POINTSIZE) && !defined(WEBGPU)
gl_PointSize=pointSize;
#endif
#define CUSTOM_VERTEX_MAIN_END
}
`;e.ShadersStore[v]||(e.ShadersStore[v]=y);var b=[t,n,i,a,o,s,c,l,u,d,f,p,r,m,h,g,_];for(let t of b)e.IncludesShadersStore[t.name]||(e.IncludesShadersStore[t.name]=t.shader);var x={name:v,shader:y};export{x as shadowOnlyVertexShader};