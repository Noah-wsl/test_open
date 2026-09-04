const BASE_HOST = 'sdoachat.com'
const CHAT_URL = `https://${BASE_HOST}/api`
const API_URL = `https://${BASE_HOST}/chat`
const WS_URL = `wss://${BASE_HOST}/msg_gateway`

export default {
  NODE_ENV: 'production',
  CHAT_URL,
  API_URL,
  WS_URL,
  LOG_LEVEL: 5,
  VERSION: 'openim',
}
