import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import * as taskController from './src/controllers/taskController.js';
import * as chatController from './src/controllers/chatController.js';
import * as homeController from './src/controllers/homeController.js';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const upload = multer({ storage: multer.memoryStorage() });

const app = express();

app.use(cors({
  origin: '*',
  credentials: false,
}));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Task Routes
app.get('/', homeController.Home);
app.get('/api/tasks', taskController.listTasks);
app.post('/api/tasks', upload.single('file'), taskController.createTask);
app.patch('/api/tasks/:id/status', taskController.updateTaskStatus);
app.post('/api/tasks/:id/attachment', upload.single('file'), taskController.uploadAttachment);
app.delete('/api/tasks/:id/attachment', taskController.deleteAttachment);

// Chat Routes
app.get('/api/messages', chatController.listMessages);
app.post('/api/messages', chatController.sendMessage);

export default app;

// Chỉ listen khi chạy local
if (process.env.NODE_ENV !== 'production') {
  const port = Number(process.env.PORT || 3001);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
}
