"use client"

import { useCallback, useRef, useEffect } from 'react'

type SoundType = 'click' | 'success' | 'error' | 'notification' | 'hover' | 'toggle' | 'complete'

// Web Audio API based sound generation
const createAudioContext = () => {
  if (typeof window !== 'undefined') {
    return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  }
  return null
}

interface SoundConfig {
  frequency: number
  duration: number
  type: OscillatorType
  volume: number
  decay?: number
  frequencyEnd?: number
}

const soundConfigs: Record<SoundType, SoundConfig> = {
  click: {
    frequency: 800,
    duration: 0.05,
    type: 'sine',
    volume: 0.1,
    decay: 0.03,
  },
  success: {
    frequency: 880,
    duration: 0.15,
    type: 'sine',
    volume: 0.12,
    frequencyEnd: 1320,
  },
  error: {
    frequency: 200,
    duration: 0.2,
    type: 'square',
    volume: 0.08,
    decay: 0.15,
  },
  notification: {
    frequency: 660,
    duration: 0.12,
    type: 'sine',
    volume: 0.1,
    frequencyEnd: 880,
  },
  hover: {
    frequency: 1200,
    duration: 0.03,
    type: 'sine',
    volume: 0.05,
  },
  toggle: {
    frequency: 600,
    duration: 0.08,
    type: 'sine',
    volume: 0.08,
    frequencyEnd: 800,
  },
  complete: {
    frequency: 523.25, // C5
    duration: 0.3,
    type: 'sine',
    volume: 0.12,
    frequencyEnd: 783.99, // G5
  },
}

export function useSound() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const enabledRef = useRef(true)

  useEffect(() => {
    // Check localStorage for sound preference
    const stored = localStorage.getItem('soundEnabled')
    enabledRef.current = stored !== 'false'
  }, [])

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = createAudioContext()
    }
    return audioContextRef.current
  }, [])

  const playSound = useCallback((type: SoundType) => {
    if (!enabledRef.current) return

    const audioContext = getAudioContext()
    if (!audioContext) return

    // Resume audio context if suspended (browser autoplay policy)
    if (audioContext.state === 'suspended') {
      audioContext.resume()
    }

    const config = soundConfigs[type]
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.type = config.type
    oscillator.frequency.setValueAtTime(config.frequency, audioContext.currentTime)

    // Frequency slide for certain sounds
    if (config.frequencyEnd) {
      oscillator.frequency.exponentialRampToValueAtTime(
        config.frequencyEnd,
        audioContext.currentTime + config.duration
      )
    }

    // Volume envelope
    gainNode.gain.setValueAtTime(config.volume, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + config.duration
    )

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + config.duration)
  }, [getAudioContext])

  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled
    localStorage.setItem('soundEnabled', String(enabled))
  }, [])

  const isEnabled = useCallback(() => enabledRef.current, [])

  return {
    playSound,
    setEnabled,
    isEnabled,
    playClick: () => playSound('click'),
    playSuccess: () => playSound('success'),
    playError: () => playSound('error'),
    playNotification: () => playSound('notification'),
    playHover: () => playSound('hover'),
    playToggle: () => playSound('toggle'),
    playComplete: () => playSound('complete'),
  }
}

// Singleton for non-hook usage
let globalAudioContext: AudioContext | null = null

export function playUISound(type: SoundType) {
  if (typeof window === 'undefined') return

  const stored = localStorage.getItem('soundEnabled')
  if (stored === 'false') return

  if (!globalAudioContext) {
    globalAudioContext = createAudioContext()
  }

  const audioContext = globalAudioContext
  if (!audioContext) return

  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }

  const config = soundConfigs[type]
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)

  oscillator.type = config.type
  oscillator.frequency.setValueAtTime(config.frequency, audioContext.currentTime)

  if (config.frequencyEnd) {
    oscillator.frequency.exponentialRampToValueAtTime(
      config.frequencyEnd,
      audioContext.currentTime + config.duration
    )
  }

  gainNode.gain.setValueAtTime(config.volume, audioContext.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(
    0.001,
    audioContext.currentTime + config.duration
  )

  oscillator.start(audioContext.currentTime)
  oscillator.stop(audioContext.currentTime + config.duration)
}
