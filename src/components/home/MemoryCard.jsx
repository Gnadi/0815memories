import { useAuth } from '../../context/AuthContext'
import MemoryCardModern from './MemoryCardModern'
import MemoryCardClassic from './MemoryCardClassic'

export default function MemoryCard(props) {
  const { memoryCardStyle } = useAuth()
  if (memoryCardStyle === 'classic') {
    return <MemoryCardClassic {...props} />
  }
  return <MemoryCardModern {...props} />
}
