<template>
  <Teleport to="body">
    <div v-if="visible" class="screenshot-editor">
      <!-- 全屏背景截图 -->
      <canvas ref="bgCanvas" class="bg-canvas" />

      <!-- 选中区域（利用 box-shadow 实现周围暗化挖空） -->
      <div
        v-show="selectRect.w > 0 && selectRect.h > 0"
        class="selection-box"
        :style="selectionStyle"
        @mousedown="onSelectionDown"
      >
        <!-- 尺寸提示 -->
        <div class="size-tip">{{ selectRect.w }} × {{ selectRect.h }}</div>

        <!-- 编辑层 canvas（仅覆盖选区） -->
        <canvas
          ref="editCanvas"
          class="edit-canvas"
          :width="selectRect.w"
          :height="selectRect.h"
          @mousedown="onEditMouseDown"
          @mousemove="onEditMouseMove"
          @mouseup="onEditMouseUp"
        />

        <!-- 8 个调整点 -->
        <div
          v-for="p in resizePoints"
          :key="p.pos"
          class="resize-point"
          :class="`rp-${p.pos}`"
          @mousedown.stop="onResizeDown($event, p.pos)"
        />
      </div>

      <!-- 全屏遮罩：捕获鼠标事件 -->
      <div
        class="mask"
        :class="{ 'mask-editing': hasSelected }"
        @mousedown="onMaskMouseDown"
        @mousemove="onMaskMouseMove"
        @mouseup="onMaskMouseUp"
      />

      <!-- 浮动工具栏（跟随选区下方） -->
      <div
        v-if="hasSelected"
        class="float-toolbar"
        :style="toolbarStyle"
      >
        <div class="ft-tools">
          <button
            v-for="t in tools"
            :key="t.key"
            :class="{ active: tool === t.key }"
            :title="t.label"
            @click="tool = t.key"
          >
            {{ t.icon }}
          </button>
        </div>
        <div class="ft-colors">
          <span
            v-for="c in colors"
            :key="c"
            :style="{ background: c }"
            :class="{ active: color === c, light: c === '#ffffff' }"
            @click="color = c"
          />
        </div>
        <div class="ft-actions">
          <button class="btn-cancel" @click="cancel">取消</button>
          <button class="btn-ok" @click="confirm">完成</button>
        </div>
      </div>

      <!-- 文字输入框 -->
      <div
        v-if="textInput.visible"
        class="text-float"
        :style="textInputStyle"
      >
        <input
          ref="textInputRef"
          v-model="textInput.value"
          :style="{ color: color }"
          @keydown.enter="commitText"
          @blur="commitText"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { showToast } from 'vant'

const emit = defineEmits<{
  (event: 'confirm', file: File): void
  (event: 'cancel'): void
}>()

/* ────────────── 状态 ────────────── */
const visible = ref(false)
const hasSelected = ref(false)
const tool = ref<'rect' | 'arrow' | 'text' | 'mosaic'>('rect')
const color = ref('#ff0000')
const colors = ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#000000', '#ffffff']
const tools = [
  { key: 'rect' as const, label: '矩形', icon: '▭' },
  { key: 'arrow' as const, label: '箭头', icon: '➜' },
  { key: 'text' as const, label: '文字', icon: 'T' },
  { key: 'mosaic' as const, label: '马赛克', icon: '▦' },
]

/* ────────────── DOM ────────────── */
const bgCanvas = ref<HTMLCanvasElement>()
const editCanvas = ref<HTMLCanvasElement>()
const textInputRef = ref<HTMLInputElement>()

let bgCtx: CanvasRenderingContext2D | null = null
let editCtx: CanvasRenderingContext2D | null = null
let sw = 0
let sh = 0

/* ────────────── 选区 ────────────── */
interface Rect {
  x: number
  y: number
  w: number
  h: number
}
const selectRect = reactive<Rect>({ x: 0, y: 0, w: 0, h: 0 })

const selectionStyle = computed(() => ({
  left: `${selectRect.x}px`,
  top: `${selectRect.y}px`,
  width: `${selectRect.w}px`,
  height: `${selectRect.h}px`,
  cursor: tool.value === 'text' ? 'text' : tool.value === 'mosaic' || tool.value === 'rect' || tool.value === 'arrow' ? 'crosshair' : 'move',
}))

/* 8 个调整点 */
const resizePoints = computed(() => [
  { pos: 'nw' }, { pos: 'n' }, { pos: 'ne' },
  { pos: 'w' },               { pos: 'e' },
  { pos: 'sw' }, { pos: 's' }, { pos: 'se' },
])

