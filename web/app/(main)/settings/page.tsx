'use client'

import { useEffect, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api, LLMSettings } from '@/lib/api'
import Link from 'next/link'

const settingsSchema = z.object({
  llm: z.object({
    llm_provider: z.string().min(1, '提供商名称不能为空').max(50),
    llm_protocol: z.enum(['openai', 'anthropic']),
    llm_model: z.string().min(1, '模型名称不能为空').max(100),
    llm_temperature: z.number().min(0).max(2),
    api_key: z.string().optional(),
    base_url: z.union([z.string().url('请输入有效的 URL'), z.literal('')]).optional(),
  }),
})

type SettingsFormData = z.infer<typeof settingsSchema>

// Common providers with their default configurations
const PROVIDER_PRESETS: Record<string, { provider: string; protocol: 'openai' | 'anthropic'; base_url: string; models: string[] }> = {
  openai: {
    provider: 'openai',
    protocol: 'openai',
    base_url: '',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'o3-mini'],
  },
  anthropic: {
    provider: 'anthropic',
    protocol: 'anthropic',
    base_url: '',
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-20250514'],
  },
  deepseek: {
    provider: 'deepseek',
    protocol: 'openai',
    base_url: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  moonshot: {
    provider: 'moonshot',
    protocol: 'openai',
    base_url: 'https://api.moonshot.cn/v1',
    models: ['kimi-k2.5', 'moonshot-v1-8k', 'moonshot-v1-32k'],
  },
  qwen: {
    provider: 'qwen',
    protocol: 'openai',
    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen3-235b-a22b', 'qwen3-coder', 'qwen-max'],
  },
  zhipu: {
    provider: 'zhipu',
    protocol: 'openai',
    base_url: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4.5', 'glm-4.6', 'glm-4-flash'],
  },
  doubao: {
    provider: 'doubao',
    protocol: 'openai',
    base_url: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-seed-1.6', 'doubao-pro-32k'],
  },
}

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Test connection state
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testError, setTestError] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    getValues,
    formState: { errors },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      llm: {
        llm_provider: 'openai',
        llm_protocol: 'openai',
        llm_model: 'gpt-4o-mini',
        llm_temperature: 0.7,
        api_key: '',
        base_url: '',
      },
    },
  })

  const selectedProtocol = watch('llm.llm_protocol')

  // Track last tested values to detect changes
  const lastTestedRef = useRef<SettingsFormData | null>(null)

  // Load existing settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await api.getSettings()
        if (response.success && response.data) {
          const data = response.data
          reset({
            llm: {
              llm_provider: data.llm_provider || 'openai',
              llm_protocol: (data.llm_protocol as 'openai' | 'anthropic') || 'openai',
              llm_model: data.llm_model || 'gpt-4o-mini',
              llm_temperature: data.llm_temperature ?? 0.7,
              api_key: data.api_key || '',
              base_url: data.base_url || '',
            },
          })
        }
      } catch (err) {
        console.error('Failed to load settings:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [reset])

  // Reset test status when form values change
  useEffect(() => {
    const subscription = watch((value) => {
      if (lastTestedRef.current) {
        const current = value.llm
        const last = lastTestedRef.current.llm
        if (
          current?.llm_provider !== last.llm_provider ||
          current?.llm_protocol !== last.llm_protocol ||
          current?.llm_model !== last.llm_model ||
          current?.llm_temperature !== last.llm_temperature ||
          current?.api_key !== last.api_key ||
          current?.base_url !== last.base_url
        ) {
          setTestStatus('idle')
          setTestError('')
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [watch])

  const applyPreset = (key: string) => {
    const preset = PROVIDER_PRESETS[key]
    if (!preset) return
    setValue('llm.llm_provider', preset.provider)
    setValue('llm.llm_protocol', preset.protocol)
    setValue('llm.llm_model', preset.models[0])
    setValue('llm.base_url', preset.base_url)
    setTestStatus('idle')
    setTestError('')
  }

  const handleTest = async () => {
    const raw = getValues()
    // HTML range input returns string; backend expects number
    const payload = {
      llm: {
        ...raw.llm,
        llm_temperature:
          typeof raw.llm.llm_temperature === 'string'
            ? parseFloat(raw.llm.llm_temperature)
            : raw.llm.llm_temperature,
      },
    }
    setTestStatus('testing')
    setTestError('')
    setSaveSuccess(false)
    setSaveError('')

    try {
      const response = await api.testLLMConnection(payload)
      if (response.success) {
        setTestStatus('success')
        lastTestedRef.current = raw
      } else {
        setTestStatus('error')
        setTestError(response.error?.message || '连接失败')
      }
    } catch (err) {
      setTestStatus('error')
      setTestError(err instanceof Error ? err.message : '连接失败')
    }
  }

  const onSubmit = async (data: SettingsFormData) => {
    if (testStatus !== 'success') {
      setSaveError('请先测试连接')
      return
    }

    setIsSaving(true)
    setSaveError('')
    setSaveSuccess(false)

    // Normalize temperature to number before sending
    const payload = {
      llm: {
        ...data.llm,
        llm_temperature:
          typeof data.llm.llm_temperature === 'string'
            ? parseFloat(data.llm.llm_temperature)
            : data.llm.llm_temperature,
      },
    }

    try {
      const response = await api.updateSettings(payload)
      if (response.success) {
        setSaveSuccess(true)
        if (response.data) {
          reset({ llm: response.data })
          lastTestedRef.current = null
          setTestStatus('idle')
        }
      } else {
        setSaveError(response.error?.message || '保存失败')
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-lg font-semibold text-gray-900 dark:text-gray-50 hover:opacity-80">
              Echoes
            </Link>
            <span className="text-xs text-gray-400 dark:text-gray-500">设置</span>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-6">
          LLM 设置
        </h1>

        {/* Test connection status */}
        {testStatus === 'success' && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-600 dark:text-green-400 text-sm">
            连接成功，可以保存设置
          </div>
        )}
        {testStatus === 'error' && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-600 dark:text-red-400 text-sm">
            {testError}
          </div>
        )}

        {saveSuccess && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-600 dark:text-green-400 text-sm">
            设置已保存
          </div>
        )}

        {saveError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-600 dark:text-red-400 text-sm">
            {saveError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Quick preset buttons */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              快速选择
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PROVIDER_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
                >
                  {preset.provider === 'openai' && 'OpenAI'}
                  {preset.provider === 'anthropic' && 'Anthropic'}
                  {preset.provider === 'deepseek' && 'DeepSeek'}
                  {preset.provider === 'moonshot' && 'Kimi'}
                  {preset.provider === 'qwen' && '通义千问'}
                  {preset.provider === 'zhipu' && '智谱'}
                  {preset.provider === 'doubao' && '豆包'}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              点击自动填充提供商配置，也可手动输入自定义提供商
            </p>
          </div>

          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              LLM 提供商
            </label>
            <input
              {...register('llm.llm_provider')}
              placeholder="如：openai、deepseek、moonshot"
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors text-sm"
            />
            {errors.llm?.llm_provider && (
              <p className="mt-1 text-xs text-red-500">{errors.llm.llm_provider.message}</p>
            )}
          </div>

          {/* Protocol */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API 协议
            </label>
            <select
              {...register('llm.llm_protocol')}
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors text-sm"
            >
              <option value="openai">OpenAI 兼容协议</option>
              <option value="anthropic">Anthropic 协议</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              {selectedProtocol === 'openai'
                ? '大多数国产模型（DeepSeek、Kimi、通义千问等）使用此协议'
                : 'Anthropic 官方及部分兼容平台使用此协议'}
            </p>
            {errors.llm?.llm_protocol && (
              <p className="mt-1 text-xs text-red-500">{errors.llm.llm_protocol.message}</p>
            )}
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              模型
            </label>
            <input
              {...register('llm.llm_model')}
              placeholder="如：gpt-4o-mini、deepseek-chat"
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors text-sm"
            />
            {errors.llm?.llm_model && (
              <p className="mt-1 text-xs text-red-500">{errors.llm.llm_model.message}</p>
            )}
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Base URL
            </label>
            <input
              {...register('llm.base_url')}
              placeholder={selectedProtocol === 'openai' ? 'https://api.openai.com/v1（默认）' : 'https://api.anthropic.com/v1（默认）'}
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors text-sm"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              留空使用默认地址。国产模型通常需要填写各自的 API 端点。
            </p>
            {errors.llm?.base_url && (
              <p className="mt-1 text-xs text-red-500">{errors.llm.base_url.message}</p>
            )}
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Key
            </label>
            <input
              type="password"
              {...register('llm.api_key')}
              placeholder="留空则使用系统默认值"
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors text-sm"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              输入新的 API Key 将覆盖系统默认值，留空则保持当前配置
            </p>
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Temperature (创造性)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                {...register('llm.llm_temperature')}
                min="0"
                max="2"
                step="0.1"
                className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-right">
                {watch('llm.llm_temperature')}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              值越低输出越确定，值越高输出越随机 (0 - 2)
            </p>
            {errors.llm?.llm_temperature && (
              <p className="mt-1 text-xs text-red-500">{errors.llm.llm_temperature.message}</p>
            )}
          </div>

          <div className="pt-4 flex items-center gap-4">
            <button
              type="button"
              onClick={handleTest}
              disabled={testStatus === 'testing'}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testStatus === 'testing' ? '测试中...' : '测试连接'}
            </button>
            <button
              type="submit"
              disabled={isSaving || testStatus !== 'success'}
              className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-md text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? '保存中...' : '保存设置'}
            </button>
            <Link
              href="/"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              返回首页
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}
