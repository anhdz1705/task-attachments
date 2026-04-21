# Hướng dẫn Supabase Database

> Project: **task-attachments** | Stack: Express (Node ESM) + React/Vite + Supabase  
> Cập nhật: 2026-04-21

---

## Mục lục

- [Tổng quan kiến trúc DB](#tổng-quan-kiến-trúc-db)
- [Schema — Tạo bảng](#schema--tạo-bảng)
  - [Bảng tasks](#bảng-tasks)
  - [Bảng messages](#bảng-messages)
- [Supabase Client — Cách khởi tạo](#supabase-client--cách-khởi-tạo)
  - [Backend (Service Role)](#backend-service-role)
  - [Frontend (Anon Key)](#frontend-anon-key)
- [Các thao tác DB trong project](#các-thao-tác-db-trong-project)
  - [Tasks — CRUD đầy đủ](#tasks--crud-đầy-đủ)
  - [Messages — Chat history](#messages--chat-history)
- [Realtime — Lắng nghe thay đổi DB](#realtime--lắng-nghe-thay-đổi-db)
- [Row Level Security (RLS)](#row-level-security-rls)
- [Cấu hình môi trường](#cấu-hình-môi-trường)
- [Kiểm thử kết nối DB](#kiểm-thử-kết-nối-db)
- [Troubleshooting thường gặp](#troubleshooting-thường-gặp)

---

## Tổng quan kiến trúc DB

```
┌─────────────────────────────────────────────────────────────┐
│                     SUPABASE PROJECT                        │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌────────────────┐  │
│  │  PostgreSQL  │    │  Realtime   │    │    REST API    │  │
│  │  Database    │    │  (Changes)  │    │  (PostgREST)   │  │
│  │             │    │             │    │                │  │
│  │  ┌────────┐ │    │  tasks-all  │    │  /rest/v1/...  │  │
│  │  │ tasks  │ │───→│  channel    │    │                │  │
│  │  └────────┘ │    │             │    │                │  │
│  │  ┌────────┐ │    └─────────────┘    └────────────────┘  │
│  │  │messages│ │                                           │
│  │  └────────┘ │                                           │
│  └─────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
         ↑  SERVICE_ROLE_KEY               ↑  ANON_KEY
         │  (bypass RLS)                   │  (subject to RLS)
  ┌──────────────┐                 ┌───────────────────┐
  │   Backend    │                 │     Frontend      │
  │   Express    │                 │   React/Vite      │
  │              │                 │                   │
  │ supabase.js  │                 │   supabase.ts     │
  │ (admin)      │                 │   (anon)          │
  └──────────────┘                 └───────────────────┘
```

**Nguyên tắc phân quyền:**

| Client | Key | Quyền | Dùng cho |
|---|---|---|---|
| Backend Express | `SERVICE_ROLE_KEY` | Bypass toàn bộ RLS | Mọi DB operation |
| Frontend React | `ANON_KEY` | Theo RLS policy | Realtime subscribe |

> Backend là nơi duy nhất ghi/đọc DB qua REST. Frontend chỉ kết nối Supabase để dùng **Realtime** (không gọi DB trực tiếp cho tasks/messages).

---

## Schema — Tạo bảng

Chạy các lệnh SQL sau trong **Supabase Dashboard → SQL Editor**.

### Bảng tasks

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT        NOT NULL,
  description      TEXT,
  status           TEXT        NOT NULL DEFAULT 'open'
                               CHECK (status IN ('open', 'in_progress', 'done')),
  attachment_url   TEXT,
  attachment_name  TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

**Mô tả từng cột:**

| Cột | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | ✅ | Primary key, tự sinh |
| `title` | TEXT | ✅ | Tiêu đề công việc |
| `description` | TEXT | ❌ | Mô tả chi tiết |
| `status` | TEXT | ✅ | `open` / `in_progress` / `done` |
| `attachment_url` | TEXT | ❌ | Public URL của file đính kèm (Supabase Storage) |
| `attachment_name` | TEXT | ❌ | Tên gốc của file (encode UTF-8) |
| `created_at` | TIMESTAMPTZ | ✅ | Thời điểm tạo |
| `updated_at` | TIMESTAMPTZ | ✅ | Thời điểm cập nhật cuối |

**Index khuyến nghị:**
```sql
-- Tăng tốc sort theo created_at (endpoint listTasks dùng ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks (created_at DESC);

-- Tăng tốc filter theo status
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
```

**Trigger tự cập nhật updated_at:**
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

### Bảng messages

```sql
CREATE TABLE IF NOT EXISTS messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name  TEXT        NOT NULL,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Mô tả từng cột:**

| Cột | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | ✅ | Primary key, tự sinh |
| `user_name` | TEXT | ✅ | Tên người gửi |
| `content` | TEXT | ✅ | Nội dung tin nhắn |
| `created_at` | TIMESTAMPTZ | ✅ | Thời điểm gửi |

> ⚠️ **Lưu ý:** Bảng `messages` hiện tại **không được ChatBox sử dụng**. ChatBox dùng Supabase Realtime Broadcast — không lưu DB. Bảng này sẵn sàng nếu nâng cấp lưu lịch sử. Xem [CHAT_REALTIME_GUIDE.md](./CHAT_REALTIME_GUIDE.md).

**Index khuyến nghị:**
```sql
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC);
```

---

## Supabase Client — Cách khởi tạo

### Backend (Service Role)

File: `backend/src/lib/supabase.js`

```js
import { createClient } from '@supabase/supabase-js';

let _supabaseAdmin = null;

export function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be provided');
    }
    _supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,  // không cần refresh token ở backend
        persistSession: false     // stateless — không lưu session
      }
    });
  }
  return _supabaseAdmin;
}
```

**Pattern Singleton:** Client chỉ được tạo một lần, tái sử dụng cho mọi request — tránh tạo quá nhiều kết nối.

---

### Frontend (Anon Key)

File: `frontend/src/lib/supabase.ts`

```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export function getSupabase() {
  if (!_supabase) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be provided');
    }
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}
```

Frontend client chỉ dùng cho **Realtime subscribe** (`useRealtimeTasks.ts`), không gọi DB trực tiếp.

---

## Các thao tác DB trong project

### Tasks — CRUD đầy đủ

#### Lấy danh sách tasks

```js
// GET /api/tasks → taskController.listTasks
const { data, error } = await supabaseAdmin
  .from('tasks')
  .select('*')
  .order('created_at', { ascending: false }); // mới nhất trước
```

#### Tạo task mới

```js
// POST /api/tasks → taskController.createTask
const { data: task, error } = await supabaseAdmin
  .from('tasks')
  .insert([{ title, description, status: 'open' }])
  .select()   // trả về row vừa insert
  .single();  // expect exactly 1 row
```

#### Cập nhật trạng thái

```js
// PATCH /api/tasks/:id/status → taskController.updateTaskStatus
// validStatuses = ['open', 'in_progress', 'done']
const { data, error } = await supabaseAdmin
  .from('tasks')
  .update({ status, updated_at: new Date().toISOString() })
  .eq('id', id)
  .select()
  .single();
```

#### Cập nhật attachment sau khi upload file

```js
// Sau khi upload lên Storage thành công
const { data: updatedTask } = await supabaseAdmin
  .from('tasks')
  .update({
    attachment_url: publicUrl,
    attachment_name: originalName,
    updated_at: new Date().toISOString()
  })
  .eq('id', task.id)
  .select()
  .single();
```

#### Xóa attachment (null hóa cột)

```js
// DELETE /api/tasks/:id/attachment → taskController.deleteAttachment
const { data: updatedTask, error } = await supabaseAdmin
  .from('tasks')
  .update({ attachment_url: null, attachment_name: null })
  .eq('id', id)
  .select()
  .single();
```

---

### Messages — Chat history

> Backend có các endpoint sau nhưng **hiện chưa được frontend gọi**:

#### Lấy 50 tin nhắn gần nhất

```js
// GET /api/messages → chatController.listMessages
const { data, error } = await supabaseAdmin
  .from('messages')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(50);
// Sau đó reverse() để hiển thị cũ → mới
```

#### Gửi tin nhắn mới

```js
// POST /api/messages → chatController.sendMessage
// Body: { user_name: string, content: string }
const { data, error } = await supabaseAdmin
  .from('messages')
  .insert([{ user_name, content }])
  .select()
  .single();
```

---

## Realtime — Lắng nghe thay đổi DB

File: `frontend/src/hooks/useRealtimeTasks.ts`

```ts
const supabase = getSupabase(); // dùng ANON_KEY

channel = supabase
  .channel('tasks-all')
  .on(
    'postgres_changes',               // mode: lắng nghe thay đổi Postgres
    {
      event: '*',                     // INSERT | UPDATE | DELETE | *
      schema: 'public',
      table: 'tasks'
    },
    (payload) => {
      console.log('Change received!', payload);
      fetchTasks();                   // re-fetch toàn bộ danh sách
    }
  )
  .subscribe();
```

**Luồng hoạt động Realtime:**

```
Browser A: PATCH /api/tasks/:id/status
       ↓
Backend Express → Supabase DB (UPDATE tasks)
       ↓
Supabase Realtime detect thay đổi
       ↓
Broadcast postgres_changes event
       ↓
Browser B (đang subscribe 'tasks-all') nhận event
       ↓
fetchTasks() → re-render danh sách
```

**Bật Realtime cho bảng tasks** (bắt buộc, chỉ cần làm 1 lần):

```sql
-- Trong Supabase SQL Editor
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
```

Hoặc qua Dashboard: **Table Editor** → bảng `tasks` → **Edit Table** → bật **Realtime** → Save.

---

## Row Level Security (RLS)

Supabase bật RLS mặc định cho mọi bảng mới. Backend dùng `SERVICE_ROLE_KEY` — **tự động bypass RLS** mà không cần policy nào.

Tuy nhiên, frontend dùng `ANON_KEY` để subscribe Realtime Postgres Changes — cần policy cho phép `SELECT`:

### Option A — Disable RLS (đơn giản, phù hợp app nội bộ)

```sql
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
```

### Option B — Giữ RLS, thêm policy public read (an toàn hơn)

```sql
-- Cho phép anon key đọc tasks (cần thiết cho Realtime Postgres Changes)
CREATE POLICY "anon_read_tasks" ON tasks
  FOR SELECT
  TO anon
  USING (true);

-- Cho phép anon key đọc messages
CREATE POLICY "anon_read_messages" ON messages
  FOR SELECT
  TO anon
  USING (true);

-- Service role vẫn có full access (tự động, không cần policy)
```

### Kiểm tra RLS hiện tại

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

## Cấu hình môi trường

### Backend (Vercel project backend)

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Lấy tại: Supabase Dashboard → **Project Settings** → **API**

### Frontend (Vercel project frontend)

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> **Quy tắc bảo mật:** `SERVICE_ROLE_KEY` tuyệt đối không được đặt trong frontend project. Key này bypass toàn bộ RLS.

**Phân biệt 2 key nhanh:**
```js
// Decode phần giữa JWT (base64)
JSON.parse(atob(key.split('.')[1]))
// anon key    → { "role": "anon", ... }
// service key → { "role": "service_role", ... }
```

---

## Kiểm thử kết nối DB

### Test qua Backend health endpoint

```bash
curl https://<backend-url>.vercel.app/api/health
# {"ok":true}
```

### Test DB query qua API

```bash
# Lấy danh sách tasks
curl https://<backend-url>.vercel.app/api/tasks
# Kết quả: [] hoặc mảng tasks

# Tạo task mới
curl -X POST https://<backend-url>.vercel.app/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Test task", "description": "Testing DB connection"}'
# Kết quả: { "id": "uuid...", "title": "Test task", ... }
```

### Test trực tiếp trong Supabase SQL Editor

```sql
-- Kiểm tra dữ liệu
SELECT * FROM tasks ORDER BY created_at DESC LIMIT 5;
SELECT * FROM messages ORDER BY created_at DESC LIMIT 5;

-- Kiểm tra Realtime publication
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Kiểm tra RLS
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

---

## Troubleshooting thường gặp

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| `500` trên mọi API | Thiếu `SUPABASE_URL` hoặc `SERVICE_ROLE_KEY` | Kiểm tra env vars trong Vercel |
| `[]` trả về dù có dữ liệu | RLS block anon key | Disable RLS hoặc thêm SELECT policy |
| `column does not exist` | Schema bảng thiếu cột | Chạy lại SQL tạo bảng |
| Realtime không nhận event | Bảng tasks chưa trong publication | `ALTER PUBLICATION supabase_realtime ADD TABLE tasks` |
| `new row violates row-level security` | Nhầm ANON_KEY dùng cho backend | Dùng `SERVICE_ROLE_KEY` cho backend |
| Supabase project không phản hồi | Project bị paused (Hobby tier) | Vào Dashboard → Restore project |

Xem chi tiết: [TROUBLESHOOTING_DEPLOY.md](./TROUBLESHOOTING_DEPLOY.md) — phần **SUPABASE Configuration Issues**.
