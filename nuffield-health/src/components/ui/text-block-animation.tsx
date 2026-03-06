"use client"

import gsap from "gsap"
import { SplitText } from "gsap/SplitText"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useGSAP } from "@gsap/react"
import { useRef } from "react"

gsap.registerPlugin(SplitText, ScrollTrigger)

interface TextBlockAnimationProps {
    children: React.ReactNode
    animateOnScroll?: boolean
    delay?: number
    blockColor?: string
    stagger?: number
    duration?: number
    scroller?: string
}

export default function TextBlockAnimation({
    children,
    animateOnScroll = true,
    delay = 0,
    blockColor = "#000",
    stagger = 0.1,
    duration = 0.6,
    scroller,
}: TextBlockAnimationProps) {
    const containerRef = useRef<HTMLDivElement>(null)

    useGSAP(() => {
        if (!containerRef.current) return

        // Wait for fonts so SplitText measures correct line heights
        const run = () => {
            if (!containerRef.current) return

            const split = new SplitText(containerRef.current, {
                type: "lines",
                linesClass: "block-line-parent",
            })

            const lines = split.lines
            const blocks: HTMLDivElement[] = []

            lines.forEach((line) => {
                const wrapper = document.createElement("div")
                wrapper.style.position = "relative"
                wrapper.style.display = "block"
                wrapper.style.overflow = "visible"

                const block = document.createElement("div")
                block.style.position = "absolute"
                block.style.top = "-10%"
                block.style.left = "0"
                block.style.width = "100%"
                block.style.height = "120%"
                block.style.backgroundColor = blockColor
                block.style.zIndex = "2"
                block.style.transform = "scaleX(0)"
                block.style.transformOrigin = "left center"

                line.parentNode!.insertBefore(wrapper, line)
                wrapper.appendChild(line)
                wrapper.appendChild(block)

                gsap.set(line, { opacity: 0 })

                blocks.push(block)
            })

            const tl = gsap.timeline({
                defaults: { ease: "expo.inOut" },
                scrollTrigger: animateOnScroll ? {
                    trigger: containerRef.current,
                    start: "top 85%",
                    toggleActions: "play none none reverse",
                    ...(scroller ? { scroller } : {}),
                } : undefined,
                delay: delay,
            })

            tl.to(blocks, {
                scaleX: 1,
                duration: duration,
                stagger: stagger,
                transformOrigin: "left center",
            })
            .set(lines, {
                opacity: 1,
                stagger: stagger,
            }, `<${duration / 2}`)
            .to(blocks, {
                scaleX: 0,
                duration: duration,
                stagger: stagger,
                transformOrigin: "right center",
            }, `<${duration * 0.4}`)
        }

        if (document.fonts?.ready) {
            document.fonts.ready.then(run)
        } else {
            run()
        }

    }, {
        scope: containerRef,
        dependencies: [animateOnScroll, delay, blockColor, stagger, duration, scroller],
    })

    return (
        <div ref={containerRef} style={{ position: "relative" }}>
            {children}
        </div>
    )
}
