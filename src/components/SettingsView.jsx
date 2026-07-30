import { useEffect, useState } from 'react'
import PartnerConnection from './PartnerConnection'

const notificationSections = [
  ['meals', '식단', '🍚', '식사 기록 시간을 알려드려요.'],
  ['schedules', '일정', '📅', '등록한 일정이 다가오면 알려드려요.'],
  ['goals', '목표', '🎯', '이번 달 목표 확인과 평가를 알려드려요.'],
  ['diaries', '일기', '📓', '오늘의 일기 작성을 알려드려요.'],
  ['anniversaries', '기념일', '♥', '생일과 기념일이 다가오면 알려드려요.'],
]

const defaultNotificationSections = Object.fromEntries(
  notificationSections.map(([key]) => [key, true]),
)

function SettingsView({
  userId,
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
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [notificationBusy, setNotificationBusy] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')
  const [sectionNotifications, setSectionNotifications] = useState(defaultNotificationSections)
  const deleteConfirmationMatches = deleteText.trim() === '탈퇴'
  const notificationStorageKey = `coupledaily:notifications:${userId}`
  const notificationSectionsStorageKey = `${notificationStorageKey}:sections`

  useEffect(() => {
    const savedPreference = window.localStorage.getItem(notificationStorageKey) === 'enabled'
    const permissionAllowsNotifications =
      typeof Notification !== 'undefined' && Notification.permission === 'granted'

    setNotificationsEnabled(savedPreference && permissionAllowsNotifications)

    try {
      const savedSections = JSON.parse(
        window.localStorage.getItem(notificationSectionsStorageKey) || '{}',
      )
      setSectionNotifications({
        ...defaultNotificationSections,
        ...savedSections,
      })
    } catch {
      setSectionNotifications(defaultNotificationSections)
    }
  }, [notificationSectionsStorageKey, notificationStorageKey])

  const openDangerDialog = (mode) => {
    setError('')
    setDeleteText('')
    setDangerMode(mode)
  }

  const closeDangerDialog = () => {
    if (dangerBusy) return
    setDangerMode(null)
    setDeleteText('')
    setError('')
  }

  const toggleNotifications = async () => {
    setNotificationBusy(true)
    setNotificationMessage('')

    try {
      if (notificationsEnabled) {
        window.localStorage.setItem(notificationStorageKey, 'disabled')
        setNotificationsEnabled(false)
        setNotificationMessage('이 기기에서 CoupleDaily 알림을 껐습니다.')
        return
      }

      if (typeof Notification === 'undefined') {
        throw new Error('이 브라우저에서는 알림 기능을 지원하지 않습니다.')
      }

      const permission =
        Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission()

      if (permission !== 'granted') {
        window.localStorage.setItem(notificationStorageKey, 'disabled')
        throw new Error(
          permission === 'denied'
            ? '브라우저에서 알림이 차단되어 있습니다. 기기 설정에서 CoupleDaily 알림을 허용해 주세요.'
            : '알림 권한이 허용되지 않았습니다.',
        )
      }

      window.localStorage.setItem(notificationStorageKey, 'enabled')
      setNotificationsEnabled(true)
      setNotificationMessage('이 기기에서 CoupleDaily 알림을 켰습니다.')
    } catch (nextError) {
      setNotificationsEnabled(false)
      setNotificationMessage(nextError.message || '알림 설정을 변경하지 못했습니다.')
    } finally {
      setNotificationBusy(false)
    }
  }

  const toggleNotificationSection = (section) => {
    if (!notificationsEnabled) return

    setSectionNotifications((current) => {
      const next = {
        ...current,
        [section]: !current[section],
      }
      window.localStorage.setItem(notificationSectionsStorageKey, JSON.stringify(next))
      return next
    })
  }

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

  const deleteAccount = async (event) => {
    event?.preventDefault()
    if (!deleteConfirmationMatches || dangerBusy) return

    setDangerBusy(true)
    setError('')
    try {
      await onDeleteAccount(deleteText.trim())
    } catch (nextError) {
      setError(nextError.message || '회원 탈퇴를 완료하지 못했습니다.')
    } finally {
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
              <button className="settings-danger-link" type="button" onClick={() => openDangerDialog('disconnect')}>
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

      <article className="settings-card notification-settings">
        <header><span aria-hidden="true">🔔</span><div><small>NOTIFICATIONS</small><h2>알림 설정</h2></div></header>
        <div className="notification-setting-row">
          <div>
            <strong>CoupleDaily 알림</strong>
            <p>이 기기에서 일정과 기념일 알림을 받을 수 있도록 설정합니다.</p>
          </div>
          <button
            className={`notification-switch ${notificationsEnabled ? 'is-on' : ''}`}
            type="button"
            role="switch"
            aria-checked={notificationsEnabled}
            aria-label="CoupleDaily 알림"
            onClick={toggleNotifications}
            disabled={notificationBusy}
          >
            <span aria-hidden="true" />
            <strong>{notificationBusy ? '처리 중' : notificationsEnabled ? '켜짐' : '꺼짐'}</strong>
          </button>
        </div>
        {notificationMessage ? (
          <p className={`notification-message ${notificationsEnabled ? 'success' : ''}`} role="status">
            {notificationMessage}
          </p>
        ) : null}
        <div className={`notification-section-list ${notificationsEnabled ? '' : 'is-disabled'}`}>
          {notificationSections.map(([key, label, icon, description]) => (
            <div className="notification-section-row" key={key}>
              <span className="notification-section-icon" aria-hidden="true">{icon}</span>
              <div>
                <strong>{label} 알림</strong>
                <p>{description}</p>
              </div>
              <button
                className={`notification-section-switch ${notificationsEnabled && sectionNotifications[key] ? 'is-on' : ''}`}
                type="button"
                role="switch"
                aria-checked={notificationsEnabled && sectionNotifications[key]}
                aria-label={`${label} 알림`}
                onClick={() => toggleNotificationSection(key)}
                disabled={!notificationsEnabled || notificationBusy}
              >
                <span aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
        <small className="notification-note">알림 허용 상태는 현재 사용하는 기기에만 저장됩니다.</small>
      </article>

      <article className="settings-card account-settings">
        <header><span aria-hidden="true">⚙</span><div><small>ACCOUNT</small><h2>계정</h2></div></header>
        <div className="settings-account-actions">
          <button type="button" onClick={onLogout}>로그아웃</button>
          <button className="danger" type="button" onClick={() => openDangerDialog('delete')}>회원 탈퇴</button>
        </div>
        <p>회원 탈퇴 시 계정과 모든 기록이 영구적으로 삭제되며 복구할 수 없습니다.</p>
      </article>

      {error && !dangerMode ? <p className="settings-error" role="alert">{error}</p> : null}

      {dangerMode && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDangerDialog()
          }}
        >
          <section className="connection-modal settings-confirm-modal" role="dialog" aria-modal="true">
            <button className="modal-close" type="button" aria-label="닫기" onClick={closeDangerDialog} disabled={dangerBusy}>×</button>
            <p className="today-label">PLEASE CONFIRM</p>
            {dangerMode === 'disconnect' ? (
              <>
                <h2>파트너 연결을 끊을까요?</h2>
                <p>식단, 일정, 목표, 일기, 기념일 등 두 사람의 공동 기록이 모두 영구 삭제됩니다. 두 사람 모두 다시 초대 코드를 사용할 수 있게 됩니다.</p>
                {error ? <p className="settings-modal-error" role="alert">{error}</p> : null}
                <div className="settings-confirm-actions">
                  <button type="button" onClick={closeDangerDialog} disabled={dangerBusy}>취소</button>
                  <button className="danger" type="button" onClick={disconnect} disabled={dangerBusy}>
                    {dangerBusy ? '처리 중...' : '연결 끊기'}
                  </button>
                </div>
              </>
            ) : (
              <form className="delete-account-form" onSubmit={deleteAccount}>
                <h2>정말 탈퇴할까요?</h2>
                <p>계정과 공동 기록이 모두 영구 삭제됩니다. 계속하려면 아래에 <strong>탈퇴</strong>를 입력해 주세요.</p>
                <input
                  className="delete-confirm-input"
                  value={deleteText}
                  placeholder="탈퇴"
                  onChange={(event) => {
                    setDeleteText(event.target.value)
                    if (error) setError('')
                  }}
                  aria-describedby="delete-account-help"
                  disabled={dangerBusy}
                  autoFocus
                />
                <small id="delete-account-help" className={deleteConfirmationMatches ? 'confirmation-ready' : ''}>
                  {deleteConfirmationMatches ? '확인되었습니다. 영구 탈퇴 버튼을 눌러 주세요.' : '“탈퇴”를 입력하면 버튼이 활성화됩니다.'}
                </small>
                {error ? <p className="settings-modal-error" role="alert">{error}</p> : null}
                <div className="settings-confirm-actions">
                  <button type="button" onClick={closeDangerDialog} disabled={dangerBusy}>취소</button>
                  <button className="danger" type="submit" disabled={dangerBusy || !deleteConfirmationMatches}>
                    {dangerBusy ? '처리 중...' : '영구 탈퇴'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </section>
  )
}

export default SettingsView
