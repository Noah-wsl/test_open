<template>
  <van-nav-bar
    :title="title"
    :placeholder="isMobile"
    :fixed="isMobile"
    :left-arrow="isMobile"
    :clickable="false"
    :border="false"
    @click-left="back"
  >
    <template #left>
      <slot name="left">
        <img v-if="isMobile" class="mr-4 h-[23px] min-w-[23px]" :src="arrows_left" alt="" />
      </slot>
    </template>

    <template #right>
      <slot></slot>
    </template>
  </van-nav-bar>
</template>

<script setup lang="ts">
import arrows_left from '@/assets/images/chatHeader/arrows_left.png'

import { onMounted, onUnmounted, ref } from 'vue'

type NavBarProps = {
  title?: string
  router?: boolean
}

type NavBarEmits = {
  (event: 'leftClick'): void
}

const emit = defineEmits<NavBarEmits>()
const props = withDefaults(defineProps<NavBarProps>(), {
  router: true,
})

const router = useRouter()

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

const back = () => {
  if (props.router) {
    router.back()
  } else {
    emit('leftClick')
  }
}
</script>

<style lang="scss" scoped></style>

