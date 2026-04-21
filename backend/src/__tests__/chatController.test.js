import { listMessages, sendMessage } from '../controllers/chatController.js';
import { getSupabaseAdmin } from '../lib/supabase.js';

vi.mock('../lib/supabase.js', () => ({
  getSupabaseAdmin: vi.fn(),
}));

function makeChain(result) {
  const chain = {
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected) => Promise.resolve(result).catch(onRejected),
    finally: (fn) => Promise.resolve(result).finally(fn),
  };
  ['select', 'insert', 'order', 'limit', 'single'].forEach(
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

const mockReq = (overrides = {}) => ({ body: {}, ...overrides });

// ─── sendMessage ──────────────────────────────────────────────────────────────

describe('sendMessage', () => {
  it('responds 400 when user_name is missing', async () => {
    const req = mockReq({ body: { content: 'Hello' } });
    const res = mockRes();

    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'User name and content are required' });
  });

  it('responds 400 when content is missing', async () => {
    const req = mockReq({ body: { user_name: 'Alice' } });
    const res = mockRes();

    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'User name and content are required' });
  });

  it('responds 201 with created message on success', async () => {
    const message = { id: 'm1', user_name: 'Alice', content: 'Hello', created_at: '2026-01-01' };
    getSupabaseAdmin.mockReturnValue(makeClient({ data: message, error: null }));

    const req = mockReq({ body: { user_name: 'Alice', content: 'Hello' } });
    const res = mockRes();

    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(message);
  });
});

// ─── listMessages ─────────────────────────────────────────────────────────────

describe('listMessages', () => {
  it('returns messages in chronological order (reversed from DB)', async () => {
    const dbOrder = [
      { id: 'm3', created_at: '2026-01-03' },
      { id: 'm2', created_at: '2026-01-02' },
      { id: 'm1', created_at: '2026-01-01' },
    ];
    getSupabaseAdmin.mockReturnValue(makeClient({ data: dbOrder, error: null }));

    const req = mockReq();
    const res = mockRes();

    await listMessages(req, res);

    expect(res.json).toHaveBeenCalledWith([
      { id: 'm1', created_at: '2026-01-01' },
      { id: 'm2', created_at: '2026-01-02' },
      { id: 'm3', created_at: '2026-01-03' },
    ]);
  });

  it('returns empty array when no messages', async () => {
    getSupabaseAdmin.mockReturnValue(makeClient({ data: null, error: null }));

    const req = mockReq();
    const res = mockRes();

    await listMessages(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });
});
