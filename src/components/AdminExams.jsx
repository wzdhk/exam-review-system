import { useEffect, useState } from 'react'
import {
  adminListExams, adminCreateExam, adminDeleteExam,
  adminListExamAttempts, adminGetExamAttempt
} from '../api'
import './AdminExams.css'

const TYPES = [
  { key: 'multiple_choice', label: '单选' },
  { key: 'multiple_select', label: '多选' },
  { key: 'judgment', label: '判断' },
  { key: 'fill_blank', label: '填空' },
  { key: 'essay', label: '简答' },
]

function formatMs(ms) {
  if (!ms || ms < 0) return '-'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}分${s % 60}秒`
}

export default function AdminExams({ banks }) {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [attemptsTarget, setAttemptsTarget] = useState(null)
  const [attemptsData, setAttemptsData] = useState(null)
  const [detailData, setDetailData] = useState(null)

  useEffect(() => { loadExams() }, [])

  const loadExams = async () => {
    setLoading(true)
    try { setExams(await adminListExams()) }
    catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleDelete = async (exam) => {
    if (!confirm(`确定删除考试"${exam.title}"吗？相关答卷记录将全部删除。`)) return
    try {
      await adminDeleteExam(exam.id)
      setExams(prev => prev.filter(e => e.id !== exam.id))
    } catch (err) { alert('删除失败：' + err.message) }
  }

  const openAttempts = async (exam) => {
    setAttemptsTarget(exam)
    setAttemptsData(null)
    try { setAttemptsData(await adminListExamAttempts(exam.id)) }
    catch (err) { alert('加载失败：' + err.message); setAttemptsTarget(null) }
  }

  const openDetail = async (attemptId) => {
    try { setDetailData(await adminGetExamAttempt(attemptId)) }
    catch (err) { alert('加载失败：' + err.message) }
  }

  if (loading) return <div className="admin-section"><div className="loading">加载中...</div></div>

  return (
    <div className="admin-section">
      <div className="exam-admin-head">
        <div>
          <div className="section-title-inline">考试列表</div>
          <div className="section-desc">发起限时考试，随机从题库抽题。客观题自动判分，简答题不计入分数。</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ 新建考试</button>
      </div>

      {exams.length === 0 ? (
        <div className="admin-empty">暂无考试</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>题库</th>
              <th>题数</th>
              <th>时长</th>
              <th>已参加</th>
              <th>已交卷</th>
              <th>平均分</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {exams.map(e => (
              <tr key={e.id}>
                <td>{e.title}</td>
                <td>{e.bank_name}</td>
                <td>{e.total_questions}</td>
                <td>{e.duration_minutes}分钟</td>
                <td>{e.attempt_count}</td>
                <td>{e.submitted_count}</td>
                <td>{e.avg_score ?? '-'}</td>
                <td className="lastseen-cell">{new Date(e.created_at).toLocaleString('zh-CN')}</td>
                <td className="action-cell">
                  <button className="link-btn" onClick={() => openAttempts(e)}>查看答卷</button>
                  <button className="link-btn danger" onClick={() => handleDelete(e)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && (
        <CreateExamModal banks={banks} onClose={() => setShowCreate(false)} onCreated={(exam) => {
          setExams(prev => [{ ...exam, attempt_count: 0, submitted_count: 0, avg_score: null }, ...prev])
          setShowCreate(false)
        }} />
      )}

      {attemptsTarget && !detailData && (
        <div className="modal-overlay" onClick={() => setAttemptsTarget(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h3>{attemptsTarget.title} · 答卷记录</h3>
            {!attemptsData ? <div className="loading">加载中...</div> : (
              attemptsData.attempts.length === 0 ? (
                <div className="admin-empty">还没有用户参加</div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr><th>用户</th><th>状态</th><th>开始时间</th><th>用时</th><th>得分</th><th>操作</th></tr>
                  </thead>
                  <tbody>
                    {attemptsData.attempts.map(a => (
                      <tr key={a.id}>
                        <td>{a.username}</td>
                        <td>{a.status === 'submitted' ? '已交卷' : '进行中'}</td>
                        <td className="lastseen-cell">{new Date(a.started_at).toLocaleString('zh-CN')}</td>
                        <td>{formatMs(a.duration_ms)}</td>
                        <td>{a.score != null ? `${a.score} / ${a.total}` : '-'}</td>
                        <td className="action-cell">
                          <button className="link-btn" onClick={() => openDetail(a.id)}>查看详情</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setAttemptsTarget(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {detailData && (
        <div className="modal-overlay" onClick={() => setDetailData(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h3>{detailData.username} 的答卷 · {detailData.exam?.title}</h3>
            <div className="detail-summary">
              得分：<strong>{detailData.attempt.score ?? '-'} / {detailData.attempt.total ?? '-'}</strong>
              {' · '}用时 {formatMs(detailData.attempt.submitted_at ? new Date(detailData.attempt.submitted_at) - new Date(detailData.attempt.started_at) : null)}
              {' · '}状态 {detailData.attempt.status === 'submitted' ? '已交卷' : '进行中'}
            </div>
            <div className="answer-scroll">
              {detailData.questions.map((q, i) => {
                const d = (detailData.attempt.detail || []).find(x => x.qid === q.id)
                const ua = detailData.attempt.answers?.[q.id] || ''
                return (
                  <div key={q.id} className={`answer-item ${d?.is_correct === true ? 'right' : d?.is_correct === false ? 'wrong' : 'neutral'}`}>
                    <div className="ai-head">
                      #{i + 1} · {typeLabel(q.type)}
                      <span className="ai-mark">
                        {d?.is_correct === true && '✅ 正确'}
                        {d?.is_correct === false && '❌ 错误'}
                        {d?.is_correct == null && '📝 主观题'}
                      </span>
                    </div>
                    <div className="ai-q">{q.question}</div>
                    <div className="ai-a">用户答案：<span>{ua || '（未作答）'}</span></div>
                    <div className="ai-ref">参考答案：<span>{q.correct_answer}</span></div>
                  </div>
                )
              })}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDetailData(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function typeLabel(t) {
  return TYPES.find(x => x.key === t)?.label || t
}

function CreateExamModal({ banks, onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [bankId, setBankId] = useState('')
  const [duration, setDuration] = useState(60)
  const [counts, setCounts] = useState({ multiple_choice: 10, multiple_select: 0, judgment: 10, fill_blank: 0, essay: 0 })
  const [posting, setPosting] = useState(false)

  const bank = banks.find(b => b.id === Number(bankId))
  const total = Object.values(counts).reduce((s, n) => s + Number(n || 0), 0)

  const handleCreate = async () => {
    if (!title.trim()) return alert('请填写考试名称')
    if (!bankId) return alert('请选择题库')
    if (total === 0) return alert('至少设置一种题型的出题数')
    const plan = Object.entries(counts)
      .filter(([, c]) => Number(c) > 0)
      .map(([type, count]) => ({ type, count: Number(count) }))
    setPosting(true)
    try {
      const exam = await adminCreateExam({
        title: title.trim(),
        bank_id: Number(bankId),
        duration_minutes: Number(duration),
        plan
      })
      onCreated(exam)
    } catch (err) { alert('创建失败：' + err.message) }
    finally { setPosting(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <h3>新建考试</h3>
        <div className="form-row">
          <label>考试名称</label>
          <input type="text" className="modal-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="如：期末模拟考试" />
        </div>
        <div className="form-row">
          <label>选择题库</label>
          <select className="modal-input" value={bankId} onChange={e => setBankId(e.target.value)}>
            <option value="">-- 请选择 --</option>
            {banks.map(b => (
              <option key={b.id} value={b.id}>{b.name}（{b.question_count} 题）</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>考试时长（分钟）</label>
          <input type="number" min="1" max="300" className="modal-input" value={duration} onChange={e => setDuration(e.target.value)} />
        </div>
        <div className="form-row">
          <label>各题型出题数</label>
          <div className="type-grid">
            {TYPES.map(t => (
              <div key={t.key} className="type-cell">
                <span className="type-name">{t.label}</span>
                <input type="number" min="0" value={counts[t.key]}
                  onChange={e => setCounts(prev => ({ ...prev, [t.key]: Number(e.target.value) || 0 }))} />
              </div>
            ))}
          </div>
          <div className="form-hint">总题数：{total} · 简答题不计入自动分数</div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={posting}>
            {posting ? '创建中...' : '创建考试'}
          </button>
        </div>
      </div>
    </div>
  )
}
