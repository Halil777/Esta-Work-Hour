import { useRef, useState } from 'react'
import { AlertCircle, Upload, X } from 'lucide-react'
import { workersApi } from '../../api/workers'

type WorkerCardImportModalProps = {
  onClose: () => void
}

export function WorkerCardImportModal({ onClose }: WorkerCardImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ linked: number; notFound: number } | null>(null)
  const [error, setError] = useState('')

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const response = await workersApi.importCards(file)
      setResult(response)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3>Kart Nomerleri Import</h3>
          <button className="btn btn--ghost btn--sm" type="button" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          {!result ? (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                "card numbers.xlsx" - <code>{'Табельный номер -> Карта №'}</code>
              </p>
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--danger-light)', borderRadius: 6, marginBottom: 10, color: 'var(--danger)', fontSize: 13 }}>
                  <AlertCircle size={14} /> {error}
                </div>
              )}
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={event => setFile(event.target.files?.[0] ?? null)} />
              <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, background: file ? 'var(--success-light)' : undefined }}>
                {file ? <span style={{ color: 'var(--success)' }}>{file.name}</span> : <span><Upload size={20} style={{ display: 'block', margin: '0 auto 6px' }} />card numbers.xlsx saýla</span>}
              </div>
            </>
          ) : (
            <div style={{ padding: '8px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--success-light)', borderRadius: 6 }}>
                  <span style={{ fontSize: 13 }}>Kart birikdirildi</span>
                  <strong style={{ color: 'var(--success)' }}>{result.linked} işçi</strong>
                </div>
                {result.notFound > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--warning-light, #FFF7ED)', borderRadius: 6 }}>
                    <span style={{ fontSize: 13 }}>Tabeli tapylmady</span>
                    <strong style={{ color: 'var(--warning, #F59E0B)' }}>{result.notFound}</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn--secondary btn--sm" type="button" onClick={onClose}>{result ? 'Ýap' : 'Ýatyr'}</button>
          {!result && (
            <button className="btn btn--primary btn--sm" type="button" onClick={handleUpload} disabled={!file || loading}>
              {loading ? 'Ýüklenýär...' : <><Upload size={13} /> Import</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
