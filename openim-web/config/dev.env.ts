const BASE_HOST = '8.148.145.206'
const CHAT_URL = `http://${BASE_HOST}:10008`
const API_URL = `http://${BASE_HOST}:10002`
const WS_URL = `ws://${BASE_HOST}:10001`

export default {
  NODE_ENV: 'development',
  CHAT_URL,
  API_URL,
  WS_URL,
  LOG_LEVEL: 5,
  VERSION: 'openim',
}
