import { JoinScreen } from './components/JoinScreen'
import { BoardView } from './components/Canvas/BoardView'
import { useVttSocket } from './hooks/useVttSocket'
import { useClientStore } from './store/useClientStore'

export default function App() {
  useVttSocket()

  const joined = useClientStore((state) => state.joined)
  const session = useClientStore((state) => state.session)

  return (
    <div className="h-full w-full bg-[#1a1a1a] text-gray-100">
      {joined && session ? <BoardView /> : <JoinScreen />}
    </div>
  )
}
