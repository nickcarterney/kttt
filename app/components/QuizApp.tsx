'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { jsPDF } from 'jspdf'

interface Question {
  cauHoi: string
  luaChon: string[]
  dapAn: number
}

interface QuestionsData {
  [key: string]: Question[]
}

interface TestResult {
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
  const [isLoading, setIsLoading] = useState(true)

  // UI state
  const [currentScreen, setCurrentScreen] = useState<'login' | 'quiz' | 'settings' | 'history' | 'review'>('login')
  const [showTestModeSelection, setShowTestModeSelection] = useState(false)
  const [isAddQuestionFormVisible, setIsAddQuestionFormVisible] = useState(false)

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
          loadLoginData()
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

  const handleAdminLogin = () => {
    if (!adminForm.username || !adminForm.password) {
      alert('Vui lòng nhập đầy đủ tên admin và mật khẩu!')
      return
    }

    if (adminForm.username === 'admin' && adminForm.password === 'admin123') {
      setIsAdmin(true)
      setUsername(adminForm.username)
      setCurrentDoituong('Admin')
      setCurrentScreen('settings')
    } else {
      alert('Tên admin hoặc mật khẩu không đúng!')
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

    let tempQuestions = [...questions[doituongToUse]]
    shuffleArray(tempQuestions)

    const newSelectedQuestions = tempQuestions.slice(0, 25).map((q) => {
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

  const nopBai = (bypassConfirm = false) => {
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
    }
  }

  // Admin functions
  const showSettings = () => {
    setCurrentScreen('settings')
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
    // This would show detailed results - for now just log
    console.log('Viewing test details:', testHistory[index])
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

  const clearHistory = () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử thi không?')) {
      saveTestHistory([])
    }
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

  const logout = () => {
    // Clear all stored data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('loginData')
      localStorage.removeItem('timeLeft')
      localStorage.removeItem('startTime')
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

      <div style={{ textAlign: 'right', marginBottom: '20px' }}>
        <button onClick={goBackToMain} style={{ backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', marginRight: '10px' }}>
          🔙 Quay lại
        </button>
        <button onClick={logout} style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
          🚪 Đăng xuất
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
                  {cauHoi.luaChon.map((lc, i) => (
                    <div key={i} className="choice">
                      <input
                        type="radio"
                        name={`cauhoi_${index}`}
                        value={i}
                        checked={answers[index] === i}
                        onChange={() => chonDapAn(index, i)}
                        disabled={isSubmitted}
                      />
                      <span>{lc}</span>
                    </div>
                  ))}
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
      <button onClick={showAddQuestionForm}>➕ Thêm câu hỏi</button>
      <button onClick={goBackToMain}>🔙 Quay lại bài thi</button>

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
        <div id="addQuestionForm">
          <h2>Thêm/Sửa câu hỏi</h2>
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

          <button onClick={saveQuestion}>💾 Lưu</button>
          <button onClick={cancelEdit}>❌ Hủy</button>
        </div>
      )}
    </div>
  )

  const renderHistoryScreen = () => (
    <div id="history-screen">
      <h1>LỊCH SỬ THI</h1>
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
            <button onClick={() => exportToPDF(index)}>Xuất PDF</button>
          </div>
        ))}
      </div>
      {isAdmin && (
        <button onClick={clearHistory}>Xóa lịch sử thi</button>
      )}
      <button onClick={goBackToMain}>🔙 Quay lại bài thi</button>
    </div>
  )

  const renderReviewScreen = () => (
    <div id="review-screen">
      <h1>ÔN TẬP CÂU HỎI</h1>
      <button onClick={goBackToMain}>🔙 Quay lại bài thi</button>
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
    </div>
  )

  const renderHeader = () => (
    <header className="header-container">
      <img src="/img/LOGO98.png" alt="Logo Trung Đoàn 98" className="logo" />
      <div className="header-content">
        <div className="main-title">
          <div className="title-left">Trung Đoàn 98 - Sư Đoàn 316</div>
          <div className="title-right">Kiểm tra nhận thức chính trị trực tuyến</div>
        </div>
        <div className="subtitle">
          Trung thành - Kiên quyết - Triệt để - Đoàn kết - Sáng tạo - Chủ động khắc phục khó khăn
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
      {currentScreen === 'login' && renderLoginScreen()}
      {currentScreen === 'quiz' && renderQuizScreen()}
      {currentScreen === 'settings' && renderSettingsScreen()}
      {currentScreen === 'history' && renderHistoryScreen()}
      {currentScreen === 'review' && renderReviewScreen()}
    </>
  )
}
