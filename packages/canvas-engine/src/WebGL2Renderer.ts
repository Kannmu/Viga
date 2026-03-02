import type { SceneNode, NodeId } from '@viga/editor-core';

const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_position;
uniform vec2 u_resolution;
void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 zeroToTwo = zeroToOne * 2.0;
  vec2 clipSpace = zeroToTwo - 1.0;
  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform vec4 u_color;
out vec4 outColor;
void main() {
  outColor = u_color;
}`;

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Failed to create shader');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log ?? 'unknown'}`);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const program = gl.createProgram();
  if (!program) {
    throw new Error('Failed to create program');
  }
  const vert = createShader(gl, gl.VERTEX_SHADER, VERT);
  const frag = createShader(gl, gl.FRAGMENT_SHADER, FRAG);
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${log ?? 'unknown'}`);
  }
  return program;
}

export class WebGL2Renderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private uResolution: WebGLUniformLocation;
  private uColor: WebGLUniformLocation;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      premultipliedAlpha: true,
      depth: false,
      stencil: true,
    });
    if (!gl) {
      throw new Error('WebGL2 not supported');
    }

    this.gl = gl;
    this.program = createProgram(gl);

    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    if (!vao || !vbo) {
      throw new Error('Failed to create GL buffers');
    }
    this.vao = vao;
    this.vbo = vbo;

    const uResolution = gl.getUniformLocation(this.program, 'u_resolution');
    const uColor = gl.getUniformLocation(this.program, 'u_color');
    if (!uResolution || !uColor) {
      throw new Error('Failed to resolve uniforms');
    }
    this.uResolution = uResolution;
    this.uColor = uColor;

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.floor(width * dpr));
    this.canvas.height = Math.max(1, Math.floor(height * dpr));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  render(nodes: SceneNode[], selectedIds: NodeId[] = []): void {
    const gl = this.gl;
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(this.uResolution, this.canvas.width, this.canvas.height);

    for (const node of nodes) {
      if (!node.visible) {
        continue;
      }

      const x = node.x;
      const y = node.y;
      const w = node.width;
      const h = node.height;
      const vertices = new Float32Array([
        x, y,
        x + w, y,
        x, y + h,
        x, y + h,
        x + w, y,
        x + w, y + h,
      ]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

      const fill = node.fills[0];
      const c = fill?.type === 'solid'
        ? fill.color
        : { r: 0.9, g: 0.9, b: 0.9, a: 1 };
      gl.uniform4f(this.uColor, c.r, c.g, c.b, c.a * node.opacity);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (selectedIds.includes(node.id)) {
        this.drawOutline(x, y, w, h);
      }
    }

    gl.bindVertexArray(null);
  }

  private drawOutline(x: number, y: number, w: number, h: number): void {
    const gl = this.gl;
    const vertices = new Float32Array([
      x, y,
      x + w, y,
      x + w, y + h,
      x, y + h,
      x, y,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.uniform4f(this.uColor, 0.22, 0.51, 0.96, 1);
    gl.lineWidth(1);
    gl.drawArrays(gl.LINE_STRIP, 0, 5);
  }

  destroy(): void {
    this.gl.deleteBuffer(this.vbo);
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program);
  }
}
