import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { uploadFile } from '../api'
import './Upload.css'

const FORMAT_GUIDES = [
  {
    key: 'choice',
    label: '选择题',
    icon: '◉',
    sample: `1. 题目内容？
A. 选项A
B. 选项B
C. 选项C
D. 选项D
答案：A`
  },
  {
    key: 'judge',
    label: '判断题',
    icon: '✓',
    sample: `判断题：地球是圆的。
答案：对

或简写：
地球是圆的。
答案：对

也可使用符号：
判断题：数组索引从0开始。√
答案：对`
  },
  {
    key: 'blank',
    label: '填空题',
    icon: '▭',
    sample: `填空题：请在横线处填写正确答案 ___
答案：正确答案`
  },
  {
    key: 'short',
    label: '简答题',
    icon: '¶',
    sample: `简答题：请简述某个概念的含义？
答案：详细的答案内容`
  },
  {
    key: 'code',
    label: '编程题',
    icon: '{ }',
    sample: `编程题：编写一个函数实现快速排序
答案：
def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    ...`
  }
]

const SUPPORTED_EXT = ['pdf', 'docx', 'txt']

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function Upload() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState([])
  const [importedCount, setImportedCount] = useState(0)
  const [totalBlocks, setTotalBlocks] = useState(0)
  const [redirectBankId, setRedirectBankId] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [activeGuide, setActiveGuide] = useState('choice')
  const [expandedWarning, setExpandedWarning] = useState(null)
  const inputRef = useRef(null)

  const validateAndSet = (selectedFile) => {
    if (!selectedFile) return
    const ext = selectedFile.name.split('.').pop().toLowerCase()
    if (SUPPORTED_EXT.includes(ext)) {
      setFile(selectedFile)
      setError('')
      setMessage('')
    } else {
      setError('文件格式不支持，请选择 PDF、DOCX 或 TXT 文件')
      setFile(null)
    }
  }

  const handleFileChange = (e) => {
    validateAndSet(e.target.files[0])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    validateAndSet(e.dataTransfer.files[0])
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const triggerPicker = () => {
    inputRef.current?.click()
  }

  const removeFile = (e) => {
    e.stopPropagation()
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleUpload = async () => {
    if (!file) {
      setError('请先选择文件')
      return
    }
    setUploading(true)
    setMessage('')
    setError('')
    setWarnings([])
    setImportedCount(0)
    setTotalBlocks(0)
    setRedirectBankId(null)
    try {
      const data = await uploadFile(file)
      setMessage(data.message || '题库导入成功')
      setImportedCount(data.count || 0)
      setTotalBlocks(data.totalBlocks || 0)
      setWarnings(Array.isArray(data.warnings) ? data.warnings : [])
      setRedirectBankId(data.bankId || null)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      if (!data.warnings || data.warnings.length === 0) {
        setTimeout(() => { window.location.href = '/banks' }, 1500)
      }
    } catch (err) {
      setError(err.message || '上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  const goToBanks = () => { window.location.href = '/banks' }
  const toggleWarning = (idx) => {
    setExpandedWarning(expandedWarning === idx ? null : idx)
  }

  const activeSample = FORMAT_GUIDES.find(g => g.key === activeGuide)

  return (
    <div className="upload-page">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="upload-header">
          <span className="upload-eyebrow">题库导入</span>
          <h1 className="page-title">将你的资料一键转为题库</h1>
          <p className="page-subtitle">支持 PDF、Word、TXT 三种格式，自动识别选择 / 判断 / 填空 / 简答 / 编程题</p>
        </div>

        <div className="upload-card">
          <div
            className={`drop-zone ${isDragging ? 'is-dragging' : ''} ${file ? 'has-file' : ''}`}
            onClick={!file ? triggerPicker : undefined}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            role="button"
            tabIndex={0}
          >
            <input
              ref={inputRef}
              id="file-input"
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
              className="file-input"
              tabIndex={-1}
              aria-hidden="true"
            />

            <AnimatePresence mode="wait">
              {!file ? (
                <motion.div
                  key="empty"
                  className="drop-empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="drop-icon" aria-hidden="true">
                    <svg viewBox="0 0 64 64" width="56" height="56" fill="none">
                      <path d="M14 38v8a4 4 0 0 0 4 4h28a4 4 0 0 0 4-4v-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      <path d="M32 14v26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      <path d="M22 24l10-10 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="drop-title">拖拽文件到此处，或<span className="drop-link">点击上传</span></div>
                  <div className="drop-hint">单个文件最大 20MB · PDF / DOCX / TXT</div>
                  <div className="drop-tags">
                    <span className="tag">.pdf</span>
                    <span className="tag">.docx</span>
                    <span className="tag">.txt</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="file"
                  className="drop-file"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="file-preview">
                    <div className="file-thumb">
                      {file.name.split('.').pop().toUpperCase()}
                    </div>
                    <div className="file-meta">
                      <div className="file-name">{file.name}</div>
                      <div className="file-size">{formatSize(file.size)} · 已就绪</div>
                    </div>
                    <button type="button" className="file-remove" onClick={removeFile} aria-label="移除文件">
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {file && (
            <motion.div
              className="action-row"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <button onClick={triggerPicker} className="btn btn-secondary btn-action" disabled={uploading}>
                重新选择
              </button>
              <button onClick={handleUpload} disabled={uploading} className="btn btn-primary btn-action">
                {uploading ? (
                  <span className="btn-loading">
                    <span className="spinner" />
                    正在导入…
                  </span>
                ) : '开始导入'}
              </button>
            </motion.div>
          )}

          <AnimatePresence>
            {message && (
              <motion.div
                className="message success"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <span className="message-dot" />{message}
              </motion.div>
            )}
            {error && (
              <motion.div
                className="message error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <span className="message-dot" />{error}
              </motion.div>
            )}
          </AnimatePresence>

          {warnings.length > 0 && (
            <motion.div
              className="warn-panel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="warn-head">
                <div>
                  <div className="warn-title">
                    {warnings.length} 道题未正常识别
                  </div>
                  <div className="warn-summary">
                    共扫描 {totalBlocks} 个题块 · 成功 {importedCount} · 未识别 {warnings.length}
                  </div>
                </div>
                {redirectBankId && (
                  <button className="btn btn-secondary warn-action" onClick={goToBanks}>
                    前往题库
                  </button>
                )}
              </div>
              <ul className="warn-list">
                {warnings.map((w, idx) => (
                  <li key={idx} className={`warn-item ${expandedWarning === idx ? 'open' : ''}`}>
                    <button className="warn-row" onClick={() => toggleWarning(idx)}>
                      <span className="warn-index">#{w.index}</span>
                      <span className="warn-line">行 {w.lineStart}</span>
                      <span className="warn-reason">{w.reason}</span>
                      <span className="warn-caret" aria-hidden="true">
                        <svg viewBox="0 0 12 12" width="10" height="10">
                          <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </button>
                    {expandedWarning === idx && (
                      <pre className="warn-snippet">{w.snippet}</pre>
                    )}
                  </li>
                ))}
              </ul>
              <div className="warn-hint">
                请按格式说明修正未识别的题目，重新整理后再次上传即可。已识别的题目可直接进入题库使用。
              </div>
            </motion.div>
          )}
        </div>

        <div className="format-guide">
          <div className="guide-head">
            <h3>题库格式说明</h3>
            <p>按以下格式整理题目，系统将自动识别题型与答案</p>
          </div>

          <div className="guide-tabs" role="tablist">
            {FORMAT_GUIDES.map(g => (
              <button
                key={g.key}
                role="tab"
                aria-selected={activeGuide === g.key}
                className={`guide-tab ${activeGuide === g.key ? 'active' : ''}`}
                onClick={() => setActiveGuide(g.key)}
              >
                <span className="guide-tab-icon">{g.icon}</span>
                <span>{g.label}</span>
              </button>
            ))}
          </div>

          <motion.pre
            key={activeGuide}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="guide-sample"
          >{activeSample.sample}</motion.pre>
        </div>
      </motion.div>
    </div>
  )
}

export default Upload