/* 工具栏位置 */
const toolbarStyle = computed(() => {
  const left = Math.min(Math.max(selectRect.x, 8), sw - 320)
  const top = selectRect.y + selectRect.h + 8
  return { left: `${left}px`, top: `${top}px` }
})

/* ────────────── 绘制状态 ────────────── */
let isDrawing = false
let startX = 0
let startY = 0
let lastShapes: Shape[] = []
let redoShapes: Shape[] = []
let currentShape: Shape | null = null

interface Shape {
  type: string
  color: string
  data: Record<string, any>
}

const textInput = reactive({ visible: false, x: 0, y: 0, value: '' })
const textInputStyle = computed(() => ({
  left: `${textInput.x}px`,
  top: `${textInput.y}px`,
}))

/* ────────────── resize ────────────── */
let resizeDir = ''
let resizeStart = { x: 0, y: 0, rect: { ...selectRect } }

/* ────────────── 生命周期 ────────────── */
const { t } = useI18n()

const open = async () => {
  visible.value = true
  hasSelected.value = false
  tool.value = 'rect'
  color.value = '#ff0000'
  lastShapes = []
  redoShapes = []
  currentShape = null
  Object.assign(selectRect, { x: 0, y: 0, w: 0, h: 0 })

  await nextTick()
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always' } as any,
    })
    const video = document.createElement('video')
    video.srcObject = stream
    await video.play()

    await new Promise<void>((resolve) => {
      const check = () => {
        if (video.videoWidth > 0 && video.readyState >= 2) {
          resolve()
        } else {
          setTimeout(check, 50)
        }
      }
      check()
    })

    sw = video.videoWidth
    sh = video.videoHeight

    bgCanvas.value!.width = sw
    bgCanvas.value!.height = sh
    editCanvas.value!.width = sw
    editCanvas.value!.height = sh

    bgCtx = bgCanvas.value!.getContext('2d', { willReadFrequently: true })!
    editCtx = editCanvas.value!.getContext('2d')!

    bgCtx.drawImage(video, 0, 0, sw, sh)
    stream.getTracks().forEach((track) => track.stop())
  } catch (err: any) {
    visible.value = false
    showToast(t('screenshotFailed') || '截图失败，请允许屏幕共享权限')
  }
}

defineExpose({ open })

/* ────────────── 鼠标事件 ────────────── */

/* 阶段 1：遮罩上拖拽选区 */
function onMaskMouseDown(e: MouseEvent) {
  if (hasSelected.value) return
  if (e.button !== 0) return
  isDrawing = true
  startX = e.clientX
  startY = e.clientY
  Object.assign(selectRect, { x: startX, y: startY, w: 0, h: 0 })
}

function onMaskMouseMove(e: MouseEvent) {
  if (!isDrawing || hasSelected.value) return
  const x = Math.min(startX, e.clientX)
  const y = Math.min(startY, e.clientY)
  const w = Math.abs(e.clientX - startX)
  const h = Math.abs(e.clientY - startY)
  Object.assign(selectRect, { x, y, w, h })
}

function onMaskMouseUp() {
  if (!isDrawing) return
  isDrawing = false
  if (selectRect.w > 10 && selectRect.h > 10) {
    hasSelected.value = true
    // 重设 edit canvas 为选区大小
    nextTick(() => {
      if (editCanvas.value) {
        editCanvas.value.width = selectRect.w
        editCanvas.value.height = selectRect.h
        editCtx = editCanvas.value.getContext('2d')!
      }
    })
  } else {
    Object.assign(selectRect, { x: 0, y: 0, w: 0, h: 0 })
  }
}

/* 阶段 2：在选区内绘制 */
function onEditMouseDown(e: MouseEvent) {
  if (!hasSelected.value || !editCtx) return
  e.stopPropagation()
  const rect = editCanvas.value!.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  if (tool.value === 'text') {
    textInput.x = e.clientX
    textInput.y = e.clientY
    textInput.value = ''
    textInput.visible = true
    nextTick(() => textInputRef.value?.focus())
    return
  }

  isDrawing = true
  startX = x
  startY = y

  if (tool.value === 'rect') {
    currentShape = { type: 'rect', color: color.value, data: { x, y, w: 0, h: 0 } }
  } else if (tool.value === 'arrow') {
    currentShape = { type: 'arrow', color: color.value, data: { x1: x, y1: y, x2: x, y2: y } }
  } else if (tool.value === 'mosaic') {
    currentShape = { type: 'mosaic', color: '', data: { x, y, w: 0, h: 0 } }
  }
}

