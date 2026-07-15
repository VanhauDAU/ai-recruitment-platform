import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// QueryClient mới cho mỗi test: không retry, không cache chéo giữa các test.
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

export function withQueryClient(children, client = createTestQueryClient()) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
