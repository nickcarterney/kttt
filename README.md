# Kiểm tra nhận thức chính trị - Trung Đoàn 98

Ứng dụng kiểm tra nhận thức chính trị trực tuyến được chuyển đổi từ HTML/CSS/JavaScript sang Next.js.

## Tính năng

- **Đăng nhập hệ thống**: Hỗ trợ đăng nhập cho các đối tượng khác nhau
- **Đăng nhập quản lý**: Tài khoản admin để quản lý câu hỏi
- **Thi thật/Thi thử**: Chế độ thi với thời gian giới hạn
- **Ôn tập câu hỏi**: Xem tất cả câu hỏi và đáp án đúng
- **Quản lý câu hỏi**: Thêm, sửa, xóa câu hỏi qua giao diện admin
- **Lịch sử thi**: Xem kết quả các lần thi trước
- **Xuất PDF**: Xuất kết quả thi ra file PDF

## Cấu trúc dự án

```
/
├── app/
│   ├── api/questions/route.ts    # API để đọc/ghi câu hỏi
│   ├── components/QuizApp.tsx    # Component chính chứa toàn bộ logic
│   ├── globals.css               # CSS tổng hợp
│   ├── layout.tsx                # Layout Next.js
│   └── page.tsx                  # Trang chính
├── public/img/                   # Hình ảnh
├── questions.json                # File dữ liệu câu hỏi
└── package.json                  # Dependencies
```

## Chạy ứng dụng

### Cài đặt dependencies

```bash
npm install
```

### Chạy development server

```bash
npm run dev
```

Ứng dụng sẽ chạy tại `http://localhost:3000`

### Build cho production

```bash
npm run build
npm start
```

## Tài khoản Admin

- **Username**: admin
- **Password**: admin123

## Cấu trúc dữ liệu câu hỏi

Câu hỏi được lưu trong file `questions.json` với cấu trúc:

```json
{
  "Siquan-QNCN": [
    {
      "cauHoi": "Câu hỏi...",
      "luaChon": ["Lựa chọn 1", "Lựa chọn 2", "Lựa chọn 3", "Lựa chọn 4"],
      "dapAn": 0
    }
  ],
  "Chiensimoi": [...],
  ...
}
```

## API Endpoints

### GET /api/questions
Trả về tất cả câu hỏi từ file `questions.json`

### POST /api/questions
Cập nhật dữ liệu câu hỏi vào file `questions.json`

**Request Body:**
```json
{
  "Siquan-QNCN": [...],
  "Chiensimoi": [...]
}
```

## Các đối tượng thi

1. **Siquan-QNCN**: Sĩ quan, QNCN
2. **Chiensimoi**: Chiến sĩ mới
3. **Chiensinamthunhat**: Chiến sĩ năm thứ nhất
4. **Chiensinamthuhai**: Chiến sĩ năm thứ hai
5. **Lopnhanthucvedang**: Lớp nhận thức về đảng
6. **Lopdangvienmoi**: Lớp đảng viên mới

## Lịch sử thay đổi

- **Chuyển đổi từ HTML/CSS/JS sang Next.js**: Tái cấu trúc hoàn toàn ứng dụng
- **Sử dụng API routes**: Thay thế localStorage bằng file system cho dữ liệu câu hỏi
- **React hooks**: Quản lý state với useState và useEffect
- **TypeScript**: Thêm type safety cho code

## Công nghệ sử dụng

- **Next.js 14**: React framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling (tích hợp sẵn)
- **jsPDF**: Xuất PDF kết quả thi