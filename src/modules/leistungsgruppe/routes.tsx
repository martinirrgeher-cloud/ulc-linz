import { Routes, Route } from 'react-router-dom'
import LeistungsgruppeLayout from './index'
import MeineTeilnahme from './pages/MeineTeilnahme'
import Katalog from './pages/Katalog'
import PlanErstellen from './pages/PlanErstellen'
import Uebersicht from './pages/Uebersicht'

export function LeistungsgruppeRoutes() {
  return (
    <Routes>
      <Route element={<LeistungsgruppeLayout />}>
        <Route index element={<MeineTeilnahme />} />
        <Route path="katalog" element={<Katalog />} />
        <Route path="plan" element={<PlanErstellen />} />
        <Route path="uebersicht" element={<Uebersicht />} />
      </Route>
    </Routes>
  )
}
