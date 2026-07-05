import { useEffect, useRef, useState } from 'react'
import { getAnnouncements } from '../api'
import './AnnouncementBanner.css'

const STORAGE_KEY = 'dismissed_banners'

function loadDismissed() {
  try { return new Set(JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]')) }
  catch { return new Set() }
}

function MarqueeRow({ item, onClose }) {
  const trackRef = useRef(null)
  const [duration, setDuration] = useState(30)

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    // 每 60px 用 1 秒，最少 20s、最多 90s
    const width = el.scrollWidth
    const speed = Math.max(20, Math.min(90, Math.round(width / 60)))
    setDuration(speed)
  }, [item.content])

  // 把换行/多空格压成单行显示，用竖线分段更醒目
  const oneLine = String(item.content || '').replace(/\s*\n+\s*/g, ' ｜ ').replace(/[ \t]{2,}/g, ' ')

  return (
    <div className="ann-banner-row">
      <span className="ann-banner-icon">📢</span>
      <div className="ann-marquee">
        <div
          ref={trackRef}
          className="ann-marquee-track"
          style={{ animationDuration: `${duration}s` }}
        >
          <span className="ann-marquee-text">{oneLine}</span>
          <span className="ann-marquee-text" aria-hidden="true">{oneLine}</span>
        </div>
      </div>
      <button
        type="button"
        className="ann-banner-close"
        onClick={onClose}
        aria-label="关闭公告"
        title="关闭"
      >×</button>
    </div>
  )
}

export default function AnnouncementBanner() {
  const [items, setItems] = useState([])
  const [dismissed, setDismissed] = useState(loadDismissed)

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

  const dismiss = (id) => {
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(id)
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)))
      return next
    })
  }

  const visible = items.filter(a => !dismissed.has(a.id))
  if (visible.length === 0) return null

  return (
    <div className="ann-banner-strip">
      {visible.map(a => (
        <MarqueeRow key={a.id} item={a} onClose={() => dismiss(a.id)} />
      ))}
    </div>
  )
}
