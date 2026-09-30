import { useCallback } from 'react'
import { useSettingsStore } from '../store/settingsStore'

// Simple audio context for generating sounds
class SoundManager {
    private audioContext: AudioContext | null = null

    private getContext(): AudioContext {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        }
        return this.audioContext
    }

    playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.5) {
        try {
            const ctx = this.getContext()
            const oscillator = ctx.createOscillator()
            const gainNode = ctx.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(ctx.destination)

            oscillator.frequency.value = frequency
            oscillator.type = type

            gainNode.gain.setValueAtTime(volume * 0.3, ctx.currentTime)
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)

            oscillator.start(ctx.currentTime)
            oscillator.stop(ctx.currentTime + duration)
        } catch (error) {
            console.warn('Sound playback failed:', error)
        }
    }

    // Pleasant entry chime (ascending)
    playEntry(volume: number) {
        this.playTone(523.25, 0.15, 'sine', volume) // C5
        setTimeout(() => this.playTone(659.25, 0.15, 'sine', volume), 100) // E5
        setTimeout(() => this.playTone(783.99, 0.2, 'sine', volume), 200) // G5
    }

    // Exit sound (descending)
    playExit(volume: number) {
        this.playTone(783.99, 0.15, 'sine', volume) // G5
        setTimeout(() => this.playTone(659.25, 0.15, 'sine', volume), 100) // E5
        setTimeout(() => this.playTone(523.25, 0.2, 'sine', volume), 200) // C5
    }

    // Late warning (attention-grabbing)
    playLate(volume: number) {
        this.playTone(440, 0.1, 'triangle', volume) // A4
        setTimeout(() => this.playTone(440, 0.1, 'triangle', volume), 150)
        setTimeout(() => this.playTone(554.37, 0.2, 'triangle', volume), 300) // C#5
    }

    // Success sound
    playSuccess(volume: number) {
        this.playTone(523.25, 0.1, 'sine', volume)
        setTimeout(() => this.playTone(659.25, 0.1, 'sine', volume), 80)
        setTimeout(() => this.playTone(783.99, 0.1, 'sine', volume), 160)
        setTimeout(() => this.playTone(1046.50, 0.2, 'sine', volume), 240) // C6
    }

    // Error/warning sound
    playError(volume: number) {
        this.playTone(200, 0.2, 'sawtooth', volume * 0.5)
        setTimeout(() => this.playTone(180, 0.3, 'sawtooth', volume * 0.5), 200)
    }

    // Notification ping
    playNotification(volume: number) {
        this.playTone(880, 0.1, 'sine', volume) // A5
        setTimeout(() => this.playTone(1108.73, 0.15, 'sine', volume), 100) // C#6
    }
}

const soundManager = new SoundManager()

export function useSound() {
    const { soundEnabled, soundVolume } = useSettingsStore()

    const playEntry = useCallback(() => {
        if (soundEnabled) {
            soundManager.playEntry(soundVolume)
        }
    }, [soundEnabled, soundVolume])

    const playExit = useCallback(() => {
        if (soundEnabled) {
            soundManager.playExit(soundVolume)
        }
    }, [soundEnabled, soundVolume])

    const playLate = useCallback(() => {
        if (soundEnabled) {
            soundManager.playLate(soundVolume)
        }
    }, [soundEnabled, soundVolume])

    const playSuccess = useCallback(() => {
        if (soundEnabled) {
            soundManager.playSuccess(soundVolume)
        }
    }, [soundEnabled, soundVolume])

    const playError = useCallback(() => {
        if (soundEnabled) {
            soundManager.playError(soundVolume)
        }
    }, [soundEnabled, soundVolume])

    const playNotification = useCallback(() => {
        if (soundEnabled) {
            soundManager.playNotification(soundVolume)
        }
    }, [soundEnabled, soundVolume])

    return {
        playEntry,
        playExit,
        playLate,
        playSuccess,
        playError,
        playNotification,
        isEnabled: soundEnabled,
    }
}

export default useSound
