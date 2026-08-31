import { Link } from 'react-router-dom'
import HeroScene from '../components/HeroScene'

export default function Landing() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#070910] text-white">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[35%] top-[-250px] h-[600px] w-[600px] rounded-full bg-violet-500/[0.08] blur-[150px]" />

        <div className="absolute right-[-200px] top-[30%] h-[500px] w-[500px] rounded-full bg-blue-500/[0.07] blur-[150px]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-7 lg:px-10">
        <Link
          to="/"
          className="flex items-center gap-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
            <span className="text-sm font-bold">K</span>
          </div>

          <span className="text-lg font-semibold tracking-tight">
            KoTrack
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-xl px-4 py-2.5 text-sm text-white/55 transition hover:bg-white/[0.05] hover:text-white"
          >
            Login
          </Link>

          <Link
            to="/login"
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:scale-[1.02] hover:bg-white/90"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-100px)] max-w-7xl items-center px-6 pb-16 pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:pt-0">
        {/* Copy */}
        <div className="relative z-10 max-w-2xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs text-white/55 backdrop-blur-xl">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
            Smart drink tracking
          </div>

          <h1 className="text-[3.5rem] font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-[5.5rem]">
            Track every
            <br />
            packet.
            <br />
            <span className="bg-gradient-to-r from-white via-white/80 to-white/35 bg-clip-text text-transparent">
              Split everything.
            </span>
          </h1>

          <p className="mt-8 max-w-xl text-base leading-7 text-white/45 sm:text-lg">
            KoTrack makes shared drink expenses simple. Track sessions,
            calculate everyone's share, and keep payments transparent.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-black transition hover:scale-[1.02] hover:bg-white/90"
            >
              Get Started
            </Link>

            <a
              href="#features"
              className="rounded-xl border border-white/10 bg-white/[0.025] px-6 py-3.5 text-sm font-medium text-white/65 backdrop-blur-xl transition hover:bg-white/[0.06] hover:text-white"
            >
              Explore KoTrack
            </a>
          </div>

          <div className="mt-11 flex flex-wrap gap-x-8 gap-y-3 text-xs text-white/25">
            <span>Precise calculations</span>
            <span>Secure accounts</span>
            <span>Transparent payments</span>
          </div>
        </div>

        {/* 3D area */}
        <div className="relative hidden h-[650px] lg:block">
          <div className="absolute inset-0">
            <HeroScene />
          </div>

          {/* Balance card */}
          <div className="absolute left-1/2 top-1/2 w-[285px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#11131a]/70 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/35">
                Current balance
              </span>

              <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.8)]" />
            </div>

            <div className="mt-4 text-[2.6rem] font-semibold tracking-[-0.04em]">
              RM 37.50
            </div>

            <div className="mt-5 flex items-end justify-between">
              <div>
                <p className="text-xs text-white/30">
                  Outstanding
                </p>

                <p className="mt-1 text-sm text-white/65">
                  2 sessions
                </p>
              </div>

              <span className="rounded-full border border-amber-300/10 bg-amber-300/[0.08] px-3 py-1 text-[11px] text-amber-300">
                Pending
              </span>
            </div>
          </div>

          {/* Small floating card */}
          <div className="absolute bottom-[19%] left-[8%] rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3 backdrop-blur-xl">
            <p className="text-[9px] uppercase tracking-wider text-white/30">
              Last session
            </p>

            <p className="mt-1 text-sm font-medium">
              1.5 packets
            </p>
          </div>

          {/* Small status card */}
          <div className="absolute right-[5%] top-[18%] rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-white/50">
                Payments synced
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature section */}
      <section
        id="features"
        className="relative z-10 mx-auto max-w-7xl px-6 pb-24 lg:px-10"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Feature
            number="01"
            title="Track sessions"
            description="Record shared drink sessions and know exactly what was used."
          />

          <Feature
            number="02"
            title="Split precisely"
            description="Costs are calculated using exact decimal arithmetic and deterministic rounding."
          />

          <Feature
            number="03"
            title="Stay balanced"
            description="See outstanding balances and keep payment status clear."
          />
        </div>
      </section>
    </main>
  )
}

function Feature({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 backdrop-blur-xl transition hover:bg-white/[0.04]">
      <span className="text-xs text-white/25">
        {number}
      </span>

      <h2 className="mt-8 text-lg font-medium">
        {title}
      </h2>

      <p className="mt-3 text-sm leading-6 text-white/35">
        {description}
      </p>
    </div>
  )
}