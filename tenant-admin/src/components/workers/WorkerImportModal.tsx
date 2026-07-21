import { useRef, useState } from 'react'
import { AlertCircle, Search, Upload, X } from 'lucide-react'
import { workersApi, type WorkerImportPreview, type WorkerImportPreviewItem } from '../../api/workers'
import { useTranslation } from '../../i18n/useTranslation'

type WorkerImportModalProps = {
  onClose: () => void
  onDone: () => void
  changedBy?: string
}

function ImportPreviewList({
  title,
  items,
  tone,
}: {
  title: string
  items: WorkerImportPreviewItem[]
  tone: 'success' | 'warning' | 'danger' | 'neutral'
}) {
  if (items.length === 0) return null

  const color = tone === 'success'
    ? 'var(--success)'
    : tone === 'danger'
    ? 'var(--danger)'
    : tone === 'warning'
    ? 'var(--warning)'
    : 'var(--text-muted)'

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '7px 10px', background: 'var(--bg-elevated)', fontSize: 12, fontWeight: 700, color }}>
        {title}
      </div>
      <div style={{ maxHeight: 126, overflow: 'auto' }}>
        {items.map((item, index) => (
          <div key={`${item.workerId}-${index}`} style={{ display: 'grid', gridTemplateColumns: '82px 1fr', gap: 8, padding: '7px 10px', borderTop: index ? '1px solid var(--border)' : 0 }}>
            <span className="td-mono" style={{ fontSize: 11 }}>{item.workerId}</span>
            <span style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</strong>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.profession || '-'} · {item.brigadeName || '-'}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function WorkerImportModal({ onClose, onDone, changedBy }: WorkerImportModalProps) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<WorkerImportPreview | null>(null)
  const [result, setResult] = useState<{ imported: number; updated?: number; restored?: number; terminated?: number } | null>(null)
  const [error, setError] = useState('')

  const handleFile = (nextFile: File | null) => {
    setFile(nextFile)
    setPreview(null)
    setResult(null)
    setError('')
  }

  const handlePreview = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      setPreview(await workersApi.previewImportExcel(file))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Preview failed')
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const response = await workersApi.importExcel(file, changedBy)
      setResult(response)
      onDone()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h3>{t.common.import} - Işçi Sanawy</h3>
          <button className="btn btn--ghost btn--sm" type="button" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          {!result ? (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                Excel sütunlary:
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.6 }}>
                <code>Sicil No · İnsan Adı · Görev · EKIP · Mesai Sistemi</code>
              </p>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '8px 12px', background: 'var(--warning-light, #FFF7ED)', borderRadius: 6, marginBottom: 12, fontSize: 12, color: 'var(--warning, #F59E0B)' }}>
                <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Täze excelda <b>ýok bolan</b> işçiler awtomatiki "Işden bosadylanlar" sahypasyna geçiriler.</span>
              </div>
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--danger-light)', borderRadius: 6, marginBottom: 10, color: 'var(--danger)', fontSize: 13 }}>
                  <AlertCircle size={14} /> {error}
                </div>
              )}
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={event => handleFile(event.target.files?.[0] ?? null)} />
              <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, background: file ? 'var(--success-light)' : undefined }}>
                {file ? <span style={{ color: 'var(--success)' }}>{file.name}</span> : <span><Upload size={20} style={{ display: 'block', margin: '0 auto 6px' }} />Excel faýlyny saýla</span>}
              </div>
              {preview && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="metric-strip" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))' }}>
                    <div className="metric-chip"><span className="metric-chip__value">{preview.totalRows}</span><span className="metric-chip__label">Okalan setir</span></div>
                    <div className="metric-chip"><span className="metric-chip__value">{preview.counts.created}</span><span className="metric-chip__label">Täze</span></div>
                    <div className="metric-chip"><span className="metric-chip__value">{preview.counts.updated}</span><span className="metric-chip__label">Update</span></div>
                    <div className="metric-chip"><span className="metric-chip__value">{preview.counts.restored}</span><span className="metric-chip__label">Restore</span></div>
                    <div className={`metric-chip${preview.counts.terminated > 0 ? ' metric-chip--alert' : ''}`}><span className="metric-chip__value">{preview.counts.terminated}</span><span className="metric-chip__label">Işden çykjak</span></div>
                  </div>
                  {preview.counts.duplicateWorkerIds > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', background: 'var(--warning-light)', borderRadius: 8, color: 'var(--warning)', fontSize: 12 }}>
                      <AlertCircle size={14} />
                      <span>Dublikat Sicil No: {preview.samples.duplicates.join(', ')}</span>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                    <ImportPreviewList title="Täze işe alynjak" items={preview.samples.created} tone="success" />
                    <ImportPreviewList title="Täzelenjek" items={preview.samples.updated} tone="neutral" />
                    <ImportPreviewList title="Gaýtadan aktiw ediljek" items={preview.samples.restored} tone="warning" />
                    <ImportPreviewList title="Excelda ýok, işden çykjak" items={preview.samples.terminated} tone="danger" />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '8px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--success-light)', borderRadius: 6 }}>
                  <span style={{ fontSize: 13 }}>Täze goşulan</span>
                  <strong style={{ color: 'var(--success)' }}>{result.imported} işçi</strong>
                </div>
                {(result.updated ?? 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--card2)', borderRadius: 6 }}>
                    <span style={{ fontSize: 13 }}>Täzelenen</span>
                    <strong>{result.updated} işçi</strong>
                  </div>
                )}
                {(result.restored ?? 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--warning-light)', borderRadius: 6 }}>
                    <span style={{ fontSize: 13 }}>Gaýtadan aktiw edilen</span>
                    <strong style={{ color: 'var(--warning)' }}>{result.restored} işçi</strong>
                  </div>
                )}
                {(result.terminated ?? 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--danger-light)', borderRadius: 6 }}>
                    <span style={{ fontSize: 13 }}>Işden aýrylan (awtomatiki)</span>
                    <strong style={{ color: 'var(--danger)' }}>{result.terminated} işçi</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn--secondary btn--sm" type="button" onClick={onClose}>{result ? t.common.close : t.common.cancel}</button>
          {!result && !preview && (
            <button className="btn btn--primary btn--sm" type="button" onClick={handlePreview} disabled={!file || loading}>
              {loading ? t.common.loading : <><Search size={13} /> Öňünden barla</>}
            </button>
          )}
          {!result && preview && (
            <button className="btn btn--primary btn--sm" type="button" onClick={handleUpload} disabled={!file || loading}>
              {loading ? t.common.loading : <><Upload size={13} /> Importy tassykla</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
