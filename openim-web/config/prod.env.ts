const BASE_HOST = '192.168.0.125'
const CHAT_URL = `http://${BASE_HOST}:10008`
const API_URL = `http://${BASE_HOST}:10002`
const WS_URL = `ws://${BASE_HOST}:10001`

export default {
  NODE_ENV: 'production',
  CHAT_URL,
  API_URL,
  WS_URL,
  LOG_LEVEL: 5,
  VERSION: 'openim',
}
