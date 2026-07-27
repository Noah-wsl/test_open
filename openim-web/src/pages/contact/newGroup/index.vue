<template>
  <div class="page_container">
    <template v-if="!detailApp">
      <NavBar :title="$t('contactMenu.newGroup')" />
      <div class="mt-[10px] flex-1 overflow-y-auto">
        <virtual-list
          v-if="comptRecvApplications.length > 0"
          class="my_scrollbar overflow-y-auto bg-white"
          :data-key="'userID'"
          :data-sources="comptRecvApplications"
          :data-component="ApplicationItem"
          :estimate-size="88"
          :extra-props="{
            total: comptRecvApplications.length,
            type: ApplicationTypeEnum.RecivedGroupApplication,
            onToDetail: handleToDetail,
          }"
        />
        <virtual-list
          v-if="comptSentApplications.length > 0"
          class="my_scrollbar overflow-y-auto bg-white"
          :data-key="'groupID'"
          :data-sources="comptSentApplications"
          :data-component="ApplicationItem"
          :estimate-size="88"
          :extra-props="{
            total: comptSentApplications.length,
            type: ApplicationTypeEnum.SentGroupApplication,
            onToDetail: handleToDetail,
          }"
        />
      </div>
    </template>
    <template v-else>
      <div class="flex items-center border-b border-[var(--gap-text)] bg-white px-4 py-3">
        <img @click="detailApp = null" class="h-5 w-5 cursor-pointer" :src="arrows_left" alt="" />
        <span class="ml-3 text-base font-medium">{{ $t('contactMenu.newGroup') }}</span>
      </div>
      <ApplicationDetails
        :application="detailApp.application"
        :type="detailApp.type"
        embedded
        @processed="detailApp = null"
        @close="detailApp = null"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import VirtualList from '@components/VirtualList'
import ApplicationItem from '@/components/ApplicationItem/index.vue'
import ApplicationDetails from '@pages/contact/applicationDetails/index.vue'
import { ApplicationTypeEnum } from '@/components/ApplicationItem/data'
import useContactStore from '@/store/modules/contact'
import {
  getAccessedGroupApplication,
  setAccessedGroupApplication,
} from '@/utils/storage'
import arrows_left from '@/assets/images/chatHeader/arrows_left.png'

const contactStore = useContactStore()

const detailApp = ref<{ application: any; type: ApplicationTypeEnum } | null>(null)

const handleToDetail = (source: any, type: ApplicationTypeEnum) => {
  if (window.innerWidth >= 768) {
    detailApp.value = { application: source, type }
  }
}

const comptRecvApplications = computed(() =>
  contactStore.storeRecvGroupApplicationList
    .sort((a, b) => (a.handleResult === 0 ? -1 : 1))
    .slice(0, 4),
)
const comptSentApplications = computed(() =>
  contactStore.storeSendGroupApplicationList
    .sort((a, b) => (a.handleResult === 0 ? -1 : 1))
    .slice(0, 4),
)

const storeAccessedApplication = () => {
  const accessedGroupApplications = getAccessedGroupApplication()
  let unHandleGroupApplication = contactStore.storeRecvGroupApplicationList.filter(
    (application) =>
      application.handleResult === 0 &&
      !accessedGroupApplications.includes(
        `${application.userID}_${application.createTime}`,
      ),
  )
  if (unHandleGroupApplication.length === 0) {
    return
  }
  unHandleGroupApplication.map((application) => {
    accessedGroupApplications.push(`${application.userID}_${application.createTime}`)
  })
  setAccessedGroupApplication(accessedGroupApplications)
  contactStore.updateUnHandleGroupApplicationNum(0)
}

onMounted(() => {
  storeAccessedApplication()
})
</script>

<style lang="scss" scoped>
:deep(.van-tabs) {
  height: 100%;
  display: flex;
  flex-direction: column;

  .van-tabs__wrap {
    min-height: var(--van-tabs-line-height);
  }

  .van-tabs__content {
    flex: 1;
    overflow: hidden;

    .van-tab__panel {
      height: 100%;
      display: flex;
      flex-direction: column;
    }
  }
}
</style>
