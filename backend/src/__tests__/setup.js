// Suppress console.error during tests to keep output clean.
// Tests that assert on error behavior still pass — the mock is transparent.
vi.spyOn(console, 'error').mockImplementation(() => {});
