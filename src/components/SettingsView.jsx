import { useEffect, useState } from 'react'
import PartnerConnection from './PartnerConnection'
import {
  defaultPushPreferences,
  disablePushNotifications,
  enablePushNotifications,
  getPushSettings,
  savePushPreferences,
} from '../services/pushNotifications'

const notificationSections = [
  ['meals', '식단', '🍚', '상대방이 식단을 등록하거나 수정하면 알려드려요.'],
  ['schedules', '일정', '📅', '상대방이 일정을 등록하거나 수정하면 알려드려요.'],
  ['goals', '목표', '🎯', '상대방이 새로운 목표를 등록하면 알려드려요.'],
  ['diaries', '일기', '📓', '상대방이 일기를 등록하거나 수정하면 알려드려요.'],
  ['anniversaries', '기념일', '♥', '상대방이 기념일을 등록하거나 수정하면 알려드려요.'],
]

const defaultNotificationSections = defaultPushPreferences

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
  useEffect(() => {
    let active = true

    getPushSettings(userId)
      .then(({ enabled, preferences }) => {
        if (!active) return
        setNotificationsEnabled(enabled)
        setSectionNotifications(preferences)
      })
      .catch(() => {
        if (!active) return
        setNotificationsEnabled(false)
        setNotificationMessage('알림 설정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      })

    return () => { active = false }
  }, [userId])

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
        await disablePushNotifications()
        setNotificationsEnabled(false)
        setNotificationMessage('이 기기에서 CoupleDaily 알림을 껐습니다.')
        return
      }

      await enablePushNotifications(userId, sectionNotifications)
      setNotificationsEnabled(true)
      setNotificationMessage('이 기기에서 상대방의 새 기록 알림을 받을 수 있습니다.')
    } catch (nextError) {
      setNotificationsEnabled(false)
      setNotificationMessage(nextError.message || '알림 설정을 변경하지 못했습니다.')
    } finally {
      setNotificationBusy(false)
    }
  }

  const toggleNotificationSection = async (section) => {
    if (!notificationsEnabled) return

    const previous = sectionNotifications
    const next = { ...previous, [section]: !previous[section] }
    setSectionNotifications(next)
    setNotificationBusy(true)
    setNotificationMessage('')
    try {
      await savePushPreferences(next)
    } catch (nextError) {
      setSectionNotifications(previous)
      setNotificationMessage(nextError.message || '세부 알림 설정을 변경하지 못했습니다.')
    } finally {
      setNotificationBusy(false)
    }
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
            <p>상대방이 새 기록을 남기면 이 기기로 알려드려요.</p>
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
        <small className="notification-note">알림은 상대방이 기록을 등록하거나 수정할 때 발송되며, 기기마다 한 번씩 켜야 합니다.</small>
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
