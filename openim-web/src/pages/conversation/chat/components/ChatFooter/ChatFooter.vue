<template>
  <div>
    <div v-if="getPlaceholder.length > 0" class="flex h-[54px] items-center justify-center bg-[#F0F2F6] border-t border-[var(--gap-text)]">
      <span class="text-sm text-[#8E9AB0]">{{ getPlaceholder }}</span>
    </div>
    <div v-else id="chat_footer" ref="footerEl" class="chat-input-wrapper">
      <div class="resize-handle" @mousedown="startFooterResize"></div>
      <div
        class="icon-btn voice-btn"
        :class="{ recording: isRecording }"
        @mousedown.prevent="startRecord"
        @mouseup="stopRecord"
        @mouseleave="stopRecord"
        @touchstart.prevent="startRecord"
        @touchend="stopRecord"
        @touchcancel="stopRecord"
      >
        <van-icon name="mic" size="20" />
      </div>
      <div class="flex-1 px-3">
        <CustomEdit ref="inputRef" @focus="onFocusUpdate(true)" @blur="onFocusUpdate(false)"
          v-model:input="messageContent" placeholder="请输入消息..." @send="switchTextMessage"
          @trigger-at="() => { }" />
      </div>
      <div class="right-actions">
        <div class="icon-btn" :class="{ active: showEmojiBar }" @click="clickEmojiBtn">
          <van-icon name="smile-o" size="20" />
        </div>
        <div class="icon-btn" :class="{ active: showActionBar }" @click="clickAddBtn">
          <van-icon name="plus" size="20" />
        </div>
        <button class="send-btn" :disabled="!messageContent" @click="switchTextMessage">发送</button>
      </div>
    </div>
    <div v-show="showEmojiBar" class="emoji-bar">
      <div class="emoji-list">
        <span
          v-for="emoji in emojiList"
          :key="emoji"
          class="emoji-item"
          @click="insertEmoji(emoji)"
        >{{ emoji }}</span>
      </div>
    </div>
    <ChatFooterAction v-show="showActionBar" @closeActionBar="closeActionBar" @getFile="getFile" @getScreenshotFile="getScreenshotFile" @startScreenshot="startScreenshot" />
    <ScreenshotEditor ref="screenshotEditorRef" @confirm="onScreenshotConfirm" @cancel="onScreenshotCancel" />
  </div>
</template>

<script setup lang="ts">
import CustomEdit from '@/components/CustomEdit/index.vue'
import ChatFooterAction from './ChatFooterAction.vue'
import ScreenshotEditor from '../ScreenshotEditor/index.vue'
import { onBeforeUnmount } from 'vue'
import { onLongPress, useThrottleFn } from '@vueuse/core'
import {
  GroupMemberRole,
  GroupStatus,
  MessageType,
  SessionType,
} from '@openim/wasm-client-sdk'
import { showToast, UploaderFileListItem } from 'vant'
import useSendMessage from '@/hooks/useSendMessage'
import useConversationStore from '@/store/modules/conversation'
import useContactStore from '@/store/modules/contact'
import { IMSDK } from '@/utils/imCommon'
import { feedbackToast, getPicInfo } from '@/utils/common'
import emitter from '@/utils/events'
import { checkIsSafari } from '@/utils/common'
import { v4 as uuidV4 } from 'uuid'
import useCreateNomalMessage from './useCreateNomalMessage'
import useCreateFileMessage from './useCreateFileMessage'
import { CustomMessageType } from '@/constants/enum'

const emit = defineEmits([])
defineProps()

const { t } = useI18n()
const conversationStore = useConversationStore()
const contactStore = useContactStore()
const { createFileMessage } = useCreateFileMessage()

// message
const messageContent = ref('')
const inputRef = ref()

const { switchNomalMessage } = useCreateNomalMessage({
  messageContent,
})
const { sendMessage } = useSendMessage()

const isSingle = computed(
  () =>
    conversationStore.storeCurrentConversation.conversationType === SessionType.Single,
)

const getPlaceholder = computed(() => {
  const isMutedAll = conversationStore.currentGroupInfo.status === GroupStatus.Muted
  const roleLevel = conversationStore.storeCurrentMemberInGroup?.roleLevel
  if (!isSingle.value && isMutedAll) {
    return roleLevel !== GroupMemberRole.Normal ? '' : t('placeholder.allMuted')
  }

  const isDismissed =
    conversationStore.currentGroupInfo.status === GroupStatus.Dismissed
  if (!isSingle.value && isDismissed) {
    return t('placeholder.leaveGroup')
  }

  if (!isSingle.value && !conversationStore.currentMemberInGroup?.roleLevel) {
    return t('placeholder.leaveGroup')
  }

  const isBlack = contactStore.storeBlackList.find(
    (black) => black.userID === conversationStore.storeCurrentConversation.userID,
  )
  if (isSingle.value && isBlack) {
    return t('placeholder.beBlack')
  }

  return ''
})

