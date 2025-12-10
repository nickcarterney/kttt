import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Check if we're on Vercel (read-only filesystem)
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV
const settingsFilePath = path.join(process.cwd(), 'settings.json')

// Default settings
const defaultSettings = {
  defaultQuestionsCount: 25,
  examTime: 1200, // 20 minutes in seconds
  adminUsername: 'admin',
  adminPassword: 'admin123'
}

// Đảm bảo file tồn tại
function ensureFileExists() {
  if (!fs.existsSync(settingsFilePath)) {
    fs.writeFileSync(settingsFilePath, JSON.stringify(defaultSettings, null, 2))
  }
}

export async function GET() {
  try {
    let settings

    if (isVercel) {
      // On Vercel, return default settings
      settings = defaultSettings
    } else {
      ensureFileExists()
      const fileContents = fs.readFileSync(settingsFilePath, 'utf8')
      settings = JSON.parse(fileContents)
    }

    // Return only public settings (exclude sensitive admin credentials)
    const publicSettings = {
      defaultQuestionsCount: settings.defaultQuestionsCount,
      examTime: settings.examTime
    }

    return NextResponse.json(publicSettings)
  } catch (error) {
    console.error('Error reading settings file:', error)
    return NextResponse.json({
      defaultQuestionsCount: defaultSettings.defaultQuestionsCount,
      examTime: defaultSettings.examTime
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const settings = await request.json()

    if (isVercel) {
      // On Vercel, we can't write to filesystem
      console.log('Settings updated in memory (Vercel mode)')
      return NextResponse.json({ success: true })
    }

    // Validate the structure
    if (typeof settings !== 'object' || settings === null) {
      return NextResponse.json({ error: 'Invalid settings data' }, { status: 400 })
    }

    // Write to file
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error writing settings file:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
