import { mount, startRound } from './boot'
import { buildW01Round } from '../workflows/w01'
import { W01SourcePage } from '../pages/w01/SourcePage'

startRound('w01', { fresh: true, build: buildW01Round })
mount(<W01SourcePage />)
