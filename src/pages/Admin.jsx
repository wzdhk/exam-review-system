import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  adminListUsers, adminDeleteUser, adminResetPassword, adminToggleRole, adminGetUserStats,
  getQuestionBanks, deleteQuestionBank, setBankVisibility, adminReplaceBank,
  getAnnouncements, adminCreateAnnouncement, adminDeleteAnnouncement
} from '../api'
import { useAuth } from '../context/AuthContext'
import './Admin.css'

function formatDuration(ms) {
  if (!ms || ms < 1000) return '不足1分钟'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatLastSeen(iso) {
  if (!iso) return '从未在线'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 90000) return '在线'
  const min = Math.floor(diff / 60000)
  if (min < 60) return `${min}分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}小时前`
  return `${Math.floor(h / 24)}天前`
}

const TYPE_LABELS = { multiple_choice: '单选', multiple_select: '多选', judgment: '判断', fill_blank: '填空', essay: '简答' }

function Admin() {
  const { user } = useAuth()
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [banks, setBanks] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [resetTarget, setResetTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [statsTarget, setStatsTarget] = useState(null)
  const [statsData, setStatsData] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [newAnnouncement, setNewAnnouncement] = useState('')
  const [announceDelay, setAnnounceDelay] = useState(3)
  const [posting, setPosting] = useState(false)
  const replaceInputRefs = useRef({})

  useEffect(() => {
    loadAll()
    const timer = setInterval(loadAll, 30000)
    return () => clearInterval(timer)
  }, [])

  const loadAll = async () => {
    try {
      const [us, bs, ann] = await Promise.all([adminListUsers(), getQuestionBanks(), getAnnouncements()])
      setUsers(us)
      setBanks(bs)
      setAnnouncements(ann)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleDeleteUser = async (u) => {
    if (u.id === user.id) { alert('不能删除自己'); return }
    if (!confirm(`确定删除用户 "${u.username}" 吗？\n会同时删除该用户的所有题库、题目、错题记录。此操作不可恢复。`)) return
    try { await adminDeleteUser(u.id); await loadAll() }
    catch (err) { alert('删除失败：' + err.message) }
  }

  const handleToggleRole = async (u) => {
    const nextRole = u.role === 'admin' ? '普通用户' : '管理员'
    if (!confirm(`确定将 "${u.username}" 的角色改为${nextRole}吗？`)) return
    try {
      const res = await adminToggleRole(u.id)
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: res.role } : x))
    } catch (err) { alert('操作失败：' + err.message) }
  }

  const handleViewStats = async (u) => {
    setStatsTarget(u)
    setStatsData(null)
    setStatsLoading(true)
    try { setStatsData(await adminGetUserStats(u.id)) }
    catch (err) { alert('获取失败：' + err.message); setStatsTarget(null) }
    finally { setStatsLoading(false) }
  }

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) { alert('密码至少 6 位'); return }
    try {
      await adminResetPassword(resetTarget.id, newPassword)
      alert(`已重置用户 "${resetTarget.username}" 的密码`)
      setResetTarget(null); setNewPassword('')
    } catch (err) { alert('重置失败：' + err.message) }
  }

  const handleDeleteBank = async (b) => {
    if (!confirm(`确定删除题库 "${b.name}" 吗？`)) return
    try { await deleteQuestionBank(b.id); setBanks(prev => prev.filter(x => x.id !== b.id)) }
    catch (err) { alert('删除失败：' + err.message) }
  }

  const handleToggleVisibility = async (bank) => {
    try {
      const nextPublic = !bank.is_public
      await setBankVisibility(bank.id, nextPublic)
      setBanks(prev => prev.map(b => b.id === bank.id ? { ...b, is_public: nextPublic } : b))
    } catch (err) { alert('设置失败：' + err.message) }
  }

  const handleReplaceBank = (bankId) => {
    const input = replaceInputRefs.current[bankId]
    if (input) input.click()
  }

  const handleReplaceFile = async (bankId, bankName, file) => {
    if (!file) return
    if (!confirm(`确定用 "${file.name}" 替换题库 "${bankName}" 的所有题目吗？\n原有题目、错题记录、答题进度将全部清除。`)) return
    try {
      const res = await adminReplaceBank(bankId, file)
      alert(`替换成功，共导入 ${res.count} 道题目${res.warnings?.length ? `，${res.warnings.length} 题未识别` : ''}`)
      await loadAll()
    } catch (err) { alert('替换失败：' + err.message) }
  }

  const handlePostAnnouncement = async () => {
    if (!newAnnouncement.trim()) return
    setPosting(true)
    try {
      const item = await adminCreateAnnouncement(newAnnouncement, Number(announceDelay))
      setAnnouncements(prev => [item, ...prev])
      setNewAnnouncement('')
      setAnnounceDelay(3)
    } catch (err) { alert('发布失败：' + err.message) }
    finally { setPosting(false) }
  }

  const handleDeleteAnnouncement = async (id) => {
    if (!confirm('确定删除这条公告吗？')) return
    try {
      await adminDeleteAnnouncement(id)
      setAnnouncements(prev => prev.filter(a => a.id !== id))
    } catch (err) { alert('删除失败：' + err.message) }
  }

  const onlineCount = users.filter(u => u.is_online).length
  const totalOnlineMs = users.reduce((s, u) => s + (u.total_online_ms || 0), 0)

  if (loading) return <div className="admin-page"><div className="loading">加载中...</div></div>

  return (
    <div className="admin-page">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="admin-header">
          <h1 className="page-title">管理员后台</h1>
          <p className="admin-subtitle">用户、题库与公告管理</p>
        </div>

        <div className="admin-stats">
          <div className="admin-stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{users.length}</div>
            <div className="stat-label">用户总数</div>
          </div>
          <div className="admin-stat-card">
            <div className="stat-icon">🟢</div>
            <div className="stat-value">{onlineCount}</div>
            <div className="stat-label">当前在线</div>
          </div>
          <div className="admin-stat-card">
            <div className="stat-icon">📚</div>
            <div className="stat-value">{banks.length}</div>
            <div className="stat-label">题库总数</div>
          </div>
          <div className="admin-stat-card">
            <div className="stat-icon">⏱</div>
            <div className="stat-value">{formatDuration(totalOnlineMs)}</div>
            <div className="stat-label">全站累计在线</div>
          </div>
        </div>

        <div className="admin-tabs">
          <button className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>用户管理</button>
          <button className={`admin-tab ${tab === 'banks' ? 'active' : ''}`} onClick={() => setTab('banks')}>题库管理</button>
          <button className={`admin-tab ${tab === 'announcements' ? 'active' : ''}`} onClick={() => setTab('announcements')}>
            公告栏 {announcements.length > 0 && <span className="tab-badge">{announcements.length}</span>}
          </button>
        </div>

        {tab === 'users' && (
          <div className="admin-section">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>用户名</th><th>角色</th><th>题库数</th><th>在线时长</th><th>最后在线</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="username">
                      {u.is_online && <span className="online-dot" title="当前在线" />}
                      {u.username}
                      {u.id === user.id && <span className="self-tag">本人</span>}
                    </td>
                    <td><span className={`role-tag role-${u.role}`}>{u.role === 'admin' ? '管理员' : '普通用户'}</span></td>
                    <td>{u.bank_count}</td>
                    <td className="duration-cell">{formatDuration(u.total_online_ms)}</td>
                    <td className="lastseen-cell">{formatLastSeen(u.last_seen)}</td>
                    <td className="action-cell">
                      <button className="link-btn" onClick={() => handleViewStats(u)}>答题记录</button>
                      <button className="link-btn" onClick={() => { setResetTarget(u); setNewPassword('') }}>重置密码</button>
                      {u.id !== user.id && (
                        <button className="link-btn" onClick={() => handleToggleRole(u)}>
                          {u.role === 'admin' ? '降为用户' : '设为管理员'}
                        </button>
                      )}
                      <button className="link-btn danger" onClick={() => handleDeleteUser(u)} disabled={u.id === user.id}>删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'banks' && (
          <div className="admin-section">
            {banks.length === 0 ? <div className="admin-empty">暂无题库</div> : (
              <table className="admin-table">
                <thead>
                  <tr><th>题库名</th><th>所有者</th><th>题目数</th><th>状态</th><th>创建时间</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {banks.map(b => (
                    <tr key={b.id}>
                      <td className="bank-name-cell">{b.name}</td>
                      <td>{b.owner_username}</td>
                      <td>{b.question_count}</td>
                      <td>{b.is_public ? <span className="public-badge">已公开</span> : <span className="private-badge">私有</span>}</td>
                      <td>{new Date(b.created_at).toLocaleString('zh-CN')}</td>
                      <td className="action-cell">
                        <button className="link-btn" onClick={() => handleToggleVisibility(b)}>
                          {b.is_public ? '设为私有' : '公开'}
                        </button>
                        <button className="link-btn" onClick={() => handleReplaceBank(b.id)}>替换题目</button>
                        <input
                          type="file"
                          accept=".txt,.pdf,.docx"
                          style={{ display: 'none' }}
                          ref={el => replaceInputRefs.current[b.id] = el}
                          onChange={e => { handleReplaceFile(b.id, b.name, e.target.files[0]); e.target.value = '' }}
                        />
                        <button className="link-btn danger" onClick={() => handleDeleteBank(b)}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'announcements' && (
          <div className="admin-section">
            <div className="announce-composer">
              <textarea
                className="announce-input"
                placeholder="写一条公告，所有用户登录后都能看到..."
                value={newAnnouncement}
                onChange={e => setNewAnnouncement(e.target.value)}
                rows={3}
              />
              <div className="announce-composer-footer">
                <label className="delay-label">
                  <span>弹窗显示后</span>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={announceDelay}
                    onChange={e => setAnnounceDelay(Math.max(0, Math.min(60, Number(e.target.value))))}
                    className="delay-input"
                  />
                  <span>秒后可关闭</span>
                </label>
                <button className="btn btn-primary" onClick={handlePostAnnouncement} disabled={posting || !newAnnouncement.trim()}>
                  {posting ? '发布中...' : '发布公告'}
                </button>
              </div>
            </div>
            {announcements.length === 0 ? (
              <div className="admin-empty">暂无公告</div>
            ) : (
              <div className="announce-list">
                {announcements.map(a => (
                  <div key={a.id} className="announce-item">
                    <p className="announce-content">{a.content}</p>
                    <div className="announce-meta">
                      {a.author} · {new Date(a.created_at).toLocaleString('zh-CN')}
                      <button className="link-btn danger" onClick={() => handleDeleteAnnouncement(a.id)}>删除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {resetTarget && (
        <div className="modal-overlay" onClick={() => setResetTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>重置 "{resetTarget.username}" 的密码</h3>
            <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="新密码（至少 6 位）" className="modal-input" autoFocus />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setResetTarget(null)}>取消</button>
              <button className="btn btn-primary" onClick={handleResetPassword}>确认重置</button>
            </div>
          </div>
        </div>
      )}

      {statsTarget && (
        <div className="modal-overlay" onClick={() => { setStatsTarget(null); setStatsData(null) }}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h3>{statsTarget.username} 的答题记录</h3>
            {statsLoading ? <div className="loading">加载中...</div> : statsData && (
              <>
                <div className="stats-row">
                  <div className="stats-mini"><div className="sm-val">{statsData.attempted}</div><div className="sm-lab">已答题数</div></div>
                  <div className="stats-mini"><div className="sm-val">{statsData.accuracy}%</div><div className="sm-lab">正确率</div></div>
                  <div className="stats-mini"><div className="sm-val">{statsData.mistakes}</div><div className="sm-lab">错题数</div></div>
                  <div className="stats-mini"><div className="sm-val">{formatDuration(statsData.total_online_ms)}</div><div className="sm-lab">在线时长</div></div>
                </div>
                {statsData.recent.length > 0 && (
                  <div className="recent-list">
                    <div className="recent-title">最近答题（最多20条）</div>
                    <table className="admin-table">
                      <thead><tr><th>题目</th><th>题型</th><th>题库</th><th>结果</th><th>时间</th></tr></thead>
                      <tbody>
                        {statsData.recent.map((r, i) => (
                          <tr key={i}>
                            <td className="q-snippet">{r.question}</td>
                            <td>{TYPE_LABELS[r.type] || r.type}</td>
                            <td>{r.bank_name}</td>
                            <td>{r.is_correct ? '✅' : '❌'}</td>
                            <td className="lastseen-cell">{new Date(r.answered_at).toLocaleString('zh-CN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setStatsTarget(null); setStatsData(null) }}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Admin
