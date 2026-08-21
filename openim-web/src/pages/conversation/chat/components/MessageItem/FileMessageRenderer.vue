<template>
  <div class="file-message need_bg" @click="downloadFile">
    <div class="file-icon">
      <van-icon name="description" size="28" />
    </div>
    <div class="file-info">
      <div class="file-name truncate">{{ fileName }}</div>
      <div class="file-size">{{ formatFileSize(fileSize) }}</div>
    </div>
    <div v-if="loading" class="file-status">
      <van-loading type="spinner" size="16" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FileElem } from '@openim/wasm-client-sdk/lib/types/entity'
import type { ExedMessageItem } from './data'

interface Props {
  message: ExedMessageItem
  isSelfMsg: boolean
  disabled?: boolean
}

const props = defineProps<Props>()

const fileElem = computed<Partial<FileElem>>(() => props.message.fileElem || {})
const fileName = computed(() => fileElem.value.fileName || '未知文件')
const fileSize = computed(() => fileElem.value.fileSize || 0)
const fileUrl = computed(() => fileElem.value.sourceUrl || fileElem.value.filePath || '')
const loading = ref(false)

const formatFileSize = (size: number) => {
  if (!size) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let index = 0
  let value = size
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index++
  }
  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`
}

const downloadFile = async () => {
  if (props.disabled || !fileUrl.value || loading.value) return
  loading.value = true
  try {
    const link = document.createElement('a')
    link.href = fileUrl.value
    link.download = fileName.value
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.file-message {
  display: flex;
  align-items: center;
  min-width: 220px;
  max-width: 320px;
  padding: 12px;
  cursor: pointer;

  .file-icon {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(24, 144, 255, 0.1);
    color: #1890ff;
    border-radius: 8px;
    margin-right: 12px;
  }

  .file-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;

    .file-name {
      font-size: 14px;
      color: #333;
      line-height: 20px;
    }

    .file-size {
      margin-top: 4px;
      font-size: 12px;
      color: #999;
    }
  }

  .file-status {
    flex-shrink: 0;
    margin-left: 8px;
  }
}
</style>
