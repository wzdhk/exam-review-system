import { useEffect, useState } from 'react'
import { getAnnouncements } from '../api'
import './AnnouncementBanner.css'

export default function AnnouncementBanner() {
  const [items, setItems] = useState([])

  useEffect(() => {
    let alive = true
    const load = () => {
      getAnnouncements()
        .then(list => { if (alive) setItems(list.filter(a => a.show_banner)) })
        .catch(() => {})
    }
    load()
    const timer = setInterval(load, 60000)
    return () => { alive = false; clearInterval(timer) }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="ann-banner-strip">
      {items.map(a => (
        <div key={a.id} className="ann-banner-row">
          <span className="ann-banner-icon">📢</span>
          <span className="ann-banner-text">{a.content}</span>
        </div>
      ))}
    </div>
  )
}
