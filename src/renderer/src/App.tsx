import { useEffect } from 'react'
import Sidebar from './components/Sidebar'
import RequestPanel from './components/RequestPanel'
import ResponsePanel from './components/ResponsePanel'
import { useRequestStore } from './stores/requestStore'

function App(): JSX.Element {
  const sendRequest = useRequestStore((s) => s.sendRequest)
  const activeUrl = useRequestStore((s) => s.activeRequest.url)
  const loading = useRequestStore((s) => s.loading)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && activeUrl.trim() && !loading) {
        e.preventDefault()
        sendRequest()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sendRequest, activeUrl, loading])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-900 text-slate-200">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Request Panel - top half */}
        <div className="h-1/2 border-b border-slate-700 flex flex-col overflow-hidden">
          <RequestPanel />
        </div>

        {/* Response Panel - bottom half */}
        <div className="h-1/2 flex flex-col overflow-hidden">
          <ResponsePanel />
        </div>
      </main>
    </div>
  )
}

export default App
