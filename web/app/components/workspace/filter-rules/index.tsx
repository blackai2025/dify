'use client'
import type { FC } from 'react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR, { mutate as globalMutate } from 'swr'
import {
  RiAddLine,
  RiDownloadLine,
  RiUploadLine,
} from '@remixicon/react'
import type { EditingEntity, FilterEntity } from './types'
import { EntityType } from './types'
import EntityList from './entity-list'
import EditEntityModal from './edit-entity-modal'
import {
  addFilterEntity,
  deleteFilterEntity,
  fetchFilterRules,
  updateFilterEntity,
} from '@/service/filter-rules'
import Button from '@/app/components/base/button'
import { useToastContext } from '@/app/components/base/toast'

const FilterRulesManagement: FC = () => {
  const { t } = useTranslation()
  const { notify } = useToastContext()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch data
  const { data, error, mutate, isLoading } = useSWR('filter-rules', fetchFilterRules)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingEntityType, setEditingEntityType] = useState<EntityType>(EntityType.BASE_ENTITY)
  const [editingEntity, setEditingEntity] = useState<FilterEntity | undefined>()
  const [isImporting, setIsImporting] = useState(false)

  // Add entity
  const handleAddEntity = (type: EntityType) => {
    setEditingEntityType(type)
    setEditingEntity(undefined)
    setShowModal(true)
  }

  // Edit entity
  const handleEditEntity = (entity: FilterEntity, type: EntityType) => {
    setEditingEntityType(type)
    setEditingEntity(entity)
    setShowModal(true)
  }

  // Save entity (add or update)
  const handleSaveEntity = async (entity: EditingEntity) => {
    // For batch add, don't show notification here - let the modal handle it
    const isBatchAdd = entity.isNew && entity.name.match(/[,，、;；\n]+/)

    try {
      if (entity.isNew) {
        // Add new entity
        await addFilterEntity({
          name: entity.name,
          attribute_type: entity.attribute_type,
        })
        if (!isBatchAdd)
          notify({ type: 'success', message: t('filterRules.addSuccess') })
      }
      else {
        // Update existing entity
        await updateFilterEntity({
          old_name: entity.originalName!,
          new_name: entity.name,
          attribute_type: entity.attribute_type,
        })
        notify({ type: 'success', message: t('filterRules.updateSuccess') })
      }
      // Refresh local data
      mutate()
      // Trigger global refresh for all components using the same SWR key
      globalMutate('filter-rules')
    }
    catch (err: any) {
      if (!isBatchAdd)
        notify({ type: 'error', message: err.message || t('filterRules.saveFailed') })

      throw err
    }
  }

  // Delete entity
  const handleDeleteEntity = async (name: string) => {
    try {
      await deleteFilterEntity({ name })
      notify({ type: 'success', message: t('filterRules.deleteSuccess') })
      // Refresh local data
      mutate()
      // Trigger global refresh for all components using the same SWR key
      globalMutate('filter-rules')
    }
    catch (err: any) {
      notify({ type: 'error', message: err.message || t('filterRules.deleteFailed') })
    }
  }

  // Import from CSV
  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      notify({ type: 'error', message: t('filterRules.invalidFileType') })
      return
    }

    setIsImporting(true)

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())

      // Skip header line
      const dataLines = lines.slice(1)

      if (dataLines.length === 0) {
        notify({ type: 'error', message: t('filterRules.emptyFile') })
        return
      }

      let successCount = 0
      let failedCount = 0

      for (const line of dataLines) {
        // Parse CSV line (simple implementation, handles basic cases)
        const [name, attributeType] = line.split(',').map(s => s.trim())

        if (!name) continue

        try {
          await addFilterEntity({
            name,
            attribute_type: attributeType || undefined,
          })
          successCount++
        }
        catch {
          failedCount++
        }
      }

      // Refresh data
      mutate()
      globalMutate('filter-rules')

      // Show result
      if (failedCount === 0) {
        notify({
          type: 'success',
          message: t('filterRules.importSuccess', { count: successCount }),
        })
      }
      else {
        notify({
          type: 'warning',
          message: t('filterRules.importPartialFailed', {
            success: successCount,
            failed: failedCount,
          }),
        })
      }
    }
    catch {
      notify({ type: 'error', message: t('filterRules.importFailed') })
    }
    finally {
      setIsImporting(false)
      // Reset file input
      if (fileInputRef.current)
        fileInputRef.current.value = ''
    }
  }

  // Export to CSV
  const handleExport = () => {
    if (!data)
      return

    const allItems = [...data.entities, ...data.attributes]
    const csvRows = allItems.map(item => `${item.name},${item.attribute_type || ''}`)
    const csvContent = `实体,属性类型\n${csvRows.join('\n')}`

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `filter_rules_${new Date().toISOString().split('T')[0]}.csv`
    link.click()

    notify({ type: 'success', message: t('filterRules.exportSuccess') })
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-red-500">{t('filterRules.loadError')}</p>
          <Button onClick={() => mutate()}>{t('common.operation.retry')}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {t('filterRules.title')}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {t('filterRules.description')}
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="secondary"
              onClick={handleImportClick}
              disabled={isLoading || isImporting}
              loading={isImporting}
            >
              <RiUploadLine className="mr-1 h-4 w-4" />
              {t('filterRules.import')}
            </Button>
            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={isLoading || !data}
            >
              <RiDownloadLine className="mr-1 h-4 w-4" />
              {t('filterRules.export')}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="grid flex-1 grid-cols-2 gap-6 overflow-hidden">
        {/* Base Entities */}
        <div className="flex flex-col rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {t('filterRules.baseEntities')}
            </h2>
            <Button
              size="small"
              variant="primary"
              onClick={() => handleAddEntity(EntityType.BASE_ENTITY)}
            >
              <RiAddLine className="mr-1 h-4 w-4" />
              {t('filterRules.addEntity')}
            </Button>
          </div>
          <EntityList
            entities={data?.entities || []}
            type={EntityType.BASE_ENTITY}
            onEdit={entity => handleEditEntity(entity, EntityType.BASE_ENTITY)}
            onDelete={handleDeleteEntity}
            isLoading={isLoading}
          />
        </div>

        {/* Attributes */}
        <div className="flex flex-col rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {t('filterRules.attributes')}
            </h2>
            <Button
              size="small"
              variant="primary"
              onClick={() => handleAddEntity(EntityType.ATTRIBUTE)}
            >
              <RiAddLine className="mr-1 h-4 w-4" />
              {t('filterRules.addAttribute')}
            </Button>
          </div>
          <EntityList
            entities={data?.attributes || []}
            type={EntityType.ATTRIBUTE}
            onEdit={entity => handleEditEntity(entity, EntityType.ATTRIBUTE)}
            onDelete={handleDeleteEntity}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && (
        <EditEntityModal
          isShow={showModal}
          entityType={editingEntityType}
          editingEntity={editingEntity}
          onClose={() => setShowModal(false)}
          onSave={handleSaveEntity}
        />
      )}
    </div>
  )
}

export default FilterRulesManagement