function onEditMouseMove(e: MouseEvent) {
  if (!isDrawing || !currentShape || !editCtx) return
  e.stopPropagation()
  const rect = editCanvas.value!.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  if (currentShape.type === 'rect' || currentShape.type === 'mosaic') {
    currentShape.data = {
      x: Math.min(startX, x),
      y: Math.min(startY, y),
      w: Math.abs(x - startX),
      h: Math.abs(y - startY),
    }
  } else if (currentShape.type === 'arrow') {
    currentShape.data.x2 = x
    currentShape.data.y2 = y
  }

  redrawEdit()
  if (currentShape) drawShape(editCtx, currentShape)
}

function onEditMouseUp() {
  if (!isDrawing) return
  isDrawing = false
  if (currentShape) {
    lastShapes.push(currentShape)
    redoShapes = []
    currentShape = null
  }
}

/* 阶段 3：拖拽选区整体移动 */
let isMoving = false
let moveStart = { x: 0, y: 0 }

function onSelectionDown(e: MouseEvent) {
  if (!hasSelected.value) return
  // 只有在“选择”模式下才允许整体移动，否则不拦截（让 editCanvas 处理）
  // 实际上我们直接在 selection-box 上 mousedown，如果是调整点会 stopPropagation
  if ((e.target as HTMLElement).classList.contains('resize-point')) return
  isMoving = true
  moveStart = { x: e.clientX - selectRect.x, y: e.clientY - selectRect.y }
}

/* 阶段 4：调整大小 */
function onResizeDown(e: MouseEvent, dir: string) {
  e.preventDefault()
  e.stopPropagation()
  resizeDir = dir
  resizeStart = { x: e.clientX, y: e.clientY, rect: { ...selectRect } }

  const onMove = (ev: MouseEvent) => {
    const dx = ev.clientX - resizeStart.x
    const dy = ev.clientY - resizeStart.y
    const r = { ...resizeStart.rect }

    if (dir.includes('e')) r.w = Math.max(20, r.w + dx)
    if (dir.includes('s')) r.h = Math.max(20, r.h + dy)
    if (dir.includes('w')) {
      const nx = r.x + dx
      const nw = r.w - dx
      if (nw >= 20) { r.x = nx; r.w = nw }
    }
    if (dir.includes('n')) {
      const ny = r.y + dy
      const nh = r.h - dy
      if (nh >= 20) { r.y = ny; r.h = nh }
    }

    Object.assign(selectRect, r)
    if (editCanvas.value) {
      editCanvas.value.width = selectRect.w
      editCanvas.value.height = selectRect.h
      editCtx = editCanvas.value.getContext('2d')!
      redrawEdit()
    }
  }

  const onUp = () => {
    resizeDir = ''
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

/* ────────────── 绘制 ────────────── */
function redrawEdit() {
  if (!editCtx) return
  editCtx.clearRect(0, 0, selectRect.w, selectRect.h)
  lastShapes.forEach((s) => drawShape(editCtx!, s))
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  switch (shape.type) {
    case 'rect': {
      ctx.strokeStyle = shape.color
      ctx.strokeRect(shape.data.x, shape.data.y, shape.data.w, shape.data.h)
      break
    }
    case 'arrow': {
      ctx.strokeStyle = shape.color
      ctx.fillStyle = shape.color
      drawArrow(ctx, shape.data.x1, shape.data.y1, shape.data.x2, shape.data.y2)
      break
    }
    case 'text': {
      ctx.fillStyle = shape.color
      ctx.font = 'bold 18px sans-serif'
      ctx.textBaseline = 'top'
      ctx.fillText(shape.data.text, shape.data.x, shape.data.y)
      break
    }
    case 'mosaic': {
      drawMosaic(ctx, shape.data.x, shape.data.y, shape.data.w, shape.data.h)
      break
    }
  }
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  const headlen = 12
  const angle = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6))
  ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6))
  ctx.closePath()
  ctx.fill()
}

function drawMosaic(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, size = 8) {
  if (!bgCtx) return
  for (let i = x; i < x + w; i += size) {
    for (let j = y; j < y + h; j += size) {
      if (i >= selectRect.w || j >= selectRect.h) continue
      const sx = selectRect.x + i
      const sy = selectRect.y + j
      if (sx >= sw || sy >= sh) continue
      const pixel = bgCtx.getImageData(Math.min(sx, sw - 1), Math.min(sy, sh - 1), 1, 1).data
      ctx.fillStyle = `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`
      ctx.fillRect(i, j, size, size)
    }
  }
}

/* ────────────── 文字 ────────────── */
function commitText() {
  if (!textInput.value.trim()) {
    textInput.visible = false
    return
  }
  const rect = editCanvas.value!.getBoundingClientRect()
  const x = textInput.x - rect.left
  const y = textInput.y - rect.top
  lastShapes.push({ type: 'text', color: color.value, data: { text: textInput.value, x, y } })
  redoShapes = []
  textInput.visible = false
  redrawEdit()
}

