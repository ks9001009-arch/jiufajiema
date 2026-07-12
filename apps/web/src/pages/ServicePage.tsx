import { useEffect, useState } from 'react'
import {
  createService,
  getCompanies,
  getServices,
  updateService,
} from '../api/http'
import type {
  Company,
  Service,
  ServiceStatus,
} from '../api/http'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'

function formatDate(value?: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ServicePage() {
  const [services, setServices] = useState<Service[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [companyId, setCompanyId] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ServiceStatus>('ACTIVE')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const isEditing = Boolean(editingService)

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [serviceResult, companyResult] = await Promise.all([
        getServices(),
        getCompanies(),
      ])

      setServices(serviceResult)
      setCompanies(companyResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载服务列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function openCreateModal() {
    setEditingService(null)
    setCompanyId(companies[0]?.id || '')
    setName('')
    setCode('')
    setDescription('')
    setStatus('ACTIVE')
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(service: Service) {
    setEditingService(service)
    setCompanyId(service.companyId)
    setName(service.name)
    setCode(service.code)
    setDescription(service.description || '')
    setStatus(service.status)
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) {
      return
    }

    setModalOpen(false)
  }

  async function handleSubmitService() {
    const trimmedName = name.trim()
    const trimmedCode = code.trim()
    const trimmedDescription = description.trim()

    if (!companyId) {
      setFormError('请选择所属公司')
      return
    }

    if (!trimmedName) {
      setFormError('请输入服务名称')
      return
    }

    if (!trimmedCode) {
      setFormError('请输入服务编码')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      if (editingService) {
        await updateService(editingService.id, {
          name: trimmedName,
          code: trimmedCode,
          description: trimmedDescription,
          status,
        })
      } else {
        await createService({
          companyId,
          name: trimmedName,
          code: trimmedCode,
          description: trimmedDescription || undefined,
        })
      }

      setModalOpen(false)
      await loadData()
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : isEditing
            ? '编辑服务失败'
            : '新增服务失败',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="manage-page">
      <PageHeader
        title="服务管理"
        subtitle="管理平台服务配置，支持服务列表、新增和编辑。"
        actions={
          <>
            <button className="secondary-button" type="button" onClick={loadData}>
              刷新
            </button>

            <button className="primary-button" type="button" onClick={openCreateModal}>
              新增服务
            </button>
          </>
        }
      />

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>服务列表</strong>
          <span>
            {loading
              ? '正在加载...'
              : `共 ${services.length} 条服务记录`}
          </span>
        </div>

        {error ? <div className="table-error">{error}</div> : null}

        <table className="data-table">
          <thead>
            <tr>
              <th>服务名称</th>
              <th>服务编码</th>
              <th>所属公司</th>
              <th>描述</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>正在加载服务列表...</td>
              </tr>
            ) : services.length > 0 ? (
              services.map((service) => (
                <tr key={service.id}>
                  <td>{service.name}</td>
                  <td>{service.code}</td>
                  <td>{service.company?.name || '-'}</td>
                  <td>{service.description || '-'}</td>
                  <td>
                    <StatusBadge status={service.status} />
                  </td>
                  <td>{formatDate(service.createdAt)}</td>
                  <td>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => openEditModal(service)}
                    >
                      编辑
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>暂无服务数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {modalOpen ? (
        <div className="modal-mask">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>{isEditing ? '编辑服务' : '新增服务'}</h3>
                <p>{isEditing ? '修改服务基础信息' : '创建一个新的平台服务'}</p>
              </div>

              <button className="modal-close" type="button" onClick={closeModal}>
                ×
              </button>
            </div>

            <div className="modal-form">
              <label>
                <span>所属公司</span>
                <select
                  value={companyId}
                  onChange={(event) => setCompanyId(event.target.value)}
                  disabled={isEditing}
                >
                  <option value="">请选择公司</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>服务名称</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如：Telegram"
                />
              </label>

              <label>
                <span>服务编码</span>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="例如：TELEGRAM"
                />
              </label>

              <label>
                <span>描述</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="填写服务用途说明"
                  rows={4}
                />
              </label>

              {isEditing ? (
                <label>
                  <span>状态</span>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as ServiceStatus)}
                  >
                    <option value="ACTIVE">启用</option>
                    <option value="DISABLED">停用</option>
                  </select>
                </label>
              ) : null}

              {formError ? <div className="form-error">{formError}</div> : null}
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                type="button"
                onClick={closeModal}
                disabled={saving}
              >
                取消
              </button>

              <button
                className="primary-button"
                type="button"
                onClick={handleSubmitService}
                disabled={saving}
              >
                {saving ? '保存中...' : isEditing ? '保存修改' : '确认新增'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
