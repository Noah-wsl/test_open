<template>
  <!-- 桌面端左侧边栏 -->
  <div class="sidebar hidden md:flex">
    <div class="sidebar-user" @click="showProfile = true">
      <Avatar :size="36" :src="userStore.storeSelfInfo.faceURL" :desc="userStore.storeSelfInfo.nickname" />
      <span class="user-name">{{ userStore.storeSelfInfo.nickname }}</span>
    </div>
    <div class="sidebar-menu">
      <router-link
        v-for="item in menuItems"
        :key="item.path"
        :to="item.path"
        class="menu-item"
        :class="{ active: route.path === item.path || route.path.startsWith(item.path + '/') }"
      >
        <img :src="isActive(item.path) ? item.iconActive : item.icon" class="menu-icon" />
        <span class="menu-label">{{ item.label }}</span>
      </router-link>
    </div>

    <!-- 个人信息弹出面板 -->
    <div v-if="showProfile" class="profile-overlay" @click="showProfile = false">
      <div class="profile-panel" @click.stop>
        <div class="profile-header">
          <Avatar :size="48" :src="userStore.storeSelfInfo.faceURL" :desc="userStore.storeSelfInfo.nickname" />
          <span class="profile-name">{{ userStore.storeSelfInfo.nickname }}</span>
        </div>
        <div class="profile-menu">
          <div v-for="menu in profileMenus" :key="menu.route" class="profile-menu-item" @click="handleProfileMenu(menu)">
            <div class="flex items-center gap-3">
              <img :src="menu.icon" class="menu-icon-img" />
              <span>{{ menu.title }}</span>
            </div>
            <img :src="back" class="arrow-icon" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 移动端底部Tabbar -->
  <van-tabbar
    v-show="isMobile"
    :border="false"
    fixed
    safe-area-inset-bottom
    placeholder
    route
    class="md:hidden"
  >
    <van-tabbar-item
      v-for="item in menuItems"
      :key="item.path"
      :to="item.path"
      :badge="item.badge"
      :badge-props="item.badgeProps"
    >
      <span>{{ item.label }}</span>
      <template #icon="props">
        <img :src="props.active ? item.iconActive : item.icon" class="tab-icon" />
      </template>
    </van-tabbar-item>
  </van-tabbar>
</template>

<script setup lang="ts">
import conversation from '@assets/images/tabbar/conversation.png'
import conversation_active from '@assets/images/tabbar/conversation_active.png'
import contacts from '@assets/images/tabbar/contacts.png'
import contacts_active from '@assets/images/tabbar/contacts_active.png'
import approval from '@assets/images/tabbar/workbench.png'
import approval_active from '@assets/images/tabbar/workbench_active.png'
import profile from '@assets/images/tabbar/profile.png'
import profile_active from '@assets/images/tabbar/profile_active.png'

import Avatar from '@/components/Avatar/index.vue'
import info from '@assets/images/profile/info.png'
import settings from '@assets/images/profile/settings.png'
import about from '@assets/images/profile/about.png'
import logout from '@assets/images/profile/logout.png'
import back from '@assets/images/profile/back.png'

import useConversationStore from '@/store/modules/conversation'
import useContactStore from '@/store/modules/contact'
import useApprovalStore from '@/store/modules/approval'
import useUserStore from '@/store/modules/user'
import { showConfirmDialog } from 'vant'

const route = useRoute()
const router = useRouter()
const conversationStore = useConversationStore()
const contactStore = useContactStore()
const approvalStore = useApprovalStore()
const userStore = useUserStore()

const isMobile = ref(window.innerWidth < 768)

