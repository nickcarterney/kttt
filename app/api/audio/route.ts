import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const audioDir = path.join(process.cwd(), 'public', 'audio')
    
    // Check if directory exists
    if (!fs.existsSync(audioDir)) {
      return NextResponse.json({ files: [] })
    }

    // Read all files in the audio directory
    const files = fs.readdirSync(audioDir)
    
    // Filter only audio files
    const audioFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase()
      return ['.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(ext)
    })

    // Return file paths relative to /public
    const audioPaths = audioFiles.map(file => `/audio/${file}`)
    
    return NextResponse.json({ files: audioPaths })
  } catch (error) {
    console.error('Error reading audio directory:', error)
    return NextResponse.json({ error: 'Failed to read audio files' }, { status: 500 })
  }
}

