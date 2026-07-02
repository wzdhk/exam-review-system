import './Footer.css'

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-content">
        <h3 className="footer-title">联系方式</h3>
        <div className="footer-items">
          <span className="footer-item">
            <span className="footer-icon">✉</span>
            <span className="footer-label">邮箱</span>
            <span className="footer-value">17643480529@163.com</span>
          </span>
          <span className="footer-item">
            <span className="footer-icon">💬</span>
            <span className="footer-label">微信</span>
            <span className="footer-value">hxh1716151413</span>
          </span>
          <span className="footer-item">
            <span className="footer-icon">🐧</span>
            <span className="footer-label">QQ</span>
            <span className="footer-value">1624934712</span>
          </span>
          <a
            className="footer-item footer-link"
            href="https://github.com/wzdhk/exam-review-system"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="footer-icon">⌥</span>
            <span className="footer-label">GitHub</span>
            <span className="footer-value">wzdhk/exam-review-system</span>
          </a>
        </div>
      </div>
    </footer>
  )
}

export default Footer
