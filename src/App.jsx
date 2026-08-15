import { useEffect, useState } from 'react'
import './App.css'
import CalendarView from './components/CalendarView'
import DiaryView from './components/DiaryView'
import AnniversarySummary from './components/AnniversarySummary'
import BirthdaySummary from './components/BirthdaySummary'
import SettingsView from './components/SettingsView'
import GoalView from './components/GoalView'
import PartnerConnection from './components/PartnerConnection'
import { getSupabaseConnectionError, supabase } from './lib/supabase'
import {
  acceptPartnerInvite,
  connectDemoPartner,
  createPartnerInvite,
  deleteMyAccount,
  disconnectPartner,
  getPartnerConnection,
} from './services/partner'
import { getMyProfile, saveMyBirthday } from './services/profile'

function App() {
  const notificationDailyDate = new URLSearchParams(window.location.search).get('daily')
  const hasNotificationDailyDate = /^\d{4}-\d{2}-\d{2}$/.test(notificationDailyDate || '')
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [connection, setConnection] = useState(null)
  const [invite, setInvite] = useState(null)
  const [partnerLoading, setPartnerLoading] = useState(false)
  const [activeView, setActiveView] = useState('home')
  const [isDailyDetail, setIsDailyDetail] = useState(hasNotificationDailyDate)
  const [homeResetKey, setHomeResetKey] = useState(0)
  const [goalRefreshKey, setGoalRefreshKey] = useState(0)
  const [openDiaryEditor, setOpenDiaryEditor] = useState(false)
  const [dailyOpenRequest, setDailyOpenRequest] = useState(() => (
    hasNotificationDailyDate
      ? { date: notificationDailyDate, key: 0 }
      : null
  ))
  const [birthday, setBirthday] = useState(null)
  const [birthdayLoading, setBirthdayLoading] = useState(true)
  const [birthdaySaving, setBirthdaySaving] = useState(false)
  const [birthdayError, setBirthdayError] = useState('')

  const getFriendlyAuthError = (error) => {
    const message = error?.message || error || ''

    if (message.includes('KOE004') || message.includes('앱 관리자 설정')) {
      return '카카오 앱 설정을 확인해 주세요. Kakao Developers에서 Redirect URI, 앱 상태, 동의 항목이 올바른지 확인해야 합니다.'
    }

    return message || '인증 처리 중 문제가 발생했습니다.'
  }

  useEffect(() => {
    let isMounted = true

    const initialiseAuth = async () => {
      const connectionError = getSupabaseConnectionError()

      if (connectionError) {
        if (isMounted) {
          setErrorMessage(connectionError)
          setLoading(false)
        }
        return undefined
      }

      try {
        const { data, error } = await supabase.auth.getSession()
        const currentSession = data?.session

        if (!isMounted) {
          return undefined
        }

        if (error) {
          throw error
        }

        setSession(currentSession)
      } catch (error) {
        if (!isMounted) {
          return undefined
        }

        setErrorMessage(getFriendlyAuthError(error))
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }

      const { data: authData } = supabase.auth.onAuthStateChange((_event, currentSession) => {
        if (isMounted) {
          setSession(currentSession)
          setErrorMessage('')
        }
      })

      return () => {
        authData.subscription.unsubscribe()
      }
    }

    let cleanupPromise = Promise.resolve(undefined)

    if (supabase) {
      cleanupPromise = initialiseAuth()
    } else {
      setLoading(false)
    }

    return () => {
      isMounted = false
      cleanupPromise.then((cleanupFn) => cleanupFn?.())
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setConnection(null)
      setInvite(null)
      return
    }

    let isMounted = true

    const loadConnection = async () => {
      setPartnerLoading(true)

      try {
        const currentConnection = await getPartnerConnection()
        if (isMounted) setConnection(currentConnection)
      } catch (error) {
        if (isMounted) {
          const message = error?.message || ''
          setErrorMessage(
            message.includes('get_partner_connection')
              ? '파트너 연결용 데이터베이스 설정이 필요합니다.'
              : getFriendlyAuthError(error),
          )
        }
      } finally {
        if (isMounted) setPartnerLoading(false)
      }
    }

    loadConnection()

    return () => {
      isMounted = false
    }
  }, [session])

  useEffect(() => {
    if (!session) {
      setBirthday(null)
      setBirthdayLoading(false)
      return
    }

    let active = true
    setBirthdayLoading(true)
    setBirthdayError('')
    getMyProfile()
      .then((profile) => {
        if (active) setBirthday(profile.birthday)
      })
      .catch((error) => {
        if (active) setBirthdayError(error.message || '생일 정보를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (active) setBirthdayLoading(false)
      })

    return () => {
      active = false
    }
  }, [session])

  useEffect(() => {
    if (!session) return

    try {
      const resume = JSON.parse(window.localStorage.getItem('coupledaily:resume-editor') || 'null')
      if (resume?.userId === session.user.id && resume.type === 'diary') {
        setActiveView('diary')
      }
    } catch {
      window.localStorage.removeItem('coupledaily:resume-editor')
    }

    const currentState = window.history.state || {}
    if (!currentState.coupleDaily) {
      window.history.replaceState(
        { ...currentState, coupleDaily: true, view: 'home', daily: false },
        '',
        window.location.href,
      )
    }

    const handlePopState = (event) => {
      if (!event.state?.coupleDaily) return
      const nextView = event.state.view || 'home'
      setOpenDiaryEditor(false)
      setActiveView(nextView)
      setIsDailyDetail(Boolean(event.state.daily))
      if (nextView === 'home' && !event.state.daily) {
        setHomeResetKey((current) => current + 1)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [session])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined

    const handleNotificationNavigation = (event) => {
      if (event.data?.type !== 'OPEN_NOTIFICATION_URL') return

      const targetUrl = new URL(event.data.url || '/', window.location.origin)
      if (targetUrl.origin !== window.location.origin) return

      const requestedDate = targetUrl.searchParams.get('daily')
      if (/^\d{4}-\d{2}-\d{2}$/.test(requestedDate || '')) {
        setActiveView('home')
        setOpenDiaryEditor(false)
        setIsDailyDetail(true)
        setDailyOpenRequest({ date: requestedDate, key: Date.now() })
        window.history.pushState(
          { coupleDaily: true, view: 'home', daily: true, selectedDate: requestedDate },
          '',
          targetUrl.href,
        )
        return
      }

      setActiveView('home')
      setOpenDiaryEditor(false)
      setIsDailyDetail(false)
      setHomeResetKey((current) => current + 1)
      window.history.pushState(
        { coupleDaily: true, view: 'home', daily: false },
        '',
        targetUrl.href,
      )
    }

    navigator.serviceWorker.addEventListener('message', handleNotificationNavigation)
    return () => navigator.serviceWorker.removeEventListener('message', handleNotificationNavigation)
  }, [])

  const handleLogin = async () => {
    if (!supabase) {
      setErrorMessage('Supabase 연결이 준비되지 않았습니다.')
      return
    }

    setAuthLoading(true)
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (error) {
      setErrorMessage(getFriendlyAuthError(error))
    }

    setAuthLoading(false)
  }

  const handleLogout = async () => {
    if (!supabase) {
      setErrorMessage('Supabase 연결이 준비되지 않았습니다.')
      return
    }

    setAuthLoading(true)

    const { error } = await supabase.auth.signOut()

    if (error) {
      setErrorMessage(getFriendlyAuthError(error))
    }

    setAuthLoading(false)
  }

  const handleBirthdaySubmit = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const nextBirthday = form.get('birthday')
    if (!nextBirthday) return

    setBirthdaySaving(true)
    setBirthdayError('')
    try {
      setBirthday(await saveMyBirthday(nextBirthday))
    } catch (error) {
      setBirthdayError(error.message || '생일을 저장하지 못했습니다.')
    } finally {
      setBirthdaySaving(false)
    }
  }

  const handleCreateInvite = async () => {
    setPartnerLoading(true)
    setErrorMessage('')

    try {
      const nextInvite = await createPartnerInvite()
      setInvite(nextInvite)
      setConnection(await getPartnerConnection())
    } catch (error) {
      setErrorMessage(getFriendlyAuthError(error))
    } finally {
      setPartnerLoading(false)
    }
  }

  const handleAcceptInvite = async (code) => {
    setPartnerLoading(true)
    setErrorMessage('')

    try {
      await acceptPartnerInvite(code)
      setConnection(await getPartnerConnection())
      setInvite(null)
    } catch (error) {
      setErrorMessage(getFriendlyAuthError(error))
    } finally {
      setPartnerLoading(false)
    }
  }

  const handleConnectDemo = async () => {
    setPartnerLoading(true)
    setErrorMessage('')

    try {
      await connectDemoPartner()
      setConnection(await getPartnerConnection())
      setInvite(null)
    } catch (error) {
      setErrorMessage(getFriendlyAuthError(error))
    } finally {
      setPartnerLoading(false)
    }
  }

  const handleDisconnect = async () => {
    await disconnectPartner()
    setConnection(null)
    setInvite(null)
  }

  const handleDeleteAccount = async (confirmation) => {
    await deleteMyAccount(confirmation)
    await supabase.auth.signOut({ scope: 'local' })
    setSession(null)
  }

  const handleBirthdayChange = async (nextBirthday) => {
    const saved = await saveMyBirthday(nextBirthday)
    setBirthday(saved)
  }

  const user = session?.user
  const displayName = user?.user_metadata?.name || user?.user_metadata?.full_name || '사용자'
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : ''

  const EmptyCard = ({ icon, eyebrow, title, description, actionLabel }) => (
    <article className="dashboard-card empty-card">
      <div className="card-heading">
        <span className="card-icon" aria-hidden="true">{icon}</span>
        <div>
          <p className="card-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>
      <p className="empty-description">{description}</p>
      {actionLabel ? (
        <button className="text-button" type="button">
          {actionLabel}<span aria-hidden="true"> →</span>
        </button>
      ) : null}
    </article>
  )

  return (
    <div className="app-shell">
      {loading || (session && birthdayLoading) ? (
        <main className="auth-card">
          <div className="brand-mark" aria-hidden="true"><img src="/pwa/source-screen-icon.png" alt="" /></div>
          <div className="status-box">세션을 확인하고 있어요...</div>
        </main>
      ) : !session ? (
        <main className="auth-card">
          <div className="brand-mark" aria-hidden="true"><img src="/pwa/source-screen-icon.png" alt="" /></div>
          <p className="eyebrow">CoupleDaily</p>
          <>
            <h1>오늘의 마음을 함께 기록해요.</h1>
            <p className="intro-text">
              커플의 소중한 순간과 생각을 한곳에 모아, 서로의 하루를 더 가깝게
              이어보세요.
            </p>

            <button
              className="kakao-button"
              type="button"
              onClick={handleLogin}
              disabled={authLoading}
            >
              {authLoading ? '로그인 중...' : '카카오로 시작하기'}
            </button>

            {errorMessage ? (
              <>
                <p className="error-text">{errorMessage}</p>
                {currentOrigin ? (
                  <p className="hint-text">현재 접속 주소: {currentOrigin}</p>
                ) : null}
                <p className="hint-text">
                  Kakao Developers에서 Redirect URI와 앱 상태를 확인해 주세요.
                </p>
              </>
            ) : null}
          </>
        </main>
      ) : !birthday ? (
        <main className="auth-card birthday-card">
          <div className="brand-mark" aria-hidden="true"><img src="/pwa/source-screen-icon.png" alt="" /></div>
          <p className="eyebrow">WELCOME</p>
          <h1>{displayName}님, 생일을 알려주세요.</h1>
          <p className="intro-text">
            CoupleDaily에서 생일을 기억하고 소중한 날을 챙길 수 있도록 한 번만 입력해 주세요.
          </p>
          <form className="birthday-form" onSubmit={handleBirthdaySubmit}>
            <label htmlFor="profile-birthday">생년월일</label>
            <input
              id="profile-birthday"
              name="birthday"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              required
              autoFocus
            />
            <button type="submit" disabled={birthdaySaving}>
              {birthdaySaving ? '저장 중...' : '입력 완료'}
            </button>
          </form>
          {birthdayError ? <p className="error-text">{birthdayError}</p> : null}
          <button className="birthday-logout" type="button" onClick={handleLogout} disabled={authLoading}>
            다른 계정으로 로그인
          </button>
        </main>
      ) : (
        <div className="dashboard-shell">
          <header className="dashboard-header">
            <div className="brand-lockup">
              <div className="mini-brand-mark" aria-hidden="true">♡</div>
              <div>
                <p className="brand-name">CoupleDaily</p>
                <p className="brand-subtitle">우리의 하루를 차곡차곡</p>
              </div>
            </div>
            <button
              className="header-logout"
              type="button"
              onClick={handleLogout}
              disabled={authLoading}
            >
              {authLoading ? '처리 중...' : '로그아웃'}
            </button>
          </header>

          <main className="dashboard-main">
            {activeView === 'settings' ? (
              <SettingsView
                userId={user.id}
                connection={connection}
                invite={invite}
                partnerLoading={partnerLoading}
                displayName={displayName}
                email={user.email}
                birthday={birthday}
                onBirthdayChange={handleBirthdayChange}
                onCreateInvite={handleCreateInvite}
                onAcceptInvite={handleAcceptInvite}
                onConnectDemo={handleConnectDemo}
                onDisconnect={handleDisconnect}
                onDeleteAccount={handleDeleteAccount}
                onLogout={handleLogout}
              />
            ) : connection?.partner_id && activeView === 'home' ? (
              <>
                {!isDailyDetail ? (
                  <>
                    <section className="welcome-section">
                      <p className="today-label">오늘도 반가워요</p>
                      <h1>{displayName}님과 {connection.partner_nickname || '파트너'}님의 하루</h1>
                      <p>홈에서 목표와 캘린더를 함께 확인하고 날짜별 기록으로 이동할 수 있어요.</p>
                    </section>

                    <AnniversarySummary coupleId={connection.couple_id} />
                    <BirthdaySummary
                      displayName={displayName}
                      partnerName={connection.partner_nickname || '파트너'}
                      birthday={birthday}
                      partnerBirthday={connection.partner_birthday}
                    />
                  </>
                ) : null}

                <CalendarView
                  displayName={displayName}
                  partnerName={connection.partner_nickname || '파트너'}
                  coupleId={connection.couple_id}
                  userId={user.id}
                  birthday={birthday}
                  partnerBirthday={connection.partner_birthday}
                  homeResetKey={homeResetKey}
                  goalRefreshKey={goalRefreshKey}
                  dailyOpenRequest={dailyOpenRequest}
                  onDetailChange={setIsDailyDetail}
                  onOpenDiaryEditor={() => {
                    window.history.pushState(
                      { coupleDaily: true, view: 'diary', daily: false },
                      '',
                      window.location.href,
                    )
                    setOpenDiaryEditor(true)
                    setActiveView('diary')
                    setIsDailyDetail(false)
                  }}
                />
              </>
            ) : connection?.partner_id && activeView === 'diary' ? (
              <DiaryView
                displayName={displayName}
                partnerName={connection.partner_nickname || '파트너'}
                coupleId={connection.couple_id}
                userId={user.id}
                openEditorOnMount={openDiaryEditor}
                onEditorOpened={() => setOpenDiaryEditor(false)}
              />
            ) : connection?.partner_id && activeView === 'goal' ? (
              <GoalView
                coupleId={connection.couple_id}
                userId={user.id}
                displayName={displayName}
                partnerName={connection.partner_nickname || '파트너'}
                onGoalsChange={() => setGoalRefreshKey((current) => current + 1)}
              />
            ) : (
              <>
                <section className="welcome-section">
                  <p className="today-label">오늘도 반가워요</p>
                  <h1>{displayName}님의 하루</h1>
                  <p>파트너와 연결하면 홈에서 목표와 캘린더를 함께 볼 수 있어요.</p>
                </section>

                <PartnerConnection
                  connection={connection}
                  invite={invite}
                  loading={partnerLoading}
                  onCreateInvite={handleCreateInvite}
                  onAcceptInvite={handleAcceptInvite}
                  onConnectDemo={handleConnectDemo}
                  autoOpen={!partnerLoading}
                />

                <section className="dashboard-grid" aria-label="오늘의 CoupleDaily">
                  <EmptyCard
                    icon="☀"
                    eyebrow="TODAY"
                    title="오늘의 기록"
                    description="파트너 연결 후 식단과 일정을 함께 기록할 수 있어요."
                  />
                  <EmptyCard
                    icon="✓"
                    eyebrow="GOAL"
                    title="이번 달 목표"
                    description="함께 응원할 목표를 정하면 이곳에서 한눈에 볼 수 있어요."
                  />
                  <EmptyCard
                    icon="♡"
                    eyebrow="ANNIVERSARY"
                    title="우리의 기념일"
                    description="소중한 날짜를 등록하면 다가오는 기념일을 알려드려요."
                  />
                </section>
              </>
            )}
            {errorMessage ? <p className="dashboard-error">{errorMessage}</p> : null}
          </main>

          <nav className="bottom-nav" aria-label="주요 메뉴">
            {[
              ['⌂', '홈', 'home'],
              ['✓', '목표', 'goal'],
              ['DAY', '데일리', 'day'],
              ['📓', '일기', 'diary'],
              ['⚙', '설정', 'settings'],
            ].map(([icon, label, view]) => (
              <button
                className={`nav-item ${view === 'day' ? 'nav-day' : ''} ${
                  (view === 'day' && activeView === 'home' && isDailyDetail)
                  || (activeView === view && !(view === 'home' && isDailyDetail))
                    ? 'active'
                    : ''
                }`}
                type="button"
                aria-current={
                  (view === 'day' && activeView === 'home' && isDailyDetail)
                  || (activeView === view && !(view === 'home' && isDailyDetail))
                    ? 'page'
                    : undefined
                }
                onClick={() => {
                  setOpenDiaryEditor(false)
                  if (view === 'day') {
                    const now = new Date()
                    const todayKey = [
                      now.getFullYear(),
                      String(now.getMonth() + 1).padStart(2, '0'),
                      String(now.getDate()).padStart(2, '0'),
                    ].join('-')
                    window.history.pushState(
                      { coupleDaily: true, view: 'home', daily: true, selectedDate: todayKey },
                      '',
                      window.location.href,
                    )
                    setDailyOpenRequest((current) => ({
                      date: todayKey,
                      key: (current?.key || 0) + 1,
                    }))
                    setActiveView('home')
                    setIsDailyDetail(true)
                    return
                  }
                  const isSameScreen =
                    activeView === view && !(view === 'home' && isDailyDetail)
                  if (!isSameScreen) {
                    window.history.pushState(
                      { coupleDaily: true, view, daily: false },
                      '',
                      window.location.href,
                    )
                  }
                  setActiveView(view)
                  if (view === 'home') {
                    setHomeResetKey((current) => current + 1)
                    setIsDailyDetail(false)
                  }
                }}
                key={label}
              >
                <span className={view === 'day' ? 'day-nav-circle' : 'nav-icon'} aria-hidden="true">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      )}
    </div>
  )
}

export default App
