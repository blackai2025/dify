'use client'
import type { FC } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EditingEntity, FilterEntity } from './types'
import { ATTRIBUTE_TYPES, EntityType } from './types'
import Modal from '@/app/components/base/modal'
import Button from '@/app/components/base/button'
import Input from '@/app/components/base/input'
import { useToastContext } from '@/app/components/base/toast'

type EditEntityModalProps = {
  isShow: boolean
  entityType: EntityType
  editingEntity?: FilterEntity
  onClose: () => void
  onSave: (entity: EditingEntity) => Promise<void>
}

const EditEntityModal: FC<EditEntityModalProps> = ({
  isShow,
  entityType,
  editingEntity,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation()
  const { notify } = useToastContext()
  const isNew = !editingEntity
  const isBaseEntity = entityType === EntityType.BASE_ENTITY

  const [name, setName] = useState(editingEntity?.name || '')
  const [attributeType, setAttributeType] = useState(editingEntity?.attribute_type || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      setError(t('filterRules.nameRequired'))
      return
    }

    if (!isBaseEntity && !attributeType.trim()) {
      setError(t('filterRules.attributeTypeRequired'))
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      // Check if this is a new entity with multiple names (separated by comma, semicolon, or newline)
      if (isNew) {
        const separatorRegex = /[,，、;；\n]+/
        const names = name.split(separatorRegex)
          .map(n => n.trim())
          .filter(n => n.length > 0)

        if (names.length > 1) {
          // Multiple entities - save them one by one
          let successCount = 0
          const failedNames: string[] = []

          for (const entityName of names) {
            try {
              await onSave({
                name: entityName,
                attribute_type: isBaseEntity ? undefined : attributeType.trim(),
                isNew,
                originalName: editingEntity?.name,
              })
              successCount++
            }
            catch {
              failedNames.push(entityName)
            }
          }

          if (failedNames.length > 0) {
            // Some succeeded, some failed
            notify({
              type: 'warning',
              message: t('filterRules.batchAddPartialFailed', {
                success: successCount,
                failed: failedNames.length,
                names: failedNames.join(', '),
              }),
            })
          }
          else {
            // All succeeded
            notify({
              type: 'success',
              message: t('filterRules.batchAddSuccess', { count: successCount }),
            })
          }
        }
        else {
          // Single entity
          await onSave({
            name: name.trim(),
            attribute_type: isBaseEntity ? undefined : attributeType.trim(),
            isNew,
            originalName: editingEntity?.name,
          })
        }
      }
      else {
        // Edit mode - single entity only
        await onSave({
          name: name.trim(),
          attribute_type: isBaseEntity ? undefined : attributeType.trim(),
          isNew,
          originalName: editingEntity?.name,
        })
      }
      onClose()
    }
    catch (error: unknown) {
      const err = error as Error
      setError(err.message || t('filterRules.saveFailed'))
    }
    finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isShow={isShow}
      onClose={onClose}
      title={isNew
        ? (isBaseEntity ? t('filterRules.addEntity') : t('filterRules.addAttribute'))
        : (isBaseEntity ? t('filterRules.editEntity') : t('filterRules.editAttribute'))}
      className="!w-[480px]"
    >
      <div className="space-y-4">
        {/* Name Input */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            {isBaseEntity ? t('filterRules.entityName') : t('filterRules.attributeName')}
            <span className="ml-1 text-red-500">*</span>
          </label>
          {isNew
            ? (
              <textarea
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={isBaseEntity ? t('filterRules.entityNamePlaceholder') : t('filterRules.attributeNamePlaceholder')}
                maxLength={1000}
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )
            : (
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={isBaseEntity ? t('filterRules.entityNamePlaceholder') : t('filterRules.attributeNamePlaceholder')}
                maxLength={100}
              />
            )}
        </div>

        {/* Attribute Type Select (only for attributes) */}
        {!isBaseEntity && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {t('filterRules.attributeType')}
              <span className="ml-1 text-red-500">*</span>
            </label>
            <select
              value={attributeType}
              onChange={e => setAttributeType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('filterRules.selectAttributeType')}</option>
              {ATTRIBUTE_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Help Text */}
        <div className="text-xs text-gray-500">
          {isNew && (
            <div className="mb-2 text-blue-600">
              💡 {t('filterRules.batchAddTip')}
            </div>
          )}
          {isBaseEntity
            ? t('filterRules.entityHelpText')
            : t('filterRules.attributeHelpText')}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex justify-end gap-2">
        <Button
          onClick={onClose}
          disabled={isSubmitting}
        >
          {t('common.operation.cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          loading={isSubmitting}
        >
          {isNew ? t('common.operation.add') : t('common.operation.save')}
        </Button>
      </div>
    </Modal>
  )
}

export default EditEntityModal
