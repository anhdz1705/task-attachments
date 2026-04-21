# Task Attachments

Ứng dụng quản lý công việc với đính kèm file và chat nhóm realtime, xây dựng trên nền Supabase.

## Tổng quan

**CORE.SYSTEM** là ứng dụng quản lý task dạng full-stack, kiến trúc monorepo:

- **Frontend** — React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend** — Node.js + Express (REST API)
- **Database / Storage** — Supabase (PostgreSQL + Storage + Realtime)
- **Deploy** — Vercel (frontend và backend triển khai độc lập)

## Tính năng

- Tạo, xem, cập nhật trạng thái task (`open` → `in_progress` → `done`)
- Đính kèm file vào task (upload / xem / xóa qua Supabase Storage)
- Cập nhật realtime qua Supabase Realtime (Postgres Changes)
- Chat nhóm — gửi và nhận tin nhắn lưu trong Supabase
- Giao diện hai màn hình: **Bảng điều khiển** & **Chat**

## Cấu trúc dự án

```
task-attachments/
├── .env                    # Biến môi trường dùng chung
├── package.json            # Root — chạy cả 2 app (concurrently)
├── backend/                # Express API (port 3001)
│   ├── server.js
│   └── src/controllers/    # taskController, chatController, homeController
└── frontend/               # React + Vite (port 5173)
    └── src/
        ├── components/     # TaskForm, TaskList, TaskItem, ChatBox
        └── hooks/          # useRealtimeTasks (Supabase Realtime)
```

## Cài đặt & Chạy local

**Yêu cầu:** Node.js >= 20

1. Cài đặt tất cả dependencies:
   ```bash
   npm run install:all
   ```

2. Tạo file `.env` ở thư mục gốc từ `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Điền các giá trị Supabase vào `.env`.

3. Chạy cả backend lẫn frontend cùng lúc:
   ```bash
   npm run dev
   ```
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

## Biến môi trường

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `SUPABASE_URL` | ✅ | URL project Supabase |
| `SUPABASE_ANON_KEY` | ✅ | Anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (backend — bảo mật) |
| `STORAGE_BUCKET` | | Tên bucket lưu file đính kèm (mặc định: `task-attachments`) |
| `FRONTEND_URL` | | URL frontend cho CORS (mặc định: `http://localhost:5173`) |
| `VITE_SUPABASE_URL` | ✅ | URL Supabase cho frontend |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Anon key cho frontend |
| `VITE_API_BASE_URL` | | Base URL backend API (để trống khi dev; đặt URL Vercel khi production) |

## API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/tasks` | Lấy danh sách tasks |
| POST | `/api/tasks` | Tạo task mới (`multipart/form-data`) |
| PATCH | `/api/tasks/:id/status` | Cập nhật trạng thái task |
| POST | `/api/tasks/:id/attachment` | Upload file đính kèm |
| DELETE | `/api/tasks/:id/attachment` | Xóa file đính kèm |
| GET | `/api/messages` | Lấy 50 tin nhắn gần nhất |
| POST | `/api/messages` | Gửi tin nhắn |

## Kiểm thử

```bash
# Backend (Vitest)
cd backend && npm test

# Frontend (Vitest + Testing Library)
cd frontend && npm test
```

## Deploy

Mỗi `backend/` và `frontend/` có `vercel.json` riêng, deploy lên Vercel độc lập.

Xem hướng dẫn chi tiết: [docs/Lab-Deploy.md](docs/Lab-Deploy.md)
