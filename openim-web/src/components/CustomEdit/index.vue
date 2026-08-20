<template>
  <div class="custom-edit-wrap">
    <div class="resize-handle" @mousedown="startResize"></div>
    <div
      ref="inputRef"
      class="input-box"
      :class="{ needsclick: !input }"
      :placeholder="placeholder ?? $t('placeholder.typingMessage')"
      :contenteditable="!disable"
      @input="emitChange"
      @keydown="onKeydown"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue'

interface CustomEditProps {
  placeholder?: string
  disable?: boolean
  input: string
}

const props = withDefaults(defineProps<CustomEditProps>(), {
  disable: false,
})

const { input, placeholder, disable } = toRefs(props)
const emit = defineEmits(['update:input', 'change', 'triggerAt', 'send'])

const inputRef = ref<HTMLDivElement>()
let latestHtml = ''
let cursorPos: Range

onUpdated(() => {
  latestHtml = input.value
})

// 回车发送；Ctrl / Cmd / Shift + Enter 手动插入换行
const onKeydown = (e: KeyboardEvent) => {
  if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return
  if (e.ctrlKey || e.metaKey || e.shiftKey) {
    e.preventDefault()
    insertBreak()
    return
  }
  e.preventDefault()
  emit('send')
}

// 在光标处插入 <br> 实现换行（contenteditable 对 Ctrl+Enter 无默认换行行为）
const insertBreak = () => {
  const inputEl = inputRef.value
  if (!inputEl) return
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return
  const range = selection.getRangeAt(0)
  if (!inputEl.contains(range.commonAncestorContainer)) return
  range.deleteContents()
  const br = document.createElement('br')
  range.insertNode(br)
  range.setStartAfter(br)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
  cursorPos = range
  emitChange()
}

const emitChange = () => {
  const content = inputRef.value?.innerHTML
  emit('change', content)
  if (content !== latestHtml) {
    emit('update:input', content)
  }
  latestHtml = content!
}

const clear = () => {
  inputRef.value!.innerHTML = ''
}

const insertAtCursor = (nodes: Node[]) => {
  const selection = window.getSelection()
  let range: Range
  if (cursorPos) {
    range = cursorPos.cloneRange()
  } else if (inputRef.value) {
    range = document.createRange()
    range.selectNodeContents(inputRef.value)
    range.collapse(false)
  } else {
    return
  }

  range.deleteContents()
  nodes.forEach((node) => {
    range.insertNode(node)
    range.setStartAfter(node)
  })
  range.collapse(false)
  selection!.removeAllRanges()
  selection!.addRange(range)
  cursorPos = range
  emitChange()
}

const deletePreviousChar = () => {
  if (!cursorPos) return
  const range = cursorPos.cloneRange()
  const previousChar = range.startContainer.textContent!.charAt(range.startOffset - 1)
  if (previousChar === '@') {
    range.setStart(range.startContainer, range.startOffset - 1)
    range.deleteContents()
  }
}

const updateCursorPosition = () => {
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    cursorPos = selection.getRangeAt(0)
  }
}

const onSelectionChange = () => {
  if (inputRef.value === document.activeElement) {
    updateCursorPosition()
  }
}

// 输入框顶部边缘拖拽调整高度
const startResize = (e: MouseEvent) => {
  e.preventDefault()
  const startY = e.clientY
  const startHeight = inputRef.value?.offsetHeight ?? 32
  const onMove = (ev: MouseEvent) => {
    const delta = ev.clientY - startY
    const height = Math.min(300, Math.max(32, startHeight + delta))
    if (inputRef.value) {
      inputRef.value.style.height = height + 'px'
    }
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.cursor = ''
  }
  document.body.style.cursor = 'ns-resize'
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

onMounted(() => {
  document.addEventListener('selectionchange', onSelectionChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', onSelectionChange)
})

defineExpose({
  inputRef,
  insertAtCursor,
  deletePreviousChar,
  clear,
})
</script>

<style lang="scss" scoped>
.custom-edit-wrap {
  position: relative;
  height: 100%;
}

.resize-handle {
  position: absolute;
  top: -3px;
  left: 0;
  right: 0;
  height: 6px;
  cursor: ns-resize;
  z-index: 10;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }
}

.input-box {
  position: relative;
  flex: 1;
  width: 100%;
  min-height: 48px;
  height: 100%;
  max-height: none;
  background-color: #f8f9fa;
  border: 1px solid #e5e6e8;
  border-radius: 24px;
  padding: 10px 16px;
  font-size: 14px;
  line-height: 26px;
  color: rgba(0, 0, 0, 0.85);
  outline: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
  white-space: pre-wrap;
  word-break: break-all;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  cursor: text;
  user-select: auto;
  // fix safari input
  -webkit-user-select: auto;

  &:focus {
    border-color: #1890ff;
    background-color: #fff;
    box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1);
  }

  :deep(.face_el) {
    display: inline-block;
    vertical-align: text-bottom;
  }

  &::-webkit-scrollbar {
    display: none;
  }
}

.needsclick {
  &::before {
    position: absolute;
    content: attr(placeholder);
    color: rgb(169, 169, 169);
  }
}
</style>
