import AppHeader from '@/components/AppHeader'
import SubMenu from '@/components/SubMenu'
import { Outlet } from 'react-router-dom'

export default function LeistungsgruppeLayout() {
  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader />
      <SubMenu items={[
        { label: 'Meine Teilnahme', path: '/leistungsgruppe' },
        { label: 'Trainingskatalog', path: '/leistungsgruppe/katalog' },
        { label: 'Plan erstellen', path: '/leistungsgruppe/plan' },
        { label: 'Übersicht', path: '/leistungsgruppe/uebersicht' },
      ]} />
      <main className="container-mobile py-4 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
