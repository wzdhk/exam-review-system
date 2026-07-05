import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { startExam, saveExamAnswers, submitExam, getExamAttempt } from '../api'
import './Exam.css'

const TYPE_LABELS = {
  multiple_choice: '单选题',
  multiple_select: '多选题',
  judgment: '判断题',
  fill_blank: '填空题',
  essay: '简答题'
}

function formatMs(ms) {
  if (ms <= 0) return '00:00'
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function Exam() {
  const { id } = useParams()
  const examId = parseInt(id)
  const navigate = useNavigate()

  const [state, setState] = useState('loading') // loading | ready | done | error
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [deadline, setDeadline] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [currentIdx, setCurrentIdx] = useState(0)
  const [result, setResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const saveTimerRef = useRef(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    (async () => {
      try {
        // 先看是否已提交（提交过就直接展示答卷）
        try {
          const existing = await getExamAttempt(examId)
          if (existing.status === 'submitted') {
            setExam(existing.exam)
            setQuestions(existing.questions)
            setAnswers(existing.answers || {})
            setResult({ score: existing.score, total: existing.total, submitted_at: existing.submitted_at, detail: existing.detail })
            setState('done')
            return
          }
        } catch (_) { /* 未开始也会走到这里 */ }

        const data = await startExam(examId)
        setExam(data.exam)
        setQuestions(data.questions)
        setAnswers(data.answers || {})
        setDeadline(new Date(data.deadline).getTime())
        setState('ready')
      } catch (err) {
        setError(err.message || '加载失败')
        setState('error')
      }
    })()
  }, [examId])

  // 每秒刷新时间
  useEffect(() => {
    if (state !== 'ready') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [state])

  const doSubmit = useCallback(async (auto = false) => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    try {
      const res = await submitExam(examId, answers)
      setResult(res)
      setState('done')
    } catch (err) {
      alert('交卷失败：' + err.message)
      submittedRef.current = false
    } finally {
      setSubmitting(false)
    }
  }, [answers, examId])

  // 时间到自动交卷
  useEffect(() => {
    if (state !== 'ready' || !deadline) return
    if (now >= deadline) {
      doSubmit(true)
    }
  }, [now, deadline, state, doSubmit])

  // 定期后台保存作答
  useEffect(() => {
    if (state !== 'ready') return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveExamAnswers(examId, answers).catch(() => {})
    }, 1500)
    return () => clearTimeout(saveTimerRef.current)
  }, [answers, state, examId])

  const setAnswer = (qid, value) => setAnswers(prev => ({ ...prev, [qid]: value }))

  if (state === 'loading') return <div className="exam-page"><div className="loading">加载中...</div></div>
  if (state === 'error') return (
    <div className="exam-page">
      <div className="empty-state">
        <div className="empty-icon">⚠️</div>
        <h2>{error}</h2>
        <Link to="/exams" className="btn btn-primary">返回考试列表</Link>
      </div>
    </div>
  )

  const q = questions[currentIdx]
  const answered = questions.filter(x => {
    const v = answers[x.id]
    return v != null && String(v).trim() !== ''
  }).length

  if (state === 'done') {
    return (
      <div className="exam-page">
        <motion.div className="exam-done" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="done-icon">🎉</div>
          <h2 className="done-title">{exam?.title || '考试'} · 已交卷</h2>
          <div className="score-big">
            {result?.score ?? 0}
            <span className="score-total"> / {result?.total ?? 0}</span>
          </div>
          <p className="done-hint">
            {result?.total > 0
              ? `客观题得分（简答题不计入自动分数）`
              : '本次考试无客观题'}
          </p>
          <details className="done-detail">
            <summary>查看逐题结果</summary>
            <div className="detail-list">
              {questions.map((qq, i) => {
                const d = result?.detail?.find(x => x.qid === qq.id)
                const ua = answers[qq.id] || ''
                return (
                  <div key={qq.id} className={`detail-item ${d?.is_correct === true ? 'right' : d?.is_correct === false ? 'wrong' : 'neutral'}`}>
                    <div className="di-head">
                      <span className="di-idx">#{i + 1}</span>
                      <span className="di-type">{TYPE_LABELS[qq.type]}</span>
                      <span className="di-mark">
                        {d?.is_correct === true && '✅ 正确'}
                        {d?.is_correct === false && '❌ 错误'}
                        {d?.is_correct === null && '📝 主观题'}
                      </span>
                    </div>
                    <div className="di-q">{qq.question}</div>
                    <div className="di-a">你的答案：<span>{ua || '（未作答）'}</span></div>
                    {qq.correct_answer && (
                      <div className="di-ref">参考答案：<span>{qq.correct_answer}</span></div>
                    )}
                  </div>
                )
              })}
            </div>
          </details>
          <div className="done-actions">
            <button className="btn btn-secondary" onClick={() => navigate('/exams')}>返回考试列表</button>
          </div>
        </motion.div>
      </div>
    )
  }

  const remaining = deadline ? deadline - now : 0
  const urgent = remaining < 60000

  return (
    <div className="exam-page">
      <div className="exam-bar">
        <div className="bar-left">
          <h1 className="exam-title-h">{exam?.title}</h1>
          <span className="bar-meta">共 {questions.length} 题 · 已作答 {answered} 题</span>
        </div>
        <div className={`countdown ${urgent ? 'urgent' : ''}`}>
          <span className="cd-label">剩余</span>
          <span className="cd-time">{formatMs(remaining)}</span>
        </div>
      </div>

      {q && (
        <motion.div key={q.id} className="exam-card" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
          <div className="q-badge">{TYPE_LABELS[q.type]}</div>
          <h2 className="q-text">{currentIdx + 1}. {q.question}</h2>

          {q.type === 'multiple_choice' && q.options && (
            <div className="options">
              {q.options.map(opt => (
                <label key={opt.label} className={`option ${answers[q.id] === opt.label ? 'selected' : ''}`}>
                  <input type="radio" name={`q-${q.id}`} value={opt.label}
                    checked={answers[q.id] === opt.label}
                    onChange={() => setAnswer(q.id, opt.label)} />
                  <span className="opt-label">{opt.label}</span>
                  <span className="opt-text">{opt.text}</span>
                </label>
              ))}
            </div>
          )}

          {q.type === 'multiple_select' && q.options && (
            <div className="options">
              <div className="multi-hint">多选题 · 可勾选多个</div>
              {q.options.map(opt => {
                const cur = answers[q.id] || ''
                const picked = cur.split('').includes(opt.label)
                return (
                  <label key={opt.label} className={`option ${picked ? 'selected' : ''}`}
                    onClick={e => {
                      e.preventDefault()
                      const set = new Set(cur.split(''))
                      if (set.has(opt.label)) set.delete(opt.label); else set.add(opt.label)
                      setAnswer(q.id, Array.from(set).sort().join(''))
                    }}>
                    <input type="checkbox" readOnly checked={picked} />
                    <span className="opt-label">{opt.label}</span>
                    <span className="opt-text">{opt.text}</span>
                  </label>
                )
              })}
            </div>
          )}

          {q.type === 'judgment' && (
            <div className="options">
              {['对', '错'].map(v => (
                <label key={v} className={`option ${answers[q.id] === v ? 'selected' : ''}`}>
                  <input type="radio" name={`q-${q.id}`} value={v}
                    checked={answers[q.id] === v}
                    onChange={() => setAnswer(q.id, v)} />
                  <span className="opt-label">{v === '对' ? '√' : '×'}</span>
                  <span className="opt-text">{v}</span>
                </label>
              ))}
            </div>
          )}

          {q.type === 'fill_blank' && (
            <input className="text-input" type="text" value={answers[q.id] || ''}
              onChange={e => setAnswer(q.id, e.target.value)}
              placeholder="请输入答案" />
          )}

          {q.type === 'essay' && (
            <textarea className="textarea-input" rows="6" value={answers[q.id] || ''}
              onChange={e => setAnswer(q.id, e.target.value)}
              placeholder="请输入答案（简答题不计入自动分数）" />
          )}

          <div className="exam-nav">
            <button className="btn btn-secondary" disabled={currentIdx === 0}
              onClick={() => setCurrentIdx(currentIdx - 1)}>上一题</button>
            {currentIdx < questions.length - 1 ? (
              <button className="btn btn-primary"
                onClick={() => setCurrentIdx(currentIdx + 1)}>下一题</button>
            ) : (
              <button className="btn btn-primary" disabled={submitting}
                onClick={() => {
                  if (confirm(`确定交卷吗？已作答 ${answered} / ${questions.length} 题。`)) doSubmit(false)
                }}>{submitting ? '提交中...' : '交卷'}</button>
            )}
          </div>
        </motion.div>
      )}

      <div className="q-map">
        {questions.map((qq, i) => {
          const filled = answers[qq.id] != null && String(answers[qq.id]).trim() !== ''
          return (
            <button key={qq.id}
              className={`q-cell ${i === currentIdx ? 'current' : ''} ${filled ? 'filled' : ''}`}
              onClick={() => setCurrentIdx(i)}>
              {i + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}
