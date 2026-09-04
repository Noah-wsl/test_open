const BASE_HOST = 'sdoachat.com'
const CHAT_URL = `https://${BASE_HOST}/api`        // → /api/         → chat-api 10008
const API_URL = `https://${BASE_HOST}/im-api`      // → /im-api/      → openim-server 10002
const WS_URL = `wss://${BASE_HOST}/msg_gateway`    // → /msg_gateway  → msg_gateway 10001

export default {
  NODE_ENV: 'development',
  CHAT_URL,
  API_URL,
  WS_URL,
  LOG_LEVEL: 5,
  VERSION: 'openim',
}
