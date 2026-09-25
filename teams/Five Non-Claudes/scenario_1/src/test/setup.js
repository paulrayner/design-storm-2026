import '@testing-library/jest-dom'

// jsdom has no ResizeObserver; Recharts' ResponsiveContainer needs one. Provide a
// no-op so chart components can mount under test.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver || ResizeObserverStub
