import { mount, startRound } from './boot'
import { buildW01Round } from '../workflows/w01'
import { W01AuditPage } from '../pages/w01/AuditPage'

startRound('w01', { build: buildW01Round })
mount(<W01AuditPage />)
