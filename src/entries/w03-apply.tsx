import { mount, startRound } from './boot'
import { buildW03Round } from '../workflows/w03'
import { W03ApplyPage } from '../pages/w03/ApplyPage'

startRound('w03', { build: buildW03Round })
mount(<W03ApplyPage />)
