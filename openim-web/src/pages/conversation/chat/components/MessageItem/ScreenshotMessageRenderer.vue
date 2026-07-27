<template>
  <div @click="clickScreenshot" class="screenshot_message_container">
    <van-image
      class="need_preload_message max-w-[32vw]"
      :class="{ 'h-8 w-8': isError }"
      fit="contain"
      radius="6"
      :src="screenshotUrl"
      @error="isError = true"
    >
      <template v-slot:loading>
        <van-loading type="spinner" size="20" />
      </template>
      <template v-slot:error>{{ $t('failLoad') }}</template>
    </van-image>
    <div class="mt-1 flex items-center gap-1 text-xs text-[#999]">
      <span>{{ screenshotName }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { showImagePreview } from 'vant'
import { ExedMessageItem } from './data'
import { CustomMessageType } from '@/constants/enum'

type ScreenshotMessageRendererProps = {
  message: ExedMessageItem
}

const props = defineProps<ScreenshotMessageRendererProps>()

const isError = ref(false)

const screenshotUrl = computed(() => {
  try {
    const customData = JSON.parse(props.message.customElem?.data || '{}')
    if (customData.customType === CustomMessageType.ScreenshotMessage) {
      return customData.data?.url || ''
    }
  } catch {}
  return ''
})

const screenshotName = computed(() => {
  try {
    const customData = JSON.parse(props.message.customElem?.data || '{}')
    if (customData.customType === CustomMessageType.ScreenshotMessage) {
      return customData.data?.name || 'screenshot.png'
    }
  } catch {}
  return 'screenshot.png'
})

const clickScreenshot = () => {
  if (screenshotUrl.value) {
    showImagePreview({
      images: [screenshotUrl.value],
      startPosition: 0,
      loop: false,
    })
  }
}
</script>

<style lang="scss" scoped>
.screenshot_message_container {
  position: relative;
  overflow: hidden;
}
</style>
