// @ts-check

export const studioVertexShader = `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec3 a_color;
layout(location = 3) in vec2 a_material;
layout(location = 4) in vec3 a_faceColor;
layout(location = 5) in float a_surface;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_viewProjection;
uniform mat4 u_lightViewProjection;
uniform mat3 u_normalMatrix;

out vec3 v_worldPosition;
out vec3 v_worldNormal;
out vec3 v_color;
out vec2 v_material;
out vec3 v_faceColor;
out float v_surface;
out vec4 v_shadowPosition;
out float v_viewDepth;

void main() {
  vec4 world = u_model * vec4(a_position, 1.0);
  vec4 viewPosition = u_view * world;
  v_worldPosition = world.xyz;
  v_worldNormal = normalize(u_normalMatrix * a_normal);
  v_color = a_color;
  v_material = a_material;
  v_faceColor = a_faceColor;
  v_surface = a_surface;
  v_shadowPosition = u_lightViewProjection * world;
  v_viewDepth = -viewPosition.z;
  gl_Position = u_viewProjection * world;
}
`;

export const studioFragmentShader = `#version 300 es
precision highp float;

in vec3 v_worldPosition;
in vec3 v_worldNormal;
in vec3 v_color;
in vec2 v_material;
in vec3 v_faceColor;
in float v_surface;
in vec4 v_shadowPosition;
in float v_viewDepth;

uniform vec3 u_cameraPosition;
uniform vec3 u_lightDirection;
uniform vec3 u_lightColor;
uniform sampler2D u_shadowMap;
uniform vec2 u_shadowTexel;
uniform float u_highlight;
uniform vec3 u_accentColor;
uniform float u_exposure;
uniform vec3 u_fogColor;

out vec4 outColor;

const float PI = 3.14159265359;

vec3 srgbToLinear(vec3 c) {
  return pow(max(c, vec3(0.0)), vec3(2.2));
}

vec3 linearToSrgb(vec3 c) {
  return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));
}

float distributionGGX(vec3 N, vec3 H, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float nDotH = max(dot(N, H), 0.0);
  float nDotH2 = nDotH * nDotH;
  float denominator = nDotH2 * (a2 - 1.0) + 1.0;
  return a2 / max(PI * denominator * denominator, 0.000001);
}

float geometrySchlickGGX(float nDotV, float roughness) {
  float r = roughness + 1.0;
  float k = (r * r) / 8.0;
  return nDotV / max(nDotV * (1.0 - k) + k, 0.000001);
}

float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
  return geometrySchlickGGX(max(dot(N, V), 0.0), roughness) *
         geometrySchlickGGX(max(dot(N, L), 0.0), roughness);
}

vec3 fresnelSchlick(float cosTheta, vec3 f0) {
  return f0 + (1.0 - f0) * pow(1.0 - cosTheta, 5.0);
}

float shadowVisibility(vec3 normal) {
  vec3 projected = v_shadowPosition.xyz / max(v_shadowPosition.w, 0.00001);
  projected = projected * 0.5 + 0.5;
  if (projected.x <= 0.0 || projected.x >= 1.0 || projected.y <= 0.0 || projected.y >= 1.0 || projected.z >= 1.0) {
    return 1.0;
  }
  float nDotL = max(dot(normal, u_lightDirection), 0.0);
  float bias = max(0.00045 * (1.0 - nDotL), 0.000075);
  float visibility = 0.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      float stored = texture(u_shadowMap, projected.xy + vec2(float(x), float(y)) * u_shadowTexel).r;
      visibility += projected.z - bias <= stored ? 1.0 : 0.0;
    }
  }
  return mix(0.28, 1.0, visibility / 9.0);
}

vec3 acesToneMap(vec3 x) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec3 N = normalize(v_worldNormal);
  vec3 V = normalize(u_cameraPosition - v_worldPosition);
  vec3 L = normalize(u_lightDirection);
  vec3 H = normalize(V + L);

  vec3 base = srgbToLinear(v_color);
  float roughness = clamp(v_material.x, 0.07, 0.96);
  float metallic = clamp(v_material.y, 0.0, 1.0);
  vec3 f0 = mix(vec3(0.04), base, metallic);

  float nDotL = max(dot(N, L), 0.0);
  float nDotV = max(dot(N, V), 0.0);
  float ndf = distributionGGX(N, H, roughness);
  float geometry = geometrySmith(N, V, L, roughness);
  vec3 fresnel = fresnelSchlick(max(dot(H, V), 0.0), f0);
  vec3 specular = (ndf * geometry * fresnel) / max(4.0 * nDotV * nDotL, 0.001);
  vec3 diffuseWeight = (vec3(1.0) - fresnel) * (1.0 - metallic);

  float shadow = shadowVisibility(N);
  vec3 direct = (diffuseWeight * base / PI + specular) * u_lightColor * nDotL * shadow * 3.25;

  float sky = 0.5 + 0.5 * N.y;
  vec3 ambientTint = mix(vec3(0.035, 0.045, 0.075), vec3(0.23, 0.27, 0.34), sky);
  vec3 ambient = base * ambientTint * mix(0.62, 1.0, v_surface);

  vec3 fillDirection = normalize(vec3(-0.55, 0.2, -0.72));
  float fill = max(dot(N, fillDirection), 0.0);
  vec3 fillLight = base * vec3(0.11, 0.16, 0.24) * fill;

  float rim = pow(1.0 - nDotV, 3.2) * mix(0.18, 0.48, v_surface);
  vec3 color = ambient + direct + fillLight + vec3(0.16, 0.29, 0.5) * rim;
  color += srgbToLinear(u_accentColor) * u_highlight * (0.25 + 0.75 * rim);

  color *= u_exposure;
  color = acesToneMap(color);
  color = linearToSrgb(color);

  float fog = smoothstep(10.0, 24.0, v_viewDepth);
  color = mix(color, u_fogColor, fog);
  outColor = vec4(color, 1.0);
}
`;

