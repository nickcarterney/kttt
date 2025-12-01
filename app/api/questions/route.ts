import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const questionsFilePath = path.join(process.cwd(), 'questions.json')

export async function GET() {
  try {
    console.log('Reading questions file:', questionsFilePath)
    const fileContents = fs.readFileSync(questionsFilePath, 'utf8')
    const questions = JSON.parse(fileContents)
    return NextResponse.json(questions)
  } catch (error) {
    console.error('Error reading questions file:', error)
    return NextResponse.json({ error: 'Failed to read questions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const questions = await request.json()

    // Validate the structure
    if (typeof questions !== 'object' || questions === null) {
      return NextResponse.json({ error: 'Invalid questions data' }, { status: 400 })
    }

    // Write to file
    fs.writeFileSync(questionsFilePath, JSON.stringify(questions, null, 2))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error writing questions file:', error)
    return NextResponse.json({ error: 'Failed to save questions' }, { status: 500 })
  }
}