const onFocusUpdate = (isFocus: boolean) => {
  if (!checkIsSafari()) {
    return
  }
  setTimeout(() => emitter.emit('KEYBOARD_UPDATE'), 100)
  if (isFocus) {
    setTimeout(() => window.scroll(0, 0), 101)
  }
}

const switchTextMessage = async () => {
  const message = await switchNomalMessage()
  if (message) {
    sendMessage({ message })
  }
  resetState()
}

const resetState = () => {
  messageContent.value = ''
  inputRef.value.clear()
  // 发送后恢复自动高度
  if (footerEl.value) {
    footerEl.value.style.height = ''
  }
}

watch(messageContent, () => {
  // 输入内容变化时清除拖拽产生的固定高度，允许输入框自动撑开
  if (footerEl.value) {
    footerEl.value.style.height = ''
  }
})


// action bar
const showActionBar = ref(false)
const showEmojiBar = ref(false)

const closeActionBar = () => {
  showActionBar.value = false
}
const clickAddBtn = () => {
  showEmojiBar.value = false
  showActionBar.value = !showActionBar.value
}
const clickEmojiBtn = () => {
  showActionBar.value = false
  showEmojiBar.value = !showEmojiBar.value
}

const emojiList = [
  '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇',
  '🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚',
  '😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸',
  '🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️',
  '👍','👎','👏','🙌','🤝','🙏','✌️','🤞','🤟','🤘',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💖',
]

const insertEmoji = (emoji: string) => {
  inputRef.value?.inputRef?.focus()
  inputRef.value?.insertAtCursor([document.createTextNode(emoji)])
}

const getFile = async (uploadData: UploaderFileListItem) => {
  let messageType = MessageType.FileMessage
  if (uploadData.file?.type?.includes('image')) {
    messageType = MessageType.PictureMessage
  }
  try {
    const { error, message } = await createFileMessage(
      uploadData.file!,
      messageType,
    )
    if (error || !message) {
      console.error('[createFileMessage failed]', error, message)
      feedbackToast({ error, message: error || '创建文件消息失败' })
      return
    }
    sendMessage({ message })
  } catch (err) {
    console.error('[getFile exception]', err)
    feedbackToast({ error: String(err) })
  }
}

// 语音消息（按住说话）
const isRecording = ref(false)
let mediaRecorder: MediaRecorder | null = null
let audioStream: MediaStream | null = null
let audioChunks: Blob[] = []
let recordStartTime = 0

const startRecord = async () => {
  if (isRecording.value || messageContent.value) return
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(audioStream)
    audioChunks = []
    recordStartTime = Date.now()
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data)
    }
    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, {
        type: mediaRecorder?.mimeType || 'audio/webm',
      })
      const duration = Math.max(1, Math.round((Date.now() - recordStartTime) / 1000))
      const file = new File([blob], `voice_${Date.now()}.webm`, { type: blob.type })
      try {
        const { data: message } = await IMSDK.createSoundMessageByFile({
          uuid: uuidV4(),
          soundPath: '',
          sourceUrl: '',
          dataSize: blob.size,
          duration,
          soundType: blob.type,
          file,
        })
        if (message) {
          sendMessage({ message })
        }
      } catch (e) {
        feedbackToast({ error: '发送语音失败' })
      }
      audioStream?.getTracks().forEach((t) => t.stop())
      audioStream = null
    }
    mediaRecorder.start()
    isRecording.value = true
  } catch (e) {
    feedbackToast({ error: '无法访问麦克风' })
  }
}

const stopRecord = () => {
  if (!isRecording.value || !mediaRecorder) return
  mediaRecorder.stop()
  isRecording.value = false
}

onBeforeUnmount(() => {
  if (mediaRecorder && isRecording.value) {
    mediaRecorder.stop()
  }
  audioStream?.getTracks().forEach((t) => t.stop())
})

const screenshotEditorRef = ref<InstanceType<typeof ScreenshotEditor>>()

const startScreenshot = () => {
  screenshotEditorRef.value?.open()
}

