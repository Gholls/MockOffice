import { mount, startRound } from './boot'
import { buildW02Round } from '../workflows/w02'
import { W02DashboardPage } from '../pages/w02/DashboardPage'

startRound('w02', { fresh: true, build: buildW02Round })
mount(<W02DashboardPage />)
