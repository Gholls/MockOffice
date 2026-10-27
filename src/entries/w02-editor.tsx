import { mount, startRound } from './boot'
import { buildW02Round } from '../workflows/w02'
import { W02EditorPage } from '../pages/w02/EditorPage'

startRound('w02', { build: buildW02Round })
mount(<W02EditorPage />)
