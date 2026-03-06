"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import TextBlockAnimation from "@/components/ui/text-block-animation"
import {
  ProgressSlider,
  SliderContent,
  SliderWrapper,
  SliderBtnGroup,
  SliderBtn,
} from "@/components/ui/progressive-carousel"

/* ═══════════════════════════════════════════════════
   Design tokens — editorial typography
   ═══════════════════════════════════════════════════ */
const TOTAL_SLIDES = 8
const INK = "#1A1A1A"           // Off-black, softer than pure black
const SUB = "#4A4A4A"           // Dark charcoal for secondary text — readable, not grey mush
const MUTED = "#666666"         // Tertiary — still passes WCAG AA
const TEAL = "#0d9488"
const MONO = "var(--font-jetbrains-mono), monospace"

const EASE = [0.22, 1, 0.36, 1] as const

const slideV = {
  enter: (d: number) => ({ opacity: 0, x: d > 0 ? 60 : -60, scale: 0.98 }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.5, ease: EASE },
  },
  exit: (d: number) => ({
    opacity: 0,
    x: d > 0 ? -60 : 60,
    scale: 0.98,
    transition: { duration: 0.3 },
  }),
}

/* ═══════════════════════════════════════════════════
   GSAP FadeIn helper
   ═══════════════════════════════════════════════════ */