/* ────────────── 确认 / 取消 ────────────── */
const confirm = () => {
  if (!hasSelected.value || selectRect.w <= 0 || selectRect.h <= 0) {
    showToast(t('screenshotSelectArea') || '请先选择截图区域')
    return
  }
  const out = document.createElement('canvas')
  out.width = selectRect.w
  out.height = selectRect.h
  const ctx = out.getContext('2d')!
  ctx.drawImage(bgCanvas.value!, selectRect.x, selectRect.y, selectRect.w, selectRect.h, 0, 0, selectRect.w, selectRect.h)
  ctx.drawImage(editCanvas.value!, 0, 0)
  out.toBlob((blob) => {
    if (blob) {
      const file = new File([blob], `screenshot_${Date.now()}.png`, { type: 'image/png' })
      emit('confirm', file)
    }
    close()
  }, 'image/png')
}

const cancel = () => {
  emit('cancel')
  close()
}

function close() {
  visible.value = false
  hasSelected.value = false
  bgCtx = null
  editCtx = null
  lastShapes = []
  currentShape = null
}

/* ────────────── 快捷键 ────────────── */
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && visible.value) cancel()
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && visible.value && hasSelected.value) {
    e.preventDefault()
    if (lastShapes.length) {
      redoShapes.push(lastShapes.pop()!)
      redrawEdit()
    }
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style lang="scss" scoped>
.screenshot-editor {
  position: fixed;
  inset: 0;
  z-index: 9999;
  user-select: none;
}

.bg-canvas {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  object-fit: contain;
}

/* 半透明遮罩 + 挖空 */
.mask {
  position: fixed;
  inset: 0;
  cursor: crosshair;
  z-index: 1;

  &.mask-editing {
    cursor: default;
    pointer-events: none;
  }
}

/* 选中区域 */
.selection-box {
  position: fixed;
  z-index: 2;
  border: 1px dashed #00ff00;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55);

  .size-tip {
    position: absolute;
    top: -22px;
    left: 0;
    background: #00ff00;
    color: #000;
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 2px;
    white-space: nowrap;
    pointer-events: none;
  }

  .edit-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
}

/* 8 个调整点 */
.resize-point {
  position: absolute;
  width: 8px;
  height: 8px;
  background: #00ff00;
  border: 1px solid #fff;
  z-index: 3;
  cursor: pointer;

  &.rp-nw { top: -4px; left: -4px; cursor: nw-resize; }
  &.rp-n  { top: -4px; left: 50%; transform: translateX(-50%); cursor: n-resize; }
  &.rp-ne { top: -4px; right: -4px; cursor: ne-resize; }
  &.rp-w  { top: 50%; left: -4px; transform: translateY(-50%); cursor: w-resize; }
  &.rp-e  { top: 50%; right: -4px; transform: translateY(-50%); cursor: e-resize; }
  &.rp-sw { bottom: -4px; left: -4px; cursor: sw-resize; }
  &.rp-s  { bottom: -4px; left: 50%; transform: translateX(-50%); cursor: s-resize; }
  &.rp-se { bottom: -4px; right: -4px; cursor: se-resize; }
}

/* 浮动工具栏 */
.float-toolbar {
  position: fixed;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #2a2a2a;
  border-radius: 6px;
  padding: 6px 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);

  .ft-tools {
    display: flex;
    gap: 4px;

    button {
      width: 30px;
      height: 30px;
      border: 1px solid #555;
      background: #333;
      color: #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover { background: #444; }
      &.active { background: var(--primary); border-color: var(--primary); color: #fff; }
    }
  }

  .ft-colors {
    display: flex;
    gap: 5px;
    padding-left: 8px;
    border-left: 1px solid #444;

    span {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      cursor: pointer;
      border: 2px solid transparent;

      &.light { border-color: #888; }
      &.active { box-shadow: 0 0 0 2px #fff; }
    }
  }

  .ft-actions {
    display: flex;
    gap: 6px;
    padding-left: 8px;
    border-left: 1px solid #444;

    button {
      padding: 4px 14px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;

      &.btn-cancel { background: #555; color: #fff; }
      &.btn-ok { background: var(--primary); color: #fff; }
    }
  }
}

/* 文字输入 */
.text-float {
  position: fixed;
  z-index: 20;

  input {
    background: transparent;
    border: none;
    outline: none;
    font-size: 18px;
    font-weight: bold;
    min-width: 80px;
    text-shadow: 0 0 2px rgba(255,255,255,0.8);
    border-bottom: 1px dashed currentColor;
  }
}
</style>
