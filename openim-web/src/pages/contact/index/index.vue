<template>
  <div class="contact-layout">
    <div class="contact-list-panel">
      <ContactHeader />
      <ContactMenuList @menuClick="handleMenuClick" />
    </div>
    <div class="hidden md:flex contact-right-panel">
      <MyFriend v-if="currentMenu === ContactMenuEnum.MyFriend" />
      <MyGroup v-else-if="currentMenu === ContactMenuEnum.MyGroup" />
      <NewFriend v-else-if="currentMenu === ContactMenuEnum.NewFriend" />
      <NewGroup v-else-if="currentMenu === ContactMenuEnum.NewGroup" />
      <div v-else class="empty-content">
        <img class="empty-img" src="@assets/images/common_empty.png" alt="empty" />
        <div class="empty-title">{{ $t('contact') }}</div>
        <div class="empty-desc">{{ $t('selectContact') || '选择左侧联系人查看详情' }}</div>
      </div>
    </div>
  </div>
</template>

<script name="contact" setup lang="ts">
import ContactHeader from './components/ContactHeader.vue'
import ContactMenuList from './components/ContactMenuList.vue'
import MyFriend from '@pages/contact/myFriend/index.vue'
import MyGroup from '@pages/contact/myGroup/index.vue'
import NewFriend from '@pages/contact/newFriend/index.vue'
import NewGroup from '@pages/contact/newGroup/index.vue'

enum ContactMenuEnum {
  NewFriend,
  NewGroup,
  MyFriend,
  MyGroup,
}

const currentMenu = ref<ContactMenuEnum | null>(null)

const handleMenuClick = (idx: ContactMenuEnum) => {
  currentMenu.value = idx
}
</script>

<style lang="scss" scoped>
.contact-layout {
  display: flex;
  height: 100%;
  flex-direction: column;

  @media (min-width: 768px) {
    flex-direction: row;
  }
}

.contact-list-panel {
  display: flex;
  flex-direction: column;
  height: 100%;

  @media (min-width: 768px) {
    width: 280px;
    flex-shrink: 0;
    border-right: 1px solid #eaeaea;
  }
}

.contact-right-panel {
  flex: 1;
  background: #fff;
  flex-direction: column;

  & > * {
    width: 100%;
    height: 100%;
  }
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
</style>
