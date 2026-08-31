import {
  lazy,
  Suspense,
  useEffect,
  useRef,
} from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'

const HeroScene = lazy(
  () => import('../components/HeroScene'),
)

export default function Landing() {
  const pageRef =
    useRef<HTMLElement | null>(null)

  const navRef =
    useRef<HTMLElement | null>(null)

  const heroRef =
    useRef<HTMLDivElement | null>(null)

  const visualRef =
    useRef<HTMLDivElement | null>(null)

  const cardRef =
    useRef<HTMLDivElement | null>(null)

  const featureRef =
    useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const page = pageRef.current

    if (!page) {
      return
    }

    const reduceMotion =
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches

    if (reduceMotion) {
      return
    }

    const ctx = gsap.context(() => {
      const nav = navRef.current
      const hero = heroRef.current
      const visual = visualRef.current
      const card = cardRef.current
      const features = featureRef.current

      if (!hero) {
        return
      }

      const heroElements =
        hero.querySelectorAll<HTMLElement>(
          '[data-hero]',
        )

      const timeline =
        gsap.timeline({
          defaults: {
            ease: 'power3.out',
          },
        })

      /* --------------------------------------------------------------- */
      /* Navigation                                                       */
      /* --------------------------------------------------------------- */

      if (nav) {
        timeline.fromTo(
          nav,
          {
            opacity: 0,
            y: -12,
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
          },
        )
      }

      /* --------------------------------------------------------------- */
      /* Hero                                                             */
      /* --------------------------------------------------------------- */

      if (heroElements.length > 0) {
        timeline.fromTo(
          heroElements,
          {
            opacity: 0,
            y: 22,
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.08,
          },
          '-=0.25',
        )
      }

      /* --------------------------------------------------------------- */
      /* Product visual                                                   */
      /* --------------------------------------------------------------- */

      if (visual) {
        timeline.fromTo(
          visual,
          {
            opacity: 0,
            scale: 0.94,
            y: 18,
          },
          {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.9,
            ease: 'power3.out',
          },
          '-=0.55',
        )
      }

      /* --------------------------------------------------------------- */
      /* Feature strip                                                    */
      /* --------------------------------------------------------------- */

      if (features) {
        timeline.fromTo(
          features,
          {
            opacity: 0,
            y: 15,
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.55,
          },
          '-=0.35',
        )
      }

      /* --------------------------------------------------------------- */
      /* Main balance card                                                */
      /* --------------------------------------------------------------- */

      if (card) {
        gsap.to(card, {
          y: -8,
          duration: 3.5,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        })
      }

      /* --------------------------------------------------------------- */
      /* Beer bubbles                                                      */
      /* --------------------------------------------------------------- */

      const bubbles =
        page.querySelectorAll<HTMLElement>(
          '[data-bubble]',
        )

      if (bubbles.length > 0) {
        bubbles.forEach(
          (bubble, index) => {
            gsap.to(bubble, {
              y: -(20 + (index % 3) * 8),
              x:
                index % 2 === 0
                  ? 5
                  : -5,
              opacity: 0.15,
              duration:
                2.5 +
                (index % 4) * 0.5,
              repeat: -1,
              yoyo: true,
              delay:
                index * 0.18,
              ease: 'sine.inOut',
            })
          },
        )
      }
    }, page)

    return () => {
      ctx.revert()
    }
  }, [])

  return (
    <main
      ref={pageRef}
      className="min-h-screen overflow-x-hidden bg-[#090806] text-white"
    >
      {/* ================================================================ */}
      {/* PARTY BACKGROUND                                                  */}
      {/* ================================================================ */}

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        {/* Warm pub lighting */}

        <div className="absolute left-[18%] top-[-220px] h-[520px] w-[520px] rounded-full bg-amber-500/[0.065] blur-[150px]" />

        <div className="absolute right-[-180px] top-[15%] h-[500px] w-[500px] rounded-full bg-orange-500/[0.045] blur-[150px]" />

        <div className="absolute bottom-[-300px] left-[35%] h-[500px] w-[500px] rounded-full bg-yellow-500/[0.035] blur-[160px]" />

        {/* Dark vignette */}

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,transparent_0%,rgba(9,8,6,0.35)_52%,rgba(9,8,6,0.9)_100%)]" />

        {/* Subtle party light */}

        <div className="absolute left-[12%] top-[18%] h-1 w-1 rounded-full bg-amber-300/70 shadow-[0_0_18px_rgba(252,211,77,0.8)]" />

        <div className="absolute left-[28%] top-[12%] h-1 w-1 rounded-full bg-orange-300/60 shadow-[0_0_15px_rgba(253,186,116,0.7)]" />

        <div className="absolute right-[27%] top-[16%] h-1 w-1 rounded-full bg-amber-200/60 shadow-[0_0_16px_rgba(253,230,138,0.7)]" />

        <div className="absolute right-[12%] top-[27%] h-1 w-1 rounded-full bg-orange-300/50 shadow-[0_0_15px_rgba(253,186,116,0.6)]" />

        <div className="absolute left-[43%] top-[8%] h-1 w-1 rounded-full bg-amber-300/50 shadow-[0_0_15px_rgba(252,211,77,0.6)]" />

        {/* Floating beer bubbles */}

        <span
          data-bubble
          className="absolute left-[20%] top-[43%] h-1.5 w-1.5 rounded-full bg-amber-200/25"
        />

        <span
          data-bubble
          className="absolute left-[24%] top-[50%] h-1 w-1 rounded-full bg-amber-200/20"
        />

        <span
          data-bubble
          className="absolute right-[22%] top-[40%] h-1.5 w-1.5 rounded-full bg-amber-200/20"
        />

        <span
          data-bubble
          className="absolute right-[18%] top-[48%] h-1 w-1 rounded-full bg-amber-200/25"
        />

        {/* Floor / table atmosphere */}

        <div className="absolute bottom-[18%] left-1/2 h-px w-[80%] -translate-x-1/2 bg-gradient-to-r from-transparent via-amber-200/[0.08] to-transparent blur-[1px]" />
      </div>

      {/* ================================================================ */}
      {/* NAVIGATION                                                        */}
      {/* ================================================================ */}

      <nav
        ref={navRef}
        className="relative z-30 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7 lg:px-10"
      >
        <Link
          to="/"
          className="group flex items-center gap-2.5"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition duration-300 group-hover:border-amber-200/20 group-hover:bg-amber-200/[0.05] sm:h-9 sm:w-9 sm:rounded-xl">
            <span className="text-xs font-bold sm:text-sm">
              K
            </span>
          </div>

          <span className="text-sm font-semibold tracking-tight sm:text-base">
            KoTrack
          </span>
        </Link>

        {/* Only login remains */}

        <Link
          to="/login"
          className="rounded-lg px-3 py-2 text-[11px] text-white/45 transition hover:bg-white/[0.04] hover:text-white sm:px-4 sm:text-xs"
        >
          Login
        </Link>
      </nav>

      {/* ================================================================ */}
      {/* HERO                                                              */}
      {/* ================================================================ */}

      <section
        ref={heroRef}
        className="relative z-10 mx-auto max-w-6xl px-5 pb-8 pt-7 sm:px-8 sm:pb-14 sm:pt-12 lg:px-10 lg:pb-12"
      >
        <div className="grid items-center lg:grid-cols-[0.9fr_1.1fr] lg:gap-2">
          {/* ------------------------------------------------------------ */}
          {/* HERO COPY                                                     */}
          {/* ------------------------------------------------------------ */}

          <div className="relative z-20 max-w-xl">
            <div
              data-hero
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200/10 bg-amber-200/[0.035] px-3 py-1.5 text-[9px] text-amber-100/45 backdrop-blur-xl sm:mb-6 sm:px-4 sm:py-2 sm:text-[10px]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.75)]" />

              Built for nights with friends
            </div>

            <h1
              data-hero
              className="text-[3.5rem] font-semibold leading-[0.88] tracking-[-0.07em] sm:text-6xl lg:text-[5.8rem]"
            >
              One table.
              <br />

              <span className="bg-gradient-to-r from-amber-100 via-white to-white/45 bg-clip-text text-transparent">
                One tab.
              </span>

              <br />

              <span className="text-white/35">
                No guessing.
              </span>
            </h1>

            <p
              data-hero
              className="mt-5 max-w-md text-xs leading-5 text-white/35 sm:mt-7 sm:text-base sm:leading-6"
            >
              Track the drinks, split the cost, and
              know exactly who owes what after the
              night is over.
            </p>

            <div
              data-hero
              className="mt-6 flex items-center gap-2.5 sm:mt-8"
            >
              <Link
                to="/login"
                className="group inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-5 py-2.5 text-[11px] font-semibold text-black shadow-[0_15px_50px_rgba(255,255,255,0.08)] transition duration-300 hover:-translate-y-0.5 hover:bg-amber-50 sm:px-6 sm:py-3 sm:text-xs"
              >
                Start tracking

                <span className="ml-2 transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>

              <a
                href="#features"
                className="hidden text-[11px] text-white/30 transition hover:text-white sm:block sm:text-xs"
              >
                See how it works
              </a>
            </div>

            <div
              data-hero
              className="mt-6 flex items-center gap-4 text-[8px] text-white/20 sm:mt-8 sm:gap-6 sm:text-[9px]"
            >
              <Trust text="Precise" />
              <Trust text="Simple" />
              <Trust text="Transparent" />
            </div>
          </div>

          {/* ------------------------------------------------------------ */}
          {/* PARTY VISUAL                                                   */}
          {/* ------------------------------------------------------------ */}

          <div
            ref={visualRef}
            className="relative mx-auto mt-3 h-[310px] w-full max-w-[500px] sm:mt-8 sm:h-[470px] lg:mt-0 lg:h-[570px]"
          >
            {/* Warm glow */}

            <div
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.07] blur-[90px] sm:h-[350px] sm:w-[350px]"
            />

            {/* Existing 3D scene */}

            <div className="absolute inset-0">
              <Suspense fallback={null}>
                <HeroScene />
              </Suspense>
            </div>

            {/* ========================================================== */}
            {/* FRIEND CIRCLES                                              */}
            {/* ========================================================== */}

            <div className="absolute left-1/2 top-[49%] z-10 -translate-x-1/2 -translate-y-1/2">
              <div className="relative h-[250px] w-[250px] sm:h-[360px] sm:w-[360px]">
                {/* Connection lines */}

                <div className="absolute left-1/2 top-1/2 h-px w-[190px] -translate-x-1/2 rotate-[0deg] bg-gradient-to-r from-transparent via-amber-200/15 to-transparent sm:w-[270px]" />

                <div className="absolute left-1/2 top-1/2 h-px w-[170px] -translate-x-1/2 rotate-[60deg] bg-gradient-to-r from-transparent via-amber-200/10 to-transparent sm:w-[250px]" />

                <div className="absolute left-1/2 top-1/2 h-px w-[170px] -translate-x-1/2 -rotate-[60deg] bg-gradient-to-r from-transparent via-amber-200/10 to-transparent sm:w-[250px]" />

                {/* Friend 1 */}

                <Friend
                  className="absolute left-[2%] top-[45%]"
                  label="You"
                  initials="A"
                />

                {/* Friend 2 */}

                <Friend
                  className="absolute right-[2%] top-[45%]"
                  label="Friend"
                  initials="J"
                />

                {/* Friend 3 */}

                <Friend
                  className="absolute left-1/2 top-[2%] -translate-x-1/2"
                  label="Friend"
                  initials="M"
                />

                {/* Shared beer */}

                <div className="absolute left-1/2 top-1/2 flex h-[125px] w-[125px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-200/10 bg-[#17130c]/70 shadow-[0_25px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:h-[175px] sm:w-[175px]">
                  <div className="absolute inset-4 rounded-full border border-amber-200/[0.06]" />

                  {/* Beer glass */}

                  <div className="relative flex h-[65px] w-[43px] items-end justify-center rounded-b-[10px] rounded-t-[4px] border border-amber-100/20 bg-gradient-to-t from-amber-600/25 via-amber-300/15 to-white/[0.08] shadow-[0_0_35px_rgba(245,158,11,0.12)] sm:h-[85px] sm:w-[56px]">
                    {/* Beer */}

                    <div className="absolute bottom-0 left-0 right-0 h-[47px] rounded-b-[9px] bg-gradient-to-t from-amber-600/35 to-amber-300/15 sm:h-[63px]" />

                    {/* Foam */}

                    <div className="absolute -top-2 left-1/2 h-4 w-[45px] -translate-x-1/2 rounded-full bg-white/[0.12] blur-[2px] sm:w-[55px]" />

                    {/* Bubbles */}

                    <span className="absolute bottom-5 left-3 h-1 w-1 rounded-full bg-amber-100/35" />

                    <span className="absolute bottom-8 right-3 h-1 w-1 rounded-full bg-amber-100/30" />

                    <span className="absolute bottom-11 left-1/2 h-1 w-1 rounded-full bg-amber-100/25" />
                  </div>

                  <span className="absolute -bottom-8 text-[7px] uppercase tracking-[0.18em] text-amber-100/25 sm:-bottom-9 sm:text-[8px]">
                    Shared tab
                  </span>
                </div>
              </div>
            </div>

            {/* ========================================================== */}
            {/* BALANCE CARD                                                */}
            {/* ========================================================== */}

            <div
              ref={cardRef}
              className="absolute bottom-[2%] left-1/2 z-20 w-[220px] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#11100d]/90 p-4 shadow-[0_25px_80px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:bottom-[7%] sm:w-[270px] sm:rounded-3xl sm:p-5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[7px] uppercase tracking-[0.16em] text-white/25 sm:text-[9px]">
                  Your share
                </span>

                <span className="flex items-center gap-1.5 text-[7px] text-emerald-300/70 sm:text-[9px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

                  Split
                </span>
              </div>

              <div className="mt-2.5 text-[2rem] font-semibold tracking-[-0.05em] sm:mt-3 sm:text-[2.4rem]">
                RM 12.50
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
                <div>
                  <p className="text-[7px] text-white/20 sm:text-[9px]">
                    Shared tonight
                  </p>

                  <p className="mt-0.5 text-[9px] text-white/55 sm:text-[11px]">
                    4 friends
                  </p>
                </div>

                <div className="flex -space-x-1.5">
                  <Avatar letter="A" />
                  <Avatar letter="J" />
                  <Avatar letter="M" />
                  <Avatar letter="+" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* FEATURES                                                          */}
      {/* ================================================================ */}

      <section
        id="features"
        ref={featureRef}
        className="relative z-10 mx-auto max-w-6xl scroll-mt-6 px-5 pb-9 sm:px-8 sm:pb-14 lg:px-10"
      >
        <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-amber-100/[0.07] bg-white/[0.018] sm:rounded-3xl">
          <MiniFeature
            number="01"
            title="Track"
            description="Drinks"
          />

          <MiniFeature
            number="02"
            title="Split"
            description="Fairly"
          />

          <MiniFeature
            number="03"
            title="Settle"
            description="Simply"
          />
        </div>
      </section>

      {/* ================================================================ */}
      {/* FINAL CTA                                                         */}
      {/* ================================================================ */}

      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-7 sm:px-8 sm:pb-10 lg:px-10">
        <div className="relative overflow-hidden rounded-2xl border border-amber-100/[0.07] bg-white/[0.018] px-5 py-7 text-center sm:rounded-3xl sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-0 h-[180px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.055] blur-[90px]"
          />

          <div className="relative">
            <p className="text-[8px] uppercase tracking-[0.18em] text-amber-100/20 sm:text-[9px]">
              KoTrack
            </p>

            <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-3xl">
              Enjoy the night.
              <span className="text-white/35">
                {' '}
                We'll handle the math.
              </span>
            </h2>

            <Link
              to="/login"
              className="mt-4 inline-flex min-h-9 items-center rounded-xl bg-white px-5 py-2 text-[10px] font-semibold text-black transition duration-300 hover:-translate-y-0.5 hover:bg-amber-50 sm:mt-5 sm:min-h-10 sm:px-6 sm:text-xs"
            >
              Start tracking
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* FOOTER                                                            */}
      {/* ================================================================ */}

      <footer className="relative z-10 px-5 pb-5 sm:px-8 sm:pb-7 lg:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <p className="text-[8px] text-white/15 sm:text-[9px]">
            © {new Date().getFullYear()} KoTrack
          </p>

          <p className="text-[8px] text-white/10 sm:text-[9px]">
            Shared expenses, simplified.
          </p>
        </div>
      </footer>
    </main>
  )
}

