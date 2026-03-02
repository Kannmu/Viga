# Viga 技术设计文档 (Technical Design Document)

> **版本**: 1.0.0  
> **基于**: PRD.md v1  
> **状态**: 初始架构设计

---

## 目录

1. [设计目标与约束](#1-设计目标与约束)
2. [技术选型与论证](#2-技术选型与论证)
3. [总体系统架构](#3-总体系统架构)
4. [核心模块详细设计](#4-核心模块详细设计)
   - 4.1 [应用外壳层 (Tauri Shell)](#41-应用外壳层-tauri-shell)
   - 4.2 [文档模型与场景图 (Document Model & Scene Graph)](#42-文档模型与场景图)
   - 4.3 [画布渲染引擎 (Canvas Rendering Engine)](#43-画布渲染引擎)
   - 4.4 [矢量编辑工具链 (Vector Editing Toolchain)](#44-矢量编辑工具链)
   - 4.5 [AI 集成层 (AI Integration Layer)](#45-ai-集成层)
   - 4.6 [文件 I/O 模块 (File I/O)](#46-文件-io-模块)
   - 4.7 [UI 界面层 (UI Layer)](#47-ui-界面层)
   - 4.8 [插件系统 (Plugin System)](#48-插件系统)
5. [数据流与通信机制](#5-数据流与通信机制)
6. [性能工程策略](#6-性能工程策略)
7. [安全设计](#7-安全设计)
8. [国际化方案](#8-国际化方案)
9. [测试策略](#9-测试策略)
10. [目录结构与工程规范](#10-目录结构与工程规范)
11. [分阶段开发路线图](#11-分阶段开发路线图)

---

## 1. 设计目标与约束

### 1.1 核心技术目标

| 目标 | 量化指标 |
|------|---------|
| 渲染性能 | 10,000+ 矢量节点下保持 60fps 缩放/平移 |
| 启动时间 | 冷启动 < 2 秒（空画布） |
| 内存占用 | 空闲状态 < 200MB，万级节点 < 500MB |
| 安装包体积 | < 50MB（不含系统 WebView） |
| AI 响应体验 | 支持 SSE 流式渲染，首 token 到画布元素出现 < 500ms |
| 跨平台 | Windows 10+, macOS 12+, Ubuntu 22.04+ |

### 1.2 架构约束

- **开源优先**：所有核心依赖必须是开源许可兼容的（MIT/Apache-2.0/MPL-2.0）
- **离线可用**：除 AI 功能外，所有编辑功能必须完全离线可用
- **BYOK 安全**：API 密钥绝不离开用户设备
- **可扩展**：核心功能与扩展功能之间必须有清晰的 API 边界

---

## 2. 技术选型与论证

### 2.1 应用框架：Tauri 2.0

| 候选方案 | 优势 | 劣势 | 结论 |
|---------|------|------|------|
| **Tauri 2.0** | 包体小（~5MB），Rust 后端性能极佳，安全沙箱模型，内存占用低 | 系统 WebView 一致性需处理，生态略小于 Electron | ✅ **选用** |
| Electron | 生态成熟，Chromium 一致性好 | 包体 >150MB，内存占用高，安全模型较弱 | ❌ |
| Flutter | 原生渲染性能好 | 自绘引擎与 Web 生态割裂，矢量编辑生态几乎为零 | ❌ |
| CEF (C++) | 极致性能 | 开发成本极高，开源社区贡献门槛高 | ❌ |

**论证**：Viga 的目标用户群包含科研人员（Windows/Linux）和设计师（macOS），Tauri 2.0 的 Rust 后端为文件处理、PDF 生成、加密等提供了原生级性能，同时其安全沙箱模型天然适合 BYOK 场景。WebView 渲染层的微小差异通过 WebGL2（绕过 DOM 渲染）被完全规避。

### 2.2 前端 UI 框架：React 18+

| 候选方案 | 优势 | 劣势 | 结论 |
|---------|------|------|------|
| **React 18+** | 生态最大，开源贡献者池最广，并发渲染（Concurrent Features）适合 UI+Canvas 双线程协调 | 虚拟 DOM 有一定开销 | ✅ **选用** |
| SolidJS | 响应式极致性能，无虚拟 DOM | 生态小，社区贡献者少 | ❌ |
| Svelte 5 | 编译优化好 | 复杂状态管理不够成熟 | ❌ |
| Vue 3 | 模板语法友好 | 设计工具领域实践少 | ❌ |

**论证**：React 的 UI 层仅负责工具栏、面板等 Chrome 界面（约占总渲染面积的 20%），画布由独立的 WebGL2 引擎绘制，因此 React 虚拟 DOM 的开销不会成为瓶颈。其庞大的生态系统和贡献者基数对开源项目至关重要。

### 2.3 画布渲染：WebGL2 + 自研引擎

| 候选方案 | 优势 | 劣势 | 结论 |
|---------|------|------|------|
| **WebGL2 自研** | GPU 加速，万级节点轻松 60fps，完全可控 | 开发成本高 | ✅ **选用** |
| Canvas 2D API | 简单易用 | 无法满足万级节点性能要求 | ❌ |
| SVG DOM | 天然矢量 | DOM 节点过多时性能崩溃 | ❌ |
| Fabric.js / Konva.js | 快速原型 | 抽象层限制了专业矢量编辑的精细控制 | ❌ |
| PixiJS | 2D WebGL 渲染成熟 | 面向游戏/动画，缺乏矢量编辑原语 | ❌ |
| WebGPU | 下一代图形 API | 浏览器/WebView 支持不足（2025 年） | 作为未来升级路径 |

**论证**：Figma 的成功证明了 WebGL 驱动矢量编辑的可行性。自研引擎虽然前期投入大，但给予我们对渲染管线的完全控制权——这是实现专业级效果（图层混合模式、模糊、阴影）和万级节点性能的前提。WebGPU 作为 v2 升级路径预留接口。

### 2.4 计算核心：Rust → WebAssembly

| 模块 | 选用库 | 用途 |
|------|--------|------|
| 路径曲面细分 | `lyon` | 将贝塞尔曲线细分为三角形供 WebGL 渲染 |
| 布尔运算 | `i_overlay`（或 `geo` + 自研） | 路径的交、并、补、差运算 |
| 布局引擎 | `taffy` | Flexbox/CSS Grid 布局计算（Auto Layout） |
| SVG 解析 | `usvg` / `resvg` | 将 SVG 文件解析为规范化的图形树 |
| PDF 生成 | `printpdf` + `rustybuzz`（字体塑形） | 高质量矢量 PDF 导出 |
| 空间索引 | `rstar` | R-Tree 空间索引，用于视口裁剪和命中测试 |

**论证**：这些计算密集型任务放在 WASM 中执行，比纯 JavaScript 快 5-20x。Rust 的内存安全保证避免了 C++ WASM 模块中常见的内存泄漏问题。同时，相同的 Rust 代码可以直接在 Tauri 后端复用（如 PDF 导出既可在 WASM 中预览，也可在 Rust 后端批量生成）。

### 2.5 状态管理：Zustand + Immer + 命令模式

| 候选方案 | 优势 | 劣势 | 结论 |
|---------|------|------|------|
| **Zustand** | 轻量无样板代码，支持切片化，天然适合 React | 需手动集成撤销/重做 | ✅ **选用** |
| Redux Toolkit | 成熟的 DevTools | 样板代码多，对设计编辑器过于繁重 | ❌ |
| Jotai/Recoil | 原子化状态 | 大规模文档模型下原子粒度难以管理 | ❌ |
| MobX | 响应式自动追踪 | 隐式依赖追踪在复杂场景下难以调试 | ❌ |

搭配 **Immer** 实现不可变状态更新，搭配自研 **Command Pattern** 实现撤销/重做和 AI 操作的原子化管理。

### 2.6 完整技术栈一览

```
┌─────────────────────────────────────────────────────┐
│                  用户界面 (User Interface)            │
│  React 18 · TypeScript · Tailwind CSS · Radix UI     │
│  Zustand (状态) · react-i18next (国际化)              │
├─────────────────────────────────────────────────────┤
│                  画布引擎 (Canvas Engine)             │
│  WebGL2 自研渲染器 · GLSL Shaders                     │
│  SDF 文本渲染 · 多通道合成                             │
├─────────────────────────────────────────────────────┤
│                  计算核心 (WASM Core)                 │
│  Rust → wasm-pack → wasm-bindgen                     │
│  lyon (曲面细分) · taffy (布局) · i_overlay (布尔)    │
│  usvg (SVG解析) · rstar (空间索引)                    │
├─────────────────────────────────────────────────────┤
│                  AI 集成层 (AI Layer)                 │
│  OpenAI-Compatible API Client · SSE Stream Parser    │
│  Design DSL (JSON Schema) · Context Serializer       │
├─────────────────────────────────────────────────────┤
│                  原生后端 (Tauri Backend)             │
│  Rust · Tauri 2.0 IPC                                │
│  printpdf (PDF导出) · keyring-rs (密钥安全存储)       │
│  notify (文件监听) · serde (序列化)                   │
└─────────────────────────────────────────────────────┘
```

---

## 3. 总体系统架构

### 3.1 分层架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                        Tauri 2.0 Shell                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    Rust Native Backend                      │  │
│  │  ┌──────────────┐ ┌───────────────┐ ┌──────────────────┐  │  │
│  │  │ File System   │ │  Secure Key   │ │  PDF/Export      │  │  │
│  │  │ Manager       │ │  Storage      │ │  Engine          │  │  │
│  │  │ (read/write/  │ │  (keyring-rs) │ │  (printpdf +     │  │  │
│  │  │  watch)       │ │               │ │   rustybuzz)     │  │  │
│  │  └──────────────┘ └───────────────┘ └──────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │              Tauri IPC Command Bridge                 │  │  │
│  │  │         (类型安全的前后端通信，基于 serde)              │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     WebView Frontend                       │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │                   React UI Shell                      │  │  │
│  │  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐  │  │  │
│  │  │  │ Toolbar  │ │  Layer   │ │ Props  │ │ AI Chat   │  │  │  │
│  │  │  │ & Menu   │ │  Panel   │ │ Panel  │ │ Panel     │  │  │  │
│  │  │  └─────────┘ └──────────┘ └────────┘ └───────────┘  │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │           Editor Core (核心编辑器引擎)                 │  │  │
│  │  │                                                      │  │  │
│  │  │  ┌─────────────────┐    ┌─────────────────────────┐  │  │  │
│  │  │  │  Document Model  │◄──►│    Command Manager      │  │  │  │
│  │  │  │  (Scene Graph)   │    │  (Undo/Redo/AI Atomic)  │  │  │  │
│  │  │  └────────┬────────┘    └─────────────────────────┘  │  │  │
│  │  │           │                                          │  │  │
│  │  │  ┌────────▼────────┐    ┌─────────────────────────┐  │  │  │
│  │  │  │  Render Pipeline │    │    Tool State Machine   │  │  │  │
│  │  │  │  (WebGL2 Engine) │    │  (Select/Pen/Shape/...) │  │  │  │
│  │  │  └────────┬────────┘    └─────────────────────────┘  │  │  │
│  │  │           │                                          │  │  │
│  │  │  ┌────────▼────────┐    ┌─────────────────────────┐  │  │  │
│  │  │  │   WASM Core     │    │   AI Integration Layer  │  │  │  │
│  │  │  │ (Geometry/Layout │    │ (API Client / DSL /     │  │  │  │
│  │  │  │  /Boolean/Index) │    │  Context Builder)       │  │  │  │
│  │  │  └─────────────────┘    └─────────────────────────┘  │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │                   Plugin Runtime                      │  │  │
│  │  │        (Sandboxed Web Worker / iframe 沙箱)           │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 核心设计原则

1. **引擎-界面分离**：Editor Core 是纯逻辑层（不依赖 React），可独立测试。React UI Shell 通过订阅 Zustand Store 响应状态变更。
2. **单一数据源**：所有设计数据存储在 Document Model 中，UI、渲染器、AI 模块均为该模型的消费者。
3. **命令驱动**：所有对文档的修改必须通过 Command 对象执行，保证撤销/重做的完整性。
4. **按需序列化**：AI 读取画布时，仅序列化选中元素或可视区域内的元素子集，避免全量数据泄露。

---

## 4. 核心模块详细设计

### 4.1 应用外壳层 (Tauri Shell)

#### 4.1.1 职责

Tauri Rust 后端处理所有需要原生能力的操作，前端通过 Tauri IPC `invoke` 调用。

#### 4.1.2 IPC 命令设计

```rust
// src-tauri/src/commands/mod.rs

/// 文件系统操作
#[tauri::command]
async fn save_project(path: String, data: Vec<u8>) -> Result<(), String>;

#[tauri::command]
async fn load_project(path: String) -> Result<Vec<u8>, String>;

#[tauri::command]
async fn export_pdf(document_json: String, output_path: String) -> Result<(), String>;

#[tauri::command]
async fn export_png(
    canvas_data: Vec<u8>,
    width: u32,
    height: u32,
    output_path: String,
    scale: f32
) -> Result<(), String>;

/// 安全密钥存储（使用系统钥匙串）
#[tauri::command]
async fn store_api_key(profile_id: String, key: String) -> Result<(), String>;

#[tauri::command]
async fn retrieve_api_key(profile_id: String) -> Result<String, String>;

#[tauri::command]
async fn delete_api_key(profile_id: String) -> Result<(), String>;

/// 系统对话框
#[tauri::command]
async fn show_save_dialog(
    default_name: String,
    filters: Vec<FileFilter>
) -> Result<Option<String>, String>;

/// 字体系统
#[tauri::command]
async fn list_system_fonts() -> Result<Vec<FontInfo>, String>;

#[tauri::command]
async fn load_font_data(font_family: String) -> Result<Vec<u8>, String>;
```

#### 4.1.3 Tauri 权限配置

```json
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:allow-save",
    "dialog:allow-open",
    "fs:allow-read",
    "fs:allow-write",
    "clipboard:allow-write-text",
    "clipboard:allow-read-text"
  ]
}
```

#### 4.1.4 PDF 导出引擎（Rust 后端）

```rust
// src-tauri/src/export/pdf.rs
use printpdf::*;
use rustybuzz::Face;

pub struct PdfExporter {
    fonts: HashMap<String, Face<'static>>,
}

impl PdfExporter {
    /// 从文档 JSON 序列化结构生成 PDF
    pub fn export(&self, document: &DocumentData, config: &PdfConfig) -> Result<Vec<u8>> {
        let (doc, page_idx, layer_idx) = PdfDocument::new(
            &document.name,
            Mm(config.width_mm),
            Mm(config.height_mm),
            "Layer 1"
        );
        let page = doc.get_page(page_idx);
        let layer = page.get_layer(layer_idx);

        for element in &document.elements {
            match element {
                Element::Path(path) => self.render_path(&layer, path),
                Element::Text(text) => self.render_text(&layer, text),
                Element::Image(img) => self.render_image(&layer, img),
                Element::Group(group) => self.render_group(&layer, group),
            }?;
        }

        doc.save_to_bytes()
    }
}
```

### 4.2 文档模型与场景图

#### 4.2.1 场景图节点类型层级

```
SceneNode (抽象基类)
├── PageNode          // 页面
├── FrameNode         // 画板/容器 (对应 Figma Frame)
├── GroupNode         // 编组
├── ShapeNode         // 基础图形
│   ├── RectangleNode
│   ├── EllipseNode
│   ├── PolygonNode
│   ├── StarNode
│   └── LineNode
├── VectorNode        // 自由矢量路径 (钢笔工具产物)
├── TextNode          // 文本
├── ImageNode         // 位图引用
└── BooleanNode       // 布尔运算组
    (union/subtract/intersect/exclude)
```

#### 4.2.2 核心数据结构（TypeScript）

```typescript
// packages/editor-core/src/document/types.ts

/** 全局唯一 ID */
type NodeId = string; // nanoid 生成

/** 2D 仿射变换矩阵 [a, b, c, d, tx, ty] */
type Matrix2D = [number, number, number, number, number, number];

/** RGBA 颜色 */
interface Color {
  r: number; // 0-1
  g: number;
  b: number;
  a: number;
}

/** 填充类型 */
type Paint =
  | { type: 'solid'; color: Color }
  | { type: 'linear-gradient'; stops: GradientStop[]; transform: Matrix2D }
  | { type: 'radial-gradient'; stops: GradientStop[]; transform: Matrix2D }
  | { type: 'image'; imageRef: string; scaleMode: 'fill' | 'fit' | 'tile' };

/** 描边配置 */
interface Stroke {
  paint: Paint;
  width: number;
  alignment: 'center' | 'inside' | 'outside';
  cap: 'none' | 'round' | 'square';
  join: 'miter' | 'round' | 'bevel';
  dashPattern: number[];
}

/** 效果 */
type Effect =
  | { type: 'drop-shadow'; color: Color; offset: Vec2; blur: number; spread: number }
  | { type: 'inner-shadow'; color: Color; offset: Vec2; blur: number; spread: number }
  | { type: 'layer-blur'; radius: number }
  | { type: 'background-blur'; radius: number };

/** 混合模式 */
type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
  | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion';

/** 场景节点基类 */
interface BaseNode {
  id: NodeId;
  name: string;
  type: NodeType;
  parentId: NodeId | null;
  childrenIds: NodeId[];        // 有序子节点列表
  transform: Matrix2D;          // 相对父节点的变换
  opacity: number;              // 0-1
  blendMode: BlendMode;
  visible: boolean;
  locked: boolean;
  fills: Paint[];
  strokes: Stroke[];
  effects: Effect[];
  constraints: LayoutConstraints;
  exportSettings: ExportSetting[];
}

/** 矩形节点 */
interface RectangleNode extends BaseNode {
  type: 'rectangle';
  width: number;
  height: number;
  cornerRadii: [number, number, number, number]; // TL, TR, BR, BL
}

/** 矢量路径节点（钢笔工具 / 布尔运算结果） */
interface VectorNode extends BaseNode {
  type: 'vector';
  vectorPaths: VectorPath[];    // 支持 Vector Network
  windingRule: 'nonzero' | 'evenodd';
}

/** 矢量路径 */
interface VectorPath {
  commands: PathCommand[];
  closed: boolean;
}

/** 路径命令 */
type PathCommand =
  | { type: 'M'; x: number; y: number }                                    // MoveTo
  | { type: 'L'; x: number; y: number }                                    // LineTo
  | { type: 'C'; cp1x: number; cp1y: number; cp2x: number; cp2y: number;
      x: number; y: number }                                                // CubicBezier
  | { type: 'Q'; cpx: number; cpy: number; x: number; y: number }          // QuadBezier
  | { type: 'Z' };                                                          // ClosePath

/** 画板/容器节点 */
interface FrameNode extends BaseNode {
  type: 'frame';
  width: number;
  height: number;
  clipsContent: boolean;          // 是否裁切溢出内容
  autoLayout: AutoLayoutConfig | null;  // Auto Layout 配置
  padding: [number, number, number, number];
  cornerRadii: [number, number, number, number];
}

/** Auto Layout 配置（映射 Flexbox） */
interface AutoLayoutConfig {
  direction: 'horizontal' | 'vertical';
  gap: number;
  primaryAxisAlignment: 'start' | 'center' | 'end' | 'space-between';
  crossAxisAlignment: 'start' | 'center' | 'end' | 'stretch';
  wrap: boolean;
}

/** 文本节点 */
interface TextNode extends BaseNode {
  type: 'text';
  characters: string;
  textStyle: TextStyle;
  textAutoResize: 'none' | 'width-and-height' | 'height';
  paragraphs: ParagraphStyle[];
}

interface TextStyle {
  fontFamily: string;
  fontWeight: number;         // 100-900
  fontSize: number;
  lineHeight: number | 'auto';
  letterSpacing: number;
  textDecoration: 'none' | 'underline' | 'strikethrough';
  textAlign: 'left' | 'center' | 'right' | 'justify';
}

/** 布尔运算节点 */
interface BooleanNode extends BaseNode {
  type: 'boolean';
  operation: 'union' | 'subtract' | 'intersect' | 'exclude';
  // childrenIds 包含参与布尔运算的子路径
}

/** 文档根结构 */
interface Document {
  id: string;
  name: string;
  version: number;
  pages: PageNode[];
  assets: AssetLibrary;       // 颜色/文本样式/组件
  metadata: DocumentMetadata;
}
```

#### 4.2.3 文档存储格式 (.viga)

```
project.viga (ZIP container)
├── manifest.json           // 版本、元数据
├── document.json           // 场景图序列化
├── assets/
│   ├── images/             // 嵌入的位图资源
│   │   └── img_xxxx.png
│   └── fonts/              // 嵌入的字体子集
│       └── font_xxxx.woff2
└── thumbnails/
    └── page_1.png          // 页面缩略图（用于文件管理器预览）
```

#### 4.2.4 节点存储与索引

```typescript
// packages/editor-core/src/document/store.ts

/**
 * 扁平化节点存储，用 Map 实现 O(1) 查找
 * 树结构通过 parentId / childrenIds 隐式维护
 */
class DocumentStore {
  private nodes: Map<NodeId, SceneNode> = new Map();
  private spatialIndex: RTree;   // WASM R-Tree 实例
  private dirty: Set<NodeId> = new Set();  // 脏节点集合

  getNode(id: NodeId): SceneNode | undefined;
  getChildren(id: NodeId): SceneNode[];
  getAncestors(id: NodeId): SceneNode[];

  /** 所有修改必须通过 applyCommand */
  applyCommand(command: Command): void;

  /** 查询视口内节点（委托 WASM R-Tree） */
  queryViewport(rect: BoundingBox): NodeId[];

  /** 查询点命中的节点（从顶层往下） */
  hitTest(point: Vec2): NodeId | null;

  /** 序列化选中节点（用于 AI 上下文） */
  serializeSubtree(ids: NodeId[]): string;

  /** 标记脏节点，触发增量渲染 */
  markDirty(id: NodeId): void;
  consumeDirty(): Set<NodeId>;
}
```

### 4.3 画布渲染引擎

#### 4.3.1 渲染管线总览

```
┌──────────────────────────────────────────────────────────────┐
│                     Render Pipeline                          │
│                                                              │
│  Document Store ──► Viewport Culling ──► Render List Sort    │
│       │              (WASM R-Tree)       (z-order)           │
│       │                                      │               │
│       ▼                                      ▼               │
│  Dirty Detection ──► Tessellation  ──► GPU Buffer Upload     │
│  (增量更新)          (WASM lyon)       (WebGL2 VBO/IBO)     │
│                                              │               │
│                                              ▼               │
│                      ┌─────────────────────────────┐         │
│                      │     Multi-Pass Rendering     │         │
│                      │                             │         │
│                      │  Pass 1: Shape Fill         │         │
│                      │  Pass 2: Shape Stroke       │         │
│                      │  Pass 3: Text (SDF)         │         │
│                      │  Pass 4: Images             │         │
│                      │  Pass 5: Effects (Blur/     │         │
│                      │          Shadow via FBO)     │         │
│                      │  Pass 6: UI Overlay         │         │
│                      │  (选择框/手柄/标尺/网格)     │         │
│                      └─────────────────────────────┘         │
│                                      │                       │
│                                      ▼                       │
│                               Screen Output                  │
└──────────────────────────────────────────────────────────────┘
```

#### 4.3.2 渲染器核心类设计

```typescript
// packages/canvas-engine/src/renderer/WebGL2Renderer.ts

class WebGL2Renderer {
  private gl: WebGL2RenderingContext;
  private programs: Map<string, WebGLProgram>;  // Shader 程序缓存
  private bufferCache: Map<NodeId, GPUBufferSet>;
  private textureCache: Map<string, WebGLTexture>;
  private fboPool: FrameBufferPool;  // FBO 对象池（用于效果渲染）

  // ========== 初始化 ==========

  constructor(canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl2', {
      antialias: true,       // 硬件 MSAA
      premultipliedAlpha: true,
      stencil: true,         // 模板缓冲（用于裁切/蒙版）
      depth: false,          // 2D 不需要深度缓冲
    })!;
    this.initShaders();
    this.initGlobalState();
  }

  // ========== 核心渲染循环 ==========

  /**
   * 每帧调用，仅处理脏区域
   * @param viewport 当前视口变换矩阵
   * @param dirtyNodes 本帧需要重绘的节点集合
   */
  render(viewport: ViewportState, renderList: RenderItem[]): void {
    this.gl.clear(GL.COLOR_BUFFER_BIT | GL.STENCIL_BUFFER_BIT);

    // 设置全局视口变换 (projection * view)
    const vpMatrix = this.computeViewProjection(viewport);

    for (const item of renderList) {
      switch (item.renderType) {
        case 'fill':
          this.drawFill(item, vpMatrix);
          break;
        case 'stroke':
          this.drawStroke(item, vpMatrix);
          break;
        case 'text':
          this.drawTextSDF(item, vpMatrix);
          break;
        case 'image':
          this.drawImage(item, vpMatrix);
          break;
        case 'effect':
          this.drawEffect(item, vpMatrix);
          break;
      }
    }

    // 叠加 UI 层（选择框、手柄、标尺等）
    this.drawOverlay(viewport);
  }

  // ========== 几何体上传 ==========

  /**
   * 将 WASM 曲面细分结果上传到 GPU
   */
  uploadTessellation(nodeId: NodeId, vertices: Float32Array, indices: Uint32Array): void {
    let buffers = this.bufferCache.get(nodeId);
    if (!buffers) {
      buffers = this.createBufferSet();
      this.bufferCache.set(nodeId, buffers);
    }
    this.gl.bindBuffer(GL.ARRAY_BUFFER, buffers.vbo);
    this.gl.bufferData(GL.ARRAY_BUFFER, vertices, GL.DYNAMIC_DRAW);
    this.gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, buffers.ibo);
    this.gl.bufferData(GL.ELEMENT_ARRAY_BUFFER, indices, GL.DYNAMIC_DRAW);
    buffers.indexCount = indices.length;
  }
}
```

#### 4.3.3 Shader 程序设计

```glsl
// packages/canvas-engine/src/shaders/fill.vert
#version 300 es
precision highp float;

uniform mat3 u_viewProjection;  // 视口投影矩阵
uniform mat3 u_modelMatrix;     // 节点世界变换

layout(location = 0) in vec2 a_position;

out vec2 v_localPos;

void main() {
  vec3 worldPos = u_viewProjection * u_modelMatrix * vec3(a_position, 1.0);
  gl_Position = vec4(worldPos.xy, 0.0, 1.0);
  v_localPos = a_position;
}
```

```glsl
// packages/canvas-engine/src/shaders/fill.frag
#version 300 es
precision highp float;

// 支持纯色和渐变
uniform int u_paintType;        // 0=solid, 1=linear, 2=radial
uniform vec4 u_color;           // 纯色
uniform sampler2D u_gradientLUT; // 渐变查找表纹理
uniform mat3 u_gradientTransform;
uniform float u_opacity;

in vec2 v_localPos;
out vec4 fragColor;

void main() {
  vec4 color;
  if (u_paintType == 0) {
    color = u_color;
  } else if (u_paintType == 1) {
    // 线性渐变
    vec3 gradPos = u_gradientTransform * vec3(v_localPos, 1.0);
    float t = clamp(gradPos.x, 0.0, 1.0);
    color = texture(u_gradientLUT, vec2(t, 0.5));
  } else {
    // 径向渐变
    vec3 gradPos = u_gradientTransform * vec3(v_localPos, 1.0);
    float t = clamp(length(gradPos.xy), 0.0, 1.0);
    color = texture(u_gradientLUT, vec2(t, 0.5));
  }
  fragColor = color * u_opacity;
}
```

```glsl
// packages/canvas-engine/src/shaders/sdf_text.frag
#version 300 es
precision highp float;

uniform sampler2D u_sdfAtlas;
uniform vec4 u_textColor;
uniform float u_smoothing;  // 根据缩放级别动态调整

in vec2 v_texCoord;
out vec4 fragColor;

void main() {
  float distance = texture(u_sdfAtlas, v_texCoord).r;
  float alpha = smoothstep(0.5 - u_smoothing, 0.5 + u_smoothing, distance);
  fragColor = vec4(u_textColor.rgb, u_textColor.a * alpha);
}
```

#### 4.3.4 视口控制器

```typescript
// packages/canvas-engine/src/viewport/ViewportController.ts

interface ViewportState {
  panX: number;      // 平移 X
  panY: number;      // 平移 Y
  zoom: number;      // 缩放级别 (0.01 ~ 256)
  rotation: number;  // 画布旋转（保留，暂不实现）
}

class ViewportController {
  private state: ViewportState = { panX: 0, panY: 0, zoom: 1, rotation: 0 };
  private animationFrame: number | null = null;
  private inertia: { vx: number; vy: number } = { vx: 0, vy: 0 };

  /** 鼠标滚轮缩放（以光标位置为中心） */
  handleWheel(e: WheelEvent): void {
    if (e.ctrlKey || e.metaKey) {
      // 缩放
      const factor = e.deltaY > 0 ? 0.95 : 1.05;
      const canvasRect = this.canvas.getBoundingClientRect();
      const cursorX = e.clientX - canvasRect.left;
      const cursorY = e.clientY - canvasRect.top;

      // 以光标为中心缩放
      const newZoom = clamp(this.state.zoom * factor, 0.01, 256);
      const scale = newZoom / this.state.zoom;
      this.state.panX = cursorX - scale * (cursorX - this.state.panX);
      this.state.panY = cursorY - scale * (cursorY - this.state.panY);
      this.state.zoom = newZoom;
    } else {
      // 平移
      this.state.panX -= e.deltaX;
      this.state.panY -= e.deltaY;
    }
    this.requestRender();
  }

  /** 屏幕坐标 → 画布坐标 */
  screenToCanvas(screenX: number, screenY: number): Vec2 {
    return {
      x: (screenX - this.state.panX) / this.state.zoom,
      y: (screenY - this.state.panY) / this.state.zoom,
    };
  }

  /** 画布坐标 → 屏幕坐标 */
  canvasToScreen(canvasX: number, canvasY: number): Vec2 {
    return {
      x: canvasX * this.state.zoom + this.state.panX,
      y: canvasY * this.state.zoom + this.state.panY,
    };
  }

  /** 计算 ViewProjection 矩阵给 WebGL */
  getViewProjectionMatrix(): Float32Array {
    // 2D 正交投影 * 视口变换
    const { panX, panY, zoom } = this.state;
    const w = this.canvas.width;
    const h = this.canvas.height;
    // 列主序 mat3
    return new Float32Array([
      2 * zoom / w,  0,               0,
      0,             -2 * zoom / h,   0,
      (2 * panX - w) / w,  (h - 2 * panY) / h,  1,
    ]);
  }
}
```

#### 4.3.5 文本渲染方案

```typescript
// packages/canvas-engine/src/text/SDFTextRenderer.ts

/**
 * 基于 SDF (Signed Distance Field) 的文本渲染
 * 优势：缩放不模糊，GPU 友好
 */
class SDFTextRenderer {
  private atlas: SDFAtlas;
  private fontCache: Map<string, SDFFont>;

  /**
   * 生成 SDF 字体图集
   * 使用 tiny-sdf (JavaScript) 或 Rust WASM 实现
   */
  async loadFont(fontFamily: string, fontData: ArrayBuffer): Promise<void> {
    // 1. 解析字体文件 (使用 opentype.js 或 Rust fontkit)
    // 2. 提取常用字符的轮廓
    // 3. 生成 SDF 纹理图集
    // 4. 上传到 WebGL 纹理
  }

  /**
   * 布局文本（多行、对齐、行高）
   * 委托 WASM 模块进行文本布局计算
   */
  layoutText(text: string, style: TextStyle, maxWidth: number): TextLayout {
    return this.wasmCore.layoutText(text, style, maxWidth);
  }

  /**
   * 渲染文本到当前 WebGL 上下文
   */
  drawText(layout: TextLayout, transform: Matrix2D, viewport: ViewportState): void {
    // 对每个字形：查找 SDF 图集位置 → 生成四边形 → 批量渲染
  }
}
```

### 4.4 矢量编辑工具链

#### 4.4.1 工具状态机

```typescript
// packages/editor-core/src/tools/ToolManager.ts

/** 工具类型枚举 */
enum ToolType {
  Select = 'select',         // V
  DirectSelect = 'direct',   // A (编辑节点)
  Frame = 'frame',           // F
  Rectangle = 'rectangle',   // R
  Ellipse = 'ellipse',       // O
  Polygon = 'polygon',
  Star = 'star',
  Line = 'line',             // L
  Arrow = 'arrow',
  Pen = 'pen',               // P
  Pencil = 'pencil',
  Text = 'text',             // T
  Hand = 'hand',             // H (平移)
  Zoom = 'zoom',             // Z
  Comment = 'comment',       // C
  Eyedropper = 'eyedropper', // I
}

/** 工具接口 - 所有工具必须实现 */
interface ITool {
  type: ToolType;
  cursor: string;             // CSS cursor

  onActivate(): void;
  onDeactivate(): void;

  onPointerDown(e: CanvasPointerEvent): void;
  onPointerMove(e: CanvasPointerEvent): void;
  onPointerUp(e: CanvasPointerEvent): void;
  onDoubleClick(e: CanvasPointerEvent): void;
  onKeyDown(e: KeyboardEvent): void;
  onKeyUp(e: KeyboardEvent): void;

  /** 渲染工具临时图形（如正在拖拽的矩形轮廓） */
  renderOverlay(ctx: OverlayRenderContext): void;
}

class ToolManager {
  private tools: Map<ToolType, ITool> = new Map();
  private activeTool: ITool;
  private previousTool: ITool;  // 用于临时工具切换（如空格按下切手型）

  switchTool(type: ToolType): void {
    this.activeTool.onDeactivate();
    this.previousTool = this.activeTool;
    this.activeTool = this.tools.get(type)!;
    this.activeTool.onActivate();
  }

  /** 临时工具（按住空格切手型，松开恢复） */
  pushTemporaryTool(type: ToolType): void { ... }
  popTemporaryTool(): void { ... }
}
```

#### 4.4.2 选择工具详细设计

```typescript
// packages/editor-core/src/tools/SelectTool.ts

class SelectTool implements ITool {
  type = ToolType.Select;
  cursor = 'default';

  private state: SelectState = { mode: 'idle' };

  onPointerDown(e: CanvasPointerEvent): void {
    const hit = this.documentStore.hitTest(e.canvasPoint);

    if (hit) {
      if (e.shiftKey) {
        // Shift + 点击：切换选中
        this.selectionManager.toggle(hit);
      } else if (!this.selectionManager.isSelected(hit)) {
        // 点击未选中的元素：选中它
        this.selectionManager.select([hit]);
      }
      // 开始拖拽移动
      this.state = {
        mode: 'dragging',
        startPoint: e.canvasPoint,
        initialTransforms: this.captureSelectedTransforms(),
      };
    } else {
      // 空白区域：开始框选
      this.selectionManager.clear();
      this.state = {
        mode: 'marquee',
        startPoint: e.canvasPoint,
        currentPoint: e.canvasPoint,
      };
    }
  }

  onPointerMove(e: CanvasPointerEvent): void {
    switch (this.state.mode) {
      case 'dragging': {
        const dx = e.canvasPoint.x - this.state.startPoint.x;
        const dy = e.canvasPoint.y - this.state.startPoint.y;

        // 智能对齐吸附 (Snap to Guides / Grid / Other Elements)
        const snapped = this.snapEngine.snap({ dx, dy }, this.selectionManager.selected);
        this.moveSelected(snapped.dx, snapped.dy);
        break;
      }
      case 'marquee': {
        this.state.currentPoint = e.canvasPoint;
        // 框选区域内的节点查询
        const rect = BoundingBox.fromPoints(this.state.startPoint, e.canvasPoint);
        const hits = this.documentStore.queryViewport(rect);
        this.selectionManager.setPreview(hits);
        break;
      }
    }
  }

  onPointerUp(e: CanvasPointerEvent): void {
    if (this.state.mode === 'dragging') {
      // 生成移动命令
      const command = new MoveNodesCommand(
        this.selectionManager.selected,
        this.state.initialTransforms,
        this.captureSelectedTransforms()
      );
      this.commandManager.execute(command);
    } else if (this.state.mode === 'marquee') {
      this.selectionManager.confirmPreview();
    }
    this.state = { mode: 'idle' };
  }
}
```

#### 4.4.3 钢笔工具（Vector Network 支持）

```typescript
// packages/editor-core/src/tools/PenTool.ts

/**
 * 钢笔工具 - 支持 Figma 风格的 Vector Network
 * 关键区别：不只是简单的路径，而是一个节点+边的网络图
 */
interface VectorNetwork {
  vertices: VectorVertex[];     // 节点列表
  segments: VectorSegment[];    // 边列表（可连接任意两个节点）
  regions: VectorRegion[];      // 闭合区域（用于填充）
}

interface VectorVertex {
  x: number;
  y: number;
  handleIn?: Vec2;              // 入方向控制柄
  handleOut?: Vec2;             // 出方向控制柄
  cornerRadius: number;
}

interface VectorSegment {
  start: number;                // 起点节点索引
  end: number;                  // 终点节点索引
  // 贝塞尔控制点（null 表示直线）
  tangentStart?: Vec2;
  tangentEnd?: Vec2;
}

class PenTool implements ITool {
  type = ToolType.Pen;
  cursor = 'crosshair';

  private editingNodeId: NodeId | null = null;
  private network: VectorNetwork | null = null;
  private activeVertexIndex: number = -1;
  private isDraggingHandle: boolean = false;

  onPointerDown(e: CanvasPointerEvent): void {
    if (!this.editingNodeId) {
      // 创建新的矢量节点
      this.editingNodeId = this.createVectorNode(e.canvasPoint);
      this.network = { vertices: [], segments: [], regions: [] };
    }

    const hitVertex = this.hitTestVertex(e.canvasPoint);
    if (hitVertex !== null) {
      if (hitVertex === 0 && this.network!.vertices.length > 2) {
        // 闭合路径
        this.closePath();
        return;
      }
      // 从现有节点延伸新边
      this.activeVertexIndex = hitVertex;
    } else {
      // 添加新节点
      const newVertex: VectorVertex = {
        x: e.canvasPoint.x,
        y: e.canvasPoint.y,
        cornerRadius: 0,
      };
      this.network!.vertices.push(newVertex);
      const newIndex = this.network!.vertices.length - 1;

      // 如果有活跃节点，创建边
      if (this.activeVertexIndex >= 0) {
        this.network!.segments.push({
          start: this.activeVertexIndex,
          end: newIndex,
        });
      }
      this.activeVertexIndex = newIndex;
    }
    this.isDraggingHandle = true;
  }

  onPointerMove(e: CanvasPointerEvent): void {
    if (this.isDraggingHandle && this.activeVertexIndex >= 0) {
      // 拖拽时调整控制柄（创建曲线）
      const vertex = this.network!.vertices[this.activeVertexIndex];
      const dx = e.canvasPoint.x - vertex.x;
      const dy = e.canvasPoint.y - vertex.y;
      vertex.handleOut = { x: dx, y: dy };
      vertex.handleIn = { x: -dx, y: -dy };  // 对称控制柄
      this.updatePreview();
    }
  }
}
```

#### 4.4.4 布尔运算流程

```typescript
// packages/editor-core/src/operations/BooleanOps.ts

class BooleanOperations {
  private wasmCore: WasmCoreModule;

  /**
   * 执行布尔运算
   * 1. 将选中的路径序列化为 WASM 可处理的格式
   * 2. 调用 WASM i_overlay 库计算
   * 3. 结果转换回 VectorPath
   * 4. 生成 BooleanNode 命令
   */
  async execute(
    operation: 'union' | 'subtract' | 'intersect' | 'exclude',
    nodeIds: NodeId[]
  ): Promise<Command> {
    // 收集所有参与运算的路径
    const paths = nodeIds.map(id => {
      const node = this.store.getNode(id);
      return this.nodeToWasmPath(node);
    });

    // 调用 WASM 布尔运算
    const resultPaths = this.wasmCore.booleanOperation(
      operation,
      paths
    );

    // 创建 BooleanNode
    return new CreateBooleanNodeCommand({
      operation,
      sourceNodeIds: nodeIds,
      resultPaths: this.wasmPathsToVectorPaths(resultPaths),
    });
  }
}
```

#### 4.4.5 对齐与吸附引擎

```typescript
// packages/editor-core/src/tools/snap/SnapEngine.ts

interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];   // 要显示的参考线
}

interface SnapGuide {
  type: 'horizontal' | 'vertical' | 'distance';
  position: number;
  label?: string;        // 距离标签
}

class SnapEngine {
  private threshold = 4;  // 像素阈值（屏幕空间）

  snap(movement: Vec2, selectedIds: NodeId[]): SnapResult {
    const selectedBounds = this.getUnionBounds(selectedIds);
    const candidateEdges = this.collectCandidateEdges(selectedIds);

    let bestDx = movement.dx;
    let bestDy = movement.dy;
    const guides: SnapGuide[] = [];

    // 检查水平对齐（左、中、右边缘）
    for (const edge of ['left', 'centerX', 'right'] as const) {
      const movingEdge = this.getEdgeAfterMove(selectedBounds, edge, movement);
      for (const candidate of candidateEdges.vertical) {
        const dist = Math.abs(movingEdge - candidate.position);
        if (dist < this.threshold / this.viewport.zoom) {
          bestDx = movement.dx + (candidate.position - movingEdge);
          guides.push({ type: 'vertical', position: candidate.position });
        }
      }
    }

    // 同理检查垂直对齐...
    // 智能间距检测...

    return { dx: bestDx, dy: bestDy, guides };
  }
}
```

### 4.5 AI 集成层

#### 4.5.1 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Integration Layer                       │
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │  Model       │    │  Context     │    │  DSL          │  │
│  │  Config      │───►│  Builder     │───►│  Compiler     │  │
│  │  Manager     │    │              │    │               │  │
│  └─────────────┘    └──────────────┘    └───────┬────────┘  │
│                                                  │          │
│  ┌─────────────┐    ┌──────────────┐    ┌───────▼────────┐  │
│  │  API Client  │◄──│  Prompt      │◄──│  Response     │  │
│  │  (OpenAI     │    │  Template    │    │  Parser       │  │
│  │   Compatible)│───►│  Engine      │───►│  & Validator  │  │
│  └─────────────┘    └──────────────┘    └───────┬────────┘  │
│                                                  │          │
│                                         ┌───────▼────────┐  │
│                                         │  Command       │  │
│                                         │  Generator     │  │
│                                         │  (DSL → Cmds)  │  │
│                                         └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### 4.5.2 模型配置管理器

```typescript
// packages/ai-integration/src/config/ModelConfigManager.ts

interface ModelConfig {
  id: string;
  name: string;           // 用户自定义的配置名称
  baseUrl: string;        // API 网关地址
  modelName: string;      // 模型名称
  apiKeyRef: string;      // 指向 Tauri 密钥存储的引用 ID
  maxTokens: number;
  temperature: number;
  topP: number;
  systemPromptOverride?: string; // 允许用户自定义系统提示
}

class ModelConfigManager {
  private configs: Map<string, ModelConfig> = new Map();
  private activeConfigId: string | null = null;

  /** 保存配置（API Key 通过 Tauri IPC 存入系统钥匙串） */
  async saveConfig(config: ModelConfig, apiKey: string): Promise<void> {
    // API Key 存入系统钥匙串
    await invoke('store_api_key', {
      profileId: config.id,
      key: apiKey,
    });

    // 配置元数据存入 localStorage（不含 API Key）
    this.configs.set(config.id, config);
    this.persistToLocalStorage();
  }

  /** 测试连接 */
  async testConnection(configId: string): Promise<{
    success: boolean;
    latency: number;
    error?: string;
    models?: string[];
  }> {
    const config = this.configs.get(configId)!;
    const apiKey = await invoke<string>('retrieve_api_key', { profileId: config.id });

    const start = performance.now();
    try {
      const response = await fetch(`${config.baseUrl}/v1/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const data = await response.json();
      return {
        success: true,
        latency: performance.now() - start,
        models: data.data?.map((m: any) => m.id),
      };
    } catch (err) {
      return { success: false, latency: 0, error: String(err) };
    }
  }
}
```

#### 4.5.3 Design DSL 规范

这是 AI 与画布之间的桥梁语言。LLM 生成此 DSL，前端解析并转换为 Command 执行。

```typescript
// packages/ai-integration/src/dsl/schema.ts

/**
 * Viga Design DSL v1.0
 *
 * 设计原则：
 * 1. 足够简洁让 LLM 低错率生成
 * 2. 语义化属性名，LLM 可推理
 * 3. 所有坐标/尺寸使用绝对像素值
 * 4. 支持引用已有元素（通过 ID）
 */

interface VigaDSL {
  version: '1.0';
  operations: DSLOperation[];
}

type DSLOperation =
  | CreateOperation
  | ModifyOperation
  | DeleteOperation
  | GroupOperation
  | AlignOperation
  | StyleOperation;

/** 创建元素 */
interface CreateOperation {
  action: 'create';
  element: DSLElement;
  parentId?: string;          // 放入指定容器
  insertIndex?: number;       // 插入位置
}

/** 修改元素属性 */
interface ModifyOperation {
  action: 'modify';
  targetId: string;           // 目标元素 ID
  properties: Partial<DSLElementProperties>;
}

/** 删除元素 */
interface DeleteOperation {
  action: 'delete';
  targetId: string;
}

/** 编组 */
interface GroupOperation {
  action: 'group';
  elementIds: string[];
  name: string;
}

/** 对齐/排列 */
interface AlignOperation {
  action: 'align';
  elementIds: string[];
  alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
    | 'distribute-h' | 'distribute-v';
}

/** DSL 元素定义 */
interface DSLElement {
  id: string;                 // AI 分配的临时 ID
  type: 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'path' | 'text'
    | 'frame' | 'polygon' | 'star' | 'group';
  name?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;          // 度数

  // 路径（仅 type=path）
  pathData?: string;          // SVG path d 属性语法

  // 文本（仅 type=text）
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;

  // 通用样式
  fill?: string | DSLGradient; // "#FF0000" 或渐变对象
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  cornerRadius?: number | [number, number, number, number];
  shadow?: DSLShadow;

  // 子元素（frame/group）
  children?: DSLElement[];

  // Auto Layout（仅 frame）
  autoLayout?: {
    direction: 'horizontal' | 'vertical';
    gap: number;
    padding: number | [number, number, number, number];
    align: 'start' | 'center' | 'end' | 'space-between';
  };

  // 箭头（仅 line/arrow）
  startArrow?: boolean;
  endArrow?: boolean;

  // 多边形/星形
  sides?: number;
  innerRadiusRatio?: number;
}

interface DSLGradient {
  type: 'linear' | 'radial';
  angle?: number;             // 线性渐变角度
  stops: { offset: number; color: string }[];
}

interface DSLShadow {
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread?: number;
}
```

**DSL 示例**（AI 生成一个简单的登录框）：

```json
{
  "version": "1.0",
  "operations": [
    {
      "action": "create",
      "element": {
        "id": "login_frame",
        "type": "frame",
        "name": "Login Card",
        "x": 400,
        "y": 200,
        "width": 360,
        "height": 400,
        "fill": "#FFFFFF",
        "cornerRadius": 16,
        "shadow": { "color": "rgba(0,0,0,0.1)", "offsetX": 0, "offsetY": 4, "blur": 24 },
        "autoLayout": {
          "direction": "vertical",
          "gap": 16,
          "padding": [32, 32, 32, 32],
          "align": "center"
        },
        "children": [
          {
            "id": "title",
            "type": "text",
            "name": "Title",
            "x": 0, "y": 0,
            "text": "Welcome Back",
            "fontSize": 24,
            "fontWeight": 700,
            "fill": "#1A1A1A",
            "textAlign": "center"
          },
          {
            "id": "email_input",
            "type": "frame",
            "name": "Email Input",
            "x": 0, "y": 0,
            "width": 296,
            "height": 44,
            "fill": "#F5F5F5",
            "cornerRadius": 8,
            "stroke": "#E0E0E0",
            "strokeWidth": 1,
            "children": [
              {
                "id": "email_placeholder",
                "type": "text",
                "x": 12, "y": 12,
                "text": "Email address",
                "fontSize": 14,
                "fill": "#999999"
              }
            ]
          },
          {
            "id": "login_button",
            "type": "frame",
            "name": "Login Button",
            "x": 0, "y": 0,
            "width": 296,
            "height": 44,
            "fill": "#3B82F6",
            "cornerRadius": 8,
            "autoLayout": { "direction": "horizontal", "gap": 0, "padding": 0, "align": "center" },
            "children": [
              {
                "id": "btn_text",
                "type": "text",
                "x": 0, "y": 0,
                "text": "Log In",
                "fontSize": 16,
                "fontWeight": 600,
                "fill": "#FFFFFF",
                "textAlign": "center"
              }
            ]
          }
        ]
      }
    }
  ]
}
```

#### 4.5.4 上下文构建器

```typescript
// packages/ai-integration/src/context/ContextBuilder.ts

/**
 * 将画布状态序列化为 AI 可理解的上下文
 * 遵循"最小必要"原则 - 只发送必要的信息
 */
class ContextBuilder {
  /**
   * 为选中元素构建上下文
   * 输出简化的 JSON 结构，而非完整的内部数据结构
   */
  buildSelectionContext(selectedIds: NodeId[]): string {
    const elements = selectedIds.map(id => {
      const node = this.store.getNode(id)!;
      return this.simplifyNode(node);
    });

    return JSON.stringify({
      selectedElements: elements,
      canvasSize: this.getVisibleCanvasSize(),
      existingColors: this.extractUsedColors(),  // 帮助 AI 保持配色一致
    }, null, 2);
  }

  /**
   * 为全局生成构建上下文
   * 包含画布概览但不包含详细属性
   */
  buildGlobalContext(): string {
    const overview = this.store.getAllNodes().map(node => ({
      id: node.id,
      type: node.type,
      name: node.name,
      bounds: this.getBounds(node),
    }));

    return JSON.stringify({
      canvasOverview: overview,
      canvasSize: this.getVisibleCanvasSize(),
    }, null, 2);
  }

  /** 将内部节点简化为 AI 友好的格式 */
  private simplifyNode(node: SceneNode): object {
    // 只保留 AI 需要知道的属性
    const base = {
      id: node.id,
      type: node.type,
      name: node.name,
      x: this.getAbsoluteX(node),
      y: this.getAbsoluteY(node),
      width: (node as any).width,
      height: (node as any).height,
    };

    // 添加类型特定属性
    if (node.type === 'text') {
      return { ...base, text: (node as TextNode).characters, fontSize: (node as TextNode).textStyle.fontSize };
    }
    if (node.fills.length > 0) {
      return { ...base, fill: this.simplifyPaint(node.fills[0]) };
    }
    return base;
  }
}
```

#### 4.5.5 Prompt 模板引擎

```typescript
// packages/ai-integration/src/prompt/PromptEngine.ts

class PromptEngine {
  /**
   * 构建完整的系统提示词
   */
  buildSystemPrompt(locale: 'zh' | 'en'): string {
    return `You are Viga AI, an expert vector design assistant embedded in a professional vector graphics editor.

## Your Capabilities
You generate and modify designs by outputting structured JSON operations in the Viga DSL format.

## Output Rules
1. ALWAYS respond with valid JSON wrapped in \`\`\`json code blocks
2. Use the exact Viga DSL schema provided below
3. All coordinates are in pixels, origin is top-left
4. Colors use hex (#RRGGBB) or rgba() format
5. When modifying existing elements, reference them by their "id"
6. Maintain visual consistency with existing elements on canvas

## Viga DSL Schema
${this.getDSLSchemaDoc()}

## Design Best Practices
- Use 8px grid alignment for professional layouts
- Maintain consistent spacing (8, 12, 16, 24, 32px)
- Use a limited, harmonious color palette
- Ensure sufficient contrast for readability
- Group related elements logically

## Current Context
{context}

## User Request
{userMessage}`;
  }

  /**
   * 构建消息序列
   */
  buildMessages(
    userMessage: string,
    context: string,
    conversationHistory: ChatMessage[]
  ): OpenAIMessage[] {
    const systemPrompt = this.buildSystemPrompt('en')
      .replace('{context}', context)
      .replace('{userMessage}', '');

    return [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: userMessage },
    ];
  }
}
```

#### 4.5.6 API 客户端与流式处理

```typescript
// packages/ai-integration/src/client/OpenAICompatibleClient.ts

class OpenAICompatibleClient {
  /**
   * 流式请求 - 支持 SSE
   * 返回 AsyncGenerator，允许逐 token 处理
   */
  async *streamChat(
    config: ModelConfig,
    messages: OpenAIMessage[]
  ): AsyncGenerator<StreamChunk> {
    const apiKey = await invoke<string>('retrieve_api_key', {
      profileId: config.id,
    });

    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelName,
        messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        top_p: config.topP,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new APIError(response.status, await response.text());
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield { type: 'content', content };
            }
          } catch {
            // 忽略解析错误的行
          }
        }
      }
    }
  }
}
```

#### 4.5.7 DSL 编译器与命令生成器

```typescript
// packages/ai-integration/src/dsl/DSLCompiler.ts

class DSLCompiler {
  /**
   * 从 AI 响应文本中提取并解析 DSL
   */
  extractDSL(responseText: string): VigaDSL | null {
    // 提取 ```json ... ``` 代码块
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) return null;

    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return this.validate(parsed);
    } catch (e) {
      // 尝试修复常见的 JSON 错误（尾随逗号等）
      return this.tryRepair(jsonMatch[1]);
    }
  }

  /**
   * 将 DSL 编译为编辑器命令序列
   */
  compile(dsl: VigaDSL): CompositeCommand {
    const commands: Command[] = [];

    for (const op of dsl.operations) {
      switch (op.action) {
        case 'create':
          commands.push(...this.compileCreate(op));
          break;
        case 'modify':
          commands.push(this.compileModify(op));
          break;
        case 'delete':
          commands.push(this.compileDelete(op));
          break;
        case 'group':
          commands.push(this.compileGroup(op));
          break;
        case 'align':
          commands.push(this.compileAlign(op));
          break;
      }
    }

    // 包装为复合命令，支持整体 undo/redo
    return new CompositeCommand('AI Operation', commands);
  }

  private compileCreate(op: CreateOperation): Command[] {
    const commands: Command[] = [];
    const element = op.element;

    // 递归处理（Frame 可能有 children）
    const node = this.dslElementToSceneNode(element);
    commands.push(new CreateNodeCommand(node, op.parentId, op.insertIndex));

    if (element.children) {
      for (const child of element.children) {
        commands.push(...this.compileCreate({
          action: 'create',
          element: child,
          parentId: element.id,
        }));
      }
    }

    return commands;
  }

  /** DSL 元素 → 场景节点 */
  private dslElementToSceneNode(element: DSLElement): SceneNode {
    switch (element.type) {
      case 'rectangle':
        return {
          id: nanoid(),
          type: 'rectangle',
          name: element.name || 'Rectangle',
          transform: createTranslation(element.x, element.y),
          width: element.width!,
          height: element.height!,
          cornerRadii: this.parseCornerRadius(element.cornerRadius),
          fills: element.fill ? [this.parsePaint(element.fill)] : [],
          strokes: element.stroke ? [this.parseStroke(element)] : [],
          effects: element.shadow ? [this.parseShadow(element.shadow)] : [],
          // ... 其他默认值
        } as RectangleNode;

      case 'text':
        return {
          id: nanoid(),
          type: 'text',
          name: element.name || element.text?.slice(0, 20) || 'Text',
          transform: createTranslation(element.x, element.y),
          characters: element.text || '',
          textStyle: {
            fontFamily: element.fontFamily || 'Inter',
            fontWeight: element.fontWeight || 400,
            fontSize: element.fontSize || 14,
            lineHeight: element.lineHeight || 'auto',
            letterSpacing: 0,
            textDecoration: 'none',
            textAlign: element.textAlign || 'left',
          },
          fills: element.fill ? [this.parsePaint(element.fill)] : [{ type: 'solid', color: { r: 0, g: 0, b: 0, a: 1 } }],
          // ...
        } as TextNode;

      // ... 其他类型
    }
  }
}
```

#### 4.5.8 AI 操作的预览/接受/拒绝机制

```typescript
// packages/ai-integration/src/preview/AIPreviewManager.ts

enum AIPreviewState {
  Idle = 'idle',
  Streaming = 'streaming',      // AI 正在生成
  Preview = 'preview',          // 生成完毕，等待用户确认
  Accepted = 'accepted',
  Rejected = 'rejected',
}

class AIPreviewManager {
  private state: AIPreviewState = AIPreviewState.Idle;
  private pendingCommand: CompositeCommand | null = null;
  private snapshotBeforeAI: DocumentSnapshot | null = null;

  /**
   * 开始 AI 操作
   * 保存当前文档快照作为回滚点
   */
  beginAIOperation(): void {
    this.snapshotBeforeAI = this.documentStore.createSnapshot();
    this.state = AIPreviewState.Streaming;
  }

  /**
   * AI 流式生成过程中的增量应用
   * 每当解析出完整的 DSL 操作时调用
   */
  applyIncremental(command: Command): void {
    // 在"预览层"执行，不进入正式 undo 栈
    command.execute(this.documentStore);
    this.pendingCommand?.addSubCommand(command);
  }

  /**
   * AI 生成完毕，进入预览状态
   */
  finishStreaming(command: CompositeCommand): void {
    this.pendingCommand = command;
    this.state = AIPreviewState.Preview;

    // UI 层显示 "Accept / Reject / Retry" 按钮
    // 同时可以高亮显示 AI 新增/修改的元素
    this.highlightAIChanges(command);
  }

  /**
   * 用户接受 AI 修改
   */
  accept(): void {
    if (this.pendingCommand) {
      // 正式推入 undo 栈
      this.commandManager.pushExecuted(this.pendingCommand);
    }
    this.cleanup();
    this.state = AIPreviewState.Accepted;
  }

  /**
   * 用户拒绝 AI 修改
   */
  reject(): void {
    if (this.snapshotBeforeAI) {
      // 回滚到 AI 操作前的状态
      this.documentStore.restoreSnapshot(this.snapshotBeforeAI);
    }
    this.cleanup();
    this.state = AIPreviewState.Rejected;
  }

  /**
   * 高亮 AI 变更的元素（diff 视觉反馈）
   */
  private highlightAIChanges(command: CompositeCommand): void {
    const affectedIds = command.getAffectedNodeIds();
    this.renderer.setHighlightOverlay(affectedIds, {
      strokeColor: '#7C3AED',   // 紫色高亮框
      strokeDash: [4, 4],
      label: 'AI Generated',
    });
  }
}
```

### 4.6 文件 I/O 模块

#### 4.6.1 导出管线

```typescript
// packages/file-io/src/export/ExportManager.ts

class ExportManager {
  /**
   * SVG 导出
   * 场景图 → SVG DOM 字符串
   */
  async exportSVG(
    nodes: SceneNode[],
    options: SVGExportOptions
  ): Promise<string> {
    const serializer = new SVGSerializer(options);
    return serializer.serialize(nodes);
  }

  /**
   * PDF 导出（委托 Tauri 后端）
   */
  async exportPDF(
    nodes: SceneNode[],
    options: PDFExportOptions
  ): Promise<void> {
    const documentJson = this.serializeForPDF(nodes);
    const outputPath = await invoke<string>('show_save_dialog', {
      defaultName: `${this.documentName}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (outputPath) {
      await invoke('export_pdf', {
        documentJson: JSON.stringify(documentJson),
        outputPath,
      });
    }
  }

  /**
   * PNG/JPEG 导出
   * 利用 WebGL readPixels 或离屏 Canvas
   */
  async exportRaster(
    nodes: SceneNode[],
    options: RasterExportOptions
  ): Promise<Blob> {
    const { width, height, scale, format } = options;

    // 创建离屏 WebGL 渲染目标
    const offscreen = this.renderer.createOffscreenTarget(
      width * scale,
      height * scale
    );

    // 渲染选中节点到离屏目标
    this.renderer.renderToTarget(offscreen, nodes, scale);

    // 读取像素数据
    const pixels = this.renderer.readPixels(offscreen);

    // 编码为 PNG/JPEG
    return this.encodeImage(pixels, width * scale, height * scale, format);
  }
}
```

#### 4.6.2 SVG 导入解析

```typescript
// packages/file-io/src/import/SVGImporter.ts

class SVGImporter {
  private wasmCore: WasmCoreModule;  // usvg WASM 实例

  /**
   * 导入 SVG 文件并转换为场景图节点
   *
   * 流程：
   * 1. usvg (WASM) 将 SVG 规范化（解析样式、展开引用、处理变换）
   * 2. 遍历规范化的树结构
   * 3. 映射为 Viga 场景节点
   */
  async import(svgContent: string): Promise<SceneNode[]> {
    // Step 1: usvg 规范化
    const normalizedTree = this.wasmCore.parseSVG(svgContent);

    // Step 2: 遍历并映射
    return this.convertTree(normalizedTree);
  }

  private convertTree(usvgNode: UsvgNode): SceneNode[] {
    const nodes: SceneNode[] = [];

    for (const child of usvgNode.children) {
      switch (child.type) {
        case 'path':
          nodes.push(this.convertPath(child));
          break;
        case 'text':
          nodes.push(this.convertText(child));
          break;
        case 'image':
          nodes.push(this.convertImage(child));
          break;
        case 'group':
          nodes.push(this.convertGroup(child));
          break;
      }
    }

    return nodes;
  }

  private convertPath(usvgPath: UsvgPath): VectorNode {
    return {
      id: nanoid(),
      type: 'vector',
      name: usvgPath.id || 'Path',
      transform: this.convertTransform(usvgPath.transform),
      vectorPaths: [{
        commands: this.parseSVGPathData(usvgPath.d),
        closed: usvgPath.d.endsWith('Z') || usvgPath.d.endsWith('z'),
      }],
      windingRule: usvgPath.fillRule === 'evenodd' ? 'evenodd' : 'nonzero',
      fills: usvgPath.fill ? [this.convertPaint(usvgPath.fill)] : [],
      strokes: usvgPath.stroke ? [this.convertStroke(usvgPath.stroke)] : [],
      effects: [],
      // ... 其他属性
    };
  }
}
```

#### 4.6.3 项目文件管理

```typescript
// packages/file-io/src/project/ProjectManager.ts

class ProjectManager {
  private currentProject: ProjectFile | null = null;
  private recentFiles: RecentFileEntry[] = [];
  private autoSaveInterval: number = 30000; // 30秒自动保存
  private autoSaveTimer: number | null = null;

  /**
   * 保存项目 (.viga 格式)
   */
  async save(path?: string): Promise<void> {
    const savePath = path || this.currentProject?.path;
    if (!savePath) {
      return this.saveAs();
    }

    // 序列化文档
    const documentJson = this.documentStore.serialize();
    const assets = this.assetStore.collectEmbeddedAssets();
    const thumbnail = await this.renderer.generateThumbnail(400, 300);

    // 打包为 ZIP (通过 Tauri 后端)
    await invoke('save_project', {
      path: savePath,
      document: documentJson,
      assets,
      thumbnail,
    });

    this.currentProject = { path: savePath, lastSaved: Date.now() };
    this.addToRecent(savePath);
  }

  /**
   * 启用自动保存
   */
  enableAutoSave(): void {
    this.autoSaveTimer = window.setInterval(() => {
      if (this.currentProject?.path && this.documentStore.isDirty()) {
        this.save();
      }
    }, this.autoSaveInterval);
  }
}
```

### 4.7 UI 界面层

#### 4.7.1 布局架构

```
┌─────────────────────────────────────────────────────────────────┐
│  Menu Bar (File | Edit | View | Insert | AI | Help)             │
├────────┬──────────────────────────────────┬─────────────────────┤
│        │                                  │                     │
│ Tool   │                                  │   Properties Panel  │
│ Bar    │                                  │   ┌───────────────┐ │
│        │                                  │   │  Alignment    │ │
│ [V]    │                                  │   │  ───────────  │ │
│ [F]    │        Canvas (WebGL2)           │   │  Position     │ │
│ [R]    │                                  │   │  X: ___ Y:___ │ │
│ [O]    │                                  │   │  W: ___ H:___ │ │
│ [L]    │                                  │   │  ───────────  │ │
│ [P]    │                                  │   │  Fill         │ │
│ [T]    │                                  │   │  [■] #3B82F6  │ │
│ [H]    │                                  │   │  ───────────  │ │
│        │                                  │   │  Stroke       │ │
│        │                                  │   │  ───────────  │ │
│        │                                  │   │  Effects      │ │
│        │                                  │   │  ───────────  │ │
│        │                                  │   │  Export       │ │
│        │                                  │   └───────────────┘ │
│        │                                  │                     │
├────────┼──────────────────────────────────┤                     │
│        │  Layer Panel                     │                     │
│        │  ▼ Page 1                        │                     │
│        │    ▼ Frame "Login Card"          │                     │
│        │      ◻ Title                     │                     │
│        │      ◻ Email Input               │                     │
│        │      ◻ Login Button              │                     │
│        │                                  │                     │
├────────┴──────────────────────────────────┴─────────────────────┤
│  AI Chat Panel (可折叠/浮动)                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 🤖 AI: I've created a login card. Shall I adjust anything?│  │
│  │ 📝 You: Make the button gradient blue to purple           │  │
│  │ [____________________________] [Send] [⚙ Model: GPT-4o]  │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.7.2 React 组件架构

```
App
├── MenuBar
├── MainLayout
│   ├── ToolBar (左侧工具栏)
│   ├── CenterArea
│   │   ├── RulerH (水平标尺)
│   │   ├── RulerV (垂直标尺)
│   │   ├── CanvasContainer
│   │   │   └── <canvas> (WebGL2 - 由引擎直接管理)
│   │   └── OverlayUI (浮动在画布上的 React 元素)
│   │       ├── SelectionOverlay
│   │       ├── ContextMenu
│   │       ├── AIInlinePopover (选中元素时的 AI 快捷面板)
│   │       └── SnapGuides (对齐参考线)
│   ├── RightPanel
│   │   ├── PropertiesPanel
│   │   │   ├── AlignmentSection
│   │   │   ├── TransformSection
│   │   │   ├── FillSection
│   │   │   ├── StrokeSection
│   │   │   ├── TextSection
│   │   │   ├── EffectsSection
│   │   │   ├── AutoLayoutSection
│   │   │   └── ExportSection
│   │   └── DesignTokensPanel (颜色/样式库)
│   └── BottomPanel (可折叠)
│       ├── LayerTree
│       └── PageTabs
├── AIPanel (可折叠侧边/底部/浮动)
│   ├── ChatHistory
│   ├── ChatInput
│   ├── ModelSelector
│   └── PreviewControls (Accept/Reject/Retry)
├── SettingsDialog
│   ├── ModelConfigPage
│   ├── KeyboardShortcutsPage
│   ├── LanguagePage
│   └── AppearancePage
└── CommandPalette (Cmd+K 呼出)
```

#### 4.7.3 Zustand Store 设计

```typescript
// packages/editor-core/src/stores/index.ts

/** 文档状态 Store */
interface DocumentStoreState {
  document: Document | null;
  nodeMap: Map<NodeId, SceneNode>;

  // Actions
  loadDocument: (doc: Document) => void;
  applyCommand: (cmd: Command) => void;
  undo: () => void;
  redo: () => void;
}

/** 选择状态 Store */
interface SelectionStoreState {
  selectedIds: Set<NodeId>;
  hoveredId: NodeId | null;

  select: (ids: NodeId[]) => void;
  toggle: (id: NodeId) => void;
  clear: () => void;
  setHovered: (id: NodeId | null) => void;
}

/** 工具状态 Store */
interface ToolStoreState {
  activeTool: ToolType;
  toolOptions: Record<ToolType, any>;

  setTool: (type: ToolType) => void;
  setToolOption: (tool: ToolType, key: string, value: any) => void;
}

/** 视口状态 Store */
interface ViewportStoreState {
  panX: number;
  panY: number;
  zoom: number;

  setPan: (x: number, y: number) => void;
  setZoom: (zoom: number, center?: Vec2) => void;
  zoomToFit: (bounds: BoundingBox) => void;
}

/** AI 状态 Store */
interface AIStoreState {
  activeConfigId: string | null;
  chatHistory: ChatMessage[];
  isStreaming: boolean;
  previewState: AIPreviewState;
  streamedContent: string;

  sendMessage: (message: string) => Promise<void>;
  acceptAIChanges: () => void;
  rejectAIChanges: () => void;
  retryLastMessage: () => void;
}

/** UI 状态 Store */
interface UIStoreState {
  rightPanelVisible: boolean;
  layerPanelVisible: boolean;
  aiPanelVisible: boolean;
  aiPanelPosition: 'bottom' | 'right' | 'float';
  theme: 'light' | 'dark' | 'system';
  locale: 'en' | 'zh';

  togglePanel: (panel: string) => void;
  setTheme: (theme: string) => void;
  setLocale: (locale: string) => void;
}

// 使用 Zustand 创建 Store
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export const useDocumentStore = create<DocumentStoreState>()(
  immer((set, get) => ({
    document: null,
    nodeMap: new Map(),

    applyCommand: (cmd) => {
      set(state => {
        cmd.execute(state);
        commandHistory.push(cmd);
      });
    },

    undo: () => {
      const cmd = commandHistory.undo();
      if (cmd) {
        set(state => { cmd.undo(state); });
      }
    },

    redo: () => {
      const cmd = commandHistory.redo();
      if (cmd) {
        set(state => { cmd.execute(state); });
      }
    },
  }))
);
```

#### 4.7.4 快捷键系统

```typescript
// packages/editor-core/src/shortcuts/ShortcutManager.ts

interface ShortcutBinding {
  key: string;            // 'v', 'p', 'delete', 'ctrl+z' etc.
  command: string;        // 命令标识符
  when?: string;          // 条件表达式 'toolActive:select && hasSelection'
}

/** Figma 兼容默认快捷键 */
const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
  // 工具
  { key: 'v', command: 'tool.select' },
  { key: 'a', command: 'tool.directSelect' },
  { key: 'f', command: 'tool.frame' },
  { key: 'r', command: 'tool.rectangle' },
  { key: 'o', command: 'tool.ellipse' },
  { key: 'l', command: 'tool.line' },
  { key: 'p', command: 'tool.pen' },
  { key: 't', command: 'tool.text' },
  { key: 'h', command: 'tool.hand' },
  { key: 'i', command: 'tool.eyedropper' },

  // 编辑
  { key: 'mod+z', command: 'edit.undo' },
  { key: 'mod+shift+z', command: 'edit.redo' },
  { key: 'mod+c', command: 'edit.copy' },
  { key: 'mod+v', command: 'edit.paste' },
  { key: 'mod+x', command: 'edit.cut' },
  { key: 'mod+d', command: 'edit.duplicate' },
  { key: 'mod+a', command: 'edit.selectAll' },
  { key: 'delete', command: 'edit.delete' },
  { key: 'backspace', command: 'edit.delete' },

  // 组织
  { key: 'mod+g', command: 'organize.group' },
  { key: 'mod+shift+g', command: 'organize.ungroup' },
  { key: ']', command: 'organize.bringForward' },
  { key: '[', command: 'organize.sendBackward' },
  { key: 'mod+]', command: 'organize.bringToFront' },
  { key: 'mod+[', command: 'organize.sendToBack' },

  // 视口
  { key: 'mod+0', command: 'viewport.zoomToFit' },
  { key: 'mod+1', command: 'viewport.zoomTo100' },
  { key: 'mod+=', command: 'viewport.zoomIn' },
  { key: 'mod+-', command: 'viewport.zoomOut' },

  // 布尔运算
  { key: 'mod+e', command: 'boolean.flatten' },

  // AI
  { key: 'mod+/', command: 'ai.togglePanel' },
  { key: 'mod+shift+a', command: 'ai.inlineAssistant', when: 'hasSelection' },

  // 导出
  { key: 'mod+shift+e', command: 'export.selection' },
];

class ShortcutManager {
  private bindings: Map<string, ShortcutBinding[]> = new Map();

  /**
   * 将平台无关的 'mod' 转换为实际修饰键
   * macOS: mod → Meta (⌘)
   * Windows/Linux: mod → Ctrl
   */
  private normalizeKey(key: string): string {
    const isMac = navigator.platform.includes('Mac');
    return key.replace(/mod/g, isMac ? 'meta' : 'ctrl');
  }

  handleKeyDown(e: KeyboardEvent): boolean {
    const combo = this.eventToCombo(e);
    const bindings = this.bindings.get(combo);
    if (!bindings) return false;

    for (const binding of bindings) {
      if (this.evaluateCondition(binding.when)) {
        e.preventDefault();
        this.commandRegistry.execute(binding.command);
        return true;
      }
    }
    return false;
  }
}
```

### 4.8 插件系统

#### 4.8.1 插件 API 设计

```typescript
// packages/plugin-api/src/types.ts

/**
 * Viga 插件 Manifest
 */
interface PluginManifest {
  id: string;                     // 唯一标识 "com.example.my-plugin"
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;                   // 入口文件路径
  permissions: PluginPermission[];
  ui?: {
    panel?: string;               // 面板 HTML 文件路径
    width?: number;
    height?: number;
  };
}

type PluginPermission =
  | 'document:read'       // 读取文档数据
  | 'document:write'      // 修改文档
  | 'selection:read'      // 读取选择状态
  | 'network:fetch'       // 网络请求
  | 'storage:local'       // 本地存储
  | 'ui:notify'           // 显示通知
  | 'ui:panel';           // 创建 UI 面板

/**
 * 插件沙箱 API
 * 通过 postMessage 与主线程通信
 */
interface VigaPluginAPI {
  // 文档操作
  document: {
    getSelectedNodes(): Promise<SerializedNode[]>;
    getAllNodes(): Promise<SerializedNode[]>;
    getNodeById(id: string): Promise<SerializedNode | null>;
    createNode(type: string, properties: any): Promise<string>;
    modifyNode(id: string, properties: Partial<any>): Promise<void>;
    deleteNode(id: string): Promise<void>;
    group(ids: string[]): Promise<string>;
  };

  // 视口
  viewport: {
    getZoom(): Promise<number>;
    scrollTo(x: number, y: number): Promise<void>;
    zoomTo(zoom: number): Promise<void>;
  };

  // UI
  ui: {
    showNotification(message: string, type?: 'info' | 'warning' | 'error'): void;
    showPanel(htmlContent: string): void;
    closePanel(): void;
  };

  // 存储
  storage: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
  };

  // 事件
  on(event: PluginEvent, handler: Function): void;
  off(event: PluginEvent, handler: Function): void;
}

type PluginEvent =
  | 'selection:change'
  | 'document:change'
  | 'tool:change'
  | 'viewport:change';
```

#### 4.8.2 插件沙箱运行时

```typescript
// packages/plugin-runtime/src/PluginSandbox.ts

/**
 * 每个插件运行在一个独立的 Web Worker 中
 * 通过 MessagePort 与主线程通信
 */
class PluginSandbox {
  private worker: Worker;
  private messagePort: MessagePort;
  private manifest: PluginManifest;
  private pendingCalls: Map<string, { resolve: Function; reject: Function }>;

  constructor(manifest: PluginManifest) {
    this.manifest = manifest;
    this.pendingCalls = new Map();

    // 创建 Worker
    const workerCode = this.generateWorkerBootstrap(manifest);
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));

    // 设置消息处理
    this.worker.onmessage = this.handleWorkerMessage.bind(this);
  }

  /**
   * 处理来自插件的 API 调用
   * 在此进行权限检查
   */
  private async handleWorkerMessage(event: MessageEvent): Promise<void> {
    const { type, callId, method, args } = event.data;

    if (type === 'api-call') {
      // 权限检查
      const requiredPermission = this.getRequiredPermission(method);
      if (!this.manifest.permissions.includes(requiredPermission)) {
        this.respondToWorker(callId, null, `Permission denied: ${requiredPermission}`);
        return;
      }

      try {
        const result = await this.executeAPICall(method, args);
        this.respondToWorker(callId, result, null);
      } catch (error) {
        this.respondToWorker(callId, null, String(error));
      }
    }
  }

  /** 终止插件 */
  terminate(): void {
    this.worker.terminate();
  }
}
```

---

## 5. 数据流与通信机制

### 5.1 用户编辑数据流

```
User Input (Mouse/Keyboard)
    │
    ▼
Tool State Machine ──► Generate Command(s)
    │
    ▼
Command Manager ──► Execute Command ──► Update DocumentStore
    │                                        │
    ├── Push to Undo Stack                   ▼
    │                              Mark Dirty Nodes
    │                                        │
    │                                        ▼
    │                              WASM: Re-tessellate
    │                                        │
    │                                        ▼
    │                              WebGL: Update GPU Buffers
    │                                        │
    │                                        ▼
    │                              Render Frame
    │
    ▼
Notify Zustand Store ──► React UI Re-render (Properties Panel, Layer Tree, etc.)
```

### 5.2 AI 生成数据流

```
User Message (Chat Input)
    │
    ▼
Context Builder ──► Serialize Selected/Visible Elements
    │
    ▼
Prompt Engine ──► Compose System Prompt + Context + User Message
    │
    ▼
API Client ──► SSE Stream to LLM API
    │
    ▼ (streaming)
Response Accumulator ──► Buffer chunks until valid JSON found
    │
    ▼
DSL Compiler ──► Parse JSON ──► Validate against schema
    │
    ▼
AI Preview Manager ──► Save snapshot ──► Execute as preview
    │
    ▼ (user decision)
┌──────────┬───────────┐
│  Accept  │  Reject   │
│  Push to │  Restore  │
│  Undo    │  Snapshot  │
│  Stack   │           │
└──────────┴───────────┘
```

### 5.3 前后端（Tauri IPC）通信

```
┌─────────────────────────┐         ┌──────────────────────────┐
│      WebView (Frontend) │         │    Rust Backend (Tauri)   │
│                         │         │                          │
│  invoke('save_project', ├────────►│  #[tauri::command]       │
│    { path, data })      │  IPC    │  fn save_project(...)    │
│                         │◄────────│  → Result<(), String>    │
│                         │         │                          │
│  invoke('export_pdf',   ├────────►│  #[tauri::command]       │
│    { docJson, path })   │  IPC    │  fn export_pdf(...)      │
│                         │◄────────│  → Result<(), String>    │
│                         │         │                          │
│  invoke('store_api_key',├────────►│  #[tauri::command]       │
│    { id, key })         │  IPC    │  fn store_api_key(...)   │
│                         │◄────────│  → Result<(), String>    │
│                         │         │                          │
│  listen('file-changed', │◄────────│  app.emit('file-changed',│
│    callback)            │  Event  │    payload)              │
└─────────────────────────┘         └──────────────────────────┘
```

---

## 6. 性能工程策略

### 6.1 渲染性能优化

| 策略 | 描述 | 预期收益 |
|------|------|---------|
| **视口裁剪** | WASM R-Tree 空间索引，仅提交可见区域内节点的绘制调用 | 大画布下减少 90%+ 绘制调用 |
| **增量曲面细分** | 脏节点追踪，仅重新曲面细分变更的路径 | 编辑时避免全量重算 |
| **图层缓存 (Tile Cache)** | 将未变更的图层组渲染为纹理缓存 (FBO → Texture) | 平移时接近零重绘开销 |
| **LOD 简化** | 低缩放级别时简化复杂路径的控制点数 | 全画布缩略图模式下性能提升 5x+ |
| **批量绘制调用** | 合并相同材质/Shader 的绘制调用 (instanced rendering) | 减少 GPU 状态切换开销 |
| **Web Worker 预处理** | 将命中测试、布局计算放入 Web Worker | 主线程不阻塞，保持 UI 响应 |

### 6.2 内存优化

```typescript
// packages/canvas-engine/src/memory/BufferPool.ts

/**
 * GPU Buffer 对象池
 * 避免频繁创建/销毁 WebGL Buffer 对象
 */
class BufferPool {
  private available: WebGLBuffer[] = [];
  private inUse: Map<NodeId, WebGLBuffer> = new Map();

  acquire(nodeId: NodeId): WebGLBuffer {
    const buffer = this.available.pop() || this.gl.createBuffer()!;
    this.inUse.set(nodeId, buffer);
    return buffer;
  }

  release(nodeId: NodeId): void {
    const buffer = this.inUse.get(nodeId);
    if (buffer) {
      this.inUse.delete(nodeId);
      this.available.push(buffer);
    }
  }
}
```

### 6.3 帧调度策略

```typescript
// packages/editor-core/src/scheduler/FrameScheduler.ts

class FrameScheduler {
  private tasks: PriorityQueue<Task> = new PriorityQueue();
  private isRunning: boolean = false;
  private deadline: number = 0;

  schedule(task: Task, priority: Priority): void {
    this.tasks.push(task, priority);
    if (!this.isRunning) {
      this.isRunning = true;
      requestAnimationFrame(this.run);
    }
  }

  private run = (timestamp: number) => {
    // 每帧预留 5ms 给 React UI 渲染和事件处理
    this.deadline = timestamp + 11; 
    
    while (performance.now() < this.deadline && !this.tasks.isEmpty()) {
      const task = this.tasks.pop();
      task.execute();
    }

    if (!this.tasks.isEmpty()) {
      requestAnimationFrame(this.run);
    } else {
      this.isRunning = false;
    }
  };
}
```

---

## 7. 安全设计

### 7.1 密钥安全存储 (BYOK)

用户的 API Key 是最高敏感数据，必须保证即使设备被恶意软件扫描也无法轻易窃取。

- **存储方案**：使用操作系统原生密钥环 (Windows Credential Manager / macOS Keychain / Linux Secret Service)。
- **实现库**：Rust `keyring` crate。
- **访问控制**：仅在发起 API 请求的一瞬间解密读取，内存中使用完立即清零 (Zeroize)。

### 7.2 沙箱与权限隔离

- **Tauri 隔离**：主进程 (Rust) 拥有系统权限，渲染进程 (WebView) 仅拥有 UI 渲染权限。所有敏感操作（文件读写、密钥存取）必须通过 IPC 显式调用。
- **CSP 策略**：

  ```html
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    img-src 'self' data: blob:;
    script-src 'self';
    style-src 'self' 'unsafe-inline';
    connect-src 'self' https://api.openai.com https://api.anthropic.com;
  ">
  ```

- **插件沙箱**：第三方插件运行在独立的 Web Worker 中，无法直接访问 DOM 或 LocalStorage，必须通过宿主 API 通信。

---

## 8. 国际化方案

### 8.1 技术选型

- **库**：`i18next` + `react-i18next`
- **检测**：`i18next-browser-languagedetector` (自动检测系统语言)

### 8.2 资源文件结构

```
src/locales/
├── en/
│   ├── translation.json   // 通用
│   ├── editor.json        // 编辑器术语
│   ├── ai.json           // AI 提示词
│   └── shortcuts.json     // 快捷键描述
└── zh/
    ├── translation.json
    ├── editor.json
    ├── ai.json
    └── shortcuts.json
```

### 8.3 AI 提示词国际化

系统提示词 (System Prompt) 也会根据用户语言设置动态切换，以确保 AI 用用户的母语回复。

```typescript
const SYSTEM_PROMPT_TEMPLATES = {
  en: "You are Viga AI, an expert vector design assistant...",
  zh: "你是 Viga AI，一个嵌入在专业矢量图形编辑器中的专家级设计助手..."
};
```

---

## 9. 测试策略

### 9.1 单元测试 (Unit Testing)

- **Rust 后端**：使用 `cargo test` 测试 PDF 生成、文件解析等核心逻辑。
- **TypeScript 核心**：使用 `Vitest` 测试数据模型、命令模式、几何算法。
  - 重点测试：`SceneNode` 的序列化/反序列化、Undo/Redo 栈的一致性。

### 9.2 集成测试 (Integration Testing)

- **渲染器测试**：使用 `puppeteer` + `pixelmatch` 进行截图对比测试 (Visual Regression Testing)，确保 WebGL 渲染结果与预期一致。
- **AI 流程测试**：Mock API 响应，测试从 Prompt 到 DSL 再到 Command 的完整链路。

### 9.3 端到端测试 (E2E)

- **工具**：`Playwright` (支持 Electron/Tauri)
- **场景**：
  1. 启动应用 -> 新建文档 -> 绘制矩形 -> 保存 -> 重启 -> 加载文档。
  2. 配置 API Key -> 输入 Prompt -> 生成图形 -> 撤销。

---

## 10. 目录结构与工程规范

采用 Monorepo 结构管理 Rust 后端、前端 UI、核心编辑器库和共享类型。

```
viga/
├── .github/                // CI/CD workflows
├── src-tauri/              // [Rust] Tauri 后端主进程
│   ├── src/
│   ├── Cargo.toml
│   └── capabilities/
├── packages/
│   ├── editor-core/        // [TS] 核心编辑器逻辑 (无 UI, 无 Node依赖)
│   ├── canvas-engine/      // [TS] WebGL2 渲染引擎
│   ├── ai-integration/     // [TS] AI 客户端与 DSL 解析
│   ├── file-io/            // [TS] 文件导入导出
│   ├── ui-components/      // [React] 通用 UI 组件库
│   └── plugin-api/         // [TS] 插件类型定义
├── apps/
│   └── desktop/            // [React] 桌面端主应用 (Tauri Frontend)
├── shared/                 // [Rust/WASM] 共享算法库
│   ├── geometry/           // 几何算法 (Rust)
│   └── layout/             // 布局算法 (Rust)
├── turbo.json              // Turborepo 配置
└── package.json            // Workspace 配置
```

---

## 11. 分阶段开发路线图

### Phase 1: MVP (核心编辑器) - 2个月

- [ ] 搭建 Tauri + React + WebGL2 基础架构
- [ ] 实现基础图形 (矩形/圆/线) 绘制与编辑
- [ ] 实现基础属性面板 (填充/描边)
- [ ] 实现 .viga 文件保存与读取
- [ ] 实现简单的 Undo/Redo

### Phase 2: Alpha (AI 集成) - 1.5个月

- [ ] 集成 OpenAI API 客户端
- [ ] 定义并实现 Design DSL v1.0
- [ ] 实现 Text-to-Vector 基础生成
- [ ] 实现上下文感知 (Context Awareness)
- [ ] 内部测试与 Prompt 调优

### Phase 3: Beta (高级功能) - 1.5个月

- [ ] 实现钢笔工具 (Vector Networks)
- [ ] 实现布尔运算 (WASM)
- [ ] 实现 Auto Layout
- [ ] 实现 PDF/SVG 导出
- [ ] 插件系统原型

### Phase 4: v1.0 Launch (完善与发布) - 1个月

- [ ] 性能优化 (R-Tree, Web Worker)
- [ ] 国际化支持 (中/英)
- [ ] 跨平台构建与签名 (Windows/macOS)
- [ ] 文档网站与社区建设



