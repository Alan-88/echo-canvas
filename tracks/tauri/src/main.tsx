import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeRuntimeNetwork } from './utils/runtimeNetwork'

async function bootstrap() {
  try {
    await initializeRuntimeNetwork()
  } catch (error) {
    console.error('应用启动时初始化运行时网络配置失败:', error)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
