import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const testResultsFilePath = path.join(process.cwd(), 'test-results.json')

// Đảm bảo file tồn tại
function ensureFileExists() {
  if (!fs.existsSync(testResultsFilePath)) {
    fs.writeFileSync(testResultsFilePath, JSON.stringify([], null, 2))
  }
}

export async function GET() {
  try {
    ensureFileExists()
    const fileContents = fs.readFileSync(testResultsFilePath, 'utf8')
    const results = JSON.parse(fileContents)
    return NextResponse.json(results)
  } catch (error) {
    console.error('Error reading test results file:', error)
    return NextResponse.json({ error: 'Failed to read test results' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureFileExists()
    const testResult = await request.json()

    // Validate the structure
    if (!testResult.username || !testResult.timestamp) {
      return NextResponse.json({ error: 'Invalid test result data' }, { status: 400 })
    }

    // Read existing results
    const fileContents = fs.readFileSync(testResultsFilePath, 'utf8')
    const results = JSON.parse(fileContents)

    // Add ID to the result
    const newResult = {
      id: Date.now().toString(),
      ...testResult,
    }

    // Add new result
    results.push(newResult)

    // Write back to file
    fs.writeFileSync(testResultsFilePath, JSON.stringify(results, null, 2))

    return NextResponse.json({ success: true, id: newResult.id })
  } catch (error) {
    console.error('Error writing test results file:', error)
    return NextResponse.json({ error: 'Failed to save test result' }, { status: 500 })
  }
}

