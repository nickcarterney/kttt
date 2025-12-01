import type { Metadata } from 'next'
import './globals.scss'

export const metadata: Metadata = {
  title: 'Ứng dụng kiểm tra nhận thức chính trị',
  description: 'Kiểm tra nhận thức chính trị trực tuyến - Trung Đoàn 98',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}
