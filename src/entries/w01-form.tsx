import { mount, startRound } from './boot'
import { buildW01Round } from '../workflows/w01'
import { W01FormPage } from '../pages/w01/FormPage'

startRound('w01', { build: buildW01Round })
mount(<W01FormPage />)
