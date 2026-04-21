# Hướng dẫn Supabase File Storage

> Project: **task-attachments** | Stack: Express (Node ESM) + React/Vite + Supabase  
> Cập nhật: 2026-04-21

---

## Mục lục

- [Tổng quan kiến trúc Storage](#tổng-quan-kiến-trúc-storage)
- [Thiết lập Bucket](#thiết-lập-bucket)
- [Luồng Upload File](#luồng-upload-file)
  - [Upload khi tạo task mới](#1-upload-khi-tạo-task-mới)
  - [Upload thêm vào task đã có](#2-upload-thêm-vào-task-đã-có)
- [Luồng Xóa File](#luồng-xóa-file)
- [Cấu trúc đường dẫn lưu file](#cấu-trúc-đường-dẫn-lưu-file)
- [Xử lý tên file tiếng Việt](#xử-lý-tên-file-tiếng-việt)
- [Content-Type và charset](#content-type-và-charset)
- [Public URL — Cách lấy và parse](#public-url--cách-lấy-và-parse)
- [Storage Policy (RLS)](#storage-policy-rls)
- [Giới hạn kích thước file](#giới-hạn-kích-thước-file)
- [Cấu hình môi trường](#cấu-hình-môi-trường)
- [Kiểm thử Storage](#kiểm-thử-storage)
- [Troubleshooting thường gặp](#troubleshooting-thường-gặp)

---

## Tổng quan kiến trúc Storage

```
Frontend (Browser)
    │
    │  multipart/form-data (file + metadata)
    ▼
Backend Express (Vercel Serverless)
    │  multer → file.buffer (RAM, max ~4.5MB)
    │
    ├─── 1. Insert task vào PostgreSQL
    │
    ├─── 2. Upload buffer lên Supabase Storage
    │         Bucket: "task-attachments"
    │         Path:   "{task_id}/{timestamp}-{filename}"
    │
    ├─── 3. Lấy publicUrl từ Storage
    │
    └─── 4. Update task: attachment_url + attachment_name
                │
                ▼
           PostgreSQL (tasks table)
           attachment_url  = "https://xxxx.supabase.co/storage/v1/object/public/..."
           attachment_name = "tên file gốc (UTF-8)"
```

**Điểm quan trọng:**
- File **không lưu trên server Express** — Express chỉ là trung gian, file ở RAM rồi push ngay lên Supabase.
- Mọi truy cập file là qua **publicUrl** — không cần token, không qua backend.
- Tên file gốc lưu riêng trong cột `attachment_name` (để hiển thị), không nằm trong URL.

---

## Thiết lập Bucket

### Tạo bucket trong Supabase Dashboard

1. Supabase Dashboard → **Storage** → **New bucket**
2. Điền thông tin:
   - **Name:** `task-attachments` *(phải khớp với env var `STORAGE_BUCKET`)*
   - **Public bucket:** ✅ **Bật** (bắt buộc để `getPublicUrl()` hoạt động)
   - **File size limit:** Tuỳ chọn, khuyến nghị `5MB`
   - **Allowed MIME types:** Để trống = chấp nhận mọi loại
3. Click **Save**

### Tạo bucket bằng SQL (tùy chọn)

```sql
-- Trong Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;
```

### Kiểm tra bucket đã tồn tại

```sql
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'task-attachments';
```

---

## Luồng Upload File

### 1. Upload khi tạo task mới

**Endpoint:** `POST /api/tasks` — `multipart/form-data`

```
Fields:  title (string), description (string, optional)
File:    file (binary, optional)
```

**Luồng chi tiết trong `taskController.createTask`:**

```js
// Bước 1: Validate input
if (!title) return res.status(400).json({ error: 'Title is required' });

// Bước 2: Insert task trước (không có attachment_url)
const { data: task } = await supabaseAdmin
  .from('tasks')
  .insert([{ title, description, status: 'open' }])
  .select().single();

// Bước 3: Nếu có file → xử lý tên + content-type
if (file) {
  // Fix encoding tên file từ Latin-1 sang UTF-8
  const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

  // Thêm charset cho text files (hỗ trợ tiếng Việt khi browser mở)
  let contentType = file.mimetype;
  if (contentType.startsWith('text/') || contentType === 'application/json') {
    if (!contentType.includes('charset')) contentType += '; charset=utf-8';
  }

  // Bước 4: Upload lên Storage
  const storagePath = `${task.id}/${Date.now()}-${file.originalname}`;
  await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file.buffer, { contentType, upsert: true });

  // Bước 5: Lấy publicUrl
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  // Bước 6: Update task với URL và tên file
  const { data: updatedTask } = await supabaseAdmin
    .from('tasks')
    .update({ attachment_url: publicUrl, attachment_name: originalName })
    .eq('id', task.id)
    .select().single();

  return res.status(201).json(updatedTask);
}
```

---

### 2. Upload thêm vào task đã có

**Endpoint:** `POST /api/tasks/:id/attachment` — `multipart/form-data`

```
File: file (binary, required)
```

**Luồng trong `taskController.uploadAttachment`:**

```js
// Bước 1: Validate file tồn tại
if (!file) return res.status(400).json({ error: 'No file uploaded' });

// Bước 2: Fix encoding tên file
const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

// Bước 3: Xử lý content-type
let contentType = file.mimetype;
if (contentType.startsWith('text/') || contentType === 'application/json') {
  if (!contentType.includes('charset')) contentType += '; charset=utf-8';
}

// Bước 4: Upload với upsert=true (ghi đè nếu path đã tồn tại)
const storagePath = `${id}/${Date.now()}-${file.originalname}`;
await supabaseAdmin.storage
  .from(STORAGE_BUCKET)
  .upload(storagePath, file.buffer, { contentType, upsert: true });

// Bước 5: Lấy publicUrl và update DB
const { data: { publicUrl } } = supabaseAdmin.storage
  .from(STORAGE_BUCKET).getPublicUrl(storagePath);

await supabaseAdmin.from('tasks')
  .update({
    attachment_url: publicUrl,
    attachment_name: originalName,
    updated_at: new Date().toISOString()
  })
  .eq('id', id);
```

> **Lưu ý:** Upload mới không tự xóa file cũ trên Storage — chỉ ghi đè cột DB. File cũ vẫn tồn tại trong Storage bucket cho đến khi bị xóa thủ công.

---

## Luồng Xóa File

**Endpoint:** `DELETE /api/tasks/:id/attachment`

**Luồng trong `taskController.deleteAttachment`:**

```js
// Bước 1: Lấy task từ DB để có attachment_url
const { data: task } = await supabaseAdmin
  .from('tasks').select('*').eq('id', id).single();

if (!task.attachment_url) {
  return res.status(400).json({ error: 'No attachment to delete' });
}

// Bước 2: Parse storage path từ publicUrl
// URL dạng: https://xxxx.supabase.co/storage/v1/object/public/task-attachments/{path}
const bucketInUrl = `/${STORAGE_BUCKET}/`;
const bucketIndex = task.attachment_url.indexOf(bucketInUrl);
const storagePath = task.attachment_url.substring(bucketIndex + bucketInUrl.length);
// storagePath = "{task_id}/{timestamp}-{filename}"

// Bước 3: Xóa file khỏi Storage
await supabaseAdmin.storage
  .from(STORAGE_BUCKET)
  .remove([storagePath]); // nhận array — có thể xóa nhiều file cùng lúc

// Bước 4: Null hóa cột trong DB (dù Storage lỗi vẫn tiếp tục)
await supabaseAdmin.from('tasks')
  .update({ attachment_url: null, attachment_name: null })
  .eq('id', id);
```

**Sơ đồ parse storagePath:**

```
attachment_url = "https://abc.supabase.co/storage/v1/object/public/task-attachments/uuid-123/1700000000-report.pdf"
                                                                     ↑_________________↑↑_____________________________↑
                                                              bucketInUrl="/task-attachments/"   storagePath
                                                              
storagePath = "uuid-123/1700000000-report.pdf"
```

---

## Cấu trúc đường dẫn lưu file

```
bucket: task-attachments
└── {task.id}/                          ← thư mục theo task UUID
    ├── 1700000001234-report.pdf        ← timestamp + filename gốc
    ├── 1700000005678-image.png
    └── 1700000009999-document.docx
```

**Format storagePath:**
```
{task_id}/{Date.now()}-{file.originalname}
```

**Ví dụ:**
```
a1b2c3d4-e5f6-7890-abcd-ef1234567890/1745123456789-báo-cáo-tháng-4.pdf
```

> `Date.now()` (timestamp milliseconds) đảm bảo không trùng tên nếu upload nhiều file cho cùng task.

---

## Xử lý tên file tiếng Việt

**Vấn đề:** `multer` đọc `filename` header từ `multipart/form-data` theo encoding **Latin-1** (ISO-8859-1) theo chuẩn HTTP. Tên file có ký tự tiếng Việt sẽ bị encode sai.

**Giải pháp:**
```js
// Đọc tên file từ multer (Latin-1) → chuyển sang UTF-8
const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

// Ví dụ:
// file.originalname = "bÃ¡o cÃ¡o.pdf"  (latin1 bị nhìn sai)
// originalName      = "báo cáo.pdf"    (utf8 đúng)
```

**Lưu riêng tên gốc vào DB:**
```js
attachment_name: originalName  // tên hiển thị cho user
attachment_url: publicUrl      // URL thực tế (dùng tên gốc chưa decode)
```

> Storage path vẫn dùng `file.originalname` (chưa decode) vì URL path không cần đọc được — chỉ cần unique.

---

## Content-Type và charset

**Vấn đề:** Browser khi mở file text/JSON qua publicUrl có thể không biết encoding là UTF-8, dẫn đến hiển thị tiếng Việt bị lỗi.

**Giải pháp:** Thêm `charset=utf-8` vào Content-Type khi upload:

```js
let contentType = file.mimetype;

// Áp dụng cho: text/plain, text/html, text/csv, application/json, ...
if (contentType.startsWith('text/') || contentType === 'application/json') {
  if (!contentType.includes('charset')) {
    contentType += '; charset=utf-8';
  }
}

// Ví dụ kết quả:
// "text/plain"           → "text/plain; charset=utf-8"
// "text/csv"             → "text/csv; charset=utf-8"
// "application/json"     → "application/json; charset=utf-8"
// "application/pdf"      → "application/pdf" (không thay đổi)
// "image/png"            → "image/png" (không thay đổi)
```

---

## Public URL — Cách lấy và parse

### Lấy publicUrl

```js
const { data: { publicUrl } } = supabaseAdmin.storage
  .from(STORAGE_BUCKET)
  .getPublicUrl(storagePath);
```

**Format URL:**
```
https://{project-ref}.supabase.co/storage/v1/object/public/{bucket-name}/{storage-path}
```

**Ví dụ thực tế:**
```
https://abcdefghijklm.supabase.co/storage/v1/object/public/task-attachments/a1b2c3d4/1745123456-report.pdf
```

### Parse storagePath từ URL (dùng khi xóa)

```js
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'task-attachments';

function parseStoragePath(publicUrl) {
  const bucketInUrl = `/${STORAGE_BUCKET}/`;
  const bucketIndex = publicUrl.indexOf(bucketInUrl);
  if (bucketIndex === -1) throw new Error('Invalid attachment URL format');
  return publicUrl.substring(bucketIndex + bucketInUrl.length);
}

// Ví dụ:
parseStoragePath(
  'https://abc.supabase.co/storage/v1/object/public/task-attachments/uuid/1700-file.pdf'
)
// → 'uuid/1700-file.pdf'
```

> **Quan trọng:** Nếu `STORAGE_BUCKET` thay đổi sau khi đã có data, các URL cũ sẽ không parse được. Không nên đổi tên bucket sau khi production.

---

## Storage Policy (RLS)

Supabase Storage cũng có RLS. Bucket **public** cho phép `GET` (download) mà không cần auth. Tuy nhiên cần policy cho **upload/delete** từ backend.

### Kiểm tra policy hiện tại

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage';
```

### Policy cho phép service_role toàn quyền

Backend dùng `SERVICE_ROLE_KEY` → **tự động bypass** mọi storage policy. Không cần tạo policy thêm.

### Policy cho phép public read (nếu bucket không phải public)

Nếu muốn bucket private nhưng vẫn có thể download qua URL:
```sql
CREATE POLICY "public_read_attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-attachments');
```

### Policy cho phép authenticated user upload (tùy mở rộng)

```sql
CREATE POLICY "auth_upload_attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-attachments');
```

---

## Giới hạn kích thước file

### Giới hạn từ Vercel (không thể thay đổi)

| Tier | Max request body |
|---|---|
| Hobby (Free) | **4.5 MB** |
| Pro | **4.5 MB** (request body) |

File lớn hơn 4.5MB sẽ bị Vercel reject trước khi đến Express.

### Giới hạn từ Supabase Storage

| Tier | Max file size |
|---|---|
| Free | 50 MB per file |
| Pro | 5 GB per file |

> Bottleneck thực tế là Vercel (4.5MB), không phải Supabase.

### Thêm validation kích thước

**Phía backend (multer):**
```js
// server.js
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024, // 4MB — dưới giới hạn Vercel
  }
});
```

**Phía frontend (trước khi submit):**
```ts
// TaskForm.tsx hoặc TaskItem.tsx
if (file && file.size > 4 * 1024 * 1024) {
  alert('File quá lớn. Vui lòng chọn file nhỏ hơn 4MB.');
  return;
}
```

---

## Cấu hình môi trường

### Backend (Vercel project backend)

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
STORAGE_BUCKET=task-attachments
```

### Kiểm tra bucket name khớp

```bash
# Bucket name trong Supabase phải = STORAGE_BUCKET env var
# Sai → upload thành công nhưng delete thất bại (URL parse sai)

# Kiểm tra qua Supabase SQL Editor:
SELECT id, name FROM storage.buckets;
# id và name phải là: "task-attachments"
```

---

## Kiểm thử Storage

### Test upload file qua API

```bash
# Upload file khi tạo task mới
curl -X POST https://<backend-url>.vercel.app/api/tasks \
  -F "title=Test upload" \
  -F "description=Testing storage" \
  -F "file=@/path/to/test-file.pdf"

# Kết quả mong đợi:
# {
#   "id": "uuid...",
#   "title": "Test upload",
#   "attachment_url": "https://xxx.supabase.co/storage/v1/object/public/...",
#   "attachment_name": "test-file.pdf",
#   ...
# }
```

```bash
# Upload file cho task đã có
curl -X POST https://<backend-url>.vercel.app/api/tasks/{task_id}/attachment \
  -F "file=@/path/to/another-file.png"
```

### Test download file

```bash
# Lấy attachment_url từ task, truy cập trực tiếp
curl -I "https://xxx.supabase.co/storage/v1/object/public/task-attachments/..."
# HTTP/2 200 — Content-Type: application/pdf (hoặc loại file tương ứng)
```

### Test xóa file

```bash
curl -X DELETE https://<backend-url>.vercel.app/api/tasks/{task_id}/attachment

# Kết quả mong đợi:
# { "id": "...", "attachment_url": null, "attachment_name": null, ... }
```

### Kiểm tra Storage trong Supabase Dashboard

1. Supabase Dashboard → **Storage** → bucket `task-attachments`
2. Xem danh sách thư mục theo `task_id`
3. Click vào file để xem preview và download URL

### Kiểm tra file còn tồn tại sau khi xóa

```sql
-- Trong Supabase SQL Editor
SELECT name, bucket_id, created_at
FROM storage.objects
WHERE bucket_id = 'task-attachments'
ORDER BY created_at DESC
LIMIT 20;
```

---

## Troubleshooting thường gặp

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| `Bucket not found` | Bucket chưa tạo hoặc tên sai | Tạo bucket `task-attachments` trong Dashboard |
| `attachment_url` = null sau upload | Upload Storage lỗi (bị bỏ qua trong code) | Kiểm tra Vercel Function Logs, kiểm tra `SERVICE_ROLE_KEY` |
| Download URL trả về `403 Forbidden` | Bucket không phải public | Vào Dashboard → Storage → Edit bucket → bật Public |
| Tên file hiển thị bị lỗi ký tự | Encoding chưa fix đúng | Kiểm tra `Buffer.from(..., 'latin1').toString('utf8')` |
| `Không thể xác định đường dẫn lưu trữ` | `STORAGE_BUCKET` env var sai | Đối chiếu env var với tên bucket thực tế |
| Upload lỗi `413 Payload Too Large` | File > 4.5MB (Vercel limit) | Thêm validation kích thước ở frontend |
| File cũ không bị xóa khi upload mới | Thiết kế hiện tại — chỉ ghi đè DB | Cần xóa file cũ thủ công trong Storage Dashboard hoặc thêm logic xóa |
| Storage đầy (Supabase Free: 1GB) | Nhiều file không còn tham chiếu | Dọn dẹp orphaned files (file không có task tương ứng) |

### Script dọn dẹp orphaned files

```sql
-- Tìm file trong Storage không có task tương ứng
SELECT o.name AS storage_path
FROM storage.objects o
WHERE o.bucket_id = 'task-attachments'
AND NOT EXISTS (
  SELECT 1 FROM tasks t
  WHERE t.attachment_url LIKE '%' || o.name
);
```

Xem thêm: [TROUBLESHOOTING_DEPLOY.md](./TROUBLESHOOTING_DEPLOY.md) — phần **SUPABASE Configuration Issues**.
