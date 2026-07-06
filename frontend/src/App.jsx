import { ConfigProvider, App as AntApp } from 'antd'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import AppRoutes from './routes/AppRoutes'

const theme = {
  token: {
    colorPrimary: '#00b14f',
    borderRadius: 8,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
}

function App() {
  return (
    <ConfigProvider theme={theme}>
      <AntApp>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  )
}

export default App
