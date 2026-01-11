'use client'
import type { FC } from 'react'
import type { RetrievalConfig } from '@/types/app'
import {
  RiAlertLine,
  RiCheckLine,
  RiFilter2Line,
  RiInformationLine,
} from '@remixicon/react'
import * as React from 'react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import { FullTextSearch, HybridSearch, VectorSearch } from '@/app/components/base/icons/src/vender/knowledge'
import Switch from '@/app/components/base/switch'
import Tooltip from '@/app/components/base/tooltip'
import { ModelTypeEnum } from '@/app/components/header/account-setting/model-provider-page/declarations'
import { useModelListAndDefaultModelAndCurrentProviderAndModel } from '@/app/components/header/account-setting/model-provider-page/hooks'
import { useModalContext } from '@/context/modal-context'
import { useProviderContext } from '@/context/provider-context'
import {
  DEFAULT_WEIGHTED_SCORE,
  RerankingModeEnum,
  WeightedScoreEnum,
} from '@/models/datasets'
import { fetchFilterRules } from '@/service/filter-rules'
import { RETRIEVE_METHOD } from '@/types/app'
import { EffectColor } from '../../settings/chunk-structure/types'
import OptionCard from '../../settings/option-card'
import RetrievalParamConfig from '../retrieval-param-config'

type Props = {
  disabled?: boolean
  value: RetrievalConfig
  showMultiModalTip?: boolean
  onChange: (value: RetrievalConfig) => void
}

