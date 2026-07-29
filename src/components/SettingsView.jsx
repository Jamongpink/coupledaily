import { useState } from 'react'
import PartnerConnection from './PartnerConnection'

function SettingsView({
  connection,
  invite,
  partnerLoading,
  displayName,
  email,
  birthday,
  onBirthdayChange,
  onCreateInvite,
  onAcceptInvite,
  onConnectDemo,
  onDisconnect,
  onDeleteAccount,
  onLogout,
}) {
  const [birthdayDraft, setBirthdayDraft] = useState(birthday || '')
  const [savingBirthday, setSavingBirthday] = useState(false)
  const [dangerMode, setDangerMode] = useState(null)
  const [deleteText, setDeleteText] = useState('')
  const [dangerBusy, setDangerBusy] = useState(false)
  const [error, setError] = useState('')

  const saveBirthday = async (event) => {
    event.preventDefault()
    setSavingBirthday(true)
    setError('')
    try {
      await onBirthdayChange(birthdayDraft)
    } catch (nextError) {
      setError(nextError.message || '생일을 변경하지 못했습니다.')
    } finally {
      setSavingBirthday(false)
    }
  }

  const disconnect = async () => {
    setDangerBusy(true)
    setError('')
    try {
      await onDisconnect()
      setDangerMode(null)
    } catch (nextError) {
      setError(nextError.message || '파트너 연결을 해제하지 못했습니다.')
    } finally {
      setDangerBusy(false)
    }
  }

  const deleteAccount = async () => {
    setDangerBusy(true)
    setError('')
    try {
      await onDeleteAccount(deleteText)
    } catch (nextError) {
      setError(nextError.message || '회원 탈퇴를 완료하지 못했습니다.')
      setDangerBusy(false)
    }
  }

  return (
    <section className="settings-page">
      <header className="settings-header">
        <p className="today-label">SETTINGS</p>
        <h1>설정</h1>
        <p>내 정보와 파트너 연결, 계정을 관리할 수 있어요.</p>
      </header>

      <div className="settings-grid">
        <article className="settings-card">
          <header><span aria-hidden="true">☺</span><div><small>PROFILE</small><h2>내 정보</h2></div></header>
          <dl className="settings-profile">
            <div><dt>이름</dt><dd>{displayName}</dd></div>
            <div><dt>로그인 계정</dt><dd>{email || '카카오 계정'}</dd></div>
          </dl>
          <form className="settings-birthday-form" onSubmit={saveBirthday}>
            <label htmlFor="settings-birthday">생년월일</label>
            <div>
              <input
                id="settings-birthday"
                type="date"
                value={birthdayDraft}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setBirthdayDraft(event.target.value)}
                required
              />
              <button type="submit" disabled={savingBirthday || birthdayDraft === birthday}>
                {savingBirthday ? '저장 중...' : '변경'}
              </button>
            </div>
          </form>
        </article>

        <article className="settings-card">
          <header><span aria-hidden="true">♡</span><div><small>PARTNER</small><h2>파트너 연결</h2></div></header>
          {connection?.partner_id ? (
            <div className="settings-connection">
              <p><strong>{connection.partner_nickname || '파트너'}님</strong>과 연결되어 있어요.</p>
              <small>연결을 해제하면 두 사람의 공동 기록이 모두 삭제됩니다.</small>
              <button className="settings-danger-link" type="button" onClick={() => setDangerMode('disconnect')}>
                파트너 연결 끊기
              </button>
            </div>
          ) : (
            <PartnerConnection
              connection={connection}
              invite={invite}
              loading={partnerLoading}
              onCreateInvite={onCreateInvite}
              onAcceptInvite={onAcceptInvite}
              onConnectDemo={onConnectDemo}
            />
          )}
        </article>
      </div>

      <article className="settings-card account-settings">
        <header><span aria-hidden="true">⚙</span><div><small>ACCOUNT</small><h2>계정</h2></div></header>
        <div className="settings-account-actions">
          <button type="button" onClick={onLogout}>로그아웃</button>
          <button className="danger" type="button" onClick={() => setDangerMode('delete')}>회원 탈퇴</button>
        </div>
        <p>회원 탈퇴 시 계정과 모든 기록이 영구적으로 삭제되며 복구할 수 없습니다.</p>
      </article>

      {error ? <p className="settings-error" role="alert">{error}</p> : null}

      {dangerMode && (
        <div className="modal-backdrop">
          <section className="connection-modal settings-confirm-modal" role="dialog" aria-modal="true">
            <button className="modal-close" type="button" aria-label="닫기" onClick={() => setDangerMode(null)}>×</button>
            <p className="today-label">PLEASE CONFIRM</p>
            {dangerMode === 'disconnect' ? (
              <>
                <h2>파트너 연결을 끊을까요?</h2>
                <p>식단, 일정, 목표, 일기, 기념일 등 두 사람의 공동 기록이 모두 영구 삭제됩니다. 두 사람 모두 다시 초대 코드를 사용할 수 있게 됩니다.</p>
                <div className="settings-confirm-actions">
                  <button type="button" onClick={() => setDangerMode(null)} disabled={dangerBusy}>취소</button>
                  <button className="danger" type="button" onClick={disconnect} disabled={dangerBusy}>
                    {dangerBusy ? '처리 중...' : '연결 끊기'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>정말 탈퇴할까요?</h2>
                <p>계정과 공동 기록이 모두 영구 삭제됩니다. 계속하려면 아래에 <strong>탈퇴</strong>를 입력해 주세요.</p>
                <input
                  className="delete-confirm-input"
                  value={deleteText}
                  placeholder="탈퇴"
                  onChange={(event) => setDeleteText(event.target.value)}
                  autoFocus
                />
                <div className="settings-confirm-actions">
                  <button type="button" onClick={() => setDangerMode(null)} disabled={dangerBusy}>취소</button>
                  <button className="danger" type="button" onClick={deleteAccount} disabled={dangerBusy || deleteText !== '탈퇴'}>
                    {dangerBusy ? '처리 중...' : '영구 탈퇴'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  )
}

export default SettingsView
