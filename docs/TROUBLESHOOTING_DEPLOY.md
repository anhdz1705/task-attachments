# Troubleshooting — Deploy lên Vercel qua GitHub

> Project: **task-attachments** | Stack: Express (Node ESM) + React/Vite + Supabase  
> Cập nhật: 2026-04-21

---

## Mục lục

- [BACKEND Issues](#backend-issues)
  - [B1. Biến môi trường runtime bị thiếu](#b1-biến-môi-trường-runtime-bị-thiếu)
  - [B2. CORS block toàn bộ request từ frontend](#b2-cors-block-toàn-bộ-request-từ-frontend)
  - [B3. dotenv không load được .env file](#b3-dotenv-không-load-được-env-file)
  - [B4. Serverless function timeout / payload limit](#b4-serverless-function-timeout--payload-limit)
  - [B5. ESM + @vercel/node không tương thích](#b5-esm--vercelnode-không-tương-thích)
  - [B6. File upload mất dữ liệu (multer memoryStorage)](#b6-file-upload-mất-dữ-liệu-multer-memorystorage)
  - [B7. Delete attachment lỗi parse storage path](#b7-delete-attachment-lỗi-parse-storage-path)
- [FRONTEND Issues](#frontend-issues)
  - [F1. VITE_API_BASE_URL rỗng → API gọi sai domain](#f1-vite_api_base_url-rỗng--api-gọi-sai-domain)
  - [F2. VITE_* env vars không có hiệu lực sau khi set](#f2-vite_-env-vars-không-có-hiệu-lực-sau-khi-set)
  - [F3. SPA reload 404 (client-side routing)](#f3-spa-reload-404-client-side-routing)
  - [F4. TypeScript build lỗi → deploy thất bại](#f4-typescript-build-lỗi--deploy-thất-bại)
  - [F5. Realtime Supabase không hoạt động](#f5-realtime-supabase-không-hoạt-động)
  - [F6. File upload > 4.5MB bị reject](#f6-file-upload--45mb-bị-reject)
- [SUPABASE Configuration Issues](#supabase-configuration-issues)
  - [S1. RLS (Row Level Security) block query](#s1-rls-row-level-security-block-query)
  - [S2. Storage bucket chưa tạo hoặc sai tên](#s2-storage-bucket-chưa-tạo-hoặc-sai-tên)
  - [S3. Storage bucket không public → publicUrl trả về 403](#s3-storage-bucket-không-public--publicurl-trả-về-403)
  - [S4. Service Role Key bị thiếu → upload/delete lỗi](#s4-service-role-key-bị-thiếu--uploaddelete-lỗi)
  - [S5. Realtime chưa được bật cho bảng tasks](#s5-realtime-chưa-được-bật-cho-bảng-tasks)
  - [S6. Schema bảng không khớp với code](#s6-schema-bảng-không-khớp-với-code)
  - [S7. ANON KEY bị dùng nhầm thay SERVICE_ROLE_KEY](#s7-anon-key-bị-dùng-nhầm-thay-service_role_key)
- [CACHE & REBUILD Issues](#cache--rebuild-issues)
  - [C1. Env vars đã set đúng nhưng vẫn còn lỗi cũ](#c1-env-vars-đã-set-đúng-nhưng-vẫn-còn-lỗi-cũ)
  - [C2. Redeploy without cache từ Dashboard](#c2-redeploy-without-cache-từ-dashboard)
  - [C3. Force deploy qua Vercel CLI](#c3-force-deploy-qua-vercel-cli)
  - [C4. Xoá cache qua Vercel API](#c4-xoá-cache-qua-vercel-api)
- [CHAT Issues](#chat-issues)
  - [CH1. Kiến trúc chat hiện tại — Tin nhắn KHÔNG được lưu DB](#ch1-kiến-trúc-chat-hiện-tại--tin-nhắn-không-được-lưu-db)
  - [CH2. Chat không hoạt động sau deploy](#ch2-chat-không-hoạt-động-sau-deploy)
  - [CH3. Không thấy người dùng online](#ch3-không-thấy-người-dùng-online)
  - [CH4. Backend /api/messages không được dùng](#ch4-backend-apimessages-không-được-dùng)

---

## BACKEND Issues

### B1. Biến môi trường runtime bị thiếu

**Triệu chứng:**
```
Error: SUPABASE_URL and SUPABASE_ANON_KEY must be provided
```
Hoặc mọi request API trả về `500 Internal Server Error`.

**Nguyên nhân:**  
Vercel không tự đọc file `.env`. Các biến phải được khai báo trực tiếp trong Vercel Dashboard.

**Biến bắt buộc cho Backend project:**

| Biến | Lấy từ đâu |
|---|---|
| `SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → API → anon / public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → API → service_role key (secret) |
| `FRONTEND_URL` | URL của Vercel frontend deployment |
| `STORAGE_BUCKET` | Tên bucket đã tạo trong Supabase Storage (default: `task-attachments`) |

**Xử lý:**
1. Vercel Dashboard → chọn project **backend** → **Settings** → **Environment Variables**
2. Thêm từng biến, chọn Environment: `Production`, `Preview`, `Development`
3. Click **Save** → vào **Deployments** → **Redeploy**

**Kiểm tra sau khi fix:**
```
curl https://<backend-url>.vercel.app/api/health
# Kết quả đúng: {"ok":true}
```

---

### B2. CORS block toàn bộ request từ frontend

**Triệu chứng:**  
Browser console:
```
Access to fetch at 'https://backend.vercel.app/api/tasks' from origin 
'https://frontend.vercel.app' has been blocked by CORS policy
```

**Nguyên nhân:**  
`server.js` đọc `FRONTEND_URL` để whitelist origin. Sau deploy, URL của Vercel frontend khác `localhost:5173`.

```js
// server.js
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());
```

**Xử lý:**  
Set biến `FRONTEND_URL` trong backend Vercel project:
```
# Production domain cố định
FRONTEND_URL=https://task-attachments.vercel.app

# Nếu muốn cho phép cả Preview deployments (nhiều domain):
FRONTEND_URL=https://task-attachments.vercel.app,https://task-attachments-git-main-xxx.vercel.app
```

> **Lưu ý:** Domain phải khớp chính xác, không có dấu `/` cuối.

---

### B3. dotenv không load được .env file

**Triệu chứng:**  
Local chạy được, nhưng deploy lên Vercel thì biến môi trường trống.

**Nguyên nhân:**  
`server.js` resolve path:
```js
dotenv.config({ path: path.join(__dirname, '../.env') });
```
Trong môi trường Vercel serverless, path tương đối này không tồn tại. Tuy nhiên `dotenv` fail silently (không crash) — chỉ đơn giản là không load được gì.

**Xử lý:**  
Vercel inject env vars trực tiếp vào `process.env` — không cần `.env` file trên production. Đảm bảo tất cả biến đã được khai báo trong Vercel Dashboard (xem [B1](#b1-biến-môi-trường-runtime-bị-thiếu)).

File `.env` chỉ cần tồn tại ở local development, không cần commit lên GitHub.

---

### B4. Serverless function timeout / payload limit

**Triệu chứng:**  
- Upload file lớn bị lỗi `413 Payload Too Large`
- Hoặc request bị cắt với `504 Gateway Timeout`

**Giới hạn Vercel:**

| Tier | Max payload | Function timeout |
|---|---|---|
| Hobby (Free) | 4.5 MB | 10 giây |
| Pro | 4.5 MB body / 250 MB response | 60 giây |

**Xử lý:**  
Thêm validation kích thước file ở backend trước khi xử lý:
```js
// Thêm vào taskController.js - createTask và uploadAttachment
if (file && file.size > 4 * 1024 * 1024) {
  return res.status(413).json({ error: 'File quá lớn. Tối đa 4MB.' });
}
```

Hoặc cấu hình limit trong multer:
```js
// server.js
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 } // 4MB
});
```

---

### B5. ESM + @vercel/node không tương thích

**Triệu chứng:**  
Build log trên Vercel báo lỗi liên quan đến `import`/`export` hoặc `require is not defined`.

**Nguyên nhân:**  
Backend dùng `"type": "module"` trong `package.json` (ESM). Một số phiên bản cũ của `@vercel/node` không hỗ trợ tốt ESM.

**Xử lý:**  
Kiểm tra `vercel.json` của backend đang đúng:
```json
{
  "builds": [{ "src": "server.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "server.js" }]
}
```
`package.json` đã có `"engines": { "node": ">=20" }` — đây là cách khai báo đúng để Vercel dùng Node 20+.

Nếu vẫn lỗi, thử thêm vào `vercel.json`:
```json
{
  "functions": {
    "server.js": { "runtime": "nodejs20.x" }
  }
}
```

---

### B6. File upload mất dữ liệu (multer memoryStorage)

**Triệu chứng:**  
Upload file thành công trên local nhưng trên Vercel file bị mất hoặc corrupt.

**Nguyên nhân:**  
Vercel serverless functions là stateless. `multer({ storage: multer.memoryStorage() })` giữ file trong RAM của function instance — điều này **hoạt động đúng** vì file được xử lý ngay trong cùng request rồi push lên Supabase Storage.

Nếu lỗi thực sự xảy ra, nguyên nhân thường là Supabase Storage (xem [S2](#s2-storage-bucket-chưa-tạo-hoặc-sai-tên), [S3](#s3-storage-bucket-không-public--publicurl-trả-về-403)).

---

### B7. Delete attachment lỗi parse storage path

**Triệu chứng:**
```json
{ "error": "Không thể xác định đường dẫn lưu trữ từ URL" }
```

**Nguyên nhân:**  
`taskController.js` parse storage path từ `attachment_url` bằng cách tìm chuỗi `/<bucket-name>/`:
```js
const bucketInUrl = `/${STORAGE_BUCKET}/`;
const bucketIndex = task.attachment_url.indexOf(bucketInUrl);
```
Nếu biến `STORAGE_BUCKET` trong Vercel khác với bucket thực tế đã dùng khi upload, parse sẽ thất bại.

**Xử lý:**  
Đảm bảo `STORAGE_BUCKET` trong Vercel Dashboard trùng với tên bucket trong Supabase. Kiểm tra:
```
STORAGE_BUCKET=task-attachments   # phải khớp với tên bucket Supabase
```

---

## FRONTEND Issues

### F1. VITE_API_BASE_URL rỗng → API gọi sai domain

**Triệu chứng:**  
Mọi API call trả về `404` hoặc trả về HTML thay vì JSON. Network tab cho thấy request đến `https://frontend.vercel.app/api/tasks` thay vì backend URL.

**Nguyên nhân:**  
```ts
// frontend/src/lib/api.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
```
Khi `VITE_API_BASE_URL` rỗng, `apiFetch('/api/tasks')` sẽ gọi đến chính frontend domain.

**Xử lý:**  
Trong frontend Vercel project → **Settings** → **Environment Variables**:
```
VITE_API_BASE_URL=https://<backend-project-name>.vercel.app
```

> **Quan trọng:** `VITE_*` được nhúng vào bundle lúc **build time**, không phải runtime. Phải set trước khi build và redeploy sau khi thay đổi.

---

### F2. VITE_* env vars không có hiệu lực sau khi set

**Triệu chứng:**  
Đã set biến trong Vercel Dashboard nhưng frontend vẫn dùng giá trị cũ.

**Nguyên nhân:**  
`VITE_*` vars được bake vào JavaScript bundle lúc build. Set sau khi deploy không có hiệu lực ngay.

**Xử lý:**  
Sau khi thêm/sửa `VITE_*` biến trong Vercel Dashboard:
1. Vercel Dashboard → **Deployments**
2. Click vào deployment mới nhất → menu `...` → **Redeploy**
3. Chọn **Redeploy without cache** để chắc chắn

**Biến bắt buộc cho Frontend project:**

| Biến | Giá trị |
|---|---|
| `VITE_API_BASE_URL` | `https://<backend>.vercel.app` |
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

---

### F3. SPA reload 404 (client-side routing)

**Triệu chứng:**  
Truy cập URL trực tiếp hoặc F5 → Vercel trả về `404 NOT_FOUND`.

**Nguyên nhân:**  
React là SPA — tất cả routing xử lý ở client. Vercel cần được báo để forward mọi path về `index.html`.

**Trạng thái hiện tại:** ✅ **Đã xử lý** trong `frontend/vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
Nếu vẫn lỗi, kiểm tra file này có được commit lên GitHub không.

---

### F4. TypeScript build lỗi → deploy thất bại

**Triệu chứng:**  
Vercel build log báo lỗi TypeScript, deployment dừng ở bước `vite build`.

**Nguyên nhân:**  
`vite build` chạy TypeScript compiler — nếu có type errors thì build thất bại.

**Xử lý:**  
Chạy local trước khi push:
```bash
cd frontend
npm run typecheck   # kiểm tra type errors
npm run build       # thử build local
```

Nếu muốn build pass dù có type error (không khuyến khích):
```json
// frontend/tsconfig.json — chỉ dùng tạm thời
{ "compilerOptions": { "noEmit": true, "strict": false } }
```

---

### F5. Realtime Supabase không hoạt động

**Triệu chứng:**  
Task mới tạo ở browser khác không cập nhật real-time. Console warning:
```
Supabase not configured for realtime
```
Hoặc WebSocket connection bị block.

**Nguyên nhân:**  
`useRealtimeTasks.ts` dùng `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` để khởi tạo Supabase client. Nếu thiếu → realtime bị skip (try/catch).

**Xử lý:**
1. Đảm bảo `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` đã set trong frontend Vercel project
2. Kiểm tra Realtime đã được bật trong Supabase (xem [S5](#s5-realtime-chưa-được-bật-cho-bảng-tasks))
3. Kiểm tra Supabase project không bị paused (Hobby tier tự pause sau 1 tuần không dùng)

---

### F6. File upload > 4.5MB bị reject

**Triệu chứng:**  
Upload file lớn → không có phản hồi hoặc lỗi `network error` / `413`.

**Nguyên nhân:**  
Giới hạn Vercel serverless payload là 4.5MB.

**Xử lý:**  
Thêm validation ở frontend trước khi submit:
```tsx
// TaskForm.tsx - trong handleSubmit, trước khi gọi apiFetch
if (file && file.size > 4 * 1024 * 1024) {
  alert('File quá lớn. Vui lòng chọn file nhỏ hơn 4MB.');
  setIsSubmitting(false);
  return;
}
```

---

## SUPABASE Configuration Issues

### S1. RLS (Row Level Security) block query

**Triệu chứng:**
```json
{ "error": "new row violates row-level security policy for table \"tasks\"" }
```
Hoặc query trả về mảng rỗng `[]` dù bảng có dữ liệu.

**Nguyên nhân:**  
Supabase mặc định bật RLS cho mọi bảng. Backend dùng `SERVICE_ROLE_KEY` để bypass RLS — nếu bị nhầm sang `ANON_KEY` thì RLS sẽ chặn.

**Xử lý:**
1. Supabase Dashboard → **Table Editor** → chọn bảng `tasks` / `messages`
2. Kiểm tra mục **Row Level Security** ở thanh bên phải
3. **Phương án A (Đơn giản — dùng cho app nội bộ):** Disable RLS
   - Click **Disable RLS** cho bảng `tasks` và `messages`
4. **Phương án B (Bảo mật hơn):** Giữ RLS, tạo policy cho phép service role:
   ```sql
   -- Trong Supabase SQL Editor
   CREATE POLICY "service_role_full_access" ON tasks
   USING (true)
   WITH CHECK (true);
   ```
5. Xác nhận backend đang dùng đúng `SUPABASE_SERVICE_ROLE_KEY` (xem [S7](#s7-anon-key-bị-dùng-nhầm-thay-service_role_key))

---

### S2. Storage bucket chưa tạo hoặc sai tên

**Triệu chứng:**
```json
{ "error": "Bucket not found" }
```
Upload file thành công (HTTP 201) nhưng `attachment_url` là null.

**Nguyên nhân:**  
Backend dùng bucket name từ `STORAGE_BUCKET` env var (default: `task-attachments`). Bucket phải tồn tại trong Supabase trước khi upload.

**Xử lý:**
1. Supabase Dashboard → **Storage** → **New bucket**
2. Bucket name: `task-attachments` (phải khớp chính xác với `STORAGE_BUCKET` env var)
3. Chọn **Public bucket** (xem [S3](#s3-storage-bucket-không-public--publicurl-trả-về-403))
4. Click **Save**

Kiểm tra tên bucket đang được dùng:
```
# Trong Vercel backend project → Environment Variables
STORAGE_BUCKET=task-attachments   ← phải trùng với tên bucket vừa tạo
```

---

### S3. Storage bucket không public → publicUrl trả về 403

**Triệu chứng:**  
File upload thành công, `attachment_url` có giá trị, nhưng khi truy cập URL → `403 Forbidden`.

**Nguyên nhân:**  
`taskController.js` dùng `getPublicUrl()` để lấy URL công khai. Nếu bucket không phải public, URL này sẽ không truy cập được mà không có token.

```js
const { data: { publicUrl } } = supabaseAdmin.storage
  .from(STORAGE_BUCKET)
  .getPublicUrl(storagePath);
```

**Xử lý:**
1. Supabase Dashboard → **Storage** → click vào bucket `task-attachments`
2. Click icon **...** → **Edit bucket**
3. Bật toggle **Public bucket** → **Save**

Hoặc tạo Storage Policy cho phép public read:
```sql
-- SQL Editor trong Supabase
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'task-attachments');
```

---

### S4. Service Role Key bị thiếu → upload/delete lỗi

**Triệu chứng:**
```json
{ "error": "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be provided" }
```
Chỉ xảy ra ở các endpoint upload/delete file, không xảy ra ở list tasks.

**Nguyên nhân:**  
`getSupabaseAdmin()` yêu cầu `SUPABASE_SERVICE_ROLE_KEY`. Nếu biến này thiếu trong Vercel, các operations cần admin quyền sẽ fail.

**Xử lý:**
1. Supabase Dashboard → **Project Settings** → **API**
2. Copy **service_role** key (key bí mật — không expose ra frontend)
3. Vercel Dashboard → backend project → **Environment Variables**:
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
4. Redeploy

> **Cảnh báo bảo mật:** `SERVICE_ROLE_KEY` bypass toàn bộ RLS. Chỉ dùng ở backend, **tuyệt đối không** set trong frontend project.

---

### S5. Realtime chưa được bật cho bảng tasks

**Triệu chứng:**  
WebSocket kết nối thành công nhưng không nhận được event khi có thay đổi trong DB.

**Nguyên nhân:**  
Supabase Realtime cần được kích hoạt cho từng bảng cụ thể.

**Xử lý:**
1. Supabase Dashboard → **Table Editor** → bảng `tasks`
2. Click **...** → **Edit Table**
3. Cuộn xuống phần **Realtime** → bật toggle **Enable Realtime**
4. Click **Save**

Hoặc qua SQL Editor:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
```

**Kiểm tra Supabase project không bị paused:**
- Hobby tier tự pause sau 1 tuần không có request
- Vào Supabase Dashboard, nếu thấy thông báo "Project is paused" → click **Restore project**

---

### S6. Schema bảng không khớp với code

**Triệu chứng:**  
Task tạo thành công nhưng `attachment_url` hoặc `attachment_name` không được lưu. Hoặc lỗi:
```json
{ "error": "column \"attachment_url\" of relation \"tasks\" does not exist" }
```

**Nguyên nhân:**  
Bảng `tasks` trong Supabase thiếu cột so với những gì code đang dùng.

**Schema bắt buộc cho bảng `tasks`:**
```sql
CREATE TABLE IF NOT EXISTS tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'in_progress', 'done')),
  attachment_url  TEXT,
  attachment_name TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Schema bắt buộc cho bảng `messages`:**
```sql
CREATE TABLE IF NOT EXISTS messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name  TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Kiểm tra schema hiện tại:**
```sql
-- Trong Supabase SQL Editor
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tasks'
ORDER BY ordinal_position;
```

---

### S7. ANON KEY bị dùng nhầm thay SERVICE_ROLE_KEY

**Triệu chứng:**  
- RLS block insert/update/delete dù đã disable
- Storage upload lỗi permission
- Không phân biệt được lỗi từ đâu

**Nguyên nhân:**  
Nhầm lẫn giữa 2 keys trong Supabase Dashboard:

| Key | Quyền | Dùng ở |
|---|---|---|
| `anon` / `public` | Bị RLS kiểm soát | Frontend (`VITE_SUPABASE_ANON_KEY`) |
| `service_role` | Bypass RLS hoàn toàn | Backend (`SUPABASE_SERVICE_ROLE_KEY`) |

**Cách phân biệt:**  
Decode JWT base64 của key (phần giữa 2 dấu `.`):
```js
JSON.parse(atob('eyJhb...'))
// anon key    → { "role": "anon" }
// service key → { "role": "service_role" }
```

**Xử lý:**
1. Supabase Dashboard → **Project Settings** → **API**
2. Đối chiếu từng key với role tương ứng
3. Update đúng biến trong Vercel:
   - Backend: `SUPABASE_SERVICE_ROLE_KEY` = key có `"role": "service_role"`
   - Frontend: `VITE_SUPABASE_ANON_KEY` = key có `"role": "anon"`

---

## CACHE & REBUILD Issues

### C1. Env vars đã set đúng nhưng vẫn còn lỗi cũ

**Triệu chứng:**  
Đã khai báo đầy đủ biến môi trường trong Vercel Dashboard, redeploy, nhưng app vẫn báo lỗi như cũ.

**Nguyên nhân phổ biến:**

| Nguyên nhân | Kiểm tra |
|---|---|
| Deployment đang chạy vẫn là bản cũ (cache) | Xem deployment timestamp trong Dashboard |
| `VITE_*` vars được set **sau** lần build cuối | Vercel không tự rebuild khi chỉ thêm env var |
| Set đúng biến nhưng sai **Environment** | Production / Preview / Development phải khớp |
| Chưa nhấn **Save** trước khi Redeploy | Kiểm tra lại danh sách biến |

**Thứ tự xử lý:**
```
1. Xác nhận biến đã Save → đúng Environment → đúng giá trị
         ↓
2. Redeploy without cache (C2)
         ↓ vẫn lỗi
3. git empty commit + push (C2 - Cách 2)
         ↓ vẫn lỗi
4. vercel --force qua CLI (C3)
         ↓ vẫn lỗi
5. Xem Function Logs để đọc lỗi cụ thể
```

---

### C2. Redeploy without cache từ Dashboard

**Cách 1 — Redeploy từ UI (nhanh nhất):**
1. Vercel Dashboard → chọn project → tab **Deployments**
2. Click vào deployment mới nhất
3. Click nút `...` (3 chấm) góc phải → chọn **Redeploy**
4. **Bỏ tick** ô `Use existing Build Cache` → click **Redeploy**

**Cách 2 — Trigger qua git empty commit:**
```bash
git commit --allow-empty -m "chore: trigger fresh deploy"
git push
```
Vercel tự detect push → build mới hoàn toàn.

> **Lưu ý:** Sau khi thêm/sửa `VITE_*` biến, **bắt buộc** phải redeploy frontend — vì các biến này được bake vào JavaScript bundle lúc build, không phải runtime.

---

### C3. Force deploy qua Vercel CLI

Dùng khi Dashboard redeploy không đủ hoặc muốn kiểm soát rõ ràng hơn.

```bash
# Cài Vercel CLI nếu chưa có
npm i -g vercel

# Đăng nhập
vercel login

# Deploy backend — bỏ qua toàn bộ cache
cd backend
vercel --force

# Deploy frontend — bỏ qua toàn bộ cache
cd ../frontend
vercel --force
```

Flag `--force` bỏ qua build cache và force tạo deployment mới.

**Xem log build realtime:**
```bash
vercel --force --debug
```

---

### C4. Xoá cache qua Vercel API

Dùng khi muốn tự động hoá trong CI/CD pipeline.

```bash
# Project ID: Vercel Dashboard → Settings → General → Project ID
# Token: Vercel Dashboard → Account Settings → Tokens → Create

curl -X POST "https://api.vercel.com/v1/projects/<PROJECT_ID>/cache" \
  -H "Authorization: Bearer <VERCEL_TOKEN>" \
  -H "Content-Type: application/json"
```

**Kiểm tra deployment sau khi rebuild:**
```bash
# Backend health check
curl https://<backend-url>.vercel.app/api/health
# Kết quả đúng: {"ok":true}

# Xem Function Logs để đọc lỗi runtime
# Vercel Dashboard → project backend → tab Functions → chọn function → View Logs
```

---

## CHAT Issues

### CH1. Kiến trúc chat hiện tại — Tin nhắn KHÔNG được lưu DB

> ⚠️ **Đây là thiết kế hiện tại, không phải bug** — cần hiểu rõ trước khi debug.

**Cách ChatBox.tsx thực sự hoạt động:**

```
Frontend A ──broadcast──→ Supabase Realtime ──broadcast──→ Frontend B
                               (channel: chat:public)
                                       ↑
                           KHÔNG đi qua backend Express
                           KHÔNG lưu vào bảng messages
```

`ChatBox.tsx` dùng **Supabase Realtime Broadcast** — channel mode truyền thẳng giữa các client:
- Tin nhắn **chỉ tồn tại trong RAM** của browser đang kết nối
- **Refresh trang / đóng tab → mất toàn bộ lịch sử chat**
- Backend `/api/messages` (`GET /api/messages`, `POST /api/messages`) tồn tại nhưng **không được ChatBox gọi**

**So sánh 2 chế độ:**

| | Broadcast (hiện tại) | Postgres Changes (lưu DB) |
|---|---|---|
| Tin nhắn lưu DB | ❌ Không | ✅ Có |
| Lịch sử sau refresh | ❌ Mất | ✅ Còn |
| Cần bảng DB | ❌ Không | ✅ Có |
| Realtime | ✅ Có | ✅ Có |
| Yêu cầu backend | ❌ Không | ✅ Có (gọi `/api/messages`) |

**Kết luận:** Chat hiện tại hoạt động đúng theo thiết kế Broadcast. Nếu cần lưu lịch sử, cần thay đổi kiến trúc (xem tài liệu `CHAT_REALTIME_GUIDE.md`).

---

### CH2. Chat không hoạt động sau deploy

**Triệu chứng:**
- Vào trang Chat, nhập tên xong nhưng không gửi/nhận được tin nhắn
- Không thấy indicator "Online"
- Console lỗi: `WebSocket connection failed` hoặc `supabase not configured`

**Nguyên nhân và xử lý:**

**A. Thiếu env vars Supabase ở frontend:**
```
# Frontend Vercel project → Environment Variables
VITE_SUPABASE_URL      = https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY = eyJ... (role: anon)
```
Kiểm tra trong `App.tsx`:
```ts
const isConfigured =
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY;
```
Nếu thiếu, app hiển thị banner cảnh báo — chat sẽ không khởi tạo được.

**B. Supabase project bị paused (Hobby tier):**
- Vào [supabase.com](https://supabase.com) → kiểm tra project status
- Nếu thấy "Project is paused" → click **Restore project** → chờ ~2 phút

**C. Realtime bị disabled ở Supabase:**
- Supabase Dashboard → **Project Settings** → **API** → mục **Realtime**
- Đảm bảo Realtime service đang **Enabled**

---

### CH3. Không thấy người dùng online

**Triệu chứng:**  
Indicator "0 Online" dù đang có người dùng trong phòng chat.

**Nguyên nhân:**  
`ChatBox.tsx` dùng Supabase **Presence** để track online users:
```ts
channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState();
  setOnlineUsers(Object.keys(state));
});
```
Presence yêu cầu cùng `channel name` — hiện đang dùng `'chat:public'`.

**Xử lý:**
1. Kiểm tra `VITE_SUPABASE_ANON_KEY` đúng và có quyền Realtime
2. Supabase Dashboard → **Realtime** → **Inspector** → kiểm tra channel `chat:public` có active không
3. Mở 2 tab cùng lúc, đặt 2 tên khác nhau → phải thấy "2 Online"

---

### CH4. Backend /api/messages không được dùng

**Triệu chứng:**  
`GET /api/messages` trả về `[]` dù đã chat nhiều. Bảng `messages` trong Supabase luôn rỗng.

**Nguyên nhân:**  
Đây là **đúng** — `ChatBox.tsx` không gọi backend. Xem [CH1](#ch1-kiến-trúc-chat-hiện-tại--tin-nhắn-không-được-lưu-db).

Backend `chatController.js` với endpoint `/api/messages` là code độc lập, **chưa được tích hợp** vào frontend ChatBox.

**Nếu muốn kích hoạt lưu tin nhắn vào DB:**  
Tham khảo tài liệu `CHAT_REALTIME_GUIDE.md` — phần "Nâng cấp: Lưu lịch sử tin nhắn vào DB".

---

## Checklist Deploy Nhanh

```
BACKEND PROJECT (vercel.com → project backend)
□ Root Directory: backend
□ SUPABASE_URL          = https://xxxx.supabase.co
□ SUPABASE_ANON_KEY     = eyJ... (role: anon)
□ SUPABASE_SERVICE_ROLE_KEY = eyJ... (role: service_role)
□ FRONTEND_URL          = https://<frontend>.vercel.app
□ STORAGE_BUCKET        = task-attachments
□ Test: GET /api/health → {"ok":true}

FRONTEND PROJECT (vercel.com → project frontend)
□ Root Directory: frontend
□ Framework Preset: Vite
□ VITE_API_BASE_URL      = https://<backend>.vercel.app
□ VITE_SUPABASE_URL      = https://xxxx.supabase.co
□ VITE_SUPABASE_ANON_KEY = eyJ... (role: anon)
□ Test: mở app, tạo 1 task, kiểm tra hiển thị

SUPABASE
□ Bảng tasks có đủ cột (id, title, description, status, attachment_url, attachment_name, created_at, updated_at)
□ Bảng messages có đủ cột (id, user_name, content, created_at)
□ Storage bucket "task-attachments" tồn tại và là Public
□ Realtime đã bật cho bảng tasks
□ Project không bị paused

SAU KHI SET ENV VARS
□ Nhấn Save trong Vercel Dashboard
□ Redeploy without cache (bỏ tick "Use existing Build Cache")
□ VITE_* vars: redeploy frontend riêng sau khi thay đổi
□ Kiểm tra GET /api/health → {"ok":true}
□ Kiểm tra Function Logs nếu vẫn còn lỗi
```
