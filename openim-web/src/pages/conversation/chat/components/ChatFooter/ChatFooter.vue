<template>
  <div>
    <div v-if="getPlaceholder.length > 0" class="flex h-[54px] items-center justify-center bg-[#F0F2F6] border-t border-[var(--gap-text)]">
      <span class="text-sm text-[#8E9AB0]">{{ getPlaceholder }}</span>
    </div>
    <div v-else id="chat_footer" ref="footerEl" class="relative flex flex-col overflow-y-auto bg-[#F0F2F6] px-3 py-3 border-t border-[var(--gap-text)]">
      <div class="resize-handle" @mousedown="startFooterResize"></div>
      <div class="flex items-end">
        <div class="flex-grow">
          <CustomEdit class="bg-[#fff]" ref="inputRef"
            @focus="onFocusUpdate(true)" @blur="onFocusUpdate(false)" v-model:input="messageContent"
            :placeholder="$t('placeholder.pleaseInput')" @trigger-at="() => { }" />
        </div>
        <img v-show="!messageContent" @click="clickAddBtn" class="ml-3 h-[26px] min-w-[26px]" :src="add" alt="" />
        <img v-show="messageContent" @click="switchTextMessage" class="ml-3 h-[26px] min-w-[26px]" :src="send"
          alt="send" />
      </div>
      <div class="mt-2 flex items-center gap-4">
        <van-icon name="smile-o" class="text-xl text-[#8E9AB0]" />
        <van-icon name="folder-o" class="text-xl text-[#8E9AB0]" />
        <van-icon name="scissors" class="text-xl text-[#8E9AB0]" />
        <van-icon name="video-o" class="text-xl text-[#8E9AB0]" />
        <van-icon name="phone-o" class="text-xl text-[#8E9AB0]" />
      </div>
    </div>
    <ChatFooterAction v-show="showActionBar" @closeActionBar="closeActionBar" @getFile="getFile" @getScreenshotFile="getScreenshotFile" @startScreenshot="startScreenshot" />
    <ScreenshotEditor ref="screenshotEditorRef" @confirm="onScreenshotConfirm" @cancel="onScreenshotCancel" />
  </div>
</template>

<script setup lang="ts">
import add from '@/assets/images/chatFooter/add.png'
import send from '@/assets/images/chatFooter/send.png'

import CustomEdit from '@/components/CustomEdit/index.vue'
import ChatFooterAction from './ChatFooterAction.vue'
import ScreenshotEditor from '../ScreenshotEditor/index.vue'
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
}


// action bar
const showActionBar = ref(false)
const showEmojiBar = ref(false)

const closeActionBar = () => {
  showActionBar.value = false
}
const clickAddBtn = () => {
  if (showEmojiBar.value) {
    showEmojiBar.value = false
  }
  showActionBar.value = !showActionBar.value
}

const getFile = async (uploadData: UploaderFileListItem) => {
  let messageType = MessageType.FileMessage
  if (uploadData.file?.type.includes('image')) {
    messageType = MessageType.PictureMessage
  }
  const { error, message } = await createFileMessage(
    uploadData.file!,
    messageType,
  )
  if (error || !message) {
    feedbackToast({ error, message: error })
    return
  }
  sendMessage({
    message,
  })
}

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
    const height = Math.max(100, startHeight + delta)
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
:deep(.van-button__content) {
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
