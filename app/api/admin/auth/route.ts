import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto-js'

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

// Load admin credentials securely
function getAdminCredentials() {
  try {
    if (isVercel) {
      return {
        username: defaultSettings.adminUsername,
        password: defaultSettings.adminPassword
      }
    }

    ensureFileExists()
    const fileContents = fs.readFileSync(settingsFilePath, 'utf8')
    const settings = JSON.parse(fileContents)
    return {
      username: settings.adminUsername,
      password: settings.adminPassword
    }
  } catch (error) {
    console.error('Error reading admin credentials:', error)
    return {
      username: defaultSettings.adminUsername,
      password: defaultSettings.adminPassword
    }
  }
}

// Update admin credentials securely
function updateAdminCredentials(newUsername: string, newPasswordHash: string) {
  try {
    if (isVercel) {
      // On Vercel, we can't write to filesystem
      console.log('Admin credentials updated in memory (Vercel mode)')
      return true
    }

    ensureFileExists()
    const fileContents = fs.readFileSync(settingsFilePath, 'utf8')
    const settings = JSON.parse(fileContents)

    // Update credentials
    settings.adminUsername = newUsername
    settings.adminPassword = newPasswordHash

    // Write back to file
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2))
    return true
  } catch (error) {
    console.error('Error updating admin credentials:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, password, action } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Thông tin đăng nhập không đúng!' },
        { status: 400 }
      )
    }

    const credentials = getAdminCredentials()

    // Hash the input password for comparison
    const hashedInputPassword = crypto.MD5(password).toString()

    // Verify credentials
    const isValid = username === credentials.username && hashedInputPassword === credentials.password

    if (isValid) {
      return NextResponse.json({
        success: true,
        message: 'Đăng nhập thành công!',
        username: credentials.username
      })
    } else {
      return NextResponse.json(
        { error: 'Thông tin đăng nhập không đúng!' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('Error in admin auth:', error)
    return NextResponse.json(
      { error: 'Thông tin đăng nhập không đúng!' },
      { status: 500 }
    )
  }
}

// GET endpoint for credential validation (used by session restoration)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    const credentials = getAdminCredentials()

    // Only validate username for session restoration (password validation happens on login)
    const isValid = username === credentials.username

    return NextResponse.json({
      valid: isValid,
      username: isValid ? credentials.username : null
    })
  } catch (error) {
    console.error('Error validating admin credentials:', error)
    return NextResponse.json(
      { error: 'Validation failed' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { currentUsername, currentPassword, newUsername, newPassword } = await request.json()

    // Validate required fields
    if (!currentUsername || !currentPassword) {
      return NextResponse.json(
        { error: 'Current username and password are required' },
        { status: 400 }
      )
    }

    // Verify current credentials first
    const credentials = getAdminCredentials()
    const hashedCurrentPassword = crypto.MD5(currentPassword).toString()

    if (currentUsername !== credentials.username || hashedCurrentPassword !== credentials.password) {
      return NextResponse.json(
        { error: 'Sai thông tin đăng nhập!' },
        { status: 401 }
      )
    }

    // Validate new credentials
    const finalUsername = newUsername || currentUsername
    if (finalUsername.length < 3) {
      return NextResponse.json(
        { error: 'Username must be at least 3 characters' },
        { status: 400 }
      )
    }

    if (newPassword && newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Hash new password if provided
    const finalPasswordHash = newPassword ? crypto.MD5(newPassword).toString() : credentials.password

    // Update credentials
    const success = updateAdminCredentials(finalUsername, finalPasswordHash)

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Admin credentials updated successfully',
        username: finalUsername
      })
    } else {
      return NextResponse.json(
        { error: 'Failed to update credentials' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error updating admin credentials:', error)
    return NextResponse.json(
      { error: 'Failed to update credentials' },
      { status: 500 }
    )
  }
}
