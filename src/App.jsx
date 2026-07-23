import './App.css'

const projects = [
  {
    number: '01',
    title: '하루의 기록',
    description:
      '생각과 배움을 짧게 남기고, 시간이 지나도 다시 찾기 쉽게 정리합니다.',
    tag: 'Journal',
  },
  {
    number: '02',
    title: '작은 실험실',
    description:
      '새로운 아이디어를 빠르게 만들어 보고, 과정에서 얻은 인사이트를 공유합니다.',
    tag: 'Lab',
  },
  {
    number: '03',
    title: '좋아하는 것들',
    description:
      '오래 기억하고 싶은 책, 음악, 장소와 도구를 나만의 기준으로 모읍니다.',
    tag: 'Collection',
  },
]

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="arrow-icon"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  )
}

function App() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="홈으로 이동">
          Jieun<span>.</span>
        </a>
        <nav aria-label="주요 메뉴">
          <a href="#about">소개</a>
          <a href="#projects">프로젝트</a>
          <a href="#contact">연락</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">Personal space · Seoul</p>
            <h1 id="hero-title">
              매일의 생각을
              <br />
              <span>작은 결과물</span>로 만듭니다.
            </h1>
            <p className="hero-description">
              안녕하세요, 지은입니다. 일상에서 발견한 아이디어를 기록하고
              직접 만들어 보며 배운 것을 이곳에 차곡차곡 모읍니다.
            </p>
            <a className="primary-link" href="#projects">
              둘러보기
              <ArrowIcon />
            </a>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="orbit orbit-large" />
            <div className="orbit orbit-small" />
            <div className="visual-card">
              <span>Today&apos;s note</span>
              <strong>좋은 질문에서<br />좋은 시작이 나온다.</strong>
              <small>24 · 07 · 2026</small>
            </div>
          </div>
        </section>

        <section className="about section-grid" id="about">
          <p className="section-label">About</p>
          <div>
            <h2>천천히 살펴보고,<br />명확하게 만듭니다.</h2>
            <p>
              복잡한 것을 이해하기 쉬운 형태로 바꾸는 일을 좋아합니다.
              관찰하고, 질문하고, 직접 만들어 보는 과정을 통해 더 나은
              일상과 경험을 탐색합니다.
            </p>
          </div>
        </section>

        <section className="projects" id="projects" aria-labelledby="projects-title">
          <div className="section-heading">
            <p className="section-label">Selected</p>
            <h2 id="projects-title">지금 만들고 있는 것</h2>
          </div>

          <div className="project-list">
            {projects.map((project) => (
              <article className="project-card" key={project.number}>
                <div className="project-meta">
                  <span>{project.number}</span>
                  <span>{project.tag}</span>
                </div>
                <h3>{project.title}</h3>
                <p>{project.description}</p>
                <span className="card-action" aria-hidden="true">
                  <ArrowIcon />
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="contact section-grid" id="contact">
          <p className="section-label">Contact</p>
          <div>
            <h2>새로운 이야기는<br />언제나 반갑습니다.</h2>
            <p>
              흥미로운 아이디어나 함께 만들고 싶은 일이 있다면 편하게
              연락해 주세요.
            </p>
            <a className="text-link" href="mailto:hello@example.com">
              hello@example.com
              <ArrowIcon />
            </a>
          </div>
        </section>
      </main>

      <footer>
        <p>© 2026 Jieun. Built with care.</p>
        <a href="#top">맨 위로</a>
      </footer>
    </div>
  )
}

export default App
