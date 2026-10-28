# E-Warehouse — Frontend

Next.js 14/React/TypeScript

## Cài đặt


```powershell
npm ci --include=dev
Copy-Item .env.local.example .env.local
```

Chỉnh `.env.local`:

```env
BACKEND_API_URL=http://localhost:4000
```

Đây là URL backend từ góc nhìn máy chạy Next.js, **không thêm `/api`**. Nếu chạy FE/BE ở hai máy hoặc container khác nhau, thay localhost bằng địa chỉ backend mà máy FE truy cập được. `app/api/[...path]/route.ts` chuyển tiếp `/api/...` từ frontend tới backend, giữ cookie phiên đăng nhập.

## Chạy

Phát triển:

```powershell
npm run dev
```

Production:

```powershell
npm run build
npm start
```