const onScreenshotConfirm = async (file: File) => {
  await sendScreenshotFile(file)
}

const onScreenshotCancel = () => {
  // do nothing
}

const sendScreenshotFile = async (file: File) => {
  const { width, height } = await getPicInfo(file)
  const baseInfo = {
    uuid: uuidV4(),
    type: file.type,
    size: file.size,
    width,
    height,
    url: URL.createObjectURL(file),
  }
  // 先用 SDK 上传图片获取服务器 URL
  const imageOptions = {
    sourcePicture: baseInfo,
    bigPicture: baseInfo,
    snapshotPicture: baseInfo,
    sourcePath: '',
    file,
  }
  const { data: imageMsg } = await IMSDK.createImageMessageByFile(imageOptions)
  const serverUrl = imageMsg.pictureElem?.sourcePicture?.url || baseInfo.url

  const screenshotData = {
    customType: CustomMessageType.ScreenshotMessage,
    data: {
      url: serverUrl,
      width,
      height,
      size: file.size,
      name: file.name || 'screenshot.png',
    },
  }
  const { data: message } = await IMSDK.createCustomMessage({
    data: JSON.stringify(screenshotData),
    extension: '',
    description: '',
  })
  if (!message) {
    feedbackToast({ error: 'create screenshot message failed' })
    return
  }
  sendMessage({
    message,
  })
  closeActionBar()
}

const getScreenshotFile = async (uploadData: UploaderFileListItem) => {
  await sendScreenshotFile(uploadData.file!)
}

// 背景容器顶部边缘拖拽调整高度
const footerEl = ref<HTMLElement>()
const startFooterResize = (e: MouseEvent) => {
  e.preventDefault()
  const startY = e.clientY
  const startHeight = footerEl.value?.offsetHeight ?? 120
  const onMove = (ev: MouseEvent) => {
    const delta = ev.clientY - startY
    // 手柄位于顶部：往上拉（delta<0）扩大，往下拉（delta>0）缩小
    const height = Math.min(240, Math.max(100, startHeight - delta))
    if (footerEl.value) {
      footerEl.value.style.height = height + 'px'
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
  if (!inputRef.value) return
  inputRef.value.inputRef?.focus()
})

onActivated(() => {
  if (!inputRef.value) return
  resetState()
  inputRef.value.clear()
  inputRef.value.inputRef?.focus()
})
</script>

<style lang="scss" scoped>
.chat-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background-color: #ffffff;
  border-top: 1px solid #f0f0f0;

  .flex-1 {
    display: flex;
    align-items: center;
    min-width: 0;
    min-height: 48px;

    .custom-edit-wrap {
      width: 100%;
    }
  }
}

.right-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  cursor: pointer;
  color: #666;
  font-size: 18px;
  border-radius: 50%;
  flex-shrink: 0;
  user-select: none;
  -webkit-user-select: none;
  transition: all 0.2s;

  &:hover {
    background-color: #f0f2f5;
  }

  &.active {
    color: #1890ff;
    background-color: rgba(24, 144, 255, 0.1);
  }

  &.recording {
    background-color: #ff4d4f;
    color: #fff;
    animation: voice-pulse 1.2s ease-in-out infinite;
  }
}

@keyframes voice-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.45);
  }

  50% {
    box-shadow: 0 0 0 8px rgba(255, 77, 79, 0);
  }
}

.send-btn {
  flex-shrink: 0;
  height: 32px;
  padding: 0 18px;
  margin-left: 0;
  border: none;
  border-radius: 16px;
  background-color: #1890ff;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background-color: #40a9ff;
  }

  &:active:not(:disabled) {
    background-color: #096dd9;
  }

  &:disabled {
    background-color: #bfbfbf;
    cursor: not-allowed;
  }
}

.emoji-bar {
  padding: 12px 16px;
  background-color: #f7f8fa;
  border-top: 1px solid #f0f0f0;

  .emoji-list {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 8px;
    max-height: 160px;
    overflow-y: auto;
  }

  .emoji-item {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 32px;
    font-size: 22px;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.2s;

    &:hover {
      background-color: #e5e6e8;
    }
  }
}

::deep(.van-button__content) {
  width: max-content;
}

.resize-handle {
  position: absolute;
  top: -4px;
  left: 0;
  right: 0;
  height: 8px;
  cursor: ns-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;

  &::before {
    content: '';
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: rgba(0, 0, 0, 0.15);
    transition: background 0.2s;
  }

  &:hover::before {
    background: rgba(0, 0, 0, 0.35);
  }
}
</style>
