# Viga

Viga is a Tauri + React vector editor scaffold that follows the architecture in `Detailed Implementation Doc.md`.

## Current implementation

- Monorepo workspace layout (`apps/desktop`, `packages/*`, `src-tauri`)
- Editor core with document model, command pattern, undo/redo, selection, basic tools
- WebGL2 canvas renderer for vector rectangles
- AI integration package with DSL schema, context builder, streaming client and compiler
- File I/O package with `.viga` ZIP archive helpers and SVG import/export basics
- Desktop app shell with toolbar, canvas, properties panel, layer panel, and shortcuts
- Tauri backend command scaffold for save/load/export/keyring/font operations

## Start frontend dev

```bash
npm install
npm run tauri dev
```

Desktop app runs in `apps/desktop`.

## Key shortcuts

- `V`: select tool
- `R`: rectangle tool
- `Delete`: remove selected nodes
- `Ctrl/Cmd + Z`: undo
- `Ctrl/Cmd + Shift + Z`: redo
