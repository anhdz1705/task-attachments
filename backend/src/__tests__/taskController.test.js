import { listTasks, createTask, updateTaskStatus } from '../controllers/taskController.js';
import { getSupabaseAdmin } from '../lib/supabase.js';

vi.mock('../lib/supabase.js', () => ({
  getSupabaseAdmin: vi.fn(),
  STORAGE_BUCKET: 'task-attachments',
}));

// Thenable chain — every method returns itself so chaining works;
// awaiting the chain resolves to `result`
function makeChain(result) {
  const chain = {
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected) => Promise.resolve(result).catch(onRejected),
    finally: (fn) => Promise.resolve(result).finally(fn),
  };
  ['select', 'insert', 'update', 'eq', 'order', 'limit', 'single'].forEach(
    (m) => (chain[m] = vi.fn().mockReturnValue(chain)),
  );
  return chain;
}

function makeClient(result) {
  const chain = makeChain(result);
  return { from: vi.fn().mockReturnValue(chain) };
}

function mockRes() {
  const res = { json: vi.fn(), status: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

const mockReq = (overrides = {}) => ({
  body: {},
  params: {},
  file: null,
  ...overrides,
});

// ─── listTasks ────────────────────────────────────────────────────────────────

describe('listTasks', () => {
  it('responds 200 with task array on success', async () => {
    const tasks = [{ id: '1', title: 'Test', status: 'open' }];
    getSupabaseAdmin.mockReturnValue(makeClient({ data: tasks, error: null }));

    const req = mockReq();
    const res = mockRes();

    await listTasks(req, res);

    expect(res.json).toHaveBeenCalledWith(tasks);
  });

  it('responds 500 on DB error', async () => {
    getSupabaseAdmin.mockReturnValue(makeClient({ data: null, error: new Error('DB failure') }));

    const req = mockReq();
    const res = mockRes();

    await listTasks(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'DB failure' });
  });
});

// ─── createTask ───────────────────────────────────────────────────────────────

describe('createTask', () => {
  it('responds 400 when title is missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();

    await createTask(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Title is required' });
  });

  it('responds 201 with created task when title is provided', async () => {
    const task = { id: 'abc', title: 'New task', status: 'open' };
    getSupabaseAdmin.mockReturnValue(makeClient({ data: task, error: null }));

    const req = mockReq({ body: { title: 'New task' }, file: null });
    const res = mockRes();

    await createTask(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(task);
  });
});

// ─── updateTaskStatus ─────────────────────────────────────────────────────────

describe('updateTaskStatus', () => {
  it('responds 400 for an invalid status', async () => {
    const req = mockReq({ params: { id: '1' }, body: { status: 'unknown' } });
    const res = mockRes();

    await updateTaskStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid status' });
  });

  it.each(['open', 'in_progress', 'done'])('responds 200 for valid status "%s"', async (status) => {
    const updated = { id: '1', status };
    getSupabaseAdmin.mockReturnValue(makeClient({ data: updated, error: null }));

    const req = mockReq({ params: { id: '1' }, body: { status } });
    const res = mockRes();

    await updateTaskStatus(req, res);

    expect(res.json).toHaveBeenCalledWith(updated);
  });
});
