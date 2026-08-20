<template>
  <div
    class="sound-msg"
    :class="{ 'sound-msg--self': isSelfMsg }"
    :style="{ width: `${width}px` }"
    @click="togglePlay"
  >
    <div class="sound-msg__icon">
      <van-icon :name="isPlaying ? 'pause' : 'volume'" size="20" />
    </div>
    <div class="sound-msg__wave" :class="{ playing: isPlaying }">
      <span v-for="i in 4" :key="i"></span>
    </div>
    <span class="sound-msg__duration">{{ duration }}″</span>
    <audio
      ref="audioRef"
      preload="none"
      @ended="isPlaying = false"
      @pause="isPlaying = false"
      @error="isPlaying = false"
    ></audio>
  </div>
</template>

<script setup lang="ts">
import { ExedMessageItem } from './data'

interface SoundMessageProps {
  message: ExedMessageItem
  isSelfMsg?: boolean
}

const props = defineProps<SoundMessageProps>()

const audioRef = ref<HTMLAudioElement>()
const isPlaying = ref(false)

const duration = computed(() =>
  Math.max(1, Math.round(props.message.soundElem?.duration ?? 0)),
)

const width = computed(() => Math.min(180, 60 + duration.value * 5))

const togglePlay = () => {
  const audio = audioRef.value
  if (!audio) return
  if (isPlaying.value) {
    audio.pause()
    isPlaying.value = false
    return
  }
  const url =
    props.message.soundElem?.sourceUrl || props.message.soundElem?.soundPath || ''
  if (!url) return
  audio.src = url
  audio.play()
  isPlaying.value = true
}
</script>

<style lang="scss" scoped>
.sound-msg {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 12px;
  background-color: var(--chat-bubble);
  border-radius: 6px;
  cursor: pointer;
  user-select: none;

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #333;
  }

  &__wave {
    display: flex;
    align-items: center;
    gap: 3px;
    margin-left: 8px;

    span {
      width: 3px;
      height: 12px;
      border-radius: 1.5px;
      background-color: #8a8f99;
      transition: height 0.15s ease;
    }

    &.playing span {
      height: 18px;
      animation: wave-bounce 0.9s ease-in-out infinite;

      &:nth-child(2) {
        animation-delay: 0.15s;
      }

      &:nth-child(3) {
        animation-delay: 0.3s;
      }

      &:nth-child(4) {
        animation-delay: 0.45s;
      }
    }
  }

  &__duration {
    margin-left: 8px;
    font-size: 13px;
    color: #666;
  }

  &--self {
    background-color: var(--chat-bubble-sender);

    .sound-msg__icon,
    .sound-msg__duration {
      color: #fff;
    }

    .sound-msg__wave span {
      background-color: rgba(255, 255, 255, 0.85);
    }
  }
}

@keyframes wave-bounce {
  0%,
  100% {
    height: 8px;
  }

  50% {
    height: 18px;
  }
}
</style>
