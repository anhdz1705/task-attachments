# Backend Unit Tests

**Framework:** Vitest v3  
**Environment:** Node  
**Cấu hình:** [`backend/vitest.config.js`](../../backend/vitest.config.js)  
**Chạy:** `npm test` (trong thư mục `backend/`)

---

## Cấu trúc

```
backend/
├── vitest.config.js
└── src/
    └── __tests__/
        ├── setup.js                  # Global setup (suppress console.error)
        ├── taskController.test.js    # 8 tests
        └── chatController.test.js    # 5 tests
```

---

## Chiến lược mock

Supabase Admin Client được mock hoàn toàn qua `vi.mock('../lib/supabase.js')`. Mỗi test dựng một **thenable chain** giả lập chuỗi query builder của Supabase (`from().select().order()...`). Chain này resolve về `{ data, error }` tuỳ kịch bản.

```js
// Tạo chain mock — mọi method trả về chính nó, await chain → result
function makeChain(result) { ... }
function makeClient(result) {
  return { from: vi.fn().mockReturnValue(makeChain(result)) };
}
```

`req` và `res` Express được mock tối giản:

```js
const mockRes = () => {
  const res = { json: vi.fn(), status: vi.fn() };
  res.status.mockReturnValue(res); // cho phép chaining res.status(400).json(...)
  return res;
};
```

---

## taskController — 8 tests

**File:** [`src/__tests__/taskController.test.js`](../../backend/src/__tests__/taskController.test.js)

| # | Describe | Test case | Kết quả mong đợi |
|---|----------|-----------|-----------------|
| 1 | `listTasks` | thành công | `res.json(tasks)` |
| 2 | `listTasks` | DB lỗi | `res.status(500).json({ error })` |
| 3 | `createTask` | thiếu `title` | `res.status(400).json({ error: 'Title is required' })` |
| 4 | `createTask` | có `title`, không file | `res.status(201).json(task)` |
| 5 | `updateTaskStatus` | status không hợp lệ | `res.status(400).json({ error: 'Invalid status' })` |
| 6 | `updateTaskStatus` | status = `open` | `res.json(updatedTask)` |
| 7 | `updateTaskStatus` | status = `in_progress` | `res.json(updatedTask)` |
| 8 | `updateTaskStatus` | status = `done` | `res.json(updatedTask)` |

> Tests 6–8 dùng `it.each(['open', 'in_progress', 'done'])` để tránh lặp code.

---

## chatController — 5 tests

**File:** [`src/__tests__/chatController.test.js`](../../backend/src/__tests__/chatController.test.js)

| # | Describe | Test case | Kết quả mong đợi |
|---|----------|-----------|-----------------|
| 1 | `sendMessage` | thiếu `user_name` | `res.status(400).json({ error: 'User name and content are required' })` |
| 2 | `sendMessage` | thiếu `content` | `res.status(400).json({ error: 'User name and content are required' })` |
| 3 | `sendMessage` | đủ dữ liệu | `res.status(201).json(message)` |
| 4 | `listMessages` | có dữ liệu | trả về mảng theo thứ tự tăng dần (reverse từ DB) |
| 5 | `listMessages` | DB trả `null` | `res.json([])` |

---

## Setup file

**File:** [`src/__tests__/setup.js`](../../backend/src/__tests__/setup.js)

```js
vi.spyOn(console, 'error').mockImplementation(() => {});
```

Suppress `console.error` trong toàn bộ test run để output sạch. Các error-path test vẫn pass bình thường vì mock chỉ ngăn in ra terminal, không ảnh hưởng logic.

---

## Chạy test

```bash
# Một lần (dùng trong CI)
npm test

# Watch mode (dùng khi dev)
npm run test:watch
```

**Kết quả hiện tại:** 13/13 tests passed ✓
