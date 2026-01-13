"use client"

import { useState, useCallback, useEffect, useRef } from 'react'

// Web Speech API type declarations
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionInstance
}

export interface VoiceInputResult {
  transcript: string
  confidence: number
  isFinal: boolean
}

interface UseVoiceInputOptions {
  onResult?: (result: VoiceInputResult) => void
  onError?: (error: string) => void
  language?: string
  continuous?: boolean
}

interface UseVoiceInputReturn {
  isListening: boolean
  isSupported: boolean
  transcript: string
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
}

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const {
    onResult,
    onError,
    language = 'en-US',
    continuous = false,
  } = options

  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // Check for browser support
  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setIsSupported(!!SpeechRecognitionAPI)

    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI() as SpeechRecognitionInstance
      recognition.continuous = continuous
      recognition.interimResults = true
      recognition.lang = language

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = ''
        let interimTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalTranscript += result[0].transcript
          } else {
            interimTranscript += result[0].transcript
          }
        }

        const currentTranscript = finalTranscript || interimTranscript
        setTranscript(currentTranscript)

        if (finalTranscript && onResult) {
          onResult({
            transcript: finalTranscript,
            confidence: event.results[event.results.length - 1][0].confidence,
            isFinal: true,
          })
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('[VoiceInput] Error:', event.error)
        setIsListening(false)
        if (onError) {
          let errorMessage = 'Voice recognition error'
          switch (event.error) {
            case 'no-speech':
              errorMessage = 'No speech detected. Please try again.'
              break
            case 'audio-capture':
              errorMessage = 'Microphone not available. Please check permissions.'
              break
            case 'not-allowed':
              errorMessage = 'Microphone access denied. Please allow microphone access.'
              break
            case 'network':
              // Network error can occur when:
              // 1. Not on HTTPS (localhost is exempt)
              // 2. Browser can't reach speech recognition servers
              // 3. Firewall/proxy blocking the connection
              if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
                errorMessage = 'Voice input requires HTTPS. Please use a secure connection.'
              } else {
                errorMessage = 'Network error. Speech recognition requires an internet connection.'
              }
              break
            case 'aborted':
              // Don't show error for user-initiated abort
              return
            case 'service-not-allowed':
              errorMessage = 'Speech recognition service not available. Try refreshing the page.'
              break
          }
          onError(errorMessage)
        }
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [continuous, language, onResult, onError])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      onError?.('Voice recognition not supported in this browser')
      return
    }

    setTranscript('')
    try {
      recognitionRef.current.start()
      setIsListening(true)
    } catch (error) {
      console.error('[VoiceInput] Start error:', error)
      onError?.('Failed to start voice recognition')
    }
  }, [onError])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [isListening])

  const resetTranscript = useCallback(() => {
    setTranscript('')
  }, [])

  return {
    isListening,
    isSupported,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
  }
}