const handleResize = () => {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

const showProfile = ref(false)

const { t } = useI18n()

const profileMenus = [
  {
    icon: info,
    title: t('profileMenu.personalInformation'),
    route: 'selfInfoDetails',
  },
  {
    icon: settings,
    title: t('profileMenu.accountSetting'),
    route: 'accountSettings',
  },
  {
    icon: about,
    title: t('profileMenu.aboutUs'),
    route: 'about',
  },
  {
    icon: logout,
    title: t('profileMenu.logOut'),
  },
]

const handleProfileMenu = (menu: any) => {
  showProfile.value = false
  if (menu.route) {
    router.push(menu.route)
  } else {
    showConfirmDialog({
      message: t('messageTip.tryLogout'),
      beforeClose: (action: string) => {
        return new Promise((resolve) => {
          if (action !== 'confirm') {
            resolve(true)
            return
          }
          userStore.userLogout().finally(() => {
            resolve(true)
            router.push('/login')
          })
        })
      },
    }).catch(() => {})
  }
}

const unHandleApplicationCount = computed(() => {
  const recvFriendNum = contactStore.recvFriendApplicationList.filter(
    (item) => item.handleResult === 0,
  ).length
  const recvGroupNum = contactStore.recvGroupApplicationList.filter(
    (item) => item.handleResult === 0,
  ).length
  return recvFriendNum + recvGroupNum
})

const isActive = (path: string) => {
  return route.path === path || route.path.startsWith(path + '/')
}

const pendingApprovalCount = computed(() => approvalStore.storePendingApprovals.length)

const menuItems = computed(() => [
  {
    path: '/conversation',
    label: '消息',
    icon: conversation,
    iconActive: conversation_active,
    badge: conversationStore.storeUnReadCount,
    badgeProps: { max: 99, showZero: false },
  },
  {
    path: '/contact',
    label: '通讯录',
    icon: contacts,
    iconActive: contacts_active,
    badge: unHandleApplicationCount.value,
    badgeProps: { max: 99, showZero: false },
  },
  {
    path: '/approval',
    label: '审批',
    icon: approval,
    iconActive: approval_active,
    badge: pendingApprovalCount.value,
    badgeProps: { max: 99, showZero: false },
  },
  {
    path: '/profile',
    label: '我的',
    icon: profile,
    iconActive: profile_active,
    badge: undefined,
    badgeProps: undefined,
  },
])
</script>

<style lang="scss" scoped>
.sidebar {
  width: 64px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid #eaeaea;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
  position: relative;
}

.sidebar-user {
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;

  .user-name {
    font-size: 10px;
    color: #333;
    margin-top: 4px;
    max-width: 52px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.sidebar-menu {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  align-items: center;
}

.menu-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 8px;
  text-decoration: none;
  color: #8e9ab0;
  transition: all 0.2s;
  position: relative;

  &:hover {
    background: #f5f7fa;
  }

  &.active {
    color: var(--primary);
    background: #f0f7ff;
  }
}

.menu-icon {
  width: 24px;
  height: 24px;
  margin-bottom: 2px;
}

.menu-label {
  font-size: 10px;
  line-height: 14px;
}

.profile-overlay {
  position: fixed;
  left: 64px;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: 100;
  pointer-events: auto;
}

.profile-panel {
  width: 200px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.12);
  padding: 16px;
  margin-top: 12px;
  margin-left: 8px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.profile-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.profile-menu {
  margin-top: 8px;
}

.profile-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;

  &:hover {
    color: var(--primary);
  }

  .menu-icon-img {
    width: 18px;
    height: 18px;
  }

  .arrow-icon {
    width: 14px;
    height: 14px;
  }
}

.tab-icon {
  height: 28px;
}

::deep(.van-tabbar) {
  height: 66px;
  border-top: 1px solid #eaeaea;
}

::deep(.van-tabbar-item__icon img) {
  height: 28px;
}

::deep(.van-tabbar-item) {
  color: #8e9ab0;
}

::deep(.van-tabbar-item--active) {
  color: var(--van-tabbar-item-active-color);
}

::deep(.van-tabbar-item__text) {
  font-size: 10px;
}
</style>
