import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleCheckBig,
  Clock3,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  MoreHorizontal,
  NotebookPen,
  PenTool,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import styles from "./home.module.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://optimus.lancehawks.com/";

export const metadata = {
  title: "Optimus — One Calm Place to Run Your Work",
  description:
    "Bring tasks, notes, calendar, projects, and team context into one calm command center built for focused work.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Optimus — One Calm Place to Run Your Work",
    description:
      "Plan the day, capture ideas, move projects forward, and keep your team in sync from one focused workspace.",
    url: "/",
    siteName: "Optimus",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Optimus productivity workspace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Optimus — One Calm Place to Run Your Work",
    description:
      "Tasks, notes, calendar, projects, and team context in one focused workspace.",
    images: ["/opengraph-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Optimus",
    url: SITE_URL,
    description:
      "A focused workspace for tasks, notes, calendars, projects, resources, and team collaboration.",
    author: {
      "@type": "Organization",
      name: "Lancehawks",
      url: "https://lancehawks.com",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Optimus",
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
    description:
      "A calm command center for planning work, capturing knowledge, and moving projects forward.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Organization",
      name: "Lancehawks",
      url: "https://lancehawks.com",
    },
  },
];

const modules = [
  { icon: ListTodo, label: "Tasks", color: "violet" },
  { icon: NotebookPen, label: "Notes", color: "rose" },
  { icon: CalendarDays, label: "Calendar", color: "blue" },
  { icon: FolderKanban, label: "Projects", color: "amber" },
  { icon: PenTool, label: "Whiteboards", color: "green" },
];

const capabilities = [
  {
    icon: Zap,
    title: "Capture at thought-speed",
    description:
      "Turn a passing thought into a task or note before the moment disappears.",
  },
  {
    icon: Users,
    title: "Move together",
    description:
      "Keep ownership, progress, milestones, and project decisions clear for everyone.",
  },
  {
    icon: ShieldCheck,
    title: "Stay in control",
    description:
      "One reliable system for the work and knowledge your day depends on.",
  },
];

function BrandMark() {
  return (
    <span className={styles.brandMark} aria-hidden="true">
      <CircleCheckBig strokeWidth={2.35} />
    </span>
  );
}

