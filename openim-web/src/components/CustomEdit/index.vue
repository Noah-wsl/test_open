<template>
  <div class="custom-edit-wrap">
    <div class="resize-handle" @mousedown="startResize"></div>
    <div
      ref="inputRef"
      class="custom_rich_input"
      :class="{ needsclick: !input }"
      :placeholder="placeholder ?? $t('placeholder.typingMessage')"
      :contenteditable="!disable"
      @input="emitChange"
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
const emit = defineEmits(['update:input', 'change', 'triggerAt'])

const inputRef = ref<HTMLDivElement>()
let latestHtml = ''
let cursorPos: Range

onUpdated(() => {
  latestHtml = input.value
})

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
  if (!cursorPos) return
  const selection = window.getSelection()
  const range = cursorPos.cloneRange()

  range.deleteContents()
  nodes.forEach((node) => {
    range.insertNode(node)
    range.setStartAfter(node)
  })
  range.collapse(false)
  selection!.removeAllRanges()
  selection!.addRange(range)
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

.custom_rich_input {
  position: relative;
  padding: 5px 8px;
  border-radius: 4px;
  color: rgba(0, 0, 0, 0.85);
  font-size: 14px;
  transition: all 0.3s;
  outline: none;
  white-space: pre-wrap;
  word-break: break-all;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  cursor: text;
  min-height: 32px;
  max-height: 300px;
  user-select: auto;
  // fix safari input
  -webkit-user-select: auto;

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