/* ========================================================================= */
/* FRIEND                                                                  */
/* ========================================================================= */

function Friend({
  className,
  label,
  initials,
}: {
  className: string
  label: string
  initials: string
}) {
  return (
    <div
      className={`${className} flex flex-col items-center gap-1.5`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.055] text-[10px] font-medium text-white/55 shadow-[0_10px_30px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:h-12 sm:w-12 sm:text-xs">
        {initials}
      </div>

      <span className="text-[7px] text-white/20 sm:text-[8px]">
        {label}
      </span>
    </div>
  )
}

/* ========================================================================= */
/* AVATAR                                                                   */
/* ========================================================================= */

function Avatar({
  letter,
}: {
  letter: string
}) {
  return (
    <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#11100d] bg-white/[0.08] text-[6px] text-white/45 sm:h-6 sm:w-6 sm:text-[7px]">
      {letter}
    </div>
  )
}

/* ========================================================================= */
/* MINI FEATURE                                                             */
/* ========================================================================= */

function MiniFeature({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="border-r border-white/[0.06] px-3 py-4 last:border-r-0 sm:px-6 sm:py-5">
      <p className="text-[7px] tracking-[0.15em] text-white/15 sm:text-[8px]">
        {number}
      </p>

      <p className="mt-2 text-[10px] font-medium text-white/60 sm:text-xs">
        {title}
      </p>

      <p className="mt-0.5 text-[8px] text-white/20 sm:text-[9px]">
        {description}
      </p>
    </div>
  )
}

/* ========================================================================= */
/* TRUST                                                                    */
/* ========================================================================= */

function Trust({
  text,
}: {
  text: string
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1 w-1 rounded-full bg-amber-200/30" />
      {text}
    </span>
  )
}