function GFadeIn({
  children,
  delay = 0,
  y = 30,
  className,
}: {
  children: React.ReactNode
  delay?: number
  y?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!ref.current) return
    gsap.fromTo(
      ref.current,
      { opacity: 0, y },
      { opacity: 1, y: 0, duration: 0.8, delay, ease: "expo.out" }
    )
  }, { scope: ref, dependencies: [delay, y] })

  return (
    <div ref={ref} style={{ opacity: 0 }} className={className}>
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Slide wrapper — strict left/right edge alignment
   ═══════════════════════════════════════════════════ */
function Slide({
  children,
  align = "left",
}: {
  children: React.ReactNode
  align?: "left" | "right" | "center"
}) {
  const justify =
    align === "right" ? "items-end text-right" :
    align === "center" ? "items-center text-center" :
    "items-start text-left"
  return (
    <div className={`flex h-full w-full flex-col justify-center ${justify} px-5 sm:px-[6vw] md:px-[8vw] bg-white overflow-hidden`}>
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   SLIDE 0 — Title Slide
   Flush left. Headline + smaller darker subtext.
   Byline in monospace for tech credibility.
   ═══════════════════════════════════════════════════ */
function TitleSlide() {
  return (
    <Slide>
      <TextBlockAnimation
        blockColor={INK}
        animateOnScroll={false}
        delay={0.3}
        duration={0.8}
        stagger={0.1}
      >
        <h1
          className="text-[clamp(2.5rem,10vw,10rem)] font-black tracking-tighter leading-[1]"
          style={{ color: INK }}
        >
          Something<br />is happening.
        </h1>
      </TextBlockAnimation>

      <GFadeIn delay={2}>
        <p
          className="mt-6 sm:mt-8 text-[clamp(0.85rem,1.6vw,1.5rem)] font-normal max-w-xl leading-relaxed"
          style={{ color: SUB }}
        >
          A conversation about AI, boring tools, and a real opportunity.
        </p>
      </GFadeIn>

      <GFadeIn delay={2.6}>
        <p
          className="mt-8 sm:mt-14 text-[clamp(0.7rem,0.9vw,0.85rem)] uppercase tracking-[0.2em]"
          style={{ color: MUTED, fontFamily: MONO }}
        >
          Chris Gowland &middot; Paul Speight
        </p>
      </GFadeIn>
    </Slide>
  )
}

/* ═══════════════════════════════════════════════════
   SLIDE 1 — Dot Picture + "We Are So Early"
   Stacked mobile, side-by-side desktop
   ═══════════════════════════════════════════════════ */
function DotEarlySlide() {
  const COLS = 40
  const ROWS = 40
  const TOTAL = COLS * ROWS

  const dots = useMemo(() => {
    return Array.from({ length: TOTAL }, (_, i) => {
      const row = Math.floor(i / COLS)

      let color = "#d4d1c8"
      if (row >= 34) color = "#6bc589"
      if (i >= TOTAL - 6 && i < TOTAL - 1) color = "#e5a83b"
      if (i === TOTAL - 1) color = "#d95050"

      const invertedRow = ROWS - 1 - row
      const delay = 0.5 + invertedRow * 0.05

      return { color, delay }
    })
  }, [])

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-white overflow-hidden">
      {/* Left / Top */}
      <div className="flex flex-col justify-center px-5 sm:px-[6vw] md:px-[8vw] md:w-1/2 pt-8 md:pt-0">
        <TextBlockAnimation
          blockColor={INK}
          animateOnScroll={false}
          delay={0.2}
          duration={0.8}
          stagger={0.1}
        >
          <h1
            className="text-[clamp(1.8rem,5.5vw,6rem)] font-black tracking-tighter leading-[1.05]"
            style={{ color: INK }}
          >
            6.8 billion people have never used AI.
          </h1>
        </TextBlockAnimation>

        <TextBlockAnimation
          blockColor={TEAL}
          animateOnScroll={false}
          delay={1.8}
          duration={0.5}
        >
          <p className="mt-4 md:mt-6 text-[clamp(1rem,2.5vw,2.5rem)] font-black tracking-tight" style={{ color: TEAL }}>
            We are so early.
          </p>
        </TextBlockAnimation>

        <GFadeIn delay={2.6}>
          <p
            className="mt-4 md:mt-6 text-[clamp(0.7rem,1vw,0.95rem)] font-normal max-w-md leading-relaxed"
            style={{ color: SUB }}
          >
            82% of American businesses aren&apos;t using AI for anything.
            Only 4% have mature capabilities.
          </p>
        </GFadeIn>
        <GFadeIn delay={2.9}>
          <p
            className="mt-2 text-[clamp(0.65rem,0.85vw,0.8rem)] uppercase tracking-[0.15em]"
            style={{ color: MUTED, fontFamily: MONO }}
          >
            Stephen Bartlett
          </p>
        </GFadeIn>
      </div>

      {/* Right / Bottom — dot grid */}
      <div className="flex flex-col items-center justify-center md:w-1/2 px-4 md:pr-[4vw] md:px-0 py-4 md:py-0 flex-1 min-h-0">
        <GFadeIn delay={0.1} className="mb-2 md:mb-3 text-center">
          <h2
            className="text-[clamp(0.85rem,1.8vw,1.6rem)] font-black tracking-tight"
            style={{ color: INK }}
          >
            Each dot is ~3.2 million people
          </h2>
          <p className="text-[0.6rem] md:text-[0.65rem] mt-1" style={{ color: MUTED, fontFamily: MONO }}>
            2,500 dots = 8.1B humans &middot; colour = most advanced AI interaction, Feb 2026
          </p>
        </GFadeIn>

        <div
          className="grid gap-[1px] md:gap-[2px] w-full"
          style={{
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            maxWidth: "min(500px, 85vw)",
          }}
        >
          {dots.map((dot, i) => (
            <div
              key={i}
              className="aspect-square rounded-[1px] pres-dot"
              style={{
                backgroundColor: dot.color,
                animationDelay: `${dot.delay}s`,
              }}
            />
          ))}
        </div>

        <GFadeIn delay={3} className="mt-2 md:mt-3 flex flex-wrap justify-center gap-x-3 md:gap-x-4 gap-y-1 text-[0.55rem] md:text-[0.6rem]" >
          {[
            { color: "#d4d1c8", label: "Never used AI", stat: "~6.8B (84%)" },
            { color: "#6bc589", label: "Free chatbot", stat: "~1.3B (16%)" },
            { color: "#e5a83b", label: "Pays $20/mo", stat: "~15-25M" },
            { color: "#d95050", label: "Coding scaffold", stat: "~2-5M" },
          ].map((item) => (
            <span key={item.label} className="flex items-center gap-1" style={{ color: MUTED }}>
              <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
              {item.label} &middot; {item.stat}
            </span>
          ))}
        </GFadeIn>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   SLIDE 2 — The Boring Tools Thesis (right-aligned)
   ═══════════════════════════════════════════════════ */
function BoringToolsSlide() {
  return (
    <Slide align="right">
      <TextBlockAnimation
        blockColor={INK}
        animateOnScroll={false}
        delay={0.2}
        duration={0.8}
        stagger={0.1}
      >
        <h1
          className="text-[clamp(2.2rem,9vw,9rem)] font-black tracking-tighter leading-[1.05]"
          style={{ color: INK }}
        >
          The flashy AI phase is over.
        </h1>
      </TextBlockAnimation>

      <GFadeIn delay={1.4}>
        <p
          className="mt-4 md:mt-6 text-[clamp(0.85rem,1.6vw,1.5rem)] font-normal max-w-xl ml-auto leading-relaxed"
          style={{ color: SUB }}
        >
          People don&apos;t know what to ask. The answers are too broad. It doesn&apos;t fit into existing workflows.
        </p>
      </GFadeIn>

      <TextBlockAnimation
        blockColor={TEAL}
        animateOnScroll={false}
        delay={2.2}
        duration={0.6}
      >
        <p className="mt-6 md:mt-8 text-[clamp(1.5rem,5vw,5rem)] font-black tracking-tight" style={{ color: TEAL }}>
          The real revolution is boring.
        </p>
      </TextBlockAnimation>
    </Slide>
  )
}

/* ═══════════════════════════════════════════════════
   SLIDE 3 — The Electricity Analogy (left-aligned)
   ═══════════════════════════════════════════════════ */
function ElectricitySlide() {
  return (
    <Slide>
      <TextBlockAnimation
        blockColor="#d97706"
        animateOnScroll={false}
        delay={0.3}
        duration={0.7}
        stagger={0.1}
      >
        <h1
          className="text-[clamp(2rem,8vw,8rem)] font-black tracking-tighter leading-[1.05]"
          style={{ color: INK }}
        >
          Power stations made headlines.
        </h1>
      </TextBlockAnimation>

      <TextBlockAnimation
        blockColor={TEAL}
        animateOnScroll={false}
        delay={1.3}
        duration={0.7}
        stagger={0.1}
      >
        <h1 className="mt-4 md:mt-6 text-[clamp(2rem,8vw,8rem)] font-black tracking-tighter leading-[1.05]" style={{ color: TEAL }}>
          Washing machines changed civilisation.
        </h1>
      </TextBlockAnimation>

      <GFadeIn delay={2.3}>
        <p
          className="mt-6 md:mt-10 text-[clamp(0.8rem,1.3vw,1.2rem)] font-normal max-w-xl leading-relaxed"
          style={{ color: SUB }}
        >
          A meeting summariser. A policy explainer. A complaint analyser. None revolutionary. Used a hundred times a week — powerful.
        </p>
      </GFadeIn>
    </Slide>
  )
}

/* ═══════════════════════════════════════════════════
   SLIDE 4 — The Hidden Shift (right-aligned)
   ═══════════════════════════════════════════════════ */
function HiddenShiftSlide() {
  return (
    <Slide align="right">
      <TextBlockAnimation
        blockColor={INK}
        animateOnScroll={false}
        delay={0.2}
        duration={0.7}
        stagger={0.1}
      >
        <h1
          className="text-[clamp(2.2rem,9vw,9rem)] font-black tracking-tighter leading-[1.05]"
          style={{ color: INK }}
        >
          You no longer need a software team.
        </h1>
      </TextBlockAnimation>

      <TextBlockAnimation
        blockColor={TEAL}
        animateOnScroll={false}
        delay={1.4}
        duration={0.5}
      >
        <p className="mt-4 md:mt-8 text-[clamp(1.3rem,4vw,4rem)] font-black tracking-tight" style={{ color: TEAL }}>
          The barrier collapsed.
        </p>
      </TextBlockAnimation>

      <GFadeIn delay={2}>
        <p
          className="mt-4 md:mt-8 text-[clamp(0.8rem,1.3vw,1.2rem)] font-normal max-w-xl ml-auto leading-relaxed"
          style={{ color: SUB }}
        >
          A planning manager, an analyst, an operations lead can design AI tools — because they already understand the workflow.
        </p>
      </GFadeIn>
    </Slide>
  )
}

/* ═══════════════════════════════════════════════════
   SLIDE 5 — We Built One (carousel)
   ═══════════════════════════════════════════════════ */
const screenshots = [
  { title: "Dashboard", desc: "KPIs and tier distribution", img: "/presentation/dashboard.png", sliderName: "dashboard" },
  { title: "AI Scoring", desc: "Evidence-backed scores", img: "/presentation/quality-scoring.png", sliderName: "scoring" },
  { title: "Rewrite", desc: "AI content improvement", img: "/presentation/rewrite-engine.png", sliderName: "rewrite" },
  { title: "Actions", desc: "Prioritised quick wins", img: "/presentation/action-centre.png", sliderName: "actions" },
  { title: "Before / After", desc: "Side-by-side comparison", img: "/presentation/before-after.png", sliderName: "before-after" },
]

function WeBuiltOneSlide() {
  return (
    <Slide>
      <TextBlockAnimation
        blockColor={INK}
        animateOnScroll={false}
        delay={0.2}
        duration={0.7}
      >
        <h1
          className="text-[clamp(2rem,8vw,8rem)] font-black tracking-tighter leading-[1.05] mb-4 md:mb-6"
          style={{ color: INK }}
        >
          We built one.
        </h1>
      </TextBlockAnimation>

      <GFadeIn delay={1} className="w-full max-w-5xl">
        <div onClick={(e) => e.stopPropagation()}>
          <ProgressSlider
            vertical={false}
            activeSlider="dashboard"
            duration={8000}
            className="w-full"
          >
            <SliderContent>
              {screenshots.map((item) => (
                <SliderWrapper key={item.sliderName} value={item.sliderName}>
                  <img
                    className="w-full h-[180px] sm:h-[260px] md:h-[400px] object-cover object-top shadow-xl"
                    src={item.img}
                    alt={item.desc}
                  />
                </SliderWrapper>
              ))}
            </SliderContent>

            <SliderBtnGroup className="absolute bottom-0 left-0 right-0 h-fit bg-white/95 backdrop-blur-md overflow-hidden grid grid-cols-5 border-t border-zinc-200">
              {screenshots.map((item) => (
                <SliderBtn
                  key={item.sliderName}
                  value={item.sliderName}
                  className="text-left cursor-pointer p-2 sm:p-3 md:p-4 border-r border-zinc-200 last:border-r-0"
                  progressBarClass="bg-teal-50 h-full"
                >
                  <h3 className="font-bold text-[0.6rem] sm:text-xs md:text-sm sm:mb-1 truncate" style={{ color: INK }}>
                    {item.title}
                  </h3>
                  <p className="hidden sm:block text-xs md:text-sm font-normal line-clamp-1 leading-snug" style={{ color: MUTED }}>
                    {item.desc}
                  </p>
                </SliderBtn>
              ))}
            </SliderBtnGroup>
          </ProgressSlider>
        </div>
      </GFadeIn>

      <GFadeIn delay={1.5} className="mt-3 md:mt-4">
        <p
          className="text-[clamp(0.65rem,1vw,0.9rem)] uppercase tracking-[0.15em]"
          style={{ color: MUTED, fontFamily: MONO }}
        >
          3,800 profiles &middot; AI quality scoring &middot; Gap analysis &middot; Content rewriting &middot; Copilot
        </p>
      </GFadeIn>
    </Slide>
  )
}

/* ═══════════════════════════════════════════════════
   SLIDE 6 — The Question
   ═══════════════════════════════════════════════════ */
const questions = [
  "Do you see a genuine market need?",
  "Is there a scale opportunity?",
  "What are we not seeing?",
]

function TheQuestionSlide() {
  return (
    <Slide>
      <GFadeIn delay={0.2}>
        <p
          className="text-[clamp(0.6rem,0.8vw,0.75rem)] uppercase tracking-[0.3em] font-medium mb-6 md:mb-10"
          style={{ color: TEAL, fontFamily: MONO }}
        >
          Our ask
        </p>
      </GFadeIn>

      <div className="space-y-5 sm:space-y-6 md:space-y-8 w-full">
        {questions.map((q, i) => (
          <TextBlockAnimation
            key={i}
            blockColor={i === 0 ? TEAL : i === 1 ? "#d97706" : "#dc2626"}
            animateOnScroll={false}
            delay={0.5 + i * 0.6}
            duration={0.6}
          >
            <div className="flex items-baseline gap-3 sm:gap-4 md:gap-6">
              <span
                className="text-[clamp(1.8rem,6vw,6rem)] font-black leading-none shrink-0"
                style={{ color: "#E5E5E5", fontFamily: MONO }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <p
                className="text-[clamp(1.1rem,4.5vw,4.5rem)] font-black tracking-tight leading-[1.05]"
                style={{ color: INK }}
              >
                {q}
              </p>
            </div>
          </TextBlockAnimation>
        ))}
      </div>

      <GFadeIn delay={2.4} className="mt-6 md:mt-10">
        <p
          className="text-[clamp(0.8rem,1.3vw,1.2rem)] font-normal max-w-xl leading-relaxed"
          style={{ color: SUB }}
        >
          We have good careers. We&apos;re not going to throw them away on a gut feeling. Not investment. Not a partnership. Just your honest read.
        </p>
      </GFadeIn>
    </Slide>
  )
}

/* ═══════════════════════════════════════════════════
   SLIDE 7 — Discussion / Close
   ═══════════════════════════════════════════════════ */
function DiscussionSlide() {
  return (
    <Slide align="center">
      <TextBlockAnimation
        blockColor={INK}
        animateOnScroll={false}
        delay={0.3}
        duration={0.8}
        stagger={0.1}
      >
        <h1
          className="text-[clamp(2.5rem,10vw,10rem)] font-black tracking-tighter leading-[1.05]"
          style={{ color: INK }}
        >
          Over to you.
        </h1>
      </TextBlockAnimation>

      <GFadeIn delay={1.6}>
        <div className="mt-6 md:mt-10 w-16 h-px mx-auto" style={{ backgroundColor: TEAL }} />
      </GFadeIn>

      <GFadeIn delay={2}>
        <p
          className="mt-6 md:mt-8 text-[clamp(0.85rem,1.4vw,1.3rem)] font-normal"
          style={{ color: SUB }}
        >
          We&apos;ll send you the full demo afterwards.
        </p>
      </GFadeIn>
    </Slide>
  )
}

/* ═══════════════════════════════════════════════════
   Main Presentation Controller
   ═══════════════════════════════════════════════════ */
export default function PresentationPage() {
  const [slide, setSlide] = useState(0)
  const [dir, setDir] = useState(1)
  const router = useRouter()

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= TOTAL_SLIDES) return
      setDir(next > slide ? 1 : -1)
      setSlide(next)
    },
    [slide]
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault()
        go(slide + 1)
      }
      if (e.key === "ArrowLeft" || e.key === "Backspace") {
        e.preventDefault()
        go(slide - 1)
      }
      if (e.key === "Escape") router.push("/")
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [slide, go, router])

  useEffect(() => {
    let startX = 0
    let startY = 0
    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        if (dx < 0) go(slide + 1)
        else go(slide - 1)
      }
    }
    window.addEventListener("touchstart", onStart, { passive: true })
    window.addEventListener("touchend", onEnd, { passive: true })
    return () => {
      window.removeEventListener("touchstart", onStart)
      window.removeEventListener("touchend", onEnd)
    }
  }, [slide, go])

  const slides = [
    <TitleSlide key="s0" />,
    <DotEarlySlide key="s1" />,
    <BoringToolsSlide key="s2" />,
    <ElectricitySlide key="s3" />,
    <HiddenShiftSlide key="s4" />,
    <WeBuiltOneSlide key="s5" />,
    <TheQuestionSlide key="s6" />,
    <DiscussionSlide key="s7" />,
  ]

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes dotDrop {
              0% { opacity: 0; transform: translateY(-12px) scale(0.6); }
              60% { opacity: 1; transform: translateY(1px) scale(1.05); }
              100% { opacity: 1; transform: translateY(0) scale(1); }
            }
            .pres-dot {
              opacity: 0;
              animation: dotDrop 0.2s ease-out forwards;
            }
          `,
        }}
      />

      <div
        className="fixed inset-0 z-50 overflow-hidden select-none cursor-pointer bg-white"
        onClick={() => go(slide + 1)}
      >
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={slide}
            custom={dir}
            variants={slideV}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0"
          >
            {slides[slide]}
          </motion.div>
        </AnimatePresence>

        {/* Progress bar */}
        <div className="fixed bottom-0 left-0 right-0 h-0.5 z-[60]" style={{ backgroundColor: "#E5E5E5" }}>
          <motion.div
            className="h-full"
            style={{ backgroundColor: TEAL }}
            animate={{ width: `${((slide + 1) / TOTAL_SLIDES) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        {/* Slide counter — monospace */}
        <div
          className="fixed bottom-3 right-4 sm:right-6 text-[0.55rem] sm:text-[0.65rem] z-[60]"
          style={{ color: "#BBBBBB", fontFamily: MONO }}
        >
          {String(slide + 1).padStart(2, "0")} / {String(TOTAL_SLIDES).padStart(2, "0")}
        </div>

        {/* Navigation hint */}
        {slide === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3 }}
            className="fixed bottom-3 left-4 sm:left-6 text-[0.55rem] sm:text-[0.65rem] z-[60]"
            style={{ color: "#BBBBBB", fontFamily: MONO }}
          >
            <span className="hidden sm:inline">Click or &rarr; to advance &middot; ESC to exit</span>
            <span className="sm:hidden">Tap or swipe to advance</span>
          </motion.div>
        )}
      </div>
    </>
  )
}