function ProductPreview() {
  return (
    <div className={styles.previewStage} aria-label="Preview of the Optimus dashboard">
      <div className={`${styles.previewInsight} ${styles.previewInsightLeft}`}>
        <span><CircleCheckBig size={17} /></span>
        <strong>Begin with clarity</strong>
        <p>A focused plan brings the right work to the surface.</p>
      </div>

      <div className={`${styles.previewInsight} ${styles.previewInsightRight}`}>
        <span><Zap size={17} /></span>
        <strong>Keep momentum visible</strong>
        <p>Owners, progress, and next steps stay in view.</p>
      </div>

      <div className={`${styles.floatCard} ${styles.weekCard}`}>
        <div className={styles.floatCardTopline}>
          <span>This week</span>
          <strong>78%</strong>
        </div>
        <div className={styles.miniBars} aria-hidden="true">
          {[44, 68, 54, 84, 66, 92, 74].map((height, index) => (
            <span key={height + index} style={{ height: `${height}%` }} />
          ))}
        </div>
        <div className={styles.miniLabels} aria-hidden="true">
          <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
        </div>
      </div>

      <div className={`${styles.floatCard} ${styles.nextCard}`}>
        <span className={styles.floatIcon}><CalendarDays size={15} /></span>
        <div>
          <span>Up next · 10:30</span>
          <strong>Product review</strong>
          <small>with Design &amp; Engineering</small>
        </div>
      </div>

      <div className={`${styles.floatCard} ${styles.noteCard}`}>
        <span className={styles.noteGlyph}><FileText size={15} /></span>
        <div>
          <span>Note captured</span>
          <strong>Launch story ideas</strong>
        </div>
        <Check size={14} />
      </div>

      <div className={`${styles.floatCard} ${styles.progressCard}`}>
        <div className={styles.progressRing}>
          <span>72%</span>
        </div>
        <div>
          <span>Project health</span>
          <strong>On track</strong>
        </div>
      </div>

      <div className={styles.appWindow}>
        <div className={styles.windowTopbar}>
          <div className={styles.windowDots} aria-hidden="true">
            <span /><span /><span />
          </div>
          <div className={styles.windowSearch}>
            <Search size={13} />
            <span>Search anything...</span>
            <kbd>⌘ K</kbd>
          </div>
          <div className={styles.windowActions}>
            <Bell size={15} />
            <span className={styles.avatar}>SS</span>
          </div>
        </div>

        <div className={styles.appBody}>
          <aside className={styles.appSidebar}>
            <div className={styles.appLogo}>
              <BrandMark />
              <strong>Optimus</strong>
            </div>
            <div className={styles.sideNav}>
              <span className={styles.sideActive}><LayoutDashboard size={14} />Overview</span>
              <span><ListTodo size={14} />Tasks <small>8</small></span>
              <span><CalendarDays size={14} />Calendar</span>
              <span><FolderKanban size={14} />Projects</span>
              <span><NotebookPen size={14} />Notes</span>
            </div>
            <div className={styles.sidebarProject}>
              <span>FAVORITES</span>
              <p><i className={styles.projectDotViolet} />Website launch</p>
              <p><i className={styles.projectDotOrange} />Product sprint</p>
            </div>
            <div className={styles.sidebarProfile}>
              <span className={styles.avatarSmall}>SS</span>
              <div><strong>Shivangi</strong><small>My workspace</small></div>
              <MoreHorizontal size={14} />
            </div>
          </aside>

          <div className={styles.dashboardCanvas}>
            <div className={styles.dashboardHeader}>
              <div>
                <span>Tuesday, July 22</span>
                <h3>Good morning, Shivangi.</h3>
                <p>Here&apos;s what needs your attention today.</p>
              </div>
              <button type="button"><Plus size={14} /> Quick add</button>
            </div>

            <div className={styles.statsRow}>
              <div><span>Tasks today</span><strong>08</strong><small>3 completed</small></div>
              <div><span>Focus time</span><strong>4.5h</strong><small>2 blocks planned</small></div>
              <div><span>Projects</span><strong>04</strong><small>All on track</small></div>
            </div>

            <div className={styles.dashboardGrid}>
              <section className={styles.todayPanel}>
                <div className={styles.panelHeading}>
                  <div><span className={styles.panelIcon}><CircleCheckBig size={14} /></span><strong>Today&apos;s focus</strong></div>
                  <span>View all <ArrowRight size={12} /></span>
                </div>
                <div className={styles.taskRows}>
                  <div>
                    <span className={styles.taskCheck}><Check size={11} /></span>
                    <p><s>Review campaign brief</s><small>Marketing</small></p>
                    <em className={styles.doneTag}>Done</em>
                  </div>
                  <div>
                    <span className={styles.emptyCheck} />
                    <p><strong>Finalize homepage direction</strong><small>Optimus · High priority</small></p>
                    <em className={styles.todayTag}>Today</em>
                  </div>
                  <div>
                    <span className={styles.emptyCheck} />
                    <p><strong>Prepare product review</strong><small>Product sprint</small></p>
                    <span className={styles.taskPeople}><i>AK</i><i>+2</i></span>
                  </div>
                </div>
              </section>

              <section className={styles.schedulePanel}>
                <div className={styles.panelHeading}>
                  <div><span className={styles.panelIconBlue}><CalendarDays size={14} /></span><strong>Schedule</strong></div>
                  <MoreHorizontal size={14} />
                </div>
                <div className={styles.timeline}>
                  <div><time>09:00</time><span className={styles.timelineViolet}><strong>Deep work</strong><small>Homepage concept</small></span></div>
                  <div><time>10:30</time><span className={styles.timelineBlue}><strong>Product review</strong><small>45 min · Team call</small></span></div>
                  <div><time>13:00</time><span className={styles.timelinePlain}><strong>Lunch &amp; reset</strong></span></div>
                </div>
              </section>

              <section className={styles.projectPanel}>
                <div className={styles.panelHeading}>
                  <div><span className={styles.panelIconOrange}><FolderKanban size={14} /></span><strong>Active projects</strong></div>
                  <span>4 projects</span>
                </div>
                <div className={styles.projectRow}>
                  <div className={styles.projectBadge}>O</div>
                  <div><strong>Optimus launch</strong><span><i style={{ width: "72%" }} /></span></div>
                  <b>72%</b>
                </div>
                <div className={styles.projectRow}>
                  <div className={`${styles.projectBadge} ${styles.projectBadgeBlue}`}>P</div>
                  <div><strong>Product sprint</strong><span><i style={{ width: "48%" }} /></span></div>
                  <b>48%</b>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowPreview() {
  return (
    <div className={styles.workflowPreview} aria-label="An Optimus project workflow">
      <div className={styles.workflowTopbar}>
        <div><span className={styles.projectLogo}>O</span><div><strong>Optimus launch</strong><small>Website redesign</small></div></div>
        <div className={styles.collaborators}><span>SS</span><span>AK</span><span>RM</span><button type="button"><Plus size={13} /></button></div>
      </div>
      <div className={styles.workflowTabs}>
        <span className={styles.workflowTabActive}>Overview</span><span>Tasks</span><span>Notes</span><span>Milestones</span><span>Files</span>
      </div>
      <div className={styles.workflowGrid}>
        <div className={styles.workflowProgress}>
          <div className={styles.workflowProgressHeader}><span>Project progress</span><strong>72%</strong></div>
          <div className={styles.largeProgress}><i /></div>
          <div className={styles.workflowMetrics}>
            <div><strong>18</strong><span>Completed</span></div>
            <div><strong>07</strong><span>In progress</span></div>
            <div><strong>03</strong><span>To do</span></div>
          </div>
        </div>
        <div className={styles.workflowActivity}>
          <div className={styles.miniHeading}><strong>Recent activity</strong><span>View all</span></div>
          <p><span>AK</span><span><strong>Arjun</strong> completed a task<small>12 min ago</small></span></p>
          <p><span>SS</span><span><strong>You</strong> added a project note<small>38 min ago</small></span></p>
          <p><span>RM</span><span><strong>Riya</strong> moved a milestone<small>1 hour ago</small></span></p>
        </div>
        <div className={styles.workflowMilestones}>
          <div className={styles.miniHeading}><strong>Milestones</strong><span>3 of 4</span></div>
          <div><CheckCircle2 size={15} /><span><strong>Visual direction</strong><small>Completed Jul 18</small></span></div>
          <div><CheckCircle2 size={15} /><span><strong>Core experience</strong><small>Completed Jul 20</small></span></div>
          <div><span className={styles.milestoneOpen} /><span><strong>Production launch</strong><small>Due Jul 28</small></span></div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className={styles.header}>
        <nav className={styles.nav} aria-label="Main navigation">
          <Link href="/" className={styles.brand} aria-label="Optimus home">
            <BrandMark />
            <span>Optimus</span>
          </Link>

          <div className={styles.navLinks}>
            <a href="#product">Product</a>
            <a href="#workflows">Workflows</a>
            <a href="#why-optimus">Why Optimus</a>
          </div>

          <div className={styles.navActions}>
            <Link href="/login" className={styles.signIn}>Sign in</Link>
            <Link href="/signup" className={styles.navCta}>Try Optimus <ArrowRight size={14} /></Link>
          </div>
        </nav>
      </header>

      <main>
        <section className={styles.hero} id="product">
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroGrid} aria-hidden="true" />

          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}><Sparkles size={13} /> Your workday, finally in sync</div>
            <h1><span>One calm place</span><br />to run your work.</h1>
            <p>
              Plan the day, capture ideas, move projects forward, and keep your
              team in sync—without stitching together ten different tools.
            </p>
            <div className={styles.heroActions}>
              <Link href="/signup" className={styles.primaryCta}>Start for free <ArrowRight size={16} /></Link>
              <a href="#workflows" className={styles.secondaryCta}><span><Play size={12} fill="currentColor" /></span> See how it works</a>
            </div>
            <small className={styles.heroNote}><Check size={13} /> Free to start <i /> No credit card needed</small>
          </div>

          <ProductPreview />

          <div className={styles.moduleRail} aria-label="Optimus modules">
            <span>Everything connected</span>
            <div>
              {modules.map(({ icon: Icon, label, color }) => (
                <p key={label}><i data-color={color}><Icon size={15} /></i>{label}</p>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.outcomes} id="why-optimus">
          <div className={styles.sectionIntro}>
            <span>Built for momentum</span>
            <h2>Less switching.<br /><em>More finishing.</em></h2>
            <p>
              Optimus gives every task, meeting, note, and decision a home—so
              the next step is always clear.
            </p>
          </div>
          <div className={styles.capabilityGrid}>
            {capabilities.map(({ icon: Icon, title, description }, index) => (
              <article key={title}>
                <div><span>0{index + 1}</span><i><Icon size={18} /></i></div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.workflowSection} id="workflows">
          <div className={styles.workflowCopy}>
            <span className={styles.sectionKicker}>One shared source of truth</span>
            <h2>From idea to done,<br />nothing gets lost.</h2>
            <p>
              Bring the plan, the work, and the conversation together. Optimus
              keeps context attached to the project instead of scattered across tabs.
            </p>
            <ul>
              <li><Check size={14} /> Clear owners, priorities, and due dates</li>
              <li><Check size={14} /> Shared notes, milestones, and activity</li>
              <li><Check size={14} /> Live progress without status meetings</li>
            </ul>
            <Link href="/signup">Explore project collaboration <ArrowRight size={15} /></Link>
          </div>
          <WorkflowPreview />
        </section>

        <section className={styles.daySection}>
          <div className={styles.dayCard}>
            <div className={styles.dayCopy}>
              <span className={styles.sectionKicker}>Designed around your day</span>
              <h2>Know what matters.<br />Then make it happen.</h2>
              <p>
                Start with a focused daily view, block time for important work,
                and capture everything else without breaking your flow.
              </p>
              <div className={styles.dayStats}>
                <div><strong>1</strong><span>clear home for work</span></div>
                <div><strong>9+</strong><span>connected modules</span></div>
              </div>
            </div>
            <div className={styles.dayVisual} aria-hidden="true">
              <div className={styles.focusCard}>
                <div><span><Clock3 size={14} /> Focus block</span><MoreHorizontal size={15} /></div>
                <strong>Homepage direction</strong>
                <p>09:00 — 10:30</p>
                <span className={styles.focusLine}><i /></span>
                <small>58 min remaining</small>
              </div>
              <div className={styles.captureCard}>
                <div><Sparkles size={15} /><span><strong>Quick capture</strong><small>Task created in Product sprint</small></span></div>
                <CheckCircle2 size={18} />
              </div>
            </div>
          </div>
        </section>

        <section className={styles.finalCta}>
          <div className={styles.finalGlow} aria-hidden="true" />
          <BrandMark />
          <span>Ready when you are</span>
          <h2>Make space for<br />your best work.</h2>
          <p>Set up your Optimus workspace and bring your day into focus.</p>
          <div>
            <Link href="/signup" className={styles.primaryCta}>Start for free <ArrowRight size={16} /></Link>
            <Link href="/login" className={styles.finalSignIn}>Already use Optimus? Sign in</Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <Link href="/" className={styles.brand}><BrandMark /><span>Optimus</span></Link>
          <p>A calmer operating system for focused work.</p>
        </div>
        <div className={styles.footerLinks}>
          <div><strong>Product</strong><a href="#product">Overview</a><a href="#workflows">Workflows</a><Link href="/signup">Get started</Link></div>
          <div><strong>Company</strong><a href="https://lancehawks.com/" target="_blank" rel="noreferrer">Lancehawks</a><Link href="/contact">Contact</Link><Link href="/login">Sign in</Link></div>
        </div>
        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} Optimus by Lancehawks</span>
          <span>Designed for work that matters.</span>
        </div>
      </footer>
    </div>
  );
}
