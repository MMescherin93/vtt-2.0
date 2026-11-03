import { useHostBridge } from './hooks/useHostBridge'
import { BoardView } from './components/BoardView'
import { SessionManagerScreen } from './components/SessionManager/SessionManagerScreen'
import { useHostStore } from './store/useHostStore'

export default function App() {
  useHostBridge()

  const session = useHostStore((state) => state.session)
  const screen = useHostStore((state) => state.screen)

  return (
    <div className="h-full w-full bg-[#1a1a1a] text-gray-100">
      {screen === 'table' && session ? <BoardView /> : <SessionManagerScreen />}
    </div>
  )
}
