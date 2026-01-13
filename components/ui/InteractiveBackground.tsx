"use client"

import { useEffect, useRef } from 'react'

export function InteractiveBackground() {
  const gradientRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!gradientRef.current) return

      // Calculate mouse position as percentage of viewport
      const x = (e.clientX / window.innerWidth) * 100
      const y = (e.clientY / window.innerHeight) * 100

      // Update CSS custom properties for gradient position
      gradientRef.current.style.setProperty('--mouse-x', `${x}%`)
      gradientRef.current.style.setProperty('--mouse-y', `${y}%`)
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div
      ref={gradientRef}
      className="fixed inset-0 pointer-events-none -z-10 transition-opacity duration-500"
      style={{
        '--mouse-x': '50%',
        '--mouse-y': '50%',
        background: `
          radial-gradient(
            600px circle at var(--mouse-x) var(--mouse-y),
            rgba(99, 179, 237, 0.15),
            transparent 40%
          ),
          radial-gradient(
            800px circle at var(--mouse-x) var(--mouse-y),
            rgba(142, 99, 255, 0.1),
            transparent 50%
          ),
          var(--bg-app-gradient)
        `,
        backgroundAttachment: 'fixed',
      } as React.CSSProperties}
    />
  )
}
