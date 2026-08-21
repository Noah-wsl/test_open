import { feedbackToast } from '@/utils/common'
import { IMSDK, getCleanText } from '@/utils/imCommon'
import type { MessageItem } from '@openim/wasm-client-sdk/lib/types/entity'
import { Ref } from 'vue'

type CreateNomalMessageProps = {
  messageContent: Ref<string>
}

export default function useCreateNomalMessage({
  messageContent,
}: CreateNomalMessageProps) {
  const getCleanTextWithBr = () => {
    let text = messageContent.value
    text = text.replace(/<div>/g, '\n').replace(/<\/div>/g, '')
    text = text.replace(/<br\s*\/?>/gi, '\n')
    return getCleanText(text)
  }

  const getTextMessage = async () => {
    const formattedText = getCleanTextWithBr()

    return (await IMSDK.createTextMessage(formattedText)).data
  }

  const switchNomalMessage = async () => {
    let message
    message = (await getTextMessage()) as MessageItem
    if (!message) {
      feedbackToast({
        error: 'create message failed',
        message: 'create message failed',
      })
      return
    }
    return message
  }

  return {
    switchNomalMessage,
    getCleanText,
  }
}
