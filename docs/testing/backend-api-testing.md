# Hướng dẫn Test API Backend

**Base URL (local):** `http://localhost:3001`  
**Khởi động server:** `npm run dev` trong thư mục `backend/`

---

## Mục lục

1. [Health Check](#1-health-check)
2. [Tasks](#2-tasks)
   - [GET /api/tasks](#21-lấy-danh-sách-task)
   - [POST /api/tasks](#22-tạo-task-mới)
   - [PATCH /api/tasks/:id/status](#23-cập-nhật-trạng-thái-task)
   - [POST /api/tasks/:id/attachment](#24-upload-file-đính-kèm)
   - [DELETE /api/tasks/:id/attachment](#25-xoá-file-đính-kèm)
3. [Messages](#3-messages)
   - [GET /api/messages](#31-lấy-danh-sách-tin-nhắn)
   - [POST /api/messages](#32-gửi-tin-nhắn)
4. [Task Object Schema](#4-task-object-schema)
5. [Error Response](#5-error-response)

---

## 1. Health Check

### `GET /api/health`

Kiểm tra server đang chạy.

**Request:**
```http
GET /api/health
```

**Response `200`:**
```json
{ "ok": true }
```

**curl:**
```bash
curl http://localhost:3001/api/health
```

---

## 2. Tasks

### 2.1 Lấy danh sách Task

### `GET /api/tasks`

Trả về tất cả tasks, sắp xếp theo `created_at` giảm dần (mới nhất trước).

**Request:**
```http
GET /api/tasks
```

**Response `200`:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Fix login bug",
    "description": "User cannot login on mobile",
    "status": "open",
    "attachment_url": null,
    "attachment_name": null,
    "created_at": "2026-04-18T10:00:00Z",
    "updated_at": "2026-04-18T10:00:00Z"
  }
]
```

**curl:**
```bash
curl http://localhost:3001/api/tasks
```

---

### 2.2 Tạo Task mới

### `POST /api/tasks`

Tạo task mới, có thể kèm file đính kèm. Request dùng `multipart/form-data`.

**Request fields:**

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `title` | string | ✅ | Tiêu đề task |
| `description` | string | ❌ | Mô tả chi tiết |
| `file` | file | ❌ | File đính kèm |

**Response `201`** — task không có file:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Fix login bug",
  "description": "User cannot login on mobile",
  "status": "open",
  "attachment_url": null,
  "attachment_name": null,
  "created_at": "2026-04-18T10:00:00Z",
  "updated_at": "2026-04-18T10:00:00Z"
}
```

**Response `400`** — thiếu title:
```json
{ "error": "Title is required" }
```

**curl — không có file:**
```bash
curl -X POST http://localhost:3001/api/tasks \
  -F "title=Fix login bug" \
  -F "description=User cannot login on mobile"
```

**curl — kèm file:**
```bash
curl -X POST http://localhost:3001/api/tasks \
  -F "title=Fix login bug" \
  -F "description=Steps to reproduce" \
  -F "file=@/path/to/document.pdf"
```

> **Lưu ý:** Tên file tiếng Việt được xử lý tự động (latin1 → UTF-8).

---

### 2.3 Cập nhật trạng thái Task

### `PATCH /api/tasks/:id/status`

Cập nhật status của một task.

**URL params:**

| Param | Mô tả |
|-------|-------|
| `id` | UUID của task |

**Request body (`application/json`):**
```json
{ "status": "in_progress" }
```

**Các giá trị `status` hợp lệ:** `open` · `in_progress` · `done`

**Response `200`:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Fix login bug",
  "status": "in_progress",
  "updated_at": "2026-04-18T11:00:00Z"
}
```

**Response `400`** — status không hợp lệ:
```json
{ "error": "Invalid status" }
```

**curl:**
```bash
curl -X PATCH http://localhost:3001/api/tasks/550e8400-e29b-41d4-a716-446655440000/status \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'
```

---

### 2.4 Upload file đính kèm

### `POST /api/tasks/:id/attachment`

Upload (hoặc thay thế) file đính kèm cho task đã tồn tại. Dùng `upsert: true` nên sẽ ghi đè nếu path trùng.

**URL params:**

| Param | Mô tả |
|-------|-------|
| `id` | UUID của task |

**Request:** `multipart/form-data`

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `file` | file | ✅ | File cần upload |

**Response `200`** — task đã được cập nhật:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "attachment_url": "https://<project>.supabase.co/storage/v1/object/public/task-attachments/550e.../1713441600000-report.pdf",
  "attachment_name": "report.pdf",
  "updated_at": "2026-04-18T12:00:00Z"
}
```

**Response `400`** — không có file:
```json
{ "error": "No file uploaded" }
```

**curl:**
```bash
curl -X POST http://localhost:3001/api/tasks/550e8400-e29b-41d4-a716-446655440000/attachment \
  -F "file=@/path/to/report.pdf"
```

---

### 2.5 Xoá file đính kèm

### `DELETE /api/tasks/:id/attachment`

Xoá file trên Supabase Storage và set `attachment_url`, `attachment_name` về `null` trong DB.

**URL params:**

| Param | Mô tả |
|-------|-------|
| `id` | UUID của task |

**Response `200`** — task sau khi xoá:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "attachment_url": null,
  "attachment_name": null,
  "updated_at": "2026-04-18T13:00:00Z"
}
```

**Response `400`** — task không có attachment:
```json
{ "error": "No attachment to delete" }
```

**curl:**
```bash
curl -X DELETE http://localhost:3001/api/tasks/550e8400-e29b-41d4-a716-446655440000/attachment
```

---

## 3. Messages

### 3.1 Lấy danh sách tin nhắn

### `GET /api/messages`

Trả về tối đa 50 tin nhắn gần nhất, sắp xếp theo thứ tự **tăng dần** (cũ nhất trước — phù hợp hiển thị chat).

**Request:**
```http
GET /api/messages
```

**Response `200`:**
```json
[
  {
    "id": "msg-001",
    "user_name": "Alice",
    "content": "Xin chào mọi người!",
    "created_at": "2026-04-18T09:00:00Z"
  },
  {
    "id": "msg-002",
    "user_name": "Bob",
    "content": "Chào Alice!",
    "created_at": "2026-04-18T09:01:00Z"
  }
]
```

**curl:**
```bash
curl http://localhost:3001/api/messages
```

---

### 3.2 Gửi tin nhắn

### `POST /api/messages`

Tạo tin nhắn mới trong phòng chat.

**Request body (`application/json`):**

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `user_name` | string | ✅ | Tên người gửi |
| `content` | string | ✅ | Nội dung tin nhắn |

```json
{
  "user_name": "Alice",
  "content": "Xin chào mọi người!"
}
```

**Response `201`:**
```json
{
  "id": "msg-003",
  "user_name": "Alice",
  "content": "Xin chào mọi người!",
  "created_at": "2026-04-18T09:05:00Z"
}
```

**Response `400`** — thiếu field:
```json
{ "error": "User name and content are required" }
```

**curl:**
```bash
curl -X POST http://localhost:3001/api/messages \
  -H "Content-Type: application/json" \
  -d '{"user_name": "Alice", "content": "Xin chào mọi người!"}'
```

---

## 4. Task Object Schema

```ts
{
  id:              string   // UUID
  title:           string
  description:     string | null
  status:          "open" | "in_progress" | "done"
  attachment_url:  string | null  // Public URL trên Supabase Storage
  attachment_name: string | null  // Tên file gốc (UTF-8)
  created_at:      string  // ISO 8601
  updated_at:      string  // ISO 8601
}
```

---

## 5. Error Response

Mọi lỗi đều trả về cùng cấu trúc:

```json
{ "error": "<mô tả lỗi>" }
```

| HTTP Status | Tình huống |
|-------------|-----------|
| `400` | Thiếu field bắt buộc, giá trị không hợp lệ |
| `500` | Lỗi DB, lỗi Supabase Storage |
