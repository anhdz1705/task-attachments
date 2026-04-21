# Hướng dẫn Chức năng Chat Real-time

> Project: **task-attachments** | Cập nhật: 2026-04-21

---

## Mục lục

- [Tổng quan kiến trúc](#tổng-quan-kiến-trúc)
- [Cách hoạt động chi tiết](#cách-hoạt-động-chi-tiết)
  - [Khởi tạo kết nối](#1-khởi-tạo-kết-nối)
  - [Gửi tin nhắn](#2-gửi-tin-nhắn)
  - [Nhận tin nhắn](#3-nhận-tin-nhắn)
  - [Presence — theo dõi người online](#4-presence--theo-dõi-người-online)
- [Yêu cầu cấu hình](#yêu-cầu-cấu-hình)
- [Điểm giới hạn hiện tại](#điểm-giới-hạn-hiện-tại)
- [Nâng cấp: Lưu lịch sử tin nhắn vào DB](#nâng-cấp-lưu-lịch-sử-tin-nhắn-vào-db)
- [Kiểm thử chức năng chat](#kiểm-thử-chức-năng-chat)

---

## Tổng quan kiến trúc

Chat trong project này dùng **Supabase Realtime Broadcast** — chế độ truyền tin nhắn trực tiếp giữa các client mà **không đi qua backend Express và không lưu vào database**.

```
┌─────────────┐     broadcast      ┌──────────────────┐     broadcast      ┌─────────────┐
│  Browser A  │ ─────────────────→ │  Supabase        │ ─────────────────→ │  Browser B  │
│  ChatBox    │                    │  Realtime Server  │                    │  ChatBox    │
│             │ ←───────────────── │  channel:        │ ←───────────────── │             │
└─────────────┘                    │  "chat:public"   │                    └─────────────┘
                                   └──────────────────┘
                                          ↑
                              ❌ Backend Express KHÔNG tham gia
                              ❌ Bảng messages KHÔNG được ghi
```

**Các công nghệ sử dụng:**

| Thành phần | Công nghệ |
|---|---|
| Real-time transport | Supabase Realtime — Broadcast mode |
| Online presence | Supabase Realtime — Presence mode |
| Lưu nickname | `localStorage` |
| Không có | REST API backend, DB persistence |

---

## Cách hoạt động chi tiết

### 1. Khởi tạo kết nối

```ts
// frontend/src/components/ChatBox.tsx

const supabase = getSupabase(); // dùng VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY

const channel = supabase.channel('chat:public', {
  config: { presence: { key: userName } }, // key presence = tên người dùng
});
```

- Kênh `chat:public` là kênh **chung duy nhất** — mọi user kết nối vào cùng kênh này.
- Kết nối được thiết lập qua **WebSocket** (wss://).
- Channel được tạo lại mỗi khi `userName` thay đổi.

---

### 2. Gửi tin nhắn

```ts
const msg: BroadcastMessage = {
  id: crypto.randomUUID(),       // ID duy nhất tạo tại client
  user_name: userName,
  content: newMessage.trim(),
  created_at: new Date().toISOString(),
};

// Hiển thị ngay trên UI (optimistic update)
setMessages(prev => [...prev, msg]);

// Broadcast đến tất cả subscriber cùng channel
await channelRef.current.send({
  type: 'broadcast',
  event: 'message',
  payload: msg,
});
```

**Optimistic update:** Tin nhắn được thêm vào UI ngay lập tức, không cần chờ server phản hồi → trải nghiệm mượt mà hơn.

---

### 3. Nhận tin nhắn

```ts
channel.on('broadcast', { event: 'message' }, ({ payload }) => {
  setMessages(prev => [...prev, payload]);
});
```

- Chỉ nhận tin nhắn từ **người khác** (tin nhắn của chính mình đã được thêm qua optimistic update).
- Nếu cùng một người gửi từ 2 tab khác nhau, cả 2 tab sẽ thấy.

---

### 4. Presence — theo dõi người online

```ts
// Đăng ký presence sau khi subscribe thành công
.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    await channel.track({ online_at: new Date().toISOString() });
  }
});

// Đồng bộ danh sách online
channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState<{ online_at: string }>();
  setOnlineUsers(Object.keys(state)); // key = userName
});
```

- `channel.track()` thông báo user đang online.
- Khi user đóng tab, Supabase tự động xóa khỏi presence state.
- `Object.keys(state)` trả về mảng các `key` — ở đây là `userName`.

---

## Yêu cầu cấu hình

### Biến môi trường (frontend Vercel project)

```
VITE_SUPABASE_URL      = https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> Không cần backend env vars, không cần bảng DB để chat hoạt động.

### Supabase Dashboard

1. **Realtime phải được bật:**
   - Supabase Dashboard → **Project Settings** → **API**
   - Mục **Realtime** → đảm bảo **Enabled**

2. **Không cần bật Realtime cho bảng cụ thể** vì Broadcast mode không dùng Postgres Changes — hoạt động độc lập với DB.

3. **Kiểm tra Realtime connection:**
   - Supabase Dashboard → **Realtime** → **Inspector**
   - Tại đây có thể xem channel `chat:public` đang có bao nhiêu subscriber

---

## Điểm giới hạn hiện tại

| Giới hạn | Chi tiết |
|---|---|
| **Không lưu lịch sử** | Refresh trang → mất toàn bộ tin nhắn |
| **Không load tin cũ** | User mới join không thấy tin nhắn trước đó |
| **Giới hạn Supabase Broadcast** | Hobby tier: 200 concurrent connections, 10 messages/giây |
| **Nickname không xác thực** | Bất kỳ ai cũng có thể dùng tên bất kỳ |
| **Không có moderation** | Không có chức năng xóa/báo cáo tin nhắn |
| **Backend /api/messages không được dùng** | Endpoint tồn tại nhưng ChatBox không gọi |

---

## Nâng cấp: Lưu lịch sử tin nhắn vào DB

Nếu cần lưu lịch sử chat, cần thay đổi kiến trúc theo 2 hướng:

### Hướng A — Gọi backend khi gửi tin (đơn giản)

Thêm vào `handleSendMessage` trong `ChatBox.tsx`:

```ts
const handleSendMessage = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!newMessage.trim() || !userName || !channelRef.current) return;

  const msg: BroadcastMessage = {
    id: crypto.randomUUID(),
    user_name: userName,
    content: newMessage.trim(),
    created_at: new Date().toISOString(),
  };

  setNewMessage('');
  setMessages(prev => [...prev, msg]);

  // 1. Lưu vào DB qua backend
  await apiFetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_name: userName, content: msg.content }),
  });

  // 2. Broadcast realtime như cũ
  await channelRef.current.send({
    type: 'broadcast',
    event: 'message',
    payload: msg,
  });
};
```

Thêm load lịch sử khi join:

```ts
useEffect(() => {
  if (!userName) return;

  // Load 50 tin nhắn gần nhất
  apiFetch('/api/messages')
    .then(r => r.json())
    .then(data => setMessages(data));

  // ... phần còn lại setup channel như cũ
}, [userName]);
```

### Hướng B — Dùng Supabase Postgres Changes (không cần backend)

Thay `broadcast` bằng `postgres_changes`, ghi trực tiếp vào Supabase từ frontend dùng `ANON_KEY` (cần cấu hình RLS phù hợp):

```ts
// Gửi: insert vào bảng messages
const { error } = await supabase
  .from('messages')
  .insert({ user_name: userName, content: newMessage });

// Nhận: subscribe postgres_changes
channel.on(
  'postgres_changes',
  { event: 'INSERT', schema: 'public', table: 'messages' },
  (payload) => setMessages(prev => [...prev, payload.new])
);
```

**So sánh 2 hướng:**

| | Hướng A (Backend API) | Hướng B (Postgres Changes) |
|---|---|---|
| Lưu DB | ✅ Qua backend | ✅ Trực tiếp |
| Bảo mật | ✅ Tốt hơn | ⚠️ Cần cấu hình RLS |
| Độ trễ | ~50-100ms thêm | Tương đương |
| Dùng backend đã có | ✅ Tận dụng `/api/messages` | ❌ Bypass backend |
| Phù hợp project này | ✅ **Khuyến nghị** | Cần thêm RLS |

---

## Kiểm thử chức năng chat

### Test cơ bản (manual)

```
1. Mở app trên 2 tab khác nhau
2. Tab 1: nhập tên "Alice" → bắt đầu chat
3. Tab 2: nhập tên "Bob" → bắt đầu chat
4. Kiểm tra:
   □ Cả 2 tab đều hiện "2 Online"
   □ Alice gửi tin → Bob nhận ngay (không cần refresh)
   □ Bob gửi tin → Alice nhận ngay
   □ Tin nhắn của mình hiển thị bên phải (màu brand)
   □ Tin nhắn người khác hiển thị bên trái (màu xám)
5. Đóng tab Bob → Tab Alice còn "1 Online"
6. Refresh Tab Alice → messages rỗng (đúng với thiết kế Broadcast)
```

### Test giới hạn

```
□ Nickname = tên trùng với người khác → presence key bị override (đã biết)
□ Gửi tin nhắn dài > 1000 ký tự → không có validation phía client
□ Mở > 10 tab cùng lúc → tất cả đều nhận tin (Broadcast to all)
```

### Kiểm tra realtime connection qua Supabase Inspector

1. Supabase Dashboard → **Realtime** → **Inspector**
2. Subscribe vào channel `chat:public`
3. Gửi tin từ app → kiểm tra event xuất hiện trong Inspector
4. Broadcast từ Inspector → kiểm tra app nhận được không
