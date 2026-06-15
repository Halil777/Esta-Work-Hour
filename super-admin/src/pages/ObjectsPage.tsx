import { useState } from 'react'
import { Plus, MapPin, Search, ChevronRight } from 'lucide-react'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import { getTranslation } from '../i18n/translations'
import { objectSummaries } from '../data/mock-data'

const REGIONS = ['Moscow', 'Kazan', 'Saint Petersburg', 'Amur', 'Novosibirsk', 'Yekaterinburg']

export function ObjectsPage() {
  const { language } = useUiPreferences()
  const t = getTranslation(language)
  const [search, setSearch] = useState('')
  const [regionFilter, setRegionFilter] = useState('all')

  const filtered = objectSummaries.filter(o => {
    const matchSearch = o.name.toLowerCase().includes(search.toLowerCase()) || o.location.toLowerCase().includes(search.toLowerCase())
    const matchRegion = regionFilter === 'all' || o.location === regionFilter
    return matchSearch && matchRegion
  })

  return (
    <>
      <div className="page-header">
        <h1>{t.objects.title}</h1>
        <div className="page-actions">
          <button className="btn btn--secondary btn--sm">{t.common.export}</button>
          <button className="btn btn--primary btn--sm"><Plus size={13} />{t.objects.createObject}</button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="input-wrap">
          <Search size={14} />
          <input className="search-input" placeholder={t.objects.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={regionFilter} onChange={e => setRegionFilter(e.target.value)}>
          <option value="all">{t.objects.filterAll}</option>
          {REGIONS.map(r => <option key={r}>{r}</option>)}
        </select>
        <span className="text-xs text-muted" style={{ marginLeft: 4 }}>{filtered.length} objects</span>
      </div>

      <div className="objects-grid">
        {filtered.map(obj => {
          const pct = parseInt(obj.occupancy)
          const presentPct = obj.workforceCapacity > 0 ? Math.round((obj.presentToday / obj.workforceCapacity) * 100) : 0

          return (
            <div key={obj.id} className="object-card">
              <div className="object-card__header">
                <div>
                  <div className="object-card__name">{obj.name}</div>
                  <div className="object-card__location">
                    <MapPin size={10} />{obj.location}
                  </div>
                </div>
                <span className={`badge badge--dot badge--${obj.status === 'Healthy' ? 'success' : 'warning'}`}>
                  {obj.status === 'Healthy' ? t.objects.healthy : t.objects.attention}
                </span>
              </div>

              <div className="object-card__meta">
                <div className="object-card__field">
                  <div className="object-card__field-label">{t.objects.siteChief}</div>
                  <div className="object-card__field-val" style={{ fontSize: 12 }}>{obj.siteChief}</div>
                </div>
                <div className="object-card__field">
                  <div className="object-card__field-label">{t.objects.structure}</div>
                  <div className="object-card__field-val" style={{ fontSize: 12 }}>{obj.structure}</div>
                </div>
                <div className="object-card__field">
                  <div className="object-card__field-label">{t.objects.capacity}</div>
                  <div className="object-card__field-val">{obj.workforceCapacity.toLocaleString()}</div>
                </div>
                <div className="object-card__field">
                  <div className="object-card__field-label">{t.objects.presentToday}</div>
                  <div className="object-card__field-val" style={{ color: presentPct >= 85 ? 'var(--success)' : presentPct >= 70 ? 'var(--warning)' : 'var(--danger)' }}>
                    {obj.presentToday.toLocaleString()}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="text-xs text-muted">{t.objects.occupancy}</span>
                  <span className="text-xs fw-600">{obj.occupancy}</span>
                </div>
                <div className="object-card__bar">
                  <div className="object-card__bar-fill" style={{
                    width: obj.occupancy,
                    background: pct >= 90 ? 'var(--success)' : pct >= 75 ? 'var(--primary)' : 'var(--warning)',
                  }} />
                </div>
              </div>

              <div className="object-card__footer">
                <span className="text-xs text-muted">{obj.schedule}</span>
                <button className="btn btn--secondary btn--sm" style={{ fontSize: 11 }}>
                  {t.objects.manageObject} <ChevronRight size={11} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
