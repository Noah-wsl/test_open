<template>
  <div class="conversation-layout">
    <!-- 会话列表区 -->
    <div class="conversation-list-panel">
      <ConversationHeader />
      <ConversationList />
    </div>

    <!-- 桌面端右侧聊天/空状态区 -->
    <div class="hidden md:flex conversation-right-panel">
      <template v-if="conversationStore.storeCurrentConversation.conversationID">
        <div class="chat-panel">
          <ChatHeader />
          <ChatContent />
          <ChatFooter />
        </div>
      </template>
      <template v-else>
        <div class="empty-content">
          <img class="empty-img" src="@assets/images/common_empty.png" alt="empty" />
          <div class="empty-title">{{ $t('startChat') || '开始聊天' }}</div>
          <div class="empty-desc">{{ $t('selectConversation') || '选择左侧会话开始交流' }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<script name="conversation" setup lang="ts">
import ConversationHeader from './components/ConversationHeader.vue'
import ConversationList from './components/ConversationList.vue'
import ChatHeader from '../chat/components/ChatHeader.vue'
import ChatContent from '../chat/components/ChatContent.vue'
import ChatFooter from '../chat/components/ChatFooter/ChatFooter.vue'
import useConversationState from '../chat/useConversationState'
import useConversationStore from '@/store/modules/conversation'

const conversationStore = useConversationStore()
useConversationState()
</script>

<style lang="scss" scoped>
.conversation-layout {
  display: flex;
  height: 100%;
  flex-direction: column;

  @media (min-width: 768px) {
    flex-direction: row;
  }
}

.conversation-list-panel {
  display: flex;
  flex-direction: column;
  height: 100%;

  @media (min-width: 768px) {
    width: 280px;
    flex-shrink: 0;
    border-right: 1px solid #eaeaea;
  }
}

.conversation-right-panel {
  flex: 1;
  background: #fff;
  flex-direction: column;

  & > * {
    width: 100%;
    height: 100%;
  }
}

.chat-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  background: #fff;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px;

  .empty-img {
    width: 160px;
    height: 160px;
    margin-bottom: 20px;
    opacity: 0.7;
  }

  .empty-title {
    font-size: 18px;
    font-weight: 500;
    color: #333;
    margin-bottom: 8px;
  }

  .empty-desc {
    font-size: 14px;
    color: #999;
  }
}

::deep(.van-search) {
  padding-top: 0 !important;
}
</style>
