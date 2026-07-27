<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <img class="logo" src="@assets/images/logo.png" alt="logo" />
        <h1 class="title">{{ $t('welcome') }}</h1>
        <p class="subtitle">
          {{ $t('notHaveAccount') }}
          <span class="link" @click="getCode(true)">{{ $t('nowRegister') }}</span>
        </p>
      </div>

      <van-form @submit="onSubmit">
        <!-- 手机号 -->
        <div v-if="!isByEmail" class="form-item">
          <div class="label">{{ $t('cellphone') }}</div>
          <div class="input-row">
            <div class="area-code" @click="showAreaCode = true">
              <span>{{ formData.areaCode }}</span>
              <van-icon name="arrow-down" />
            </div>
            <van-field
              v-model="formData.phoneNumber"
              name="phoneNumber"
              type="number"
              :placeholder="$t('placeholder.inputPhoneNumber')"
              class="phone-field"
            />
          </div>
        </div>

        <!-- 邮箱 -->
        <div v-else class="form-item">
          <div class="label">{{ $t('email') }}</div>
          <van-field
            v-model="formData.email"
            name="email"
            :placeholder="$t('placeholder.inputEmail')"
            class="single-field"
          />
        </div>

        <!-- 密码 -->
        <div v-if="isByPassword" class="form-item">
          <div class="label">{{ $t('password') }}</div>
          <van-field
            v-model="formData.password"
            name="password"
            type="password"
            :placeholder="$t('placeholder.inputPassword')"
            class="single-field"
          />
        </div>

        <!-- 验证码 -->
        <div v-else class="form-item">
          <div class="label">{{ $t('reAcquireDesc') }}</div>
          <van-field
            v-model="formData.verificationCode"
            name="verificationCode"
            type="text"
            :placeholder="$t('placeholder.inputVerificationCode')"
            class="single-field"
          >
            <template #button>
              <span class="code-btn" @click="reSend" v-if="count <= 0">{{ $t('buttons.verificationCode') }}</span>
              <span class="code-count" v-else>{{ count }}S</span>
            </template>
          </van-field>
        </div>

        <div class="form-links">
          <span class="link-text" @click="getCode(false)">{{ $t('forgetPasswordTitle') }}</span>
          <span class="link-text primary" @click="isByPassword = !isByPassword">
            {{ isByPassword ? $t('buttons.verificationCodeLogin') : $t('buttons.passwordLogin') }}
          </span>
        </div>

        <div class="form-actions">
          <van-button
            :loading="loading"
            block
            type="primary"
            native-type="submit"
            class="login-btn"
          >
            {{ $t('buttons.login') }}
          </van-button>

          <van-button
            @click="isByEmail = !isByEmail"
            block
            plain
            type="primary"
            class="switch-btn"
          >
            {{ isByEmail ? $t('buttons.phoneNumberLogin') : $t('buttons.emailLogin') }}
          </van-button>
        </div>
      </van-form>
    </div>

    <van-popup v-model:show="showAreaCode" round position="bottom">
      <van-picker
        :columns="countryCode"
        @cancel="showAreaCode = false"
        @confirm="onConfirmAreaCode"
        :columns-field-names="{
          text: 'phone_code',
          value: 'phone_code',
          children: 'children',
        }"
      />
    </van-popup>

    <van-action-sheet v-model:show="showActions" :actions="actions" @select="onSelect" />
  </div>
</template>

<script setup lang="ts">
import md5 from 'md5'
import type { PickerConfirmEventParams } from 'vant'
import { login, sendSms } from '@/api/login'
import countryCode from '@/utils/areaCode'
import { feedbackToast } from '@/utils/common'
import { setIMProfile } from '@/utils/storage'
import { UsedFor } from '@/api/data'

const { t } = useI18n()
const router = useRouter()
const showActions = ref(false)
const isRegiste = ref(false)
const actions = ref<{ idx: number; name: string }[]>([])

const formData = reactive({
  phoneNumber: localStorage.getItem('IMAccount') ?? '',
  email: '',
  areaCode: '+86',
  password: '',
  verificationCode: '',
  accept: true,
})
const loading = ref(false)
const isByPassword = ref(true)
const isByEmail = ref(false)
const showAreaCode = ref(false)
const count = ref(0)
let timer: NodeJS.Timer

const onSubmit = async () => {
  loading.value = true
  localStorage.setItem('IMAccount', formData.phoneNumber)
  try {
    const {
      data: { chatToken, imToken, userID },
    } = await login({
      phoneNumber: isByEmail.value ? '' : formData.phoneNumber,
      password: isByPassword.value ? md5(formData.password) : '',
      areaCode: formData.areaCode,
      verifyCode: formData.verificationCode,
      email: formData.email,
    })

    setIMProfile({ chatToken, imToken, userID })
    router.push('/conversation')
  } catch (error) {
    // feedbackToast({ message: t('messageTip.loginFailed'), error })
  }
  loading.value = false
}

