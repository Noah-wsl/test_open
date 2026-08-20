<template>
  <div
    ref="messageContainerRef"
    class="message_item"
    :class="{
      message_item_self: isSelfMsg,
      message_item_checked: showCheck,
      message_item_active: isActive || source.jump,
    }"
  >
    <div class="message_container_wrap">
      <Avatar
        ref="avatarRef"
        :size="42"
        :src="source.senderFaceUrl"
        :desc="source.senderNickname"
        @click="toDetails"
      />
      <div class="message_container">
        <div class="mb-1 max-w-[240px] truncate text-xs">
          <span class="text-[var(--sub-text)]">
            {{ formatMessageTime(source.sendTime) }}
          </span>
          <span>{{ ' ' }}</span>
          <span v-if="!isSing" class="text-[var(--sub-text)]">{{ source.senderNickname }}</span>
        </div>
        <component
          :message="source"
          :is-self-msg="isSelfMsg"
          :disabled="showCheck || isActive"
          :is="getRenderComp"
        ></component>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Avatar from '@/components/Avatar/index.vue'
import TextMessageRenderer from './TextMessageRenderer.vue'
import MediaMessageRenderer from './MediaMessageRenderer.vue'
import ScreenshotMessageRenderer from './ScreenshotMessageRenderer.vue'
import ApprovalMessageRenderer from './ApprovalMessageRenderer.vue'
import SoundMessageRenderer from './SoundMessageRenderer.vue'
import FileMessageRenderer from './FileMessageRenderer.vue'
import CatchMsgRenderer from './CatchMsgRenderer.vue'
import { MessageType, SessionType } from '@openim/wasm-client-sdk'
import { CustomMessageType } from '@/constants/enum'
import useUserStore from '@/store/modules/user'
import { ExedMessageItem } from './data'
import useContactStore from '@/store/modules/contact'
import useConversationStore from '@/store/modules/conversation'
import { formatMessageTime } from '@/utils/imCommon'

interface MessageItemProps {
  source: ExedMessageItem
  showCheck?: boolean
  isPreView?: boolean
  isActive?: boolean
}

const userStore = useUserStore()
const contactStore = useContactStore()
const conversationStore = useConversationStore()
const props = defineProps<MessageItemProps>()

const { source, showCheck } = toRefs(props)
const messageContainerRef = ref()
const avatarRef = ref()

const isSing = computed(
  () => conversationStore.currentConversation.conversationType === SessionType.Single,
)
const isSelfMsg = computed(() => userStore.selfInfo.userID === source.value.sendID)

const getRenderComp = computed(() => {
  switch (props.source.contentType) {
    case MessageType.TextMessage:
      return TextMessageRenderer
    case MessageType.PictureMessage:
      return MediaMessageRenderer
    case MessageType.VoiceMessage:
      return SoundMessageRenderer
    case MessageType.FileMessage:
      return FileMessageRenderer
    case MessageType.CustomMessage:
      return getCustomMsgRender()
    default:
      return CatchMsgRenderer
  }
})

const getCustomMsgRender = () => {
  try {
    const customData = JSON.parse(props.source.customElem?.data || '{}')
    if (customData.customType === CustomMessageType.ScreenshotMessage) {
      return ScreenshotMessageRenderer
    }
    if (customData.customType === CustomMessageType.ApprovalMessage) {
      return ApprovalMessageRenderer
    }
  } catch {}
  return CatchMsgRenderer
}

const toDetails = async (e: Event) => {
  e.preventDefault()
  contactStore.getUserCardData(props.source.sendID, props.source.groupID)
}
</script>

<style lang="scss" scoped>
.message_item {
  display: flex;
  align-items: center;
  padding: 12px 22px;
  color: #333;
  min-height: 40px;
  position: relative;
  -webkit-overflow-scrolling: touch;

  .need_bg {
    padding: 10px;
    border-radius: 6px;
    background-color: var(--chat-bubble);
    word-break: break-all;
    word-wrap: break-word;
    white-space: pre-wrap;
  }

  .message_container_wrap {
    display: flex;
  }

  .message_container {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-left: 12px;
    max-width: 80%;
    position: relative;

    .message_content_wrap {
      position: relative;
    }

    .time_line {
      font-size: 12px;
      color: #999;
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translate(-50%, 100%);
    }
  }

  &_self {
    // flex-direction: row-reverse;

    .check_wrap {
      margin-right: 0;
      margin-left: 12px;
    }

    .need_bg {
      padding: 10px;
      border-radius: 6px;
      background-color: var(--chat-bubble-sender);
      word-break: break-all;
      word-wrap: break-word;
      white-space: pre-wrap;
    }

    .message_container_wrap {
      margin-left: auto;
      flex-direction: row-reverse;
    }

    .message_container {
      margin-left: 0;
      margin-right: 12px;
      align-items: flex-end;
    }
  }

  &_checked {
    align-items: flex-start;
    padding: 12px;
  }

  &_active {
    background-color: var(--primary-active);
    animation: fadeOut 2s ease-in-out forwards;
  }
}

@keyframes fadeOut {
  0% {
    background-color: var(--primary-active);
  }

  100% {
    background-color: transparent;
  }
}
</style>