const RetrievalMethodConfig: FC<Props> = ({
  disabled = false,
  value,
  showMultiModalTip = false,
  onChange,
}) => {
  const { t } = useTranslation()
  const { supportRetrievalMethods } = useProviderContext()
  const { setShowAccountSettingModal } = useModalContext()
  const {
    defaultModel: rerankDefaultModel,
    currentModel: isRerankDefaultModelValid,
  } = useModelListAndDefaultModelAndCurrentProviderAndModel(ModelTypeEnum.rerank)

  // Fetch filter rules for Smart Filter status display
  const { data: filterRules } = useSWR('filter-rules', fetchFilterRules)
  const filterRulesCount = {
    entities: filterRules?.entities?.length || 0,
    attributes: filterRules?.attributes?.length || 0,
    total: (filterRules?.entities?.length || 0) + (filterRules?.attributes?.length || 0),
  }

  const onSwitch = useCallback((retrieveMethod: RETRIEVE_METHOD) => {
    if ([RETRIEVE_METHOD.semantic, RETRIEVE_METHOD.fullText].includes(retrieveMethod)) {
      onChange({
        ...value,
        search_method: retrieveMethod,
        ...((!value.reranking_model.reranking_model_name || !value.reranking_model.reranking_provider_name)
          ? {
              reranking_model: {
                reranking_provider_name: isRerankDefaultModelValid ? rerankDefaultModel?.provider?.provider ?? '' : '',
                reranking_model_name: isRerankDefaultModelValid ? rerankDefaultModel?.model ?? '' : '',
              },
              reranking_enable: !!isRerankDefaultModelValid,
            }
          : {
              reranking_enable: true,
            }),
      })
    }
    if (retrieveMethod === RETRIEVE_METHOD.hybrid) {
      onChange({
        ...value,
        search_method: retrieveMethod,
        ...((!value.reranking_model.reranking_model_name || !value.reranking_model.reranking_provider_name)
          ? {
              reranking_model: {
                reranking_provider_name: isRerankDefaultModelValid ? rerankDefaultModel?.provider?.provider ?? '' : '',
                reranking_model_name: isRerankDefaultModelValid ? rerankDefaultModel?.model ?? '' : '',
              },
              reranking_enable: !!isRerankDefaultModelValid,
              reranking_mode: isRerankDefaultModelValid ? RerankingModeEnum.RerankingModel : RerankingModeEnum.WeightedScore,
            }
          : {
              reranking_enable: true,
              reranking_mode: RerankingModeEnum.RerankingModel,
            }),
        ...(!value.weights
          ? {
              weights: {
                weight_type: WeightedScoreEnum.Customized,
                vector_setting: {
                  vector_weight: DEFAULT_WEIGHTED_SCORE.other.semantic,
                  embedding_provider_name: '',
                  embedding_model_name: '',
                },
                keyword_setting: {
                  keyword_weight: DEFAULT_WEIGHTED_SCORE.other.keyword,
                },
              },
            }
          : {}),
      })
    }
  }, [value, rerankDefaultModel, isRerankDefaultModelValid, onChange])

  return (
    <div className="flex flex-col gap-y-2">
      {supportRetrievalMethods.includes(RETRIEVE_METHOD.semantic) && (
        <OptionCard
          id={RETRIEVE_METHOD.semantic}
          disabled={disabled}
          icon={<VectorSearch className="size-4" />}
          iconActiveColor="text-util-colors-purple-purple-600"
          title={t('dataset.retrieval.semantic_search.title')}
          description={t('dataset.retrieval.semantic_search.description')}
          isActive={value.search_method === RETRIEVE_METHOD.semantic}
          onClick={onSwitch}
          effectColor={EffectColor.purple}
          showEffectColor
          showChildren={value.search_method === RETRIEVE_METHOD.semantic}
          className="gap-x-2"
        >
          <RetrievalParamConfig
            type={RETRIEVE_METHOD.semantic}
            value={value}
            onChange={onChange}
            showMultiModalTip={showMultiModalTip}
          />
        </OptionCard>
      )}
      {supportRetrievalMethods.includes(RETRIEVE_METHOD.fullText) && (
        <OptionCard
          id={RETRIEVE_METHOD.fullText}
          disabled={disabled}
          icon={<FullTextSearch className="size-4" />}
          iconActiveColor="text-util-colors-purple-purple-600"
          title={t('dataset.retrieval.full_text_search.title')}
          description={t('dataset.retrieval.full_text_search.description')}
          isActive={value.search_method === RETRIEVE_METHOD.fullText}
          onClick={onSwitch}
          effectColor={EffectColor.purple}
          showEffectColor
          showChildren={value.search_method === RETRIEVE_METHOD.fullText}
          className="gap-x-2"
        >
          <RetrievalParamConfig
            type={RETRIEVE_METHOD.fullText}
            value={value}
            onChange={onChange}
            showMultiModalTip={showMultiModalTip}
          />
        </OptionCard>
      )}
      {supportRetrievalMethods.includes(RETRIEVE_METHOD.hybrid) && (
        <OptionCard
          id={RETRIEVE_METHOD.hybrid}
          disabled={disabled}
          icon={<HybridSearch className="size-4" />}
          iconActiveColor="text-util-colors-purple-purple-600"
          title={t('dataset.retrieval.hybrid_search.title')}
          description={t('dataset.retrieval.hybrid_search.description')}
          isActive={value.search_method === RETRIEVE_METHOD.hybrid}
          onClick={onSwitch}
          effectColor={EffectColor.purple}
          showEffectColor
          isRecommended
          showChildren={value.search_method === RETRIEVE_METHOD.hybrid}
          className="gap-x-2"
        >
          <RetrievalParamConfig
            type={RETRIEVE_METHOD.hybrid}
            value={value}
            onChange={onChange}
            showMultiModalTip={showMultiModalTip}
          />
        </OptionCard>
      )}

      {/* Smart Filter Section */}
      <div className="mt-4 rounded-xl border border-divider-subtle p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="system-sm-semibold text-text-secondary">
                {t('appDebug.datasetConfig.smartFilter.title')}
              </span>
              <Tooltip
                popupContent={(
                  <div className="w-[280px]">
                    <div className="mb-2 font-medium">
                      {t('appDebug.datasetConfig.smartFilter.tooltipTitle')}
                    </div>
                    <div className="space-y-2 text-xs">
                      <div>
                        <strong>{t('appDebug.datasetConfig.smartFilter.suitableFor')}</strong>
                        <ul className="mt-1 list-inside list-disc">
                          <li>{t('appDebug.datasetConfig.smartFilter.useCase1')}</li>
                          <li>{t('appDebug.datasetConfig.smartFilter.useCase2')}</li>
                        </ul>
                      </div>
                      <div>
                        <strong>{t('appDebug.datasetConfig.smartFilter.howItWorks')}</strong>
                        <p className="mt-1">
                          {t('appDebug.datasetConfig.smartFilter.mechanism')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              >
                <RiInformationLine className="h-3.5 w-3.5 cursor-help text-text-tertiary" />
              </Tooltip>
            </div>
            <div className="mt-1 text-xs text-text-tertiary">
              {t('appDebug.datasetConfig.smartFilter.description')}
            </div>
          </div>
          <Switch
            key={`filter-enabled-${value.filter_enabled}`}
            size="md"
            defaultValue={value.filter_enabled || false}
            onChange={(checked) => {
              onChange({
                ...value,
                filter_enabled: checked,
              })
            }}
          />
        </div>
        {value.filter_enabled && (
          <div className="mt-3 space-y-2 rounded-lg bg-background-section-burn p-3">
            {filterRulesCount.total > 0
              ? (
                  <>
                    <div className="flex items-center gap-2 text-xs text-text-tertiary">
                      <RiCheckLine className="h-4 w-4 text-text-success" />
                      <span>
                        {t('appDebug.datasetConfig.smartFilter.rulesConfigured', {
                          entities: filterRulesCount.entities,
                          attributes: filterRulesCount.attributes,
                        })}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAccountSettingModal({ payload: 'filter-rules' })}
                      className="inline-flex cursor-pointer items-center gap-1 text-xs text-text-accent hover:underline"
                    >
                      <RiFilter2Line className="h-3.5 w-3.5" />
                      {t('appDebug.datasetConfig.smartFilter.viewRules')}
                    </button>
                  </>
                )
              : (
                  <div className="flex items-start gap-2">
                    <RiAlertLine className="mt-0.5 h-4 w-4 shrink-0 text-text-warning" />
                    <div className="flex-1">
                      <div className="text-xs font-medium text-text-secondary">
                        {t('appDebug.datasetConfig.smartFilter.noRulesWarning')}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAccountSettingModal({ payload: 'filter-rules' })}
                        className="mt-1 inline-flex cursor-pointer items-center gap-1 text-xs text-text-accent hover:underline"
                      >
                        <RiFilter2Line className="h-3.5 w-3.5" />
                        {t('appDebug.datasetConfig.smartFilter.addRulesNow')}
                      </button>
                    </div>
                  </div>
                )}
          </div>
        )}
      </div>
    </div>
  )
}
export default React.memo(RetrievalMethodConfig)
