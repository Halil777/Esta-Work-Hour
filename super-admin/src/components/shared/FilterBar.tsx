import { ListFilter } from 'lucide-react'

export function FilterBar({ items }: { items: string[] }) {
  return (
    <div className="filter-bar">
      <span className="filter-label">
        <ListFilter size={16} />
        Filters
      </span>
      {items.map((item) => (
        <button key={item} type="button" className="chip-button">
          {item}
        </button>
      ))}
    </div>
  )
}
