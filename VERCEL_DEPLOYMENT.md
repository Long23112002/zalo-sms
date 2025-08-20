# Hướng dẫn Deploy lên Vercel

## Vấn đề đã được giải quyết

### Lỗi ENOENT: no such file or directory, mkdir '/var/task/tmp'

Lỗi này xảy ra khi build trên Vercel vì:
- Vercel không có quyền tạo thư mục `/var/task/tmp`
- Ứng dụng cố gắng tạo thư mục `tmp` trong quá trình build

### Giải pháp đã áp dụng

1. **Cập nhật `ensureTmpDir()` function** trong `src/app/api/zalo/login-qr/route.ts`:
   - Trên production (Vercel): sử dụng `/tmp` (thư mục tạm thời của serverless function)
   - Trên development: sử dụng thư mục `tmp` local

2. **Xử lý lỗi an toàn**:
   - Thêm try-catch cho việc tạo thư mục
   - Fallback về thư mục hiện tại nếu không thể tạo thư mục tạm thời

3. **Cập nhật webpack config** trong `next.config.js`:
   - Chỉ áp dụng fallback cho client-side
   - Cho phép server-side sử dụng `fs`, `path`, `os` modules

4. **Tạo `.vercelignore`**:
   - Loại trừ thư mục `tmp` khỏi deployment
   - Loại trừ các file không cần thiết khác

## Cách deploy

### 1. Cài đặt Vercel CLI (nếu chưa có)
```bash
npm i -g vercel
```

### 2. Login vào Vercel
```bash
vercel login
```

### 3. Deploy
```bash
vercel --prod
```

### 4. Hoặc deploy qua GitHub
- Push code lên GitHub
- Kết nối repository với Vercel
- Vercel sẽ tự động build và deploy

## Lưu ý quan trọng

### Về thư mục tạm thời
- **Trên Vercel**: Chỉ có thể ghi vào `/tmp`
- **Trên development**: Có thể tạo và ghi vào thư mục `tmp` local
- **QR code**: Sẽ được lưu vào thư mục tạm thời phù hợp với môi trường

### Về file system
- **Serverless functions**: Có quyền đọc/ghi hạn chế
- **Temporary storage**: Chỉ tồn tại trong thời gian function chạy
- **Persistence**: Dữ liệu quan trọng nên lưu vào database

### Về performance
- **Cold start**: Lần đầu gọi API có thể chậm
- **Warm start**: Các lần gọi tiếp theo sẽ nhanh hơn
- **Memory**: Mỗi function có giới hạn memory riêng

## Troubleshooting

### Nếu vẫn gặp lỗi build
1. Kiểm tra `.vercelignore` có loại trừ đúng thư mục `tmp`
2. Đảm bảo không có code nào cố gắng tạo thư mục trong quá trình build
3. Kiểm tra `next.config.js` có cấu hình đúng

### Nếu API không hoạt động
1. Kiểm tra logs trong Vercel dashboard
2. Đảm bảo environment variables được set đúng
3. Kiểm tra database connection string

### Nếu QR code không hiển thị
1. Kiểm tra quyền ghi vào `/tmp` trên Vercel
2. Đảm bảo `ensureTmpDir()` function hoạt động đúng
3. Kiểm tra logs để xem có lỗi gì không

## Kết luận

Với các thay đổi đã áp dụng, ứng dụng sẽ:
- ✅ Build thành công trên Vercel
- ✅ Hoạt động bình thường trên production
- ✅ Xử lý thư mục tạm thời một cách an toàn
- ✅ Có fallback cho các trường hợp lỗi

Ứng dụng đã sẵn sàng để deploy lên Vercel!
