import { NavLink } from 'react-router-dom'

type Item = { label: string; path: string }

export default function SubMenu({ items }: { items: Item[] }) {
  return (
    <nav className="sticky top-[44px] z-10 bg-white border-b border-gray-200">
      <div className="container-mobile flex gap-2 overflow-auto no-scrollbar py-2">
        {items.map(i => (
          <NavLink
            key={i.path}
            to={i.path}
            className={({ isActive }) =>
              `px-3 py-1 rounded-xl border text-sm whitespace-nowrap ${isActive ? 'bg-black text-white border-black' : ''}`
            }
            end
          >
            {i.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
