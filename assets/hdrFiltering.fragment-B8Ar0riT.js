import{t as e}from"./shaderStore-D-XQlhUT.js";import{t}from"./helperFunctions-D89zo_74.js";import{n,t as r}from"./hdrFilteringFunctions-Dw0rQ8Bu.js";import{t as i}from"./pbrBRDFFunctions-BCNINF-p.js";var a=`hdrFilteringPixelShader`,o=`#include<helperFunctions>
#include<importanceSampling>
#include<pbrBRDFFunctions>
#include<hdrFilteringFunctions>
uniform float alphaG;uniform samplerCube inputTexture;uniform vec2 vFilteringInfo;uniform float hdrScale;varying vec3 direction;void main() {vec3 color=radiance(alphaG,inputTexture,direction,vFilteringInfo);gl_FragColor=vec4(color*hdrScale,1.0);}`;e.ShadersStore[a]||(e.ShadersStore[a]=o);var s=[t,n,i,r];for(let t of s)e.IncludesShadersStore[t.name]||(e.IncludesShadersStore[t.name]=t.shader);var c={name:a,shader:o};export{c as t};