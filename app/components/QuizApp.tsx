'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { jsPDF } from 'jspdf'
import ExcelJS from 'exceljs'
import MusicPlayer from './MusicPlayer'

interface Question {
  cauHoi: string
  luaChon: string[]
  dapAn: number
}

interface QuestionsData {
  [key: string]: Question[]
}

interface TestResult {
  id?: string
  username: string
  doituong: string
  capbac: string
  chucvu: string
  donvi: string
  timestamp: string
  correct: number
  total: number
  score: string
  answers: number[]
  questions: Question[]
}

export default function QuizApp() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // State variables
  const [questions, setQuestions] = useState<QuestionsData>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [username, setUsername] = useState('')
  const [currentDoituong, setCurrentDoituong] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<{ doituong: string; index: number } | null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [testHistory, setTestHistory] = useState<TestResult[]>([])
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([])
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [capbac, setCapbac] = useState('')
  const [chucvu, setChucvu] = useState('')
  const [donvi, setDonvi] = useState('')
  const [isPracticeMode, setIsPracticeMode] = useState(false)
  const [settings, setSettings] = useState({
    defaultQuestionsCount: 25,
    examTime: 1200,
    adminUsername: 'admin',
    adminPassword: 'admin123'
  })
  const [isAdminPasswordDialogVisible, setIsAdminPasswordDialogVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // UI state
  const [currentScreen, setCurrentScreen] = useState<'login' | 'quiz' | 'settings' | 'history' | 'review' | 'admin-results'>('login')
  const [showTestModeSelection, setShowTestModeSelection] = useState(false)
  const [isAddQuestionFormVisible, setIsAddQuestionFormVisible] = useState(false)
  const [allTestResults, setAllTestResults] = useState<TestResult[]>([])
  const [selectedTestResult, setSelectedTestResult] = useState<TestResult | null>(null)

  // Filter states for admin results
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedObject, setSelectedObject] = useState('')
  const [unitFilter, setUnitFilter] = useState('')

  // Form state
  const [loginForm, setLoginForm] = useState({
    username: '',
    doituong: 'Siquan-QNCN',
    donvi: '',
    capbac: '',
    chucvu: ''
  })

  const [adminForm, setAdminForm] = useState({
    username: '',
    password: ''
  })

  const [questionForm, setQuestionForm] = useState({
    doituong: 'Siquan-QNCN',
    cauHoi: '',
    luaChon: ['', '', '', ''],
    dapAn: 0
  })

  const EXAM_TIME = 20 * 60

  // Scroll to specific question
  const scrollToQuestion = (questionIndex: number) => {
    const questionElement = document.getElementById(`question-${questionIndex}`)
    if (questionElement) {
      questionElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }

  // Load saved login data
  const loadLoginData = async () => {
    return new Promise<void>((resolve) => {
      if (typeof window !== 'undefined') {
        const savedLoginData = localStorage.getItem('loginData')
        if (savedLoginData) {
          try {
            const loginData = JSON.parse(savedLoginData)
            setUsername(loginData.username || '')
            setCurrentDoituong(loginData.doituong || '')
            setDonvi(loginData.donvi || '')
            setCapbac(loginData.capbac || '')
            setChucvu(loginData.chucvu || '')
            setLoginForm({
              username: loginData.username || '',
              doituong: loginData.doituong || 'Siquan-QNCN',
              donvi: loginData.donvi || '',
              capbac: loginData.capbac || '',
              chucvu: loginData.chucvu || ''
            })
            setCurrentScreen(loginData.currentScreen || 'login')
            setShowTestModeSelection(loginData.showTestModeSelection || false)
          } catch (error) {
            console.error('Error loading login data:', error)
            localStorage.removeItem('loginData')
          }
        }
      }
      resolve()
    })
  }

  // Load questions on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await Promise.all([
          loadQuestions(),
          loadTestHistory(),
          loadLoginData(),
          loadSettings(),
          restoreAdminSession()
        ])
      } finally {
        setIsLoading(false)
      }
    }

    initializeApp()
  }, [])

  // Handle URL parameters for different modes
  useEffect(() => {
    // Only process URL parameters if questions are loaded
    if (Object.keys(questions).length === 0) {
      return
    }

    const mode = searchParams.get('mode')
    const doituong = searchParams.get('doituong')

    // Set doituong from URL if provided
    if (doituong) {
      setCurrentDoituong(doituong)
    }

    if (mode === 'real') {
      startRealTest(doituong)
    } else if (mode === 'practice') {
      startPracticeTest(doituong)
    } else if (mode === 'review') {
      showReviewScreen(doituong)
    }
  }, [searchParams, questions])

  const loadQuestions = async () => {
    try {
      const response = await fetch('/api/questions')
      if (response.ok) {
        const data = await response.json()
        setQuestions(data)
      } else {
        console.error('Failed to load questions')
        alert('Không thể tải dữ liệu câu hỏi. Vui lòng liên hệ admin.')
      }
    } catch (error) {
      console.error('Error loading questions:', error)
      alert('Lỗi khi tải dữ liệu câu hỏi.')
    }
  }

  const saveQuestions = async (newQuestions: QuestionsData) => {
    try {
      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newQuestions),
      })

      if (!response.ok) {
        throw new Error('Failed to save questions')
      }

      setQuestions(newQuestions)
    } catch (error) {
      console.error('Error saving questions:', error)
      alert('Lỗi khi lưu câu hỏi.')
    }
  }

  const loadTestHistory = async () => {
    return new Promise<void>((resolve) => {
      if (typeof window !== 'undefined') {
        try {
          const storedHistory = localStorage.getItem('testHistory')
          if (storedHistory) {
            setTestHistory(JSON.parse(storedHistory))
          }
        } catch (e) {
          console.error('Lỗi khi đọc testHistory từ localStorage:', e)
          alert('Dữ liệu lịch sử thi bị lỗi. Khởi tạo lại lịch sử.')
          setTestHistory([])
        }
      }
      resolve()
    })
  }

  const saveTestHistory = (history: TestResult[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('testHistory', JSON.stringify(history))
    }
    setTestHistory(history)
  }

  const loadAllTestResults = async () => {
    try {
      const response = await fetch('/api/test-results')
      if (response.ok) {
        const data = await response.json()
        setAllTestResults(data)
      }
    } catch (error) {
      console.error('Error loading all test results:', error)
    }
  }

  // Get unique objects for dropdown
  const getUniqueObjects = () => {
    const objects = allTestResults.map(result => result.doituong).filter(Boolean)
    return Array.from(new Set(objects)).sort()
  }

  // Filter test results based on current filters
  const getFilteredResults = () => {
    return allTestResults.filter(result => {
      // Date range filter
      if (startDate || endDate) {
        if (!result.timestamp) return false

        // Parse timestamp (assuming format like "2024-12-10 14:30:25" or similar)
        const resultDate = new Date(result.timestamp.split(' ')[0]) // Get date part only
        if (isNaN(resultDate.getTime())) return false

        if (startDate) {
          const start = new Date(startDate)
          if (resultDate < start) return false
        }

        if (endDate) {
          const end = new Date(endDate)
          end.setHours(23, 59, 59, 999) // Include the entire end date
          if (resultDate > end) return false
        }
      }

      // Object filter (dropdown selection)
      if (selectedObject && result.doituong !== selectedObject) {
        return false
      }

      // Unit filter (đơn vị)
      if (unitFilter && !result.donvi?.toLowerCase().includes(unitFilter.toLowerCase())) {
        return false
      }

      return true
    })
  }

  // Export filtered results to Excel
  const exportToExcel = async () => {
    const filteredResults = getFilteredResults()

    if (filteredResults.length === 0) {
      alert('Không có dữ liệu để xuất!')
      return
    }

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Kết quả bài thi')

    // Define columns
    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 5 },
      { header: 'Họ tên', key: 'hoTen', width: 20 },
      { header: 'Đối tượng', key: 'doiTuong', width: 15 },
      { header: 'Đơn vị', key: 'donVi', width: 20 },
      { header: 'Đúng', key: 'dung', width: 8 },
      { header: 'Sai', key: 'sai', width: 8 },
      { header: 'Tổng câu', key: 'tongCau', width: 10 },
      { header: 'Điểm', key: 'diem', width: 12 },
      { header: 'Thời gian', key: 'thoiGian', width: 20 }
    ]

    // Add data rows
    filteredResults.forEach((result, index) => {
      worksheet.addRow({
        stt: index + 1,
        hoTen: result.username,
        doiTuong: result.doituong,
        donVi: result.donvi || '-',
        dung: result.correct,
        sai: result.total - result.correct,
        tongCau: result.total,
        diem: `${((result.correct / result.total) * 10).toFixed(1)}/10`,
        thoiGian: result.timestamp
      })
    })

    // Style header row
    const headerRow = worksheet.getRow(1)
    headerRow.eachCell((cell) => {
      cell.font = {
        bold: true,
        size: 12,
        color: { argb: 'FF000000' } // Black text
      }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF90EE90' } // Light green background
      }
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle'
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      }
    })

    // Style data rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header row
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
          }
          cell.alignment = {
            horizontal: 'left',
            vertical: 'middle'
          }
        })
      }
    })

    // Generate filename with current date
    const now = new Date()
    const filename = `ket_qua_bai_thi_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.xlsx`

    // Save file
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      // Fallback to localStorage if API fails (for Vercel compatibility)
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('defaultQuestionsCount')
        if (saved) {
          const count = parseInt(saved, 10)
          if (count >= 1 && count <= 100) {
            setSettings(prev => ({ ...prev, defaultQuestionsCount: count }))
          }
        }
      }
    }
  }

  const saveSettings = async (newSettings: typeof settings) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      })

      if (response.ok) {
        setSettings(newSettings)
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      // Fallback to localStorage (for Vercel compatibility)
      if (typeof window !== 'undefined') {
        localStorage.setItem('defaultQuestionsCount', newSettings.defaultQuestionsCount.toString())
        setSettings(newSettings)
      }
    }
  }

  const saveDefaultQuestionsCount = (count: number) => {
    // Đảm bảo count trong khoảng 1-100
    const validCount = Math.max(1, Math.min(100, count))
    const newSettings = { ...settings, defaultQuestionsCount: validCount }
    saveSettings(newSettings)
  }

  const saveTestResultToServer = async (testResult: TestResult) => {
    try {
      const response = await fetch('/api/test-results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testResult),
      })

      if (response.ok) {
        const data = await response.json()
        // Reload all results
        await loadAllTestResults()
        return data
      } else {
        throw new Error('Failed to save test result')
      }
    } catch (error) {
      console.error('Error saving test result to server:', error)
      alert('Lỗi khi lưu kết quả bài thi vào server.')
    }
  }

  const deleteTestResultFromServer = async (id?: string, deleteAll = false) => {
    try {
      const response = await fetch('/api/test-results', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deleteAll ? { deleteAll: true } : { id }),
      })

      if (response.ok) {
        // Reload all results
        await loadAllTestResults()
        return true
      } else {
        throw new Error('Failed to delete test result')
      }
    } catch (error) {
      console.error('Error deleting test result from server:', error)
      alert(`Lỗi khi ${deleteAll ? 'xóa tất cả' : 'xóa'} kết quả bài thi từ server.`)
      return false
    }
  }

  // Login functions
  const handleLogin = () => {
    if (!loginForm.username || !loginForm.doituong || !loginForm.donvi || !loginForm.capbac || !loginForm.chucvu) {
      alert('Vui lòng nhập đầy đủ thông tin trước khi vào thi!')
      return
    }

    setUsername(loginForm.username)
    setCurrentDoituong(loginForm.doituong)
    setDonvi(loginForm.donvi)
    setCapbac(loginForm.capbac)
    setChucvu(loginForm.chucvu)
    setIsAdmin(false)

    // Store all login information in localStorage
    if (typeof window !== 'undefined') {
      const loginData = {
        username: loginForm.username,
        doituong: loginForm.doituong,
        donvi: loginForm.donvi,
        capbac: loginForm.capbac,
        chucvu: loginForm.chucvu,
        currentScreen: 'quiz',
        showTestModeSelection: true,
        timestamp: Date.now()
      }
      localStorage.setItem('loginData', JSON.stringify(loginData))

      localStorage.removeItem('timeLeft')
      localStorage.removeItem('startTime')
    }

    setCurrentScreen('quiz')
    setShowTestModeSelection(true)
  }

  const handleAdminLogin = async () => {
    if (!adminForm.username || !adminForm.password) {
      alert('Vui lòng nhập đầy đủ tên admin và mật khẩu!')
      return
    }

    try {
      // Authenticate with admin auth endpoint
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: adminForm.username,
          password: adminForm.password
        }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          alert('Tên admin hoặc mật khẩu không đúng!')
          console.log('❌ Admin login failed - invalid credentials')
        } else {
          alert('Không thể kết nối đến máy chủ. Vui lòng thử lại!')
        }
        return
      }

      const authResult = await response.json()

      if (authResult.success) {
        setIsAdmin(true)
        setUsername(authResult.username)
        setCurrentDoituong('Admin')
        setCurrentScreen('settings')

        // Save admin session to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('adminLoggedIn', 'true')
          localStorage.setItem('adminUsername', authResult.username)
          localStorage.setItem('adminLoginTime', Date.now().toString())
        }

        console.log('✅ Admin login successful')
      } else {
        alert('Tên admin hoặc mật khẩu không đúng!')
        console.log('❌ Admin login failed - invalid credentials')
      }
    } catch (error) {
      console.error('❌ Error during admin login:', error)
      alert('Lỗi khi đăng nhập. Vui lòng thử lại!')
    }
  }

  // Quiz functions
  const startRealTest = (doituongOverride?: string) => {
    const doituongToUse = doituongOverride || currentDoituong
    if (!questions[doituongToUse] || questions[doituongToUse].length === 0) {
      alert('Chưa có câu hỏi cho đối tượng này! Vui lòng chọn đối tượng khác hoặc liên hệ admin.')
      return
    }

    resetTestState()
    setIsPracticeMode(false)
    setIsSubmitted(false)
    setShowTestModeSelection(false)
    taoBoDeNgauNhien(doituongToUse)
    setTimeLeft(EXAM_TIME)

    if (typeof window !== 'undefined') {
      localStorage.setItem('startTime', Date.now().toString())
    }

    demNguoc()
  }

  const startPracticeTest = (doituongOverride?: string) => {
    const doituongToUse = doituongOverride || currentDoituong
    if (!questions[doituongToUse] || questions[doituongToUse].length === 0) {
      alert('Chưa có câu hỏi cho đối tượng này! Vui lòng chọn đối tượng khác hoặc liên hệ admin.')
      return
    }

    resetTestState()
    setIsPracticeMode(true)
    setIsSubmitted(false)
    setShowTestModeSelection(false)
    setTimeLeft(EXAM_TIME)

    if (typeof window !== 'undefined') {
      localStorage.setItem('startTime', Date.now().toString())
    }

    demNguoc()
    taoBoDeNgauNhien(doituongToUse)
  }

  const resetTestState = () => {
    setIsSubmitted(false)
    setTimeLeft(0)
    setAnswers([])
    setSelectedQuestions([])
  }

  const shuffleArray = <T,>(array: T[]): void => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
  }

  const taoBoDeNgauNhien = (doituongOverride?: string) => {
    const doituongToUse = doituongOverride || currentDoituong
    if (!questions[doituongToUse] || questions[doituongToUse].length === 0) {
      console.error('No questions available for:', doituongToUse)
      return
    }

    // Đảm bảo số lượng câu hỏi không vượt quá số câu hỏi có sẵn
    const availableQuestions = questions[doituongToUse].length
    const questionsToSelect = Math.min(settings.defaultQuestionsCount, availableQuestions)

    if (questionsToSelect < settings.defaultQuestionsCount && isAdmin) {
      alert(`Chỉ có ${availableQuestions} câu hỏi cho đối tượng này. Sẽ hiển thị tất cả câu hỏi có sẵn.`)
    }

    // Đảm bảo có ít nhất 1 câu hỏi
    if (questionsToSelect === 0) {
      alert('Không có câu hỏi nào cho đối tượng này!')
      return
    }

    let tempQuestions = [...questions[doituongToUse]]
    shuffleArray(tempQuestions)

    const newSelectedQuestions = tempQuestions.slice(0, questionsToSelect).map((q) => {
      let clonedQuestion = {
        cauHoi: q.cauHoi,
        luaChon: [] as string[],
        dapAn: 0,
      }

      let choicesWithIndex = q.luaChon.map((lc, i) => ({
        text: lc,
        index: i,
      }))

      shuffleArray(choicesWithIndex)

      choicesWithIndex.forEach((item, newIndex) => {
        clonedQuestion.luaChon.push(item.text)
        if (item.index === q.dapAn) {
          clonedQuestion.dapAn = newIndex
        }
      })

      return clonedQuestion
    })

    setSelectedQuestions(newSelectedQuestions)
    setAnswers(new Array(newSelectedQuestions.length).fill(-1))
  }

  const demNguoc = () => {
    const startTime = typeof window !== 'undefined' ? parseInt(localStorage.getItem('startTime') || Date.now().toString()) : Date.now()

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      const newTimeLeft = Math.max(0, EXAM_TIME - elapsed)
      setTimeLeft(newTimeLeft)

      if (newTimeLeft === 60) {
        alert('Còn 1 phút nữa! Hãy nhanh chóng hoàn thành bài thi.')
      }

      if (newTimeLeft <= 0 && !isSubmitted) {
        clearInterval(interval)
        setIsSubmitted(true)
        nopBai(true)
      }
    }, 1000)
  }

  const chonDapAn = (questionIndex: number, choice: number) => {
    if (!isSubmitted && timeLeft > 0) {
      const newAnswers = [...answers]
      newAnswers[questionIndex] = choice
      setAnswers(newAnswers)
    }
  }

  const nopBai = async (bypassConfirm = false) => {
    if (!isPracticeMode && !bypassConfirm && !confirm('Bạn có chắc chắn muốn nộp bài không?')) {
      return
    }

    setIsSubmitted(true)

    if (!selectedQuestions || selectedQuestions.length === 0) {
      alert('Lỗi: Không có câu hỏi để chấm điểm!')
      return
    }

    let correct = 0
    const tongCau = selectedQuestions.length

    selectedQuestions.forEach((q, i) => {
      if (answers[i] === q.dapAn) correct++
    })

    const diem = (correct / tongCau) * 10
    const diemLamTron = Number(diem.toFixed(2)).toString()

    if (isPracticeMode) {
      // Practice mode result display will be handled in render
    } else {
      const testResult: TestResult = {
        username: username,
        doituong: currentDoituong,
        capbac: capbac,
        chucvu: chucvu,
        donvi: donvi,
        timestamp: new Date().toLocaleString(),
        correct: correct,
        total: tongCau,
        score: diemLamTron,
        answers: [...answers],
        questions: selectedQuestions,
      }

      const newHistory = [...testHistory, testResult]
      saveTestHistory(newHistory)
      
      // Save to server
      await saveTestResultToServer(testResult)
    }
  }

  // Admin functions
  const showSettings = () => {
    setCurrentScreen('settings')
  }

  const showAdminResults = () => {
    setCurrentScreen('admin-results')
    loadAllTestResults()
  }

  const showAdminPasswordDialog = () => setIsAdminPasswordDialogVisible(true)
  const hideAdminPasswordDialog = () => setIsAdminPasswordDialogVisible(false)

  const viewTestResultDetails = (result: TestResult) => {
    setSelectedTestResult(result)
  }

  const closeTestResultDetails = () => {
    setSelectedTestResult(null)
  }

  const showAddQuestionForm = () => {
    setQuestionForm({
      doituong: 'Siquan-QNCN',
      cauHoi: '',
      luaChon: ['', '', '', ''],
      dapAn: 0
    })
    setEditingQuestionIndex(null)
    setIsAddQuestionFormVisible(true)
  }

  const editQuestion = (doituong: string, index: number) => {
    const q = questions[doituong][index]
    setQuestionForm({
      doituong: doituong,
      cauHoi: q.cauHoi,
      luaChon: [...q.luaChon],
      dapAn: q.dapAn
    })
    setEditingQuestionIndex({ doituong, index })
    setIsAddQuestionFormVisible(true)
  }

  const deleteQuestion = async (doituong: string, index: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) {
      return
    }

    const newQuestions = { ...questions }
    newQuestions[doituong].splice(index, 1)
    await saveQuestions(newQuestions)
  }

  const saveQuestion = async () => {
    if (!questionForm.cauHoi.trim() || questionForm.luaChon.some(opt => !opt.trim())) {
      alert('Vui lòng nhập đầy đủ nội dung câu hỏi và các lựa chọn!')
      return
    }

    const newQuestion: Question = {
      cauHoi: questionForm.cauHoi.trim(),
      luaChon: questionForm.luaChon.map(opt => opt.trim()),
      dapAn: questionForm.dapAn,
    }

    const newQuestions = { ...questions }

    if (editingQuestionIndex) {
      newQuestions[editingQuestionIndex.doituong][editingQuestionIndex.index] = newQuestion
    } else {
      if (!newQuestions[questionForm.doituong]) {
        newQuestions[questionForm.doituong] = []
      }
      newQuestions[questionForm.doituong].push(newQuestion)
    }

    await saveQuestions(newQuestions)
    setIsAddQuestionFormVisible(false)
  }

  const cancelEdit = () => {
    setIsAddQuestionFormVisible(false)
  }

  // History functions
  const showHistory = () => {
    setCurrentScreen('history')
  }

  const viewTestDetails = (index: number) => {
    setSelectedTestResult(testHistory[index])
  }

  const exportToPDF = (index: number) => {
    const result = testHistory[index]
    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.text('KẾT QUẢ THI TRẮC NGHIỆM', 20, 20)
    doc.setFontSize(12)
    doc.text(`Họ và tên: ${result.username}`, 20, 30)
    doc.text(`Đối tượng: ${result.doituong}`, 20, 40)
    doc.text(`Cấp bậc: ${result.capbac || 'Không có dữ liệu'}`, 20, 50)
    doc.text(`Chức vụ: ${result.chucvu || 'Không có dữ liệu'}`, 20, 60)
    doc.text(`Đơn vị: ${result.donvi || 'Không có dữ liệu'}`, 20, 70)
    doc.text(`Thời gian: ${result.timestamp}`, 20, 80)
    doc.text(`Kết quả: ${result.correct}/${result.total} câu`, 20, 90)
    doc.text(`Điểm: ${result.score}/10`, 20, 100)

    let y = 110
    result.questions.forEach((q, i) => {
      if (y > 270) {
        doc.addPage()
        y = 20
      }
      doc.setFontSize(10)
      doc.text(`${i + 1}. ${q.cauHoi}`, 20, y)
      y += 5
      q.luaChon.forEach((lc, j) => {
        const isCorrect = j === q.dapAn
        const isUserAnswer = j === result.answers[i]
        let prefix = isCorrect
          ? '[Đúng] '
          : isUserAnswer && !isCorrect
          ? '[Sai] '
          : ''
        doc.text(`${prefix}${lc}`, 25, y)
        y += 5
      })
      y += 5
    })

    doc.save(`KetQuaThi_${result.timestamp.replace(/[:,\s\/]/g, '_')}.pdf`)
  }


  // Show review screen
  const showReviewScreen = (doituongOverride?: string) => {
    const doituongToUse = doituongOverride || currentDoituong
    if (!questions[doituongToUse] || questions[doituongToUse].length === 0) {
      alert('Chưa có câu hỏi cho đối tượng này! Vui lòng chọn đối tượng khác hoặc liên hệ admin.')
      return
    }
    setCurrentScreen('review')
  }

  // Restore admin session from localStorage
  const restoreAdminSession = async () => {
    if (typeof window === 'undefined') return

    try {
      const adminLoggedIn = localStorage.getItem('adminLoggedIn')
      const adminUsername = localStorage.getItem('adminUsername')
      const adminLoginTime = localStorage.getItem('adminLoginTime')

      // Check if admin session exists and is not too old (24 hours)
      if (adminLoggedIn === 'true' && adminUsername && adminLoginTime) {
        const loginTime = parseInt(adminLoginTime, 10)
        const now = Date.now()
        const hoursSinceLogin = (now - loginTime) / (1000 * 60 * 60)

        // Only restore if login was within 24 hours
        if (hoursSinceLogin < 24) {
          // Set a timeout to auto-logout after remaining session time
          const remainingMs = (24 - hoursSinceLogin) * 60 * 60 * 1000
          setTimeout(() => {
            console.log('⏰ Admin session expired, auto-logging out')
            logout()
            alert('Phiên đăng nhập admin đã hết hạn. Vui lòng đăng nhập lại.')
          }, remainingMs)
          console.log('🔄 Restoring admin session from localStorage')

          // Verify admin credentials are still valid
          const response = await fetch(`/api/admin/auth?username=${encodeURIComponent(adminUsername)}`)
          if (response.ok) {
            const authResult = await response.json()

            // Double-check credentials match
            if (authResult.valid && adminUsername === authResult.username) {
              setIsAdmin(true)
              setUsername(adminUsername)
              setCurrentDoituong('Admin')
              setCurrentScreen('settings')
              console.log('✅ Admin session restored successfully')
              return
            }
          }
        }

        // If verification fails or session is too old, clear the session
        console.log('⚠️ Admin session expired or invalid, clearing...')
        localStorage.removeItem('adminLoggedIn')
        localStorage.removeItem('adminUsername')
        localStorage.removeItem('adminLoginTime')
      }
    } catch (error) {
      console.error('❌ Error restoring admin session:', error)
      // Clear potentially corrupted session data
      localStorage.removeItem('adminLoggedIn')
      localStorage.removeItem('adminUsername')
      localStorage.removeItem('adminLoginTime')
    }
  }

  const logout = () => {
    // Clear all stored data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('loginData')
      localStorage.removeItem('timeLeft')
      localStorage.removeItem('startTime')
      // Clear admin session
      localStorage.removeItem('adminLoggedIn')
      localStorage.removeItem('adminUsername')
      localStorage.removeItem('adminLoginTime')
    }

    // Reset all state
    setUsername('')
    setCurrentDoituong('')
    setDonvi('')
    setCapbac('')
    setChucvu('')
    setAnswers([])
    setSelectedQuestions([])
    setIsSubmitted(false)
    setTimeLeft(0)
    setIsPracticeMode(false)
    setCurrentScreen('login')
    setShowTestModeSelection(false)
    setLoginForm({
      username: '',
      doituong: 'Siquan-QNCN',
      donvi: '',
      capbac: '',
      chucvu: ''
    })

    // Redirect to root URL
    router.push('/')
  }

  const goBackToMain = () => {
    // Reset quiz-related state but keep login data
    setAnswers([])
    setSelectedQuestions([])
    setIsSubmitted(false)
    setTimeLeft(0)
    setIsPracticeMode(false)
    setCurrentScreen('quiz')
    setShowTestModeSelection(true)

    // Clear quiz-specific localStorage but keep login data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('timeLeft')
      localStorage.removeItem('startTime')
    }
    // Redirect to root URL
    router.push('/')
  }

  // Render functions
  const renderLoginScreen = () => (
    <div id="login-screen">
      <h1>ĐĂNG NHẬP HỆ THỐNG THI</h1>
      <div className="login-form">
        <label htmlFor="username">Họ và tên:</label>
        <input
          type="text"
          id="username"
          placeholder="Nhập họ và tên"
          value={loginForm.username}
          onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
        />

        <label htmlFor="doituong">Đối tượng:</label>
        <select
          id="doituong"
          value={loginForm.doituong}
          onChange={(e) => setLoginForm({ ...loginForm, doituong: e.target.value })}
        >
          <option value="Siquan-QNCN">Sĩ quan, QNCN</option>
          <option value="Chiensimoi">Chiến sĩ mới</option>
          <option value="Chiensinamthunhat">Chiến sĩ năm thứ nhất</option>
          <option value="Chiensinamthuhai">Chiến sĩ năm thứ hai</option>
          <option value="Lopnhanthucvedang">Lớp nhận thức về đảng</option>
          <option value="Lopdangvienmoi">Lớp đảng viên mới</option>
        </select>

        <label htmlFor="donvi">Đơn vị:</label>
        <input
          type="text"
          id="donvi"
          placeholder="Nhập đơn vị"
          value={loginForm.donvi}
          onChange={(e) => setLoginForm({ ...loginForm, donvi: e.target.value })}
        />

        <label htmlFor="capbac">Cấp bậc:</label>
        <input
          type="text"
          id="capbac"
          placeholder="Nhập cấp bậc"
          value={loginForm.capbac}
          onChange={(e) => setLoginForm({ ...loginForm, capbac: e.target.value })}
        />

        <label htmlFor="chucvu">Chức vụ:</label>
        <input
          type="text"
          id="chucvu"
          placeholder="Nhập chức vụ"
          value={loginForm.chucvu}
          onChange={(e) => setLoginForm({ ...loginForm, chucvu: e.target.value })}
        />

        <button onClick={handleLogin}>📚 Vào thi</button>
      </div>

      <div className="login-form admin-login">
        <h2>ĐĂNG NHẬP QUẢN LÝ</h2>
        <label htmlFor="admin-username">Tên người quản lý:</label>
        <input
          type="text"
          id="admin-username"
          placeholder="Nhập tên người quản lý"
          value={adminForm.username}
          onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
        />

        <label htmlFor="admin-password">Mật khẩu:</label>
        <input
          type="password"
          id="admin-password"
          placeholder="Nhập mật khẩu"
          value={adminForm.password}
          onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
        />

        <button onClick={handleAdminLogin}>Đăng nhập Admin</button>
      </div>
    </div>
  )

  const renderQuizScreen = () => (
    <div className="container">
      <h1>ĐỀ THI TRẮC NGHIỆM</h1>

      {currentDoituong && (
        <div id="test-taker-info">
          <p>Họ và tên: <span id="info-username">{username}</span></p>
          <p>Đối tượng: <span id="info-doituong">{currentDoituong}</span></p>
          <p>Đơn vị: <span id="info-donvi">{donvi}</span></p>
          <p>Cấp bậc: <span id="info-capbac">{capbac}</span></p>
          <p>Chức vụ: <span id="info-chucvu">{chucvu}</span></p>
        </div>
      )}

      <div className="quiz-nav-buttons">
        {!showTestModeSelection && (
          <button onClick={goBackToMain} className="back-btn">
            Quay lại
          </button>
        )}
        <button onClick={logout} className="logout-btn">
          Đăng xuất
        </button>
      </div>

      {showTestModeSelection && (
        <div id="test-mode-selection">
          <div className="button-group">
            <button onClick={() => router.push(`?mode=real&doituong=${currentDoituong}`)}>📝 Thi thật</button>
            <button onClick={() => router.push(`?mode=practice&doituong=${currentDoituong}`)}>📚 Thi thử</button>
            <button onClick={() => router.push(`?mode=review&doituong=${currentDoituong}`)}>📖 Ôn tập câu hỏi</button>
          </div>
        </div>
      )}

      {selectedQuestions.length > 0 && (
        <>
          <div id="quiz-container">
            {selectedQuestions.map((cauHoi, index) => (
              <div key={index} id={`question-${index}`} className="question-block">
                <div className="question">
                  {index + 1}. {cauHoi.cauHoi}
                </div>
                <div className="choices-container">
                  {cauHoi.luaChon.map((lc, i) => {
                    const isCorrectAnswer = i === cauHoi.dapAn
                    const isUserAnswer = answers[index] === i
                    const isIncorrectSelected = isSubmitted && isUserAnswer && !isCorrectAnswer
                    const isCorrectHighlight = isSubmitted && isCorrectAnswer
                    
                    return (
                      <label 
                        key={i} 
                        className={`choice ${isCorrectHighlight ? 'correct' : ''} ${isIncorrectSelected ? 'incorrect' : ''}`}
                        style={{ cursor: isSubmitted ? 'default' : 'pointer' }}
                      >
                        <input
                          type="radio"
                          name={`cauhoi_${index}`}
                          value={i}
                          checked={answers[index] === i}
                          onChange={() => chonDapAn(index, i)}
                          disabled={isSubmitted}
                        />
                        <span>{lc}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {!showTestModeSelection && (
            <>
              <div id="fixed-timer">
                <span>⏳ Thời gian còn lại: </span>
                <span id="fixed-time">
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </span>
              </div>

              <div id="question-nav">
                {selectedQuestions.map((_, index) => {
                  const isAnswered = answers[index] !== -1
                  const isCorrect = isSubmitted && isAnswered && answers[index] === selectedQuestions[index].dapAn
                  const isIncorrect = isSubmitted && isAnswered && answers[index] !== selectedQuestions[index].dapAn

                  return (
                    <button
                      key={index}
                      className={`nav-btn ${isAnswered ? 'answered' : ''} ${isCorrect ? 'correct' : ''} ${isIncorrect ? 'incorrect' : ''}`}
                      onClick={() => scrollToQuestion(index)}
                    >
                      <span>{index + 1}</span>
                      <span className="status">
                        {isCorrect && '✓'}
                        {isIncorrect && '✗'}
                      </span>
                    </button>
                  )
                })}
              </div>

              {isSubmitted && selectedQuestions.length > 0 && (
                <div style={{
                  marginTop: '20px',
                  padding: '20px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #dee2e6',
                  textAlign: 'center'
                }}>
                  <h3 style={{ margin: '0 0 15px 0', color: '#495057' }}>KẾT QUẢ BÀI THI</h3>
                  {(() => {
                    const correct = selectedQuestions.reduce((count, q, index) => {
                      return answers[index] === q.dapAn ? count + 1 : count
                    }, 0)
                    const incorrect = selectedQuestions.length - correct
                    const score = Number((correct / selectedQuestions.length * 10).toFixed(2))

                    return (
                      <div>
                        <div style={{
                          fontSize: '24px',
                          fontWeight: 'bold',
                          color: score >= 8 ? '#28a745' : score >= 6 ? '#ffc107' : '#dc3545',
                          marginBottom: '10px'
                        }}>
                          {score}/10 điểm
                        </div>
                        <div style={{ fontSize: '16px', color: '#6c757d' }}>
                          <span style={{ color: '#28a745', fontWeight: 'bold' }}>
                            ✓ Đúng: {correct}
                          </span>
                          {' • '}
                          <span style={{ color: '#dc3545', fontWeight: 'bold' }}>
                            ✗ Sai: {incorrect}
                          </span>
                          {' • '}
                          <span style={{ color: '#6c757d' }}>
                            Tổng: {selectedQuestions.length}
                          </span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

              <div id="result"></div>

              <div className="button-group">
                {!isSubmitted && (
                  <button id="submitBtn" onClick={() => nopBai()}>
                    📝 Nộp bài
                  </button>
                )}
                {isAdmin && (
                  <button id="settingsBtn" onClick={showSettings}>
                    ⚙️ Cài đặt bộ đề
                  </button>
                )}
                <button id="historyBtn" onClick={showHistory}>
                  📜 Xem lịch sử thi
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )

  const renderSettingsScreen = () => (
    <div id="settings-screen">
      <h1>QUẢN LÝ BỘ ĐỀ</h1>
      <br></br>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={showAddQuestionForm} className="back-btn">Thêm câu hỏi</button>
        <button onClick={showAdminResults} className="back-btn">Xem kết quả bài thi</button>
        <button onClick={showAdminPasswordDialog} className="back-btn">Thay đổi mật khẩu admin</button>
        <button onClick={logout} className="logout-btn">Đăng xuất</button>
      </div>

      {/* Admin session info */}
      <div style={{
        backgroundColor: '#e8f5e8',
        border: '1px solid #c3e6c3',
        borderRadius: '4px',
        padding: '8px 12px',
        marginBottom: '20px',
        fontSize: '14px',
        color: '#2d5a2d'
      }}>
        <strong>🔐 Admin:</strong> {username} | <strong>Trạng thái:</strong> Đã đăng nhập | <strong>Session:</strong> Tự động hết hạn sau 24 giờ
      </div>

      {/* Cấu hình số lượng câu hỏi */}
      <div style={{
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '10px', color: '#495057' }}>⚙️ Cấu hình bài thi</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <label htmlFor="questionsCount" style={{ fontWeight: 'bold' }}>
            Số câu hỏi mỗi bài thi:
          </label>
          <input
            id="questionsCount"
            type="number"
            min="1"
            max="100"
            value={settings.defaultQuestionsCount}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10)
              if (!isNaN(value)) {
                saveDefaultQuestionsCount(value)
              }
            }}
            style={{
              padding: '5px 8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              width: '80px',
              textAlign: 'center'
            }}
          />
          <span style={{ color: '#6c757d', fontSize: '14px' }}>
            (Tối thiểu: 1, Tối đa: 100)
          </span>
        </div>
      </div>


      <div id="stats">
        Thống kê bộ đề<br/>
        {Object.entries(questions).map(([doituong, qs]) => (
          <div key={doituong}>{doituong}: {qs.length} câu hỏi</div>
        ))}
      </div>

      <table>
        <thead>
          <tr>
            <th>Đối tượng</th>
            <th>Câu hỏi</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(questions).map(([doituong, qs]) =>
            qs.map((q, index) => (
              <tr key={`${doituong}-${index}`}>
                <td>{doituong}</td>
                <td>{q.cauHoi}</td>
                <td>
                  <button className="edit-btn" onClick={() => editQuestion(doituong, index)}>Sửa</button>
                  <button className="delete-btn" onClick={() => deleteQuestion(doituong, index)}>Xóa</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {isAddQuestionFormVisible && (
        <div className="dialog-overlay" onClick={cancelEdit}>
          <dialog 
            id="addQuestionForm" 
            open
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                cancelEdit()
              }
            }}
          >
            <div className="dialog-header">
              <h2>Thêm/Sửa câu hỏi</h2>
              <button className="dialog-close" onClick={cancelEdit} aria-label="Đóng">×</button>
            </div>
            <div className="dialog-content">
              <label htmlFor="questionDoituong">Đối tượng:</label>
              <select
                id="questionDoituong"
                value={questionForm.doituong}
                onChange={(e) => setQuestionForm({ ...questionForm, doituong: e.target.value })}
              >
                <option value="Siquan-QNCN">Sĩ quan, QNCN</option>
                <option value="Chiensimoi">Chiến sĩ mới</option>
                <option value="Chiensinamthunhat">Chiến sĩ năm thứ nhất</option>
                <option value="Chiensinamthuhai">Chiến sĩ năm thứ hai</option>
                <option value="Lopnhanthucvedang">Lớp nhận thức về đảng</option>
                <option value="Lopdangvienmoi">Lớp đảng viên mới</option>
              </select>

              <label htmlFor="questionText">Câu hỏi:</label>
              <textarea
                id="questionText"
                rows={4}
                value={questionForm.cauHoi}
                onChange={(e) => setQuestionForm({ ...questionForm, cauHoi: e.target.value })}
              />

              <label>Lựa chọn:</label>
              <div id="options">
                {questionForm.luaChon.map((option, index) => (
                  <div key={index}>
                    <input
                      type="text"
                      className="option"
                      placeholder={`Lựa chọn ${index + 1}`}
                      value={option}
                      onChange={(e) => {
                        const newLuaChon = [...questionForm.luaChon]
                        newLuaChon[index] = e.target.value
                        setQuestionForm({ ...questionForm, luaChon: newLuaChon })
                      }}
                    />
                  </div>
                ))}
              </div>

              <label htmlFor="correctAnswer">Đáp án đúng:</label>
              <select
                id="correctAnswer"
                value={questionForm.dapAn}
                onChange={(e) => setQuestionForm({ ...questionForm, dapAn: parseInt(e.target.value) })}
              >
                <option value={0}>Lựa chọn 1</option>
                <option value={1}>Lựa chọn 2</option>
                <option value={2}>Lựa chọn 3</option>
                <option value={3}>Lựa chọn 4</option>
              </select>
            </div>
            <div className="dialog-footer">
              <button onClick={saveQuestion}>💾 Lưu</button>
              <button onClick={cancelEdit}>❌ Hủy</button>
            </div>
          </dialog>
        </div>
      )}

      {/* Admin Password Change Dialog */}
      {isAdminPasswordDialogVisible && (
        <div className="dialog-overlay" onClick={hideAdminPasswordDialog}>
          <dialog
            id="adminPasswordDialog"
            open
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                hideAdminPasswordDialog()
              }
            }}
          >
            <div className="dialog-header">
              <h2>Thay đổi mật khẩu Admin</h2>
              <button className="dialog-close" onClick={hideAdminPasswordDialog} aria-label="Đóng">×</button>
            </div>
            <div className="dialog-content">
              <div style={{ marginBottom: '15px', fontSize: '14px', color: '#666' }}>
                💡 Để trống các trường không muốn thay đổi. Mật khẩu phải có ít nhất 6 ký tự.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label htmlFor="dialogCurrentUsername" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Tên đăng nhập hiện tại:
                  </label>
                  <input
                    id="dialogCurrentUsername"
                    type="text"
                    value={username}
                    readOnly
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px',
                      backgroundColor: '#f8f9fa'
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="dialogNewUsername" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Tên đăng nhập mới (tùy chọn):
                  </label>
                  <input
                    id="dialogNewUsername"
                    type="text"
                    placeholder="Để trống nếu không đổi"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="dialogCurrentPassword" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Mật khẩu hiện tại:
                  </label>
                  <input
                    id="dialogCurrentPassword"
                    type="password"
                    placeholder="Nhập mật khẩu hiện tại"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="dialogNewPassword" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Mật khẩu mới:
                  </label>
                  <input
                    id="dialogNewPassword"
                    type="password"
                    placeholder="Nhập mật khẩu mới"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="dialogConfirmPassword" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Xác nhận mật khẩu mới:
                  </label>
                  <input
                    id="dialogConfirmPassword"
                    type="password"
                    placeholder="Nhập lại mật khẩu mới"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="dialog-footer">
              <button onClick={async () => {
                const newUsername = (document.getElementById('dialogNewUsername') as HTMLInputElement)?.value?.trim()
                const currentPassword = (document.getElementById('dialogCurrentPassword') as HTMLInputElement)?.value
                const newPassword = (document.getElementById('dialogNewPassword') as HTMLInputElement)?.value
                const confirmPassword = (document.getElementById('dialogConfirmPassword') as HTMLInputElement)?.value

                // Validate required current password
                if (!currentPassword) {
                  alert('Vui lòng nhập mật khẩu hiện tại!')
                  return
                }

                // Check if any changes are being made
                if (!newUsername && !newPassword && !confirmPassword) {
                  alert('Vui lòng nhập thông tin cần thay đổi!')
                  return
                }

                // Validate new username if provided
                if (newUsername && newUsername.length < 3) {
                  alert('Tên đăng nhập phải có ít nhất 3 ký tự!')
                  return
                }

                // Validate new password if provided
                if (newPassword || confirmPassword) {
                  if (!newPassword || !confirmPassword) {
                    alert('Vui lòng nhập đầy đủ mật khẩu mới và xác nhận!')
                    return
                  }

                  if (newPassword !== confirmPassword) {
                    alert('Mật khẩu mới và xác nhận không khớp!')
                    return
                  }

                  if (newPassword.length < 6) {
                    alert('Mật khẩu mới phải có ít nhất 6 ký tự!')
                    return
                  }
                }

                // Update admin credentials using auth endpoint
                try {
                  const updateResponse = await fetch('/api/admin/auth', {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      currentUsername: username,
                      currentPassword: currentPassword,
                      newUsername: newUsername || undefined,
                      newPassword: newPassword || undefined
                    }),
                  })

                  if (!updateResponse.ok) {
                    const errorData = await updateResponse.json()
                    alert(errorData.error || 'Không thể cập nhật thông tin admin!')
                    return
                  }

                  await updateResponse.json()

                  // Update local state
                  if (newUsername) {
                    setUsername(newUsername)
                  }

                  alert('Cập nhật thông tin admin thành công!')

                  // Close dialog
                  hideAdminPasswordDialog()
                } catch (error) {
                  console.error('Error updating admin credentials:', error)
                  alert('Không thể cập nhật thông tin admin. Vui lòng thử lại!')
                }

                // Clear form and close dialog
                ;(document.getElementById('dialogNewUsername') as HTMLInputElement).value = ''
                ;(document.getElementById('dialogCurrentPassword') as HTMLInputElement).value = ''
                ;(document.getElementById('dialogNewPassword') as HTMLInputElement).value = ''
                ;(document.getElementById('dialogConfirmPassword') as HTMLInputElement).value = ''

                hideAdminPasswordDialog()
              }}>💾 Lưu</button>
              <button onClick={hideAdminPasswordDialog}>❌ Hủy</button>
            </div>
          </dialog>
        </div>
      )}
    </div>
  )

  const renderHistoryScreen = () => (
    <div id="history-screen">
      <h1>LỊCH SỬ THI</h1>
      <br></br>
      <div className="quiz-nav-buttons">
        <button className="back-btn" onClick={goBackToMain}>Quay lại bài thi</button>
      </div>
      <div id="history-list">
        {testHistory.map((result, index) => (
          <div key={index} className="history-item">
            <p><strong>Lần thi {index + 1}</strong></p>
            <p>Họ và tên: {result.username}</p>
            <p>Đối tượng: {result.doituong}</p>
            <p>Cấp bậc: {result.capbac || 'Không có dữ liệu'}</p>
            <p>Chức vụ: {result.chucvu || 'Không có dữ liệu'}</p>
            <p>Đơn vị: {result.donvi || 'Không có dữ liệu'}</p>
            <p>Thời gian: {result.timestamp}</p>
            <p>Kết quả: {result.correct}/{result.total} câu</p>
            <p>Điểm: {result.score}/10</p>
            <button onClick={() => viewTestDetails(index)}>Xem chi tiết</button>
          </div>
        ))}
      </div>
    </div>
  )

  const renderReviewScreen = () => (
    <div id="review-screen">
      <h1>ÔN TẬP CÂU HỎI</h1>
      <div className="quiz-nav-buttons">
        <button className="back-btn" onClick={goBackToMain}>Quay lại bài thi</button>
      </div>
      <div id="review-questions">
        {questions[currentDoituong]?.map((q, index) => (
          <div key={index} className="question-block">
            <div className="question">{index + 1}. {q.cauHoi}</div>
            <div className="choices-container">
              {q.luaChon.map((lc, i) => (
                <div key={i} className={`choice ${i === q.dapAn ? 'correct' : ''}`}>
                  <span>{lc}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Test Details Dialog */}
      {selectedTestResult && (
        <div className="dialog-overlay" onClick={closeTestResultDetails}>
          <dialog
            id="testDetailsDialog"
            open
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                closeTestResultDetails()
              }
            }}
            style={{
              maxWidth: '90vw',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 0.25rem 0.9375rem rgba(0, 0, 0, 0.3)',
              border: 'none'
            }}
          >
            <div className="dialog-header">
              <h2>Chi tiết bài thi</h2>
              <button className="dialog-close" onClick={closeTestResultDetails} aria-label="Đóng">×</button>
            </div>
            <div className="dialog-content" style={{ padding: '1.25rem' }}>
              {/* Thống kê tổng quát */}
              {(() => {
                const incorrect = selectedTestResult.total - selectedTestResult.correct
                const correctPercentage = ((selectedTestResult.correct / selectedTestResult.total) * 100).toFixed(1)

                return (
                  <div style={{
                    backgroundColor: '#f8f9fa',
                    padding: '20px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    border: '1px solid #dee2e6'
                  }}>
                    <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Thống kê tổng quát</h3>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '15px'
                    }}>
                      <div style={{
                        backgroundColor: 'white',
                        padding: '15px',
                        borderRadius: '8px',
                        textAlign: 'center',
                        border: '1px solid #dee2e6'
                      }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                          {selectedTestResult.correct}
                        </div>
                        <div style={{ color: '#6c757d', fontSize: '14px' }}>Đúng</div>
                      </div>
                      <div style={{
                        backgroundColor: 'white',
                        padding: '15px',
                        borderRadius: '8px',
                        textAlign: 'center',
                        border: '1px solid #dee2e6'
                      }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>
                          {incorrect}
                        </div>
                        <div style={{ color: '#6c757d', fontSize: '14px' }}>Sai</div>
                      </div>
                      <div style={{
                        backgroundColor: 'white',
                        padding: '15px',
                        borderRadius: '8px',
                        textAlign: 'center',
                        border: '1px solid #dee2e6'
                      }}>
                        <div style={{
                          fontSize: '24px',
                          fontWeight: 'bold',
                          color: parseFloat(selectedTestResult.score) >= 8 ? '#28a745' : parseFloat(selectedTestResult.score) >= 6 ? '#ffc107' : '#dc3545'
                        }}>
                          {selectedTestResult.score}/10
                        </div>
                        <div style={{ color: '#6c757d', fontSize: '14px' }}>Điểm số</div>
                      </div>
                      <div style={{
                        backgroundColor: 'white',
                        padding: '15px',
                        borderRadius: '8px',
                        textAlign: 'center',
                        border: '1px solid #dee2e6'
                      }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
                          {correctPercentage}%
                        </div>
                        <div style={{ color: '#6c757d', fontSize: '14px' }}>Tỷ lệ đúng</div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Thông tin chi tiết */}
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '1px solid #dee2e6'
              }}>
                <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Thông tin chi tiết</h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '10px'
                }}>
                  <p><strong>Họ và tên:</strong> {selectedTestResult.username}</p>
                  <p><strong>Đối tượng:</strong> {selectedTestResult.doituong}</p>
                  <p><strong>Cấp bậc:</strong> {selectedTestResult.capbac || '-'}</p>
                  <p><strong>Chức vụ:</strong> {selectedTestResult.chucvu || '-'}</p>
                  <p><strong>Đơn vị:</strong> {selectedTestResult.donvi || '-'}</p>
                  <p><strong>Thời gian:</strong> {selectedTestResult.timestamp}</p>
                  <p><strong>Kết quả:</strong> {selectedTestResult.correct}/{selectedTestResult.total} câu</p>
                  <p><strong>Điểm số:</strong> {selectedTestResult.score}/10</p>
                </div>
              </div>

              {/* Chi tiết từng câu hỏi */}
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid #dee2e6'
              }}>
                <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Chi tiết từng câu hỏi</h3>
                <div style={{
                  maxHeight: '400px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  {selectedTestResult.questions.map((q, index) => {
                    const userAnswer = selectedTestResult.answers[index]
                    const correctAnswer = q.dapAn
                    const isCorrect = userAnswer === correctAnswer

                    return (
                      <div key={index} style={{
                        backgroundColor: 'white',
                        padding: '15px',
                        borderRadius: '8px',
                        border: '1px solid #dee2e6',
                        borderLeft: `4px solid ${isCorrect ? '#28a745' : '#dc3545'}`
                      }}>
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Câu {index + 1}:</strong> {q.cauHoi}
                        </div>
                        <div style={{ marginBottom: '5px', color: '#6c757d', fontSize: '14px' }}>
                          <strong>Đáp án đã chọn:</strong> {userAnswer !== undefined ? q.luaChon[userAnswer] : 'Không trả lời'}
                        </div>
                        <div style={{ marginBottom: '5px', color: '#6c757d', fontSize: '14px' }}>
                          <strong>Đáp án đúng:</strong> {q.luaChon[correctAnswer]}
                        </div>
                        <div style={{
                          fontWeight: 'bold',
                          color: isCorrect ? '#28a745' : '#dc3545',
                          fontSize: '14px'
                        }}>
                          {isCorrect ? '✓ Đúng' : '✗ Sai'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="dialog-footer">
              <button onClick={() => {
                // Find the index of selectedTestResult in testHistory
                const index = testHistory.findIndex(result =>
                  result.timestamp === selectedTestResult.timestamp &&
                  result.username === selectedTestResult.username &&
                  result.score === selectedTestResult.score
                )
                if (index !== -1) {
                  exportToPDF(index)
                }
              }}>📄 Xuất PDF</button>
              <button onClick={closeTestResultDetails}>❌ Đóng</button>
            </div>
          </dialog>
        </div>
      )}
    </div>
  )

  const renderAdminResultsScreen = () => {
    const filteredResults = getFilteredResults()

    return (
      <div id="admin-results-screen" className="container">
        <h1>QUẢN LÝ KẾT QUẢ BÀI THI</h1>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={showSettings} className="back-btn">Quản lý bộ đề</button>
        </div>

        {/* Filter Controls */}
        <div style={{
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#495057' }}>🔍 Bộ lọc kết quả</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
            <div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="startDate" style={{ display: 'block', fontSize: '12px', color: '#6c757d', marginBottom: '2px' }}>
                    Từ ngày:
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #ced4da',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="endDate" style={{ display: 'block', fontSize: '12px', color: '#6c757d', marginBottom: '2px' }}>
                    Đến ngày:
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #ced4da',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="objectFilter" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Đối tượng:
              </label>
              <select
                id="objectFilter"
                value={selectedObject}
                onChange={(e) => setSelectedObject(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="">Tất cả đối tượng</option>
                {getUniqueObjects().map(obj => (
                  <option key={obj} value={obj}>{obj}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="unitFilter" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Đơn vị:
              </label>
              <input
                id="unitFilter"
                type="text"
                placeholder="Tìm theo đơn vị..."
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
          <div style={{ marginTop: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => {
                setStartDate('')
                setEndDate('')
                setSelectedObject('')
                setUnitFilter('')
              }}
              style={{
                padding: '6px 12px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🗑️ Xóa bộ lọc
            </button>
            <button
              onClick={exportToExcel}
              style={{
                padding: '6px 12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              📊 Xuất Excel
            </button>
            <span style={{ fontSize: '14px', color: '#6c757d', marginLeft: 'auto' }}>
              Hiển thị: {filteredResults.length} / {allTestResults.length} kết quả
            </span>
          </div>
        </div>

        {/* Danh sách kết quả */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #dee2e6',
          overflow: 'hidden'
        }}>
          <h2 style={{ padding: '15px 20px', margin: 0, borderBottom: '1px solid #dee2e6' }}>
            Danh sách bài thi
          </h2>
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {filteredResults.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
                {allTestResults.length === 0 ? 'Chưa có kết quả bài thi nào' : 'Không tìm thấy kết quả phù hợp với bộ lọc'}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>STT</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Họ tên</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Đối tượng</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Đơn vị</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Đúng</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Sai</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Điểm</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Thời gian</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((result, index) => (
                    <tr key={result.id || index} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '12px' }}>{index + 1}</td>
                      <td style={{ padding: '12px' }}>{result.username}</td>
                      <td style={{ padding: '12px' }}>{result.doituong}</td>
                      <td style={{ padding: '12px' }}>{result.donvi || '-'}</td>
                      <td style={{ padding: '12px', textAlign: 'center', color: '#28a745', fontWeight: 'bold' }}>
                        {result.correct}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', color: '#dc3545', fontWeight: 'bold' }}>
                        {result.total - result.correct}
                      </td>
                      <td style={{
                        padding: '12px',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        color: parseFloat(result.score) >= 8 ? '#28a745' : parseFloat(result.score) >= 6 ? '#ffc107' : '#dc3545'
                      }}>
                        {result.score}/10
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>{result.timestamp}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div className="admin-actions">
                          <button
                            className="edit-btn"
                            onClick={() => viewTestResultDetails(result)}
                          >
                          Xem
                          </button>
                          <button
                            className="delete-btn"
                            onClick={() => {
                              if (confirm(`Bạn có chắc chắn muốn xóa kết quả bài thi của "${result.username}" (${result.score}/10) không?`)) {
                                deleteTestResultFromServer(result.id || '')
                              }
                            }}
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderTestResultDetails = () => {
    if (!selectedTestResult) return null

    return (
      <div className="dialog-overlay" onClick={closeTestResultDetails}>
        <dialog
          open
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              closeTestResultDetails()
            }
          }}
          style={{
            position: 'relative',
            background: 'white',
            borderRadius: '0.5rem',
            padding: 0,
            maxWidth: '100rem',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 0.25rem 0.9375rem rgba(0, 0, 0, 0.3)',
            border: 'none'
          }}
        >
          <div className="dialog-header">
            <h2>Chi tiết bài thi</h2>
            <button className="dialog-close" onClick={closeTestResultDetails} aria-label="Đóng">×</button>
          </div>
          <div className="dialog-content" style={{ padding: '1.25rem' }}>
            {/* Thống kê tổng quát cho bài thi này */}
            {(() => {
              const incorrect = selectedTestResult.total - selectedTestResult.correct
              const correctPercentage = ((selectedTestResult.correct / selectedTestResult.total) * 100).toFixed(1)
              
              return (
                <div style={{
                  backgroundColor: '#f8f9fa',
                  padding: '20px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  border: '1px solid #dee2e6'
                }}>
                  <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Thống kê tổng quát</h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '15px'
                  }}>
                    <div style={{
                      backgroundColor: 'white',
                      padding: '15px',
                      borderRadius: '8px',
                      textAlign: 'center',
                      border: '1px solid #dee2e6'
                    }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                        {selectedTestResult.correct}
                      </div>
                      <div style={{ color: '#6c757d', fontSize: '14px' }}>Câu đúng</div>
                    </div>
                    <div style={{
                      backgroundColor: 'white',
                      padding: '15px',
                      borderRadius: '8px',
                      textAlign: 'center',
                      border: '1px solid #dee2e6'
                    }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>
                        {incorrect}
                      </div>
                      <div style={{ color: '#6c757d', fontSize: '14px' }}>Câu sai</div>
                    </div>
                    <div style={{
                      backgroundColor: 'white',
                      padding: '15px',
                      borderRadius: '8px',
                      textAlign: 'center',
                      border: '1px solid #dee2e6'
                    }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
                        {selectedTestResult.total}
                      </div>
                      <div style={{ color: '#6c757d', fontSize: '14px' }}>Tổng số câu</div>
                    </div>
                    <div style={{
                      backgroundColor: 'white',
                      padding: '15px',
                      borderRadius: '8px',
                      textAlign: 'center',
                      border: '1px solid #dee2e6'
                    }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: parseFloat(selectedTestResult.score) >= 8 ? '#28a745' : parseFloat(selectedTestResult.score) >= 6 ? '#ffc107' : '#dc3545'
                      }}>
                        {selectedTestResult.score}/10
                      </div>
                      <div style={{ color: '#6c757d', fontSize: '14px' }}>Điểm số</div>
                    </div>
                    <div style={{
                      backgroundColor: 'white',
                      padding: '15px',
                      borderRadius: '8px',
                      textAlign: 'center',
                      border: '1px solid #dee2e6'
                    }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
                        {correctPercentage}%
                      </div>
                      <div style={{ color: '#6c757d', fontSize: '14px' }}>Tỷ lệ đúng</div>
                    </div>
                  </div>
                </div>
              )
            })()}

            <div style={{ marginBottom: '20px' }}>
              <p><strong>Họ và tên:</strong> {selectedTestResult.username}</p>
              <p><strong>Đối tượng:</strong> {selectedTestResult.doituong}</p>
              <p><strong>Cấp bậc:</strong> {selectedTestResult.capbac || '-'}</p>
              <p><strong>Chức vụ:</strong> {selectedTestResult.chucvu || '-'}</p>
              <p><strong>Đơn vị:</strong> {selectedTestResult.donvi || '-'}</p>
              <p><strong>Thời gian:</strong> {selectedTestResult.timestamp}</p>
            </div>

            <div style={{ borderTop: '1px solid #ddd', paddingTop: '20px' }}>
              <h3 style={{ marginBottom: '15px' }}>Chi tiết từng câu hỏi:</h3>
              {selectedTestResult.questions.map((q, index) => {
                const userAnswer = selectedTestResult.answers[index]
                const isCorrect = userAnswer === q.dapAn
                const userAnswerText = userAnswer !== -1 && userAnswer !== undefined ? q.luaChon[userAnswer] : 'Chưa trả lời'
                const correctAnswerText = q.luaChon[q.dapAn]

                return (
                  <div key={index} style={{
                    marginBottom: '20px',
                    padding: '15px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    backgroundColor: isCorrect ? '#f0f9f0' : '#fff5f5'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
                      Câu {index + 1}: {q.cauHoi}
                    </div>
                    <div style={{ marginLeft: '20px' }}>
                      {q.luaChon.map((lc, i) => {
                        const isUserAnswer = i === userAnswer
                        const isCorrectAnswer = i === q.dapAn
                        let className = ''
                        if (isCorrectAnswer) className = 'correct'
                        if (isUserAnswer && !isCorrectAnswer) className = 'incorrect'

                        return (
                          <div key={i} className={`choice ${className}`} style={{
                            marginBottom: '5px',
                            padding: '5px'
                          }}>
                            <span>{lc}</span>
                            {isCorrectAnswer && <span style={{ color: '#28a745', marginLeft: '10px' }}>✓ Đáp án đúng</span>}
                            {isUserAnswer && !isCorrectAnswer && <span style={{ color: '#dc3545', marginLeft: '10px' }}>✗ Đáp án bạn chọn</span>}
                          </div>
                        )
                      })}
                    </div>
                    <div style={{
                      marginTop: '10px',
                      padding: '8px',
                      borderRadius: '4px',
                      backgroundColor: isCorrect ? '#d4edda' : '#f8d7da',
                      color: isCorrect ? '#155724' : '#721c24',
                      fontWeight: 'bold'
                    }}>
                      {isCorrect ? '✓ Đúng' : '✗ Sai'} - Bạn chọn: {userAnswerText}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="dialog-footer">
            <button onClick={closeTestResultDetails}>Đóng</button>
          </div>
        </dialog>
      </div>
    )
  }


  const renderHeader = () => (
    <header className="header-container">
      <img src="/img/trungdoan18.webp" alt="Logo Trung Đoàn 18" className="logo" />
      <div className="header-content">
        <div className="main-title">
          <div className="title-left">Trung Đoàn 18 - Sư Đoàn 325</div>
          <div className="title-right">Kiểm tra nhận thức chính trị trực tuyến</div>
        </div>
        <div className="subtitle">
        Đoàn kết - Kiên cường - Tích cực - Chủ động - Quyết thắng
        </div>
      </div>
    </header>
  )

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '5px solid #f3f3f3',
          borderTop: '5px solid #a31d1d',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '20px'
        }}></div>
        <div>Đang tải...</div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <>
      {renderHeader()}
      <MusicPlayer />
      {currentScreen === 'login' && renderLoginScreen()}
      {currentScreen === 'quiz' && renderQuizScreen()}
      {currentScreen === 'settings' && renderSettingsScreen()}
      {currentScreen === 'history' && renderHistoryScreen()}
      {currentScreen === 'review' && renderReviewScreen()}
      {currentScreen === 'admin-results' && renderAdminResultsScreen()}
      {selectedTestResult && renderTestResultDetails()}
    </>
  )
}
