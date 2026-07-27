<template>
  <div class="layout-wrapper">
    <tabbar class="layout-sidebar" />
    <div class="layout-content">
      <router-view v-slot="{ Component }">
        <transition>
          <keep-alive include="profile,contact,conversation">
            <component :is="Component" />
          </keep-alive>
        </transition>
      </router-view>
    </div>
    <van-overlay :show="showProgress" z-index="100">
      <div class="flex h-full w-full items-center justify-center">
        <van-loading size="24px" vertical>{{ `${userStore.progress}%` }}</van-loading>
      </div>
    </van-overlay>
  </div>
</template>

<script setup lang="ts" name="tabbar">
import Tabbar from './Tabbar.vue'
import useConversationStore from '@/store/modules/conversation'
import { AllowType, LoginStatus } from '@openim/wasm-client-sdk'
import useContactStore from '@/store/modules/contact'
import { useGlobalEvent } from './useGlobalEvent'
import {
  getApiUrl,
  getIMToken,
  getIMUserID,
  getLogLevel,
  getWsUrl,
} from '@/utils/storage'
import { IMSDK, initStore } from '@/utils/imCommon'
import useUserStore from '@/store/modules/user'
import emitter from '@/utils/events'

useGlobalEvent()
const userStore = useUserStore()
const router = useRouter()

const showProgress = computed(
  () => userStore.reinstall && userStore.progress > 0 && userStore.progress < 100,
)

onMounted(() => {
  loginCheck()
})

router.beforeEach(async (to, from, next) => {
  if (to.path === '/getCode') {
    next()
    return
  }
  if (from.path === '/login') {
    const { data } = await IMSDK.getLoginStatus()
    if (data === LoginStatus.Logout) {
      loginCheck()
    }
  }
  next()
})

const loginCheck = () => {
  const IMToken = getIMToken()
  const IMUserID = getIMUserID()
  if (!IMToken || !IMUserID) {
    router.push('/login')
    return
  }
  tryLogin()
}

const tryLogin = async () => {
  const IMToken = getIMToken()
  const IMUserID = getIMUserID()
  try {
    await IMSDK.login({
      userID: IMUserID!,
      token: IMToken!,
      apiAddr: getApiUrl(),
      wsAddr: getWsUrl(),
      platformID: 5,
      logLevel: Number(getLogLevel()),
    })
    initStore()
  } catch (error) {
    router.push('/login')
  }
}

window.userClick = (userID?: string, groupID?: string) => {
  const conversationStore = useConversationStore()
  const contactStore = useContactStore()
  if (!userID || userID === 'AtAllTag') return

  const currentGroupInfo = conversationStore.currentGroupInfo

  if (groupID && currentGroupInfo?.lookMemberInfo === AllowType.NotAllowed) {
    return
  }

  contactStore.getUserCardData(userID, groupID)
}

window.reEdit = (clientMsgID: string) => {
}
</script>

<style lang="scss" scoped>
.layout-wrapper {
  display: flex;
  height: 100%;
  flex-direction: column;

  @media (min-width: 768px) {
    flex-direction: row;
  }
}

.layout-sidebar {
  flex-shrink: 0;
}

.layout-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}
</style>
