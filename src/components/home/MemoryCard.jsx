import { useAuth } from '../../context/AuthContext'
import MemoryCardModern from './MemoryCardModern'
import MemoryCardClassic from './MemoryCardClassic'
import MemoryCardPolaroid from './MemoryCardPolaroid'

export default function MemoryCard(props) {
  const { memoryCardStyle } = useAuth()
  if (memoryCardStyle === 'classic') {
    return <MemoryCardClassic {...props} />
  }
  if (memoryCardStyle === 'polaroid') {
    return <MemoryCardPolaroid {...props} />
  }
  return <MemoryCardModern {...props} />
}
