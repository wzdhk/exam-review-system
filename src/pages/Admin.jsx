import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { adminListUsers, adminDeleteUser, adminResetPassword, getQuestionBanks, deleteQuestionBank } from '../api'
import { useAuth } from '../context/AuthContext'
import './Admin.css'

function Admin() {
  const { user } = useAuth()
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [banks, setBanks] = useState([])
  const [loading, setLoading] = useState(true)
  const [resetTarget, setResetTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [us, bs] = await Promise.all([adminListUsers(), getQuestionBanks()])
      setUsers(us)
      setBanks(bs)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (u) => {
    if (u.id === user.id) { alert('不能删除自己'); return }
    if (!confirm(`确定删除用户 "${u.username}" 吗？\n会同时删除该用户的所有题库、题目、错题记录。此操作不可恢复。`)) return
    try {
      await adminDeleteUser(u.id)
      await loadAll()
    } catch (err) {
      alert('删除失败：' + err.message)
    }
  }

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) { alert('密码至少 6 位'); return }
    try {
      await adminResetPassword(resetTarget.id, newPassword)
      alert(`已重置用户 "${resetTarget.username}" 的密码`)
      setResetTarget(null)
      setNewPassword('')
    } catch (err) {
      alert('重置失败：' + err.message)
    }
  }

  const handleDeleteBank = async (b) => {
    if (!confirm(`确定删除题库 "${b.name}" 吗？\n会同时删除其中的所有题目和相关错题记录。`)) return
    try {
      await deleteQuestionBank(b.id)
      setBanks(prev => prev.filter(x => x.id !== b.id))
    } catch (err) {
      alert('删除失败：' + err.message)
    }
  }

  if (loading) return <div className="admin-page"><div className="loading">加载中...</div></div>

  return (
    <div className="admin-page">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="admin-header">
          <h1 className="page-title">管理员后台</h1>
          <p className="admin-subtitle">用户与题库管理</p>
        </div>

        <div className="admin-stats">
          <div className="admin-stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{users.length}</div>
            <div className="stat-label">用户总数</div>
          </div>
          <div className="admin-stat-card">
            <div className="stat-icon">📚</div>
            <div className="stat-value">{banks.length}</div>
            <div className="stat-label">题库总数</div>
          </div>
          <div className="admin-stat-card">
            <div className="stat-icon">📝</div>
            <div className="stat-value">{banks.reduce((s, b) => s + (b.question_count || 0), 0)}</div>
            <div className="stat-label">题目总数</div>
          </div>
        </div>

        <div className="admin-tabs">
          <button className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>用户管理</button>
          <button className={`admin-tab ${tab === 'banks' ? 'active' : ''}`} onClick={() => setTab('banks')}>题库管理</button>
        </div>

        {tab === 'users' && (
          <div className="admin-section">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>用户名</th>
                  <th>角色</th>
                  <th>题库数</th>
                  <th>注册时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td className="username">{u.username}{u.id === user.id && <span className="self-tag">本人</span>}</td>
                    <td>
                      <span className={`role-tag role-${u.role}`}>{u.role === 'admin' ? '管理员' : '普通用户'}</span>
                    </td>
                    <td>{u.bank_count}</td>
                    <td>{new Date(u.created_at).toLocaleString('zh-CN')}</td>
                    <td className="action-cell">
                      <button className="link-btn" onClick={() => { setResetTarget(u); setNewPassword('') }}>重置密码</button>
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
            {banks.length === 0 ? (
              <div className="admin-empty">暂无题库</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>题库名</th>
                    <th>所有者</th>
                    <th>题目数</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {banks.map(b => (
                    <tr key={b.id}>
                      <td>{b.id}</td>
                      <td className="bank-name-cell">{b.name}</td>
                      <td>{b.owner_username}</td>
                      <td>{b.question_count}</td>
                      <td>{new Date(b.created_at).toLocaleString('zh-CN')}</td>
                      <td className="action-cell">
                        <button className="link-btn danger" onClick={() => handleDeleteBank(b)}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </motion.div>

      {resetTarget && (
        <div className="modal-overlay" onClick={() => setResetTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>重置 "{resetTarget.username}" 的密码</h3>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新密码（至少 6 位）"
              className="modal-input"
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setResetTarget(null)}>取消</button>
              <button className="btn btn-primary" onClick={handleResetPassword}>确认重置</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Admin
