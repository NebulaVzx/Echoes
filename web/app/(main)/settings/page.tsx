'use client'

import { useEffect, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api, LLMSettings, UserSettings } from '@/lib/api'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { Toast, ToastContainer } from '@/components/ui/toast'

const settingsSchema = z.object({
  llm_provider: z.string().min(1, '提供商名称不能为空').max(50),
  llm_protocol: z.enum(['openai', 'anthropic']),
  llm_model: z.string().min(1, '模型名称不能为空').max(100),
  llm_temperature: z.number().min(0).max(2),
  api_key: z.string().optional(),
  base_url: z.union([z.string().url('请输入有效的 URL'), z.literal('')]).optional(),
  include_note_in_analysis: z.boolean().optional(),
  similarity_threshold: z.number().min(0).max(1),
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
  const [isSavingConnection, setIsSavingConnection] = useState(false)
  const [isSavingProcessing, setIsSavingProcessing] = useState(false)
  const [isSavingSearch, setIsSavingSearch] = useState(false)

  // Test connection state
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; duration?: number } | null>(null)
  const showToast = (message: string, type: 'success' | 'error', duration?: number) => {
    setToast({ message, type, duration })
  }
  const dismissToast = () => setToast(null)

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
      llm_provider: 'openai',
      llm_protocol: 'openai',
      llm_model: 'gpt-4o-mini',
      llm_temperature: 0.7,
      api_key: '',
      base_url: '',
      include_note_in_analysis: false,
      similarity_threshold: 0.4,
    },
  })

  const selectedProtocol = watch('llm_protocol')

  // Track last tested connection values
  const lastTestedRef = useRef<Partial<SettingsFormData> | null>(null)

  // Load existing settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await api.getSettings()
        if (response.success && response.data) {
          const data = response.data
          reset({
            llm_provider: data.llm_provider || 'openai',
            llm_protocol: (data.llm_protocol as 'openai' | 'anthropic') || 'openai',
            llm_model: data.llm_model || 'gpt-4o-mini',
            llm_temperature: data.llm_temperature ?? 0.7,
            api_key: data.api_key || '',
            base_url: data.base_url || '',
            include_note_in_analysis: data.include_note_in_analysis ?? false,
            similarity_threshold: data.search_similarity_threshold ?? 0.4,
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

  // Reset test status when connection form values change
  useEffect(() => {
    const subscription = watch((value) => {
      if (lastTestedRef.current) {
        const last = lastTestedRef.current
        if (
          value.llm_provider !== last.llm_provider ||
          value.llm_protocol !== last.llm_protocol ||
          value.llm_model !== last.llm_model ||
          value.llm_temperature !== last.llm_temperature ||
          value.api_key !== last.api_key ||
          value.base_url !== last.base_url
        ) {
          setTestStatus('idle')
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [watch])

  const applyPreset = (key: string) => {
    const preset = PROVIDER_PRESETS[key]
    if (!preset) return
    setValue('llm_provider', preset.provider)
    setValue('llm_protocol', preset.protocol)
    setValue('llm_model', preset.models[0])
    setValue('base_url', preset.base_url)
    setTestStatus('idle')
  }

  const handleTest = async () => {
    const raw = getValues()
    const llmPayload: LLMSettings = {
      llm_provider: raw.llm_provider,
      llm_protocol: raw.llm_protocol,
      llm_model: raw.llm_model,
      llm_temperature: typeof raw.llm_temperature === 'string' ? parseFloat(raw.llm_temperature) : raw.llm_temperature,
      api_key: raw.api_key || '',
      base_url: raw.base_url || '',
      include_note_in_analysis: raw.include_note_in_analysis || false,
    }
    setTestStatus('testing')
    dismissToast()

    try {
      const response = await api.testLLMConnection({ llm: llmPayload })
      if (response.success) {
        setTestStatus('success')
        lastTestedRef.current = {
          llm_provider: raw.llm_provider,
          llm_protocol: raw.llm_protocol,
          llm_model: raw.llm_model,
          llm_temperature: raw.llm_temperature,
          api_key: raw.api_key,
          base_url: raw.base_url,
        }
        showToast('连接成功，可以保存设置', 'success', 6000)
      } else {
        setTestStatus('error')
        showToast(response.error?.message || '连接失败', 'error')
      }
    } catch (err) {
      setTestStatus('error')
      showToast(err instanceof Error ? err.message : '连接失败', 'error')
    }
  }

  const onSaveConnection = async () => {
    if (testStatus !== 'success') {
      showToast('请先测试连接', 'error')
      return
    }

    setIsSavingConnection(true)
    dismissToast()

    const data = getValues()
    const payload = {
      llm: {
        llm_provider: data.llm_provider,
        llm_protocol: data.llm_protocol,
        llm_model: data.llm_model,
        llm_temperature: typeof data.llm_temperature === 'string' ? parseFloat(data.llm_temperature) : data.llm_temperature,
        api_key: data.api_key || '',
        base_url: data.base_url || '',
        include_note_in_analysis: data.include_note_in_analysis || false,
      } as LLMSettings,
    }

    try {
      const response = await api.updateSettings(payload)
      if (response.success) {
        showToast('LLM 连接设置已保存', 'success')
        lastTestedRef.current = null
        setTestStatus('idle')
      } else {
        showToast(response.error?.message || '保存失败', 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存失败', 'error')
    } finally {
      setIsSavingConnection(false)
    }
  }

  const onSaveProcessing = async () => {
    setIsSavingProcessing(true)
    dismissToast()

    const data = getValues()
    const payload = {
      llm: {
        llm_provider: data.llm_provider,
        llm_protocol: data.llm_protocol,
        llm_model: data.llm_model,
        llm_temperature: typeof data.llm_temperature === 'string' ? parseFloat(data.llm_temperature) : data.llm_temperature,
        api_key: data.api_key || '',
        base_url: data.base_url || '',
        include_note_in_analysis: data.include_note_in_analysis || false,
      } as LLMSettings,
    }

    try {
      const response = await api.updateSettings(payload)
      if (response.success) {
        showToast('处理偏好已保存', 'success')
      } else {
        showToast(response.error?.message || '保存失败', 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存失败', 'error')
    } finally {
      setIsSavingProcessing(false)
    }
  }

  const onSaveSearch = async () => {
    setIsSavingSearch(true)
    dismissToast()

    const data = getValues()
    const payload = {
      search: {
        similarity_threshold: typeof data.similarity_threshold === 'string'
          ? parseFloat(data.similarity_threshold)
          : data.similarity_threshold,
      },
    }

    try {
      const response = await api.updateSettings(payload)
      if (response.success) {
        showToast('搜索偏好已保存', 'success')
      } else {
        showToast(response.error?.message || '保存失败', 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存失败', 'error')
    } finally {
      setIsSavingSearch(false)
    }
  }

  if (isLoading) {
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
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-64 mb-6" />
            <div className="space-y-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <div className="flex gap-4 pt-2">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-28" />
              </div>
            </div>
          </div>
        </div>
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

      <ToastContainer>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={dismissToast}
            duration={toast.duration}
          />
        )}
      </ToastContainer>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Section 1: LLM Connection */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-1">
            LLM 连接
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            配置 LLM 提供商和认证信息，保存前需要先测试连接
          </p>

          <div className="space-y-5">
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
            </div>

            {/* Provider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                LLM 提供商
              </label>
              <input
                {...register('llm_provider')}
                placeholder="如：openai、deepseek、moonshot"
                className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors text-sm"
              />
              {errors.llm_provider && (
                <p className="mt-1 text-xs text-red-500">{errors.llm_provider.message}</p>
              )}
            </div>

            {/* Protocol */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                API 协议
              </label>
              <select
                {...register('llm_protocol')}
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
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                模型
              </label>
              <input
                {...register('llm_model')}
                placeholder="如：gpt-4o-mini、deepseek-chat"
                className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors text-sm"
              />
              {errors.llm_model && (
                <p className="mt-1 text-xs text-red-500">{errors.llm_model.message}</p>
              )}
            </div>

            {/* Base URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Base URL
              </label>
              <input
                {...register('base_url')}
                placeholder={selectedProtocol === 'openai' ? 'https://api.openai.com/v1（默认）' : 'https://api.anthropic.com/v1（默认）'}
                className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors text-sm"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                留空使用默认地址。国产模型通常需要填写各自的 API 端点。
              </p>
              {errors.base_url && (
                <p className="mt-1 text-xs text-red-500">{errors.base_url.message}</p>
              )}
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                API Key
              </label>
              <input
                type="password"
                {...register('api_key')}
                placeholder="留空则使用系统默认值"
                className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors text-sm"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                输入新的 API Key 将覆盖系统默认值，留空则保持当前配置
              </p>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={testStatus === 'testing'}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testStatus === 'testing' ? '测试中...' : '测试连接'}
              </button>
              <button
                type="button"
                onClick={onSaveConnection}
                disabled={isSavingConnection || testStatus !== 'success'}
                className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-md text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingConnection ? '保存中...' : '保存连接设置'}
              </button>
            </div>
          </div>
        </section>

        {/* Section 2: Processing Preferences */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-1">
            处理偏好
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            控制 LLM 处理记忆时的行为
          </p>

          <div className="space-y-5">
            {/* Temperature */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Temperature (创造性)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  {...register('llm_temperature', { valueAsNumber: true })}
                  min="0"
                  max="2"
                  step="0.1"
                  className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-right">
                  {watch('llm_temperature')}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                值越低输出越确定，值越高输出越随机 (0 - 2)
              </p>
              {errors.llm_temperature && (
                <p className="mt-1 text-xs text-red-500">{errors.llm_temperature.message}</p>
              )}
            </div>

            {/* Include note in LLM analysis */}
            <div className="flex items-center justify-between py-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  备注参与 LLM 分析
                </label>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-500">
                  开启后，备注内容将一并发送给 LLM 用于生成标签和链接摘要
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  {...register('include_note_in_analysis')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-gray-400 dark:peer-focus:ring-gray-500 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-gray-500 peer-checked:bg-gray-900 dark:peer-checked:bg-gray-100" />
              </label>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onSaveProcessing}
                disabled={isSavingProcessing}
                className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-md text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingProcessing ? '保存中...' : '保存处理偏好'}
              </button>
            </div>
          </div>
        </section>

        {/* Section 3: Search Preferences */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-1">
            搜索偏好
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            调整语义搜索的相关度阈值
          </p>

          <div className="space-y-5">
            {/* Similarity Threshold */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                相似度阈值
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  {...register('similarity_threshold', { valueAsNumber: true })}
                  min="0"
                  max="1"
                  step="0.05"
                  className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400 w-16 text-right">
                  {Math.round((watch('similarity_threshold') || 0) * 100)}%
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                只显示相似度高于此阈值的结果。阈值越低结果越多，阈值越高结果越精准 (0% - 100%)
              </p>
              {errors.similarity_threshold && (
                <p className="mt-1 text-xs text-red-500">{errors.similarity_threshold.message}</p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onSaveSearch}
                disabled={isSavingSearch}
                className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-md text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingSearch ? '保存中...' : '保存搜索偏好'}
              </button>
            </div>
          </div>
        </section>

        {/* Back link */}
        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            返回首页
          </Link>
        </div>
      </div>
    </main>
  )
}
