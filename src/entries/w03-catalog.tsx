import { mount, startRound } from './boot'
import { buildW03Round } from '../workflows/w03'
import { W03CatalogPage } from '../pages/w03/CatalogPage'

startRound('w03', { build: buildW03Round })
mount(<W03CatalogPage />)
