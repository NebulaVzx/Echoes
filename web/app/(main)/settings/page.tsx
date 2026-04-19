'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api, LLMSettings } from '@/lib/api'
import Link from 'next/link'

const settingsSchema = z.object({
  llm: z.object({
    llm_provider: z.enum(['openai', 'anthropic'], {
      required_error: '请选择 LLM 提供商',
    }),
    llm_model: z.string().min(1, '模型名称不能为空').max(100),
    llm_temperature: z.coerce.number().min(0).max(2).default(0.7),
    api_key: z.string().optional(),
  }),
})

type SettingsFormData = z.infer<typeof settingsSchema>

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-20250514'],
}

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      llm: {
        llm_provider: 'openai',
        llm_model: 'gpt-4o-mini',
        llm_temperature: 0.7,
        api_key: '',
      },
    },
  })

  const selectedProvider = watch('llm.llm_provider')

  // Load existing settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await api.getSettings()
        if (response.success && response.data) {
          reset({ llm: response.data })
        }
      } catch (err) {
        console.error('Failed to load settings:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [reset])

  // Update model suggestions when provider changes
  useEffect(() => {
    const models = PROVIDER_MODELS[selectedProvider] || []
    const currentModel = watch('llm.llm_model')
    if (!models.includes(currentModel)) {
      setValue('llm.llm_model', models[0] || '')
    }
  }, [selectedProvider, setValue, watch])

  const onSubmit = async (data: SettingsFormData) => {
    setIsSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    try {
      const response = await api.updateSettings(data)
      if (response.success) {
        setSaveSuccess(true)
        if (response.data) {
          reset({ llm: response.data })
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
          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              LLM 提供商
            </label>
            <select
              {...register('llm.llm_provider')}
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors text-sm"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
            {errors.llm?.llm_provider && (
              <p className="mt-1 text-xs text-red-500">{errors.llm.llm_provider.message}</p>
            )}
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              模型
            </label>
            <input
              {...register('llm.llm_model')}
              list="model-suggestions"
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors text-sm"
            />
            <datalist id="model-suggestions">
              {(PROVIDER_MODELS[selectedProvider] || []).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {errors.llm?.llm_model && (
              <p className="mt-1 text-xs text-red-500">{errors.llm.llm_model.message}</p>
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
              type="submit"
              disabled={isSaving}
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
