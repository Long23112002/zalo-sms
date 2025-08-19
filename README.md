# Zalo SMS System

Hệ thống gửi tin nhắn SMS hàng loạt qua Zalo với giao diện web hiện đại, tích hợp MongoDB và JWT authentication.

## ✨ Tính năng chính

- 🔐 **Hệ thống Authentication hoàn chỉnh**
  - Đăng ký/Đăng nhập với JWT tokens
  - Access Token (15 phút) + Refresh Token (7 ngày)
  - Bảo mật với bcrypt password hashing

- 💾 **Quản lý cấu hình Zalo**
  - Lưu trữ nhiều cấu hình đăng nhập Zalo
  - Quản lý cookie, IMEI, User Agent
  - Hỗ trợ proxy (tùy chọn)

- 📱 **Gửi tin nhắn hàng loạt**
  - Tìm kiếm user qua số điện thoại
  - Gửi tin nhắn với delay tùy chỉnh
  - Theo dõi kết quả gửi tin nhắn

- 🎨 **Giao diện hiện đại**
  - Responsive design cho mọi thiết bị
  - Tailwind CSS với gradient và shadows
  - UX/UI được tối ưu hóa

## 🚀 Cài đặt

### Yêu cầu hệ thống
- Node.js 18+ 
- MongoDB Atlas hoặc MongoDB local
- npm hoặc yarn

### Bước 1: Clone và cài đặt dependencies
```bash
git clone <repository-url>
cd zalo-spam
npm install
```

### Bước 2: Cấu hình MongoDB
Tạo file `.env.local` trong thư mục gốc:
```env
# JWT Secrets (thay đổi trong production)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production

# MongoDB URI (đã có trong code, nhưng có thể override)
MONGODB_URI=mongodb+srv://longjava2024:Java2024%40%40@cluster0.cb22hdu.mongodb.net/zalo?retryWrites=true&w=majority&appName=Cluster0
```

### Bước 3: Khởi động ứng dụng
```bash
npm run dev
```

Ứng dụng sẽ chạy tại `http://localhost:3000`

## 📖 Hướng dẫn sử dụng

### 1. Đăng ký tài khoản
- Truy cập ứng dụng
- Chọn "Đăng ký"
- Điền thông tin: username, email, password, họ tên
- Hệ thống sẽ tạo tài khoản và đăng nhập tự động

### 2. Quản lý cấu hình Zalo
- Chuyển sang tab "Quản lý cấu hình"
- Click "Thêm cấu hình mới"
- Điền thông tin:
  - **Tên cấu hình**: Tên để dễ nhớ (ví dụ: "Tài khoản chính")
  - **Cookie**: Cookie Zalo (xem hướng dẫn bên dưới)
  - **IMEI**: IMEI thiết bị
  - **User Agent**: User Agent trình duyệt
  - **Proxy**: Tùy chọn

### 3. Lấy thông tin Zalo

#### Lấy Cookie:
1. Mở trình duyệt và truy cập [Zalo](https://zalo.me)
2. Đăng nhập vào tài khoản Zalo
3. Nhấn F12 để mở Developer Tools
4. Chọn tab **Application** → **Cookies** → **https://zalo.me**
5. **QUAN TRỌNG**: Copy cookie theo một trong hai cách:

   **Cách 1 (Khuyến nghị):**
   - Copy từng cookie một cách thủ công
   - Format: `name1=value1; name2=value2; name3=value3`
   - Ví dụ: `_zlang=vn; zpw_sek=abc123; __zi=xyz789`

   **Cách 2:**
   - Copy toàn bộ cookie từ DevTools
   - Hệ thống sẽ tự động chuyển đổi JSON array thành string format
   - Hiển thị indicator để biết format hiện tại

6. **Lưu ý**: Cookie phải ở dạng string, không phải JSON array

#### Lấy IMEI:
- Có thể lấy từ thiết bị hoặc sử dụng IMEI giả (ví dụ: 123456789012345)

#### Lấy User Agent:
- F12 → Console → `navigator.userAgent`

### 4. Gửi tin nhắn hàng loạt
- Chuyển sang tab "Gửi tin nhắn"
- Nhập danh sách số điện thoại (mỗi số một dòng)
- Nhập nội dung tin nhắn
- Điều chỉnh delay giữa các tin nhắn
- Click "Gửi tin nhắn hàng loạt"

## 🏗️ Kiến trúc hệ thống

### Frontend
- **Next.js 15** với App Router
- **Tailwind CSS** cho styling
- **TypeScript** cho type safety
- **Heroicons** cho icons

### Backend
- **Next.js API Routes**
- **MongoDB** với Mongoose ODM
- **JWT** authentication
- **bcryptjs** cho password hashing

### Database Models
- **User**: Thông tin người dùng
- **ZaloConfig**: Cấu hình đăng nhập Zalo

### API Endpoints
- `POST /api/auth/register` - Đăng ký
- `POST /api/auth/login` - Đăng nhập
- `GET /api/zalo-config` - Lấy danh sách cấu hình
- `POST /api/zalo-config` - Tạo cấu hình mới
- `PUT /api/zalo-config` - Cập nhật cấu hình
- `DELETE /api/zalo-config` - Xóa cấu hình

## 🔒 Bảo mật

- **Password Hashing**: bcrypt với salt rounds = 12
- **JWT Tokens**: Access token (15 phút) + Refresh token (7 ngày)
- **Authentication Middleware**: Bảo vệ các API routes
- **Input Validation**: Kiểm tra dữ liệu đầu vào
- **CORS Protection**: Chỉ cho phép requests từ cùng origin

## 🚨 Lưu ý quan trọng

1. **Thay đổi JWT secrets** trong production
2. **Bảo mật MongoDB connection string**
3. **Sử dụng HTTPS** trong production
4. **Rate limiting** cho API endpoints
5. **Logging và monitoring** cho production

## 🐛 Xử lý lỗi

### Lỗi thường gặp

#### Sharp Module Error
```bash
Error: Could not load the "sharp" module using the win32-x64 runtime
```
**Giải pháp:**
```bash
npm uninstall sharp
npm install --platform=win32 --arch=x64 --target=18.0.0 sharp
```

#### MongoDB Connection Error
- Kiểm tra connection string
- Kiểm tra network access
- Kiểm tra MongoDB service

#### JWT Token Expired
- Access token tự động hết hạn sau 15 phút
- Sử dụng refresh token để lấy token mới
- Hoặc đăng nhập lại

## 📱 Responsive Design

- **Mobile First**: Tối ưu cho thiết bị di động
- **Tablet**: Layout thích ứng cho tablet
- **Desktop**: Giao diện đầy đủ cho desktop
- **Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px)

## 🔄 Cập nhật

### Cập nhật dependencies
```bash
npm update
```

### Cập nhật database schema
```bash
# Backup database trước khi cập nhật
# Chạy migration scripts nếu cần
```

## 📄 License

MIT License - Xem file LICENSE để biết thêm chi tiết.

## 🤝 Đóng góp

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push to branch
5. Tạo Pull Request

## 📞 Hỗ trợ

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra documentation
2. Tìm kiếm trong issues
3. Tạo issue mới với thông tin chi tiết

---

**Lưu ý**: Đây là dự án demo, không nên sử dụng trong production mà không có các biện pháp bảo mật bổ sung.
