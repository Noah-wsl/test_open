import useContactStore from '@store/modules/contact'
import useConversationStore from '@store/modules/conversation'
import useUserStore from '@store/modules/user'
import useApprovalStore from '@store/modules/approval'
import { conversationSort, IMSDK } from '@/utils/imCommon'
import { CbEvents } from '@openim/wasm-client-sdk'
import type {
  ConversationItem,
  GroupMemberItem,
  FriendApplicationItem,
  GroupApplicationItem,
  WSEvent,
  MessageItem,
  BlackUserItem,
  GroupItem,
  FriendUserItem,
  SelfUserInfo,
} from '@openim/wasm-client-sdk/lib/types/entity'
import { MessageType, SessionType } from '@openim/wasm-client-sdk'
import useMessageStore, { ExMessageItem } from '@/store/modules/message'
import emitter from '@/utils/events'
import { CustomMessageType } from '@/constants/enum'
import {
  getAccessedFriendApplication,
  getAccessedGroupApplication,
} from '@/utils/storage'
import { ToastWrapperInstance } from 'vant/lib/toast/types'
import { feedbackToast } from '@/utils/common'

import messageRing from '@assets/audio/newMsg.mp3'

export function useGlobalEvent() {
  const userStore = useUserStore()
  const conversationStore = useConversationStore()
  const contactStore = useContactStore()
  const messageStore = useMessageStore()
  const approvalStore = useApprovalStore()

  const { t } = useI18n()
  const router = useRouter()

  let syncToast: ToastWrapperInstance | null = null
  let audioEl: HTMLAudioElement | null = null
  let titleTimer: ReturnType<typeof setInterval> | null = null
  const originalTitle = document.title
  let unreadMsgCount = 0

  let originalFaviconHref = ''
  let faviconImg: HTMLImageElement | null = null
  let faviconCanvas: HTMLCanvasElement | null = null
  let faviconCtx: CanvasRenderingContext2D | null = null

  const setIMListener = () => {
    // account
    IMSDK.on(CbEvents.OnSelfInfoUpdated, selfUpdateHandler)
    IMSDK.on(CbEvents.OnConnecting, connectingHandler)
    IMSDK.on(CbEvents.OnConnectFailed, connectFailedHandler)
    IMSDK.on(CbEvents.OnConnectSuccess, connectSuccessHandler)
    IMSDK.on(CbEvents.OnKickedOffline, kickHandler)
    IMSDK.on(CbEvents.OnUserTokenExpired, expiredHandler)
    // sync
    IMSDK.on(CbEvents.OnSyncServerStart, syncStartHandler)
    IMSDK.on(CbEvents.OnSyncServerFinish, syncFinishHandler)
    IMSDK.on(CbEvents.OnSyncServerFailed, syncFailedHandler)
    IMSDK.on(CbEvents.OnSyncServerProgress, syncProgressHandler)
    // message
    IMSDK.on(CbEvents.OnRecvNewMessage, newMessageHandler)
    IMSDK.on(CbEvents.OnRecvNewMessages, newMessageHandler)
    // conversation
    IMSDK.on(CbEvents.OnConversationChanged, conversationChnageHandler)
    IMSDK.on(CbEvents.OnNewConversation, newConversationHandler)
    IMSDK.on(CbEvents.OnTotalUnreadMessageCountChanged, totalUnreadChangeHandler)
    // friend
    IMSDK.on(CbEvents.OnFriendInfoChanged, friednInfoChangeHandler)
    IMSDK.on(CbEvents.OnFriendAdded, friednAddedHandler)
    IMSDK.on(CbEvents.OnFriendDeleted, friednDeletedHandler)
    // blacklist
    IMSDK.on(CbEvents.OnBlackAdded, blackAddedHandler)
    IMSDK.on(CbEvents.OnBlackDeleted, blackDeletedHandler)
    // group
    IMSDK.on(CbEvents.OnJoinedGroupAdded, joinedGroupAddedHandler)
    IMSDK.on(CbEvents.OnJoinedGroupDeleted, joinedGroupDeletedHandler)
    IMSDK.on(CbEvents.OnGroupDismissed, joinedGroupDismissHandler)
    IMSDK.on(CbEvents.OnGroupInfoChanged, groupInfoChangedHandler)
    IMSDK.on(CbEvents.OnGroupMemberAdded, groupMemberAddedHandler)
    IMSDK.on(CbEvents.OnGroupMemberDeleted, groupMemberDeletedHandler)
    IMSDK.on(CbEvents.OnGroupMemberInfoChanged, groupMemberInfoChangedHandler)
    // application
    IMSDK.on(CbEvents.OnFriendApplicationAdded, friendApplicationAddedHandler)
    IMSDK.on(CbEvents.OnFriendApplicationAccepted, friendApplicationProcessedHandler)
    IMSDK.on(CbEvents.OnFriendApplicationRejected, friendApplicationProcessedHandler)
    IMSDK.on(CbEvents.OnGroupApplicationAdded, groupApplicationAddedHandler)
    IMSDK.on(CbEvents.OnGroupApplicationAccepted, groupApplicationProcessedHandler)
    IMSDK.on(CbEvents.OnGroupApplicationRejected, groupApplicationProcessedHandler)
  }

  const selfUpdateHandler = ({ data }: WSEvent<SelfUserInfo>) => {
    const imUserInfo = data
    userStore.updateSelfInfo({
      ...userStore.storeSelfInfo,
      ...imUserInfo,
      globalRecvMsgOpt: imUserInfo.globalRecvMsgOpt,
    })
    messageStore.updateMessageNicknameAndFaceUrl({
      sendID: data.userID,
      senderNickname: data.nickname,
      senderFaceUrl: data.faceURL,
    })
  }
  const connectingHandler = () => {}
  const connectFailedHandler = ({ errCode }: WSEvent) => {
    if (errCode == 705) {
      tryOut(t('messageTip.loginExpiration'))
    }
  }
  const connectSuccessHandler = () => {}
  const kickHandler = () => tryOut(t('messageTip.loginKicked'))
  const expiredHandler = () => tryOut(t('messageTip.loginExpiration'))

  const tryOut = (message: string) =>
    feedbackToast({
      message,
      error: message,
      onClose: () => {
        userStore.userLogout(true)
        router.push('/login')
      },
    })

  // sync
  const syncStartHandler = ({ data }: WSEvent<boolean>) => {
    userStore.isSyncing = true
    userStore.reinstall = data
  }
  const syncFinishHandler = () => {
    userStore.isSyncing = false
    syncToast?.close()
    syncToast = null
    contactStore.getFriendListFromReq()
    contactStore.getGroupListFromReq()
    conversationStore.getConversationListFromReq()
    conversationStore.getUnReadCountFromReq()
  }
  const syncFailedHandler = () => {
    userStore.isSyncing = false
    if (!syncToast) return
    syncToast.message = t('syncFailed')
    syncToast.close()
    syncToast = null
  }
  const syncProgressHandler = ({ data }: WSEvent<number>) => {
    userStore.progress = data
  }

  // message
  const newMessageHandler = ({ data }: WSEvent<ExMessageItem | ExMessageItem[]>) => {
    if (syncToast) return
    const parsedData = data
    if (Array.isArray(parsedData)) {
      parsedData.map((message) => handleNewMessage(message))
      return
    }
    handleNewMessage(parsedData)
  }
  const handleNewMessage = (newServerMsg: ExMessageItem) => {
    // 审批消息同步：无论是否在当前会话，都需要同步到本地 store
    if (newServerMsg.contentType === MessageType.CustomMessage) {
      try {
        const customData = JSON.parse(newServerMsg.customElem!.data)
        if (customData.customType === CustomMessageType.ApprovalMessage) {
          const instance = customData.data?.instance
          if (instance) {
            approvalStore.syncRemoteInstance(instance)
          }
        }
      } catch {}
    }

    if (inCurrentConversation(newServerMsg)) {
      if (newServerMsg.contentType === MessageType.CustomMessage) {
        let customData: { customType?: number } = {}
        try {
          customData = JSON.parse(newServerMsg.customElem?.data || '{}')
        } catch {}
        if (200 <= customData.customType! && customData.customType! <= 204) {
          return
        }
      }
      if (
        newServerMsg.contentType !== MessageType.TypingMessage &&
        newServerMsg.contentType !== MessageType.RevokeMessage
      ) {
        newServerMsg.isAppend = true
        messageStore.pushNewMessage(newServerMsg)
        emitter.emit('CHAT_MAIN_SCROLL_TO_BOTTOM', true)
      }
    }

    // 非当前会话或窗口失焦时，提示用户
    const isSelf = newServerMsg.sendID === userStore.storeSelfInfo.userID
    if (
      !isSelf &&
      newServerMsg.contentType !== MessageType.TypingMessage &&
      newServerMsg.contentType !== MessageType.RevokeMessage
    ) {
      notifyNewMessage(newServerMsg)
    }
  }

  const notifyNewMessage = (message: ExMessageItem) => {
    const isVisible = document.visibilityState === 'visible'
    const inCurrent = inCurrentConversation(message)

    // 在当前会话且窗口可见时，不闪烁标题、不弹桌面通知，只播放轻微提示音
    if (inCurrent && isVisible) {
      playMessageRing()
      return
    }

    // 增加未读计数并闪烁标题
    unreadMsgCount++
    flashTitle()

    // 播放提示音
    playMessageRing()

    // 桌面通知
    showDesktopNotification(message)
  }

  const playMessageRing = () => {
    if (!audioEl) {
      audioEl = new Audio(messageRing)
      audioEl.volume = 0.6
    }
    audioEl.currentTime = 0
    audioEl.play().catch(() => {
      // 浏览器自动播放策略限制，忽略错误
    })
  }

  const loadOriginalFavicon = () => {
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
    originalFaviconHref = link?.href || '/favicon.ico'
    faviconImg = new Image()
    faviconImg.crossOrigin = 'anonymous'
    faviconImg.onload = () => {
      // 图片加载完成后，若已有未读消息则立即绘制徽章（避免消息先于 favicon 加载而丢失）
      if (unreadMsgCount > 0) updateFaviconBadge(unreadMsgCount)
    }
    faviconImg.src = originalFaviconHref
  }

  const updateFaviconBadge = (count: number) => {
    if (!faviconImg || !faviconImg.complete || faviconImg.naturalWidth === 0) return
    if (!faviconCanvas) {
      faviconCanvas = document.createElement('canvas')
      faviconCanvas.width = 32
      faviconCanvas.height = 32
      faviconCtx = faviconCanvas.getContext('2d')
    }
    if (!faviconCtx) return

    faviconCtx.clearRect(0, 0, 32, 32)
    faviconCtx.drawImage(faviconImg, 0, 0, 32, 32)

    if (count > 0) {
      const badge = count > 99 ? '99+' : String(count)
      const radius = count > 99 ? 9 : 8
      const cx = 32 - radius - 1
      const cy = radius + 1
      faviconCtx.beginPath()
      faviconCtx.arc(cx, cy, radius, 0, Math.PI * 2)
      faviconCtx.fillStyle = '#ff4d4f'
      faviconCtx.fill()

      faviconCtx.fillStyle = '#fff'
      faviconCtx.font = badge.length > 2 ? '9px Arial' : '11px Arial'
      faviconCtx.textAlign = 'center'
      faviconCtx.textBaseline = 'middle'
      faviconCtx.fillText(badge, cx, cy + 1)
    }

    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
    const dataUrl = faviconCanvas.toDataURL('image/png')
    if (link) {
      link.href = dataUrl
    } else {
      const newLink = document.createElement('link')
      newLink.rel = 'icon'
      newLink.href = dataUrl
      document.head.appendChild(newLink)
    }
  }

  const restoreOriginalFavicon = () => {
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
    if (link) link.href = originalFaviconHref
  }

  const flashTitle = () => {
    updateFaviconBadge(unreadMsgCount)
    if (titleTimer) return
    titleTimer = setInterval(() => {
      document.title =
        document.title === originalTitle
          ? `[${unreadMsgCount}条新消息] ${originalTitle}`
          : originalTitle
    }, 1000)
  }

  const clearFlashTitle = () => {
    if (titleTimer) {
      clearInterval(titleTimer)
      titleTimer = null
    }
    document.title = originalTitle
    unreadMsgCount = 0
    restoreOriginalFavicon()
  }

  const showDesktopNotification = (message: ExMessageItem) => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') {
      createNotification(message)
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') createNotification(message)
      })
    }
  }

  const createNotification = (message: ExMessageItem) => {
    const title = message.senderNickname || '新消息'
    const body = getMessageAbstract(message)
    new Notification(title, {
      body,
      icon: message.senderFaceUrl || '/favicon.ico',
      tag: message.clientMsgID,
    })
  }

  const getMessageAbstract = (message: ExMessageItem) => {
    switch (message.contentType) {
      case MessageType.TextMessage:
        return message.textElem?.content || ''
      case MessageType.PictureMessage:
        return '[图片]'
      case MessageType.VoiceMessage:
        return '[语音]'
      case MessageType.VideoMessage:
        return '[视频]'
      case MessageType.FileMessage:
        return `[文件] ${message.fileElem?.fileName || ''}`
      case MessageType.CustomMessage:
        return '[自定义消息]'
      default:
        return '[新消息]'
    }
  }

  const onWindowFocus = () => {
    clearFlashTitle()
  }
  const inCurrentConversation = (newServerMsg: MessageItem) => {
    switch (newServerMsg.sessionType) {
      case SessionType.Single:
        return (
          newServerMsg.sendID === conversationStore.storeCurrentConversation.userID ||
          (newServerMsg.sendID === userStore.storeSelfInfo.userID &&
            newServerMsg.recvID === conversationStore.storeCurrentConversation.userID)
        )
      case SessionType.Group:
      case SessionType.WorkingGroup:
        return (
          newServerMsg.groupID === conversationStore.storeCurrentConversation.groupID
        )
      case SessionType.Notification:
        return newServerMsg.sendID === conversationStore.storeCurrentConversation.userID
      default:
        return false
    }
  }
  // conversation
  const conversationChnageHandler = ({ data }: WSEvent<ConversationItem[]>) => {
    let filterArr: ConversationItem[] = []
    const changes = data
    const chids = changes.map((ch) => ch.conversationID)
    filterArr = conversationStore.storeConversationList.filter(
      (tc) => !chids.includes(tc.conversationID),
    )
    const idx = changes.findIndex(
      (c) =>
        c.conversationID === conversationStore.storeCurrentConversation.conversationID,
    )
    if (idx !== -1) conversationStore.updateCurrentConversation(changes[idx])
    const result = [...changes, ...filterArr]
    conversationStore.updateConversationList(conversationSort(result))
  }
  const newConversationHandler = ({ data }: WSEvent<ConversationItem[]>) => {
    const news = data
    const result = [...news, ...conversationStore.storeConversationList]
    conversationStore.updateConversationList(conversationSort(result))
  }
  const totalUnreadChangeHandler = ({ data }: WSEvent<number>) => {
    conversationStore.updateUnReadCount(data)
  }

  // friend
  const friednInfoChangeHandler = ({ data }: WSEvent<FriendUserItem>) => {
    if (data.userID === conversationStore.currentConversation?.userID) {
      messageStore.updateMessageNicknameAndFaceUrl({
        sendID: data.userID,
        senderNickname: data.remark || data.nickname,
        senderFaceUrl: data.faceURL,
      })
    }
    contactStore.updateFriendList(data)
  }
  const friednAddedHandler = ({ data }: WSEvent<FriendUserItem>) => {
    contactStore.pushNewFriend(data)
  }
  const friednDeletedHandler = ({ data }: WSEvent<FriendUserItem>) => {
    contactStore.updateFriendList(data, true)
  }

  // blacklist
  const blackAddedHandler = ({ data }: WSEvent<BlackUserItem>) => {
    contactStore.pushNewBlack(data)
  }
  const blackDeletedHandler = ({ data }: WSEvent<BlackUserItem>) => {
    contactStore.updateBlackList(data, true)
  }

  // group
  const joinedGroupAddedHandler = ({ data }: WSEvent<GroupItem>) => {
    if (data.groupID === conversationStore.currentConversation?.groupID) {
      conversationStore.updateCurrentGroupInfo(data)
    }
    contactStore.pushNewGroup(data)
  }
  const joinedGroupDeletedHandler = ({ data }: WSEvent<GroupItem>) => {
    if (data.groupID === conversationStore.currentConversation?.groupID) {
      conversationStore.updateCurrentGroupInfo(data)
      conversationStore.getCurrentGroupInfoFromReq(data.groupID)
      conversationStore.updateCurrentMemberInGroup()
    }
    contactStore.updateGroupList(data, true)
  }
  const joinedGroupDismissHandler = ({ data }: WSEvent<GroupItem>) => {
    if (data.groupID === conversationStore.currentConversation?.groupID) {
      conversationStore.getCurrentMemberInGroupFromReq(data.groupID)
    }
  }
  const groupInfoChangedHandler = ({ data }: WSEvent<GroupItem>) => {
    contactStore.updateGroupList(data)
    if (data.groupID === conversationStore.storeCurrentGroupInfo?.groupID) {
      conversationStore.updateCurrentGroupInfo(data)
    }
  }
  const groupMemberAddedHandler = () => {}
  const groupMemberDeletedHandler = () => {}
  const groupMemberInfoChangedHandler = ({ data }: WSEvent<GroupMemberItem>) => {
    if (data.groupID === conversationStore.storeCurrentMemberInGroup?.groupID) {
      if (data.userID === conversationStore.storeCurrentMemberInGroup?.userID) {
        conversationStore.updateCurrentMemberInGroup({ ...data })
      }
      messageStore.updateMessageNicknameAndFaceUrl({
        sendID: data.userID,
        senderNickname: data.nickname,
        senderFaceUrl: data.faceURL,
      })
    }
    contactStore.updateUserCardMemberInfo(data)
  }

  //application
  const friendApplicationAddedHandler = ({ data }: WSEvent<FriendApplicationItem>) => {
    const application = data
    const isRecv = application.toUserID === userStore.storeSelfInfo.userID
    if (isRecv) {
      contactStore.pushNewRecvFriendApplication(application)
    } else {
      contactStore.pushNewSendFriendApplication(application)
    }
  }
  const friendApplicationProcessedHandler = ({
    data,
  }: WSEvent<FriendApplicationItem>) => {
    const application = data
    const isRecv = application.toUserID === userStore.storeSelfInfo.userID
    if (isRecv) {
      contactStore.updateRecvFriendApplicationList(application)
    } else {
      contactStore.updateSendFriendApplicationList(application)
    }
  }
  const groupApplicationAddedHandler = ({ data }: WSEvent<GroupApplicationItem>) => {
    const application = data
    const isRecv = application.userID !== userStore.storeSelfInfo.userID
    if (isRecv) {
      contactStore.pushNewRecvGroupApplication(application)
    } else {
      contactStore.pushNewSendGroupApplication(application)
    }
  }
  const groupApplicationProcessedHandler = ({
    data,
  }: WSEvent<GroupApplicationItem>) => {
    const application = data
    const isRecv = application.userID !== userStore.storeSelfInfo.userID
    if (isRecv) {
      contactStore.updateRecvGroupApplicationList(application)
    } else {
      contactStore.updateSendGroupApplicationList(application)
    }
  }

  const disposeIMListener = () => {
    IMSDK.off(CbEvents.OnSelfInfoUpdated, selfUpdateHandler)
    IMSDK.off(CbEvents.OnConnecting, connectingHandler)
    IMSDK.off(CbEvents.OnConnectFailed, connectFailedHandler)
    IMSDK.off(CbEvents.OnConnectSuccess, connectSuccessHandler)
    IMSDK.off(CbEvents.OnKickedOffline, kickHandler)
    IMSDK.off(CbEvents.OnUserTokenExpired, expiredHandler)
    // sync
    IMSDK.off(CbEvents.OnSyncServerStart, syncStartHandler)
    IMSDK.off(CbEvents.OnSyncServerFinish, syncFinishHandler)
    IMSDK.off(CbEvents.OnSyncServerFailed, syncFailedHandler)
    IMSDK.off(CbEvents.OnSyncServerProgress, syncProgressHandler)
    // message
    IMSDK.off(CbEvents.OnRecvNewMessage, newMessageHandler)
    IMSDK.off(CbEvents.OnRecvNewMessages, newMessageHandler)
    // conversation
    IMSDK.off(CbEvents.OnConversationChanged, conversationChnageHandler)
    IMSDK.off(CbEvents.OnNewConversation, newConversationHandler)
    IMSDK.off(CbEvents.OnTotalUnreadMessageCountChanged, totalUnreadChangeHandler)
    // friend
    IMSDK.off(CbEvents.OnFriendInfoChanged, friednInfoChangeHandler)
    IMSDK.off(CbEvents.OnFriendAdded, friednAddedHandler)
    IMSDK.off(CbEvents.OnFriendDeleted, friednDeletedHandler)
    // blacklist
    IMSDK.off(CbEvents.OnBlackAdded, blackAddedHandler)
    IMSDK.off(CbEvents.OnBlackDeleted, blackDeletedHandler)
    // group
    IMSDK.off(CbEvents.OnJoinedGroupAdded, joinedGroupAddedHandler)
    IMSDK.off(CbEvents.OnJoinedGroupDeleted, joinedGroupDeletedHandler)
    IMSDK.off(CbEvents.OnGroupDismissed, joinedGroupDismissHandler)
    IMSDK.off(CbEvents.OnGroupInfoChanged, groupInfoChangedHandler)
    IMSDK.off(CbEvents.OnGroupMemberAdded, groupMemberAddedHandler)
    IMSDK.off(CbEvents.OnGroupMemberDeleted, groupMemberDeletedHandler)
    IMSDK.off(CbEvents.OnGroupMemberInfoChanged, groupMemberInfoChangedHandler)
    // application
    IMSDK.off(CbEvents.OnFriendApplicationAdded, friendApplicationAddedHandler)
    IMSDK.off(CbEvents.OnFriendApplicationAccepted, friendApplicationProcessedHandler)
    IMSDK.off(CbEvents.OnFriendApplicationRejected, friendApplicationProcessedHandler)
    IMSDK.off(CbEvents.OnGroupApplicationAdded, groupApplicationAddedHandler)
    IMSDK.off(CbEvents.OnGroupApplicationAccepted, groupApplicationProcessedHandler)
    IMSDK.off(CbEvents.OnGroupApplicationRejected, groupApplicationProcessedHandler)
  }

  watch(
    () => userStore.storeSelfInfo.userID,
    () => {
      // 用户切换时清理状态
    },
  )

  watch(
    [
      () => contactStore.storeRecvFriendApplicationList,
      () => contactStore.storeRecvGroupApplicationList,
      () => userStore.storeSelfInfo.userID,
    ],
    (newValue) => {
      const userID = newValue[2]
      if (!userID) return
      const accessedFriendApplications = getAccessedFriendApplication()
      let unHandleFriendApplicationNum = newValue[0].filter(
        (application) =>
          application.handleResult === 0 &&
          !accessedFriendApplications.includes(
            `${application.fromUserID}_${application.createTime}`,
          ),
      ).length

      const accessedGroupApplications = getAccessedGroupApplication()
      let unHandleGroupApplicationNum = newValue[1].filter(
        (application) =>
          application.handleResult === 0 &&
          !accessedGroupApplications.includes(
            `${application.userID}_${application.createTime}`,
          ),
      ).length
      contactStore.updateUnHandleFriendApplicationNum(unHandleFriendApplicationNum)
      contactStore.updateUnHandleGroupApplicationNum(unHandleGroupApplicationNum)
    },
  )

  onMounted(() => {
    setIMListener()
    window.addEventListener('focus', onWindowFocus)
    loadOriginalFavicon()
  })
  onUnmounted(() => {
    disposeIMListener()
    window.removeEventListener('focus', onWindowFocus)
    clearFlashTitle()
  })
}