export const shadowVertexShader = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
uniform mat4 u_model;
uniform mat4 u_lightViewProjection;
void main() {
  gl_Position = u_lightViewProjection * u_model * vec4(a_position, 1.0);
}
`;

export const shadowFragmentShader = `#version 300 es
precision highp float;
void main() {}
`;

export const lineVertexShader = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
uniform mat4 u_model;
uniform mat4 u_viewProjection;
void main() {
  gl_Position = u_viewProjection * u_model * vec4(a_position, 1.0);
}
`;

export const lineFragmentShader = `#version 300 es
precision highp float;
uniform vec4 u_color;
out vec4 outColor;
void main() {
  outColor = u_color;
}
`;

export const observationVertexShader = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec3 a_color;
layout(location = 4) in vec3 a_faceColor;
uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_viewProjection;
uniform mat3 u_normalMatrix;
out vec3 v_normal;
out vec3 v_albedo;
out vec3 v_faceColor;
out float v_viewDepth;
void main() {
  vec4 world = u_model * vec4(a_position, 1.0);
  vec4 viewPosition = u_view * world;
  v_normal = normalize(u_normalMatrix * a_normal);
  v_albedo = a_color;
  v_faceColor = a_faceColor;
  v_viewDepth = -viewPosition.z;
  gl_Position = u_viewProjection * world;
}
`;

export const observationFragmentShader = `#version 300 es
precision highp float;
in vec3 v_normal;
in vec3 v_albedo;
in vec3 v_faceColor;
in float v_viewDepth;
uniform int u_mode;
uniform vec3 u_pieceColor;
uniform float u_near;
uniform float u_far;
out vec4 outColor;
void main() {
  vec3 color;
  if (u_mode == 1) {
    color = u_pieceColor;
  } else if (u_mode == 2) {
    color = v_faceColor;
  } else if (u_mode == 3) {
    color = normalize(v_normal) * 0.5 + 0.5;
  } else if (u_mode == 4) {
    float depth = clamp((v_viewDepth - u_near) / (u_far - u_near), 0.0, 1.0);
    color = vec3(1.0 - depth);
  } else {
    color = v_albedo;
  }
  outColor = vec4(color, 1.0);
}
`;

export const groundVertexShader = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
uniform mat4 u_view;
uniform mat4 u_viewProjection;
uniform mat4 u_lightViewProjection;
out vec3 v_worldPosition;
out vec4 v_shadowPosition;
out float v_viewDepth;
void main() {
  vec4 world = vec4(a_position, 1.0);
  v_worldPosition = a_position;
  v_shadowPosition = u_lightViewProjection * world;
  v_viewDepth = -(u_view * world).z;
  gl_Position = u_viewProjection * world;
}
`;

export const groundFragmentShader = `#version 300 es
precision highp float;
in vec3 v_worldPosition;
in vec4 v_shadowPosition;
in float v_viewDepth;
uniform sampler2D u_shadowMap;
uniform vec2 u_shadowTexel;
uniform vec3 u_fogColor;
out vec4 outColor;

float gridLine(vec2 coordinate, float scaleValue) {
  vec2 scaled = coordinate * scaleValue;
  vec2 width = fwidth(scaled);
  vec2 distanceToLine = abs(fract(scaled - 0.5) - 0.5) / max(width, vec2(0.0001));
  return 1.0 - min(min(distanceToLine.x, distanceToLine.y), 1.0);
}

float shadowVisibility() {
  vec3 projected = v_shadowPosition.xyz / max(v_shadowPosition.w, 0.00001);
  projected = projected * 0.5 + 0.5;
  if (projected.x <= 0.0 || projected.x >= 1.0 || projected.y <= 0.0 || projected.y >= 1.0 || projected.z >= 1.0) return 1.0;
  float visibility = 0.0;
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      float stored = texture(u_shadowMap, projected.xy + vec2(float(x), float(y)) * u_shadowTexel).r;
      visibility += projected.z - 0.00035 <= stored ? 1.0 : 0.0;
    }
  }
  return mix(0.34, 1.0, visibility / 25.0);
}

void main() {
  float fineGrid = gridLine(v_worldPosition.xz, 1.0);
  float coarseGrid = gridLine(v_worldPosition.xz, 0.2);
  float radius = length(v_worldPosition.xz);
  float gridFade = 1.0 - smoothstep(3.0, 11.0, radius);
  vec3 base = vec3(0.025, 0.032, 0.047);
  base += vec3(0.035, 0.052, 0.075) * fineGrid * gridFade;
  base += vec3(0.055, 0.09, 0.13) * coarseGrid * gridFade;
  base *= shadowVisibility();
  float fog = smoothstep(8.0, 20.0, v_viewDepth);
  base = mix(base, u_fogColor, max(fog, smoothstep(7.0, 14.0, radius)));
  outColor = vec4(base, 1.0);
}
`;
