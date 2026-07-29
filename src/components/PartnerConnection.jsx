import { useEffect, useRef, useState } from 'react'

function PartnerConnection({
  connection,
  invite,
  loading,
  onCreateInvite,
  onAcceptInvite,
  onConnectDemo,
  autoOpen = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)
  const autoOpened = useRef(false)

  useEffect(() => {
    if (autoOpen && !autoOpened.current) {
      autoOpened.current = true
      setIsOpen(true)
    }
  }, [autoOpen])

  const handleSubmit = (event) => {
    event.preventDefault()
    onAcceptInvite(code)
  }

  const handleCopy = async () => {
    if (!invite?.invite_code) return
    await navigator.clipboard.writeText(invite.invite_code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  if (connection?.partner_id) {
    return (
      <section className="partner-card connected">
        <div className="partner-avatar" aria-hidden="true">
          {connection.partner_avatar_url ? (
            <img src={connection.partner_avatar_url} alt="" />
          ) : (
            <span>♡</span>
          )}
        </div>
        <div className="partner-copy">
          <p className="card-eyebrow">PARTNER CONNECTED</p>
          <h2>{connection.partner_nickname}님과 연결되었어요</h2>
          <p>이제 두 사람의 일정과 기록을 함께 채워갈 수 있어요.</p>
        </div>
        <span className="connection-badge">연결 완료</span>
      </section>
    )
  }

  return (
    <>
      <section className="partner-card">
        <div className="partner-visual" aria-hidden="true"><span>♡</span></div>
        <div className="partner-copy">
          <p className="card-eyebrow">COUPLE CONNECTION</p>
          <h2>아직 연결된 파트너가 없어요</h2>
          <p>초대 코드를 주고받고, 두 사람의 하루를 함께 기록해 보세요.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => setIsOpen(true)}>
          파트너 연결하기
        </button>
      </section>

      {isOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <section
            className="connection-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connection-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              aria-label="파트너 연결 창 닫기"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
            <p className="card-eyebrow">CONNECT TOGETHER</p>
            <h2 id="connection-title">파트너와 연결하기</h2>
            <p className="modal-description">
              내 코드를 공유하거나, 파트너에게 받은 코드를 입력하세요.
            </p>

            <div className="invite-panel">
              <h3>내 초대 코드</h3>
              {invite ? (
                <>
                  <div className="invite-code-row">
                    <strong>{invite.invite_code}</strong>
                    <button type="button" onClick={handleCopy}>
                      {copied ? '복사됨' : '복사'}
                    </button>
                  </div>
                  <p>24시간 동안 한 번만 사용할 수 있어요.</p>
                </>
              ) : (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={loading}
                  onClick={onCreateInvite}
                >
                  {loading ? '만드는 중...' : '초대 코드 만들기'}
                </button>
              )}
            </div>

            <div className="modal-divider"><span>또는</span></div>

            <form className="invite-form" onSubmit={handleSubmit}>
              <label htmlFor="partner-code">파트너 초대 코드</label>
              <input
                id="partner-code"
                value={code}
                maxLength={8}
                autoComplete="off"
                placeholder="8자리 코드 입력"
                onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              />
              <button
                className="primary-button"
                type="submit"
                disabled={loading || code.length !== 8}
              >
                {loading ? '연결하는 중...' : '파트너와 연결하기'}
              </button>
            </form>

            <div className="demo-panel">
              <div>
                <span className="demo-badge">DEMO</span>
                <h3>계정 하나로 먼저 둘러보기</h3>
                <p>테스트 파트너 ‘다정이’와 연결해 다음 기능을 개발할 수 있어요.</p>
              </div>
              <button
                className="demo-button"
                type="button"
                disabled={loading}
                onClick={onConnectDemo}
              >
                데모 파트너와 연결하기
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}

export default PartnerConnection