const onConfirmAreaCode = ({ selectedValues }: PickerConfirmEventParams) => {
  formData.areaCode = String(selectedValues[0])
  showAreaCode.value = false
}

const reSend = () => {
  if (count.value > 0) return
  sendSms({
    phoneNumber: formData.phoneNumber,
    areaCode: formData.areaCode,
    email: formData.email,
    usedFor: UsedFor.Login,
  }).then(startTimer)
}

const startTimer = () => {
  if (timer) {
    clearInterval(timer)
  }
  count.value = 60
  timer = setInterval(() => {
    if (count.value > 0) {
      count.value -= 1
    } else {
      clearInterval(timer)
    }
  }, 1000)
}

const getCode = (flag: boolean) => {
  isRegiste.value = flag
  if (flag) {
    actions.value = [
      { idx: 0, name: t('buttons.emailRegiste') },
      { idx: 1, name: t('buttons.phoneNumberRegiste') },
    ]
  } else {
    actions.value = [
      { idx: 0, name: t('buttons.emailRetrieve') },
      { idx: 1, name: t('buttons.phoneNumberRetrieve') },
    ]
  }
  showActions.value = true
}

const onSelect = (item: { idx: number; name: string }) => {
  router.push({
    path: 'getCode',
    query: {
      isRegiste: isRegiste.value + '',
      isByEmail: item.idx === 0 ? true + '' : false + '',
    },
  })
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;

  .logo {
    width: 64px;
    height: 64px;
    margin-bottom: 16px;
  }

  .title {
    font-size: 22px;
    font-weight: 600;
    color: #181818;
    margin-bottom: 8px;
  }

  .subtitle {
    font-size: 14px;
    color: #666;

    .link {
      color: var(--primary);
      cursor: pointer;
      margin-left: 4px;

      &:hover {
        opacity: 0.8;
      }
    }
  }
}

.form-item {
  margin-bottom: 20px;

  .label {
    font-size: 14px;
    color: #181818;
    margin-bottom: 8px;
    font-weight: 500;
  }

  .input-row {
    display: flex;
    align-items: center;
    border: 1px solid #dcdcdc;
    border-radius: 4px;
    overflow: hidden;
    transition: border-color 0.2s;

    &:focus-within {
      border-color: var(--primary);
    }

    .area-code {
      display: flex;
      align-items: center;
      padding: 0 12px;
      border-right: 1px solid #dcdcdc;
      font-size: 14px;
      color: #181818;
      cursor: pointer;
      white-space: nowrap;
      height: 40px;

      .van-icon {
        margin-left: 4px;
        font-size: 12px;
        color: #999;
      }
    }

    .phone-field {
      flex: 1;
      padding: 0;

      :deep(.van-field__control) {
        height: 40px;
        padding: 0 12px;
        font-size: 14px;
      }
    }
  }

  .single-field {
    padding: 0;
    border: 1px solid #dcdcdc;
    border-radius: 4px;
    overflow: hidden;
    transition: border-color 0.2s;

    &:focus-within {
      border-color: var(--primary);
    }

    :deep(.van-field__control) {
      height: 40px;
      padding: 0 12px;
      font-size: 14px;
    }

    :deep(.van-field__right-icon) {
      padding-right: 12px;
    }
  }

  .code-btn {
    color: var(--primary);
    font-size: 14px;
    cursor: pointer;
    padding: 0 12px;
    white-space: nowrap;

    &:hover {
      opacity: 0.8;
    }
  }

  .code-count {
    color: #999;
    font-size: 14px;
    padding: 0 12px;
    white-space: nowrap;
  }
}

.form-links {
  display: flex;
  justify-content: space-between;
  margin-bottom: 24px;

  .link-text {
    font-size: 13px;
    color: #666;
    cursor: pointer;

    &:hover {
      color: var(--primary);
    }

    &.primary {
      color: var(--primary);
    }
  }
}

.form-actions {
  .login-btn {
    height: 40px;
    font-size: 15px;
    font-weight: 500;
    border-radius: 4px;
    margin-bottom: 12px;

    :deep(.van-button__content) {
      font-weight: 500;
    }
  }

  .switch-btn {
    height: 40px;
    font-size: 14px;
    border-radius: 4px;
    color: #666;
    border-color: #dcdcdc;

    &:hover {
      border-color: var(--primary);
      color: var(--primary);
    }
  }
}

@media (max-width: 480px) {
  .login-page {
    padding: 0;
    background: #fff;
    align-items: flex-start;
  }

  .login-card {
    box-shadow: none;
    border-radius: 0;
    padding: 32px 24px;
  }
}
</style>
