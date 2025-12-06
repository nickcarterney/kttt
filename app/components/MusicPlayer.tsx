'use client'

import { useState, useEffect, useRef } from 'react'

interface MusicPlayerProps {
  className?: string
}

export default function MusicPlayer({ className = '' }: MusicPlayerProps) {
  const [playlist, setPlaylist] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMinimized, setIsMinimized] = useState(false)
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false)
  const playlistRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Load audio files on mount
  useEffect(() => {
    const loadAudioFiles = async () => {
      try {
        const response = await fetch('/api/audio')
        if (response.ok) {
          const data = await response.json()
          if (data.files && data.files.length > 0) {
            setPlaylist(data.files)
          }
        }
      } catch (error) {
        console.error('Error loading audio files:', error)
      }
    }

    loadAudioFiles()
  }, [])

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)
    const handleEnded = () => {
      // Auto-play next song
      if (currentIndex < playlist.length - 1) {
        setCurrentIndex(currentIndex + 1)
      } else {
        // Loop back to first song
        setCurrentIndex(0)
      }
    }
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
    }
  }, [currentIndex, playlist.length])

  // Update audio source when currentIndex changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || playlist.length === 0) return

    audio.src = playlist[currentIndex]
    // Always auto-play when switching to new song
    audio.play().catch(console.error)
    setIsPlaying(true)
  }, [currentIndex, playlist])

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  // Auto-play first song once when user clicks anywhere except player
  useEffect(() => {
    if (hasAutoPlayed || playlist.length === 0) return

    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const playerElement = playerRef.current

      // Check if click is outside the player
      if (playerElement && !playerElement.contains(target)) {
        // Auto-play first song once
        const audio = audioRef.current
        if (audio && playlist.length > 0 && !hasAutoPlayed) {
          setCurrentIndex(0)
          audio.src = playlist[0]
          audio.play().catch(console.error)
          setHasAutoPlayed(true)
        }
      }
    }

    // Add click listener
    document.addEventListener('click', handleDocumentClick)

    return () => {
      document.removeEventListener('click', handleDocumentClick)
    }
  }, [hasAutoPlayed, playlist.length])

  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play().catch(console.error)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return

    const newTime = parseFloat(e.target.value)
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
  }

  const nextSong = () => {
    if (currentIndex < playlist.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      setCurrentIndex(0)
    }
  }

  const prevSong = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    } else {
      setCurrentIndex(playlist.length - 1)
    }
  }

  const selectSong = (index: number) => {
    setCurrentIndex(index)
    setIsPlaying(true)
    if (audioRef.current && playlist.length > 0) {
      audioRef.current.src = playlist[index]
      audioRef.current.play().catch(console.error)
    }
  }

  // Auto-scroll to current song in playlist
  useEffect(() => {
    if (playlistRef.current && !isMinimized) {
      const currentSongElement = playlistRef.current.children[currentIndex] as HTMLElement
      if (currentSongElement) {
        currentSongElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [currentIndex, isMinimized])

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getFileName = (path: string) => {
    return path.split('/').pop()?.replace(/\.(mp3|wav|ogg|m4a|aac)$/i, '') || path
  }

  if (playlist.length === 0) {
    return null
  }

  return (
    <>
      <audio ref={audioRef} preload="metadata" />
      <div
        ref={playerRef}
        className={`music-player ${isMinimized ? 'minimized' : ''} ${className}`}
      >
        {/* Header */}
        <div className="music-player-header">
          <h3>
            🎵 Trình phát nhạc
          </h3>
          <button
            className="minimize-btn"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? '▼' : '▲'}
          </button>
        </div>

        {!isMinimized && (
          <>
            {/* Current song info */}
            <div className="song-info">
              <div
                className="song-title"
                title={getFileName(playlist[currentIndex])}
              >
                {getFileName(playlist[currentIndex])}
              </div>
              <div className="song-counter">
                {currentIndex + 1} / {playlist.length}
              </div>
            </div>

            {/* Progress bar */}
            <div className="progress-container">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="progress-bar"
              />
              <div className="time-display">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="controls">
              <button
                className="control-btn"
                onClick={prevSong}
                title="Bài trước"
              >
                ⏮
              </button>
              <button
                className="control-btn play-pause-btn"
                onClick={togglePlayPause}
                title={isPlaying ? 'Tạm dừng' : 'Phát'}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button
                className="control-btn"
                onClick={nextSong}
                title="Bài tiếp"
              >
                ⏭
              </button>
              <div className="volume-control">
                <span className="volume-icon">🔊</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="volume-slider"
                />
                <span className="volume-percent">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>


            {/* Playlist */}
            <div className="playlist-container">
              <div className="playlist-header">
                Danh sách bài hát ({playlist.length})
              </div>
              <div ref={playlistRef} className="playlist">
                {playlist.map((song, index) => {
                  const isCurrent = index === currentIndex
                  return (
                    <button
                      key={index}
                      className={`song-button ${isCurrent ? 'current' : ''}`}
                      onClick={() => selectSong(index)}
                      title={getFileName(song)}
                    >
                      <span className="song-number">
                        {isCurrent && isPlaying ? '▶' : isCurrent ? '⏸' : index + 1}
                      </span>
                      <span className="song-title">
                        {getFileName(song)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

