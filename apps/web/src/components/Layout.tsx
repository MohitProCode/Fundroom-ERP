import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const groups = [
  { label: 'Commercial', items: [{ to: '/enquiries', label: 'Enquiries', mark: 'EN' }, { to: '/quotations', label: 'Quotations', mark: 'QT' }, { to: '/sales-orders', label: 'Sales orders', mark: 'SO' }, { to: '/dispatches', label: 'Dispatches', mark: 'DS' }] },
  { label: 'Operations', items: [{ to: '/manufacturing', label: 'Manufacturing', mark: 'MO' }, { to: '/inventory', label: 'Inventory stock', mark: 'IV' }] },
  { label: 'Master data', items: [{ to: '/customers', label: 'Customers', mark: 'CU' }, { to: '/products', label: 'Products', mark: 'PR' }] },
];

export default function Layout() {
  const { user, logout } = useAuth(); const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const handleLogout = () => { logout(); navigate('/login'); };
  return <div className="min-h-screen bg-slate-950 text-slate-100 lg:flex">
    <aside className={`${mobileOpen ? 'block' : 'hidden'} fixed inset-y-0 left-0 z-30 w-72 border-r border-slate-800 bg-slate-900 lg:static lg:block`}>
      <div className="flex h-full flex-col px-5 py-5">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-6"><div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400 font-black text-slate-950">S</div><div><p className="font-semibold tracking-tight text-white">Steelwork ERP</p><p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Operations cloud</p></div></div>
        <div className="mt-6 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-widest text-cyan-300">Active plant</p><p className="mt-1 text-sm font-medium text-slate-100">Pune Works <span className="text-slate-500">/ Plant 4</span></p></div><span className="text-xs text-cyan-300">v1</span></div></div>
        <nav className="mt-7 flex-1 space-y-7">{groups.map((group) => <div key={group.label}><p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{group.label}</p><div className="space-y-1">{group.items.map((item) => <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${isActive ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-950/40' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}><span className="grid h-7 w-7 place-items-center rounded-md border border-current/20 text-[9px] font-bold tracking-tight opacity-80">{item.mark}</span><span className="flex-1">{item.label}</span><span className="text-xs opacity-0 transition group-hover:opacity-100">&gt;</span></NavLink>)}</div></div>)}</nav>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px] shadow-emerald-400/70" /><span className="text-xs font-medium text-slate-300">Operations active</span></div><p className="mt-2 text-[11px] text-slate-500">Last sync just now</p></div>
      </div>
    </aside>
    {mobileOpen && <button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-20 bg-slate-950/70 lg:hidden" />}
    <div className="min-w-0 flex-1"><header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur"><div className="flex h-16 items-center gap-3 px-4 sm:px-7"><button onClick={() => setMobileOpen(true)} className="rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-300 lg:hidden">Menu</button><div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300 sm:flex"><span className="text-cyan-300">PLANT</span><span>Pune Works - Plant 4</span><span className="text-slate-600">v</span></div><div className="relative max-w-xl flex-1"><span className="absolute left-3 top-2.5 text-slate-500">/</span><input aria-label="Global search" placeholder="Search orders, customers, or SKUs..." className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2.5 pl-8 pr-4 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/60" /></div><button className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300 hover:border-cyan-400/50">+</button><button className="relative rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300">!<span className="absolute right-2 top-1 h-1.5 w-1.5 rounded-full bg-rose-400" /></button><div className="hidden text-right sm:block"><p className="text-sm font-medium text-slate-100">{user?.name}</p><p className="text-[11px] text-slate-500">{user?.role === 'ADMIN' ? 'Operations lead' : 'Sales workspace'}</p></div><button onClick={handleLogout} aria-label="Account menu" className="grid h-9 w-9 place-items-center rounded-full bg-cyan-400 font-semibold text-slate-950">{user?.name?.slice(0, 1).toUpperCase() || 'U'}</button></div></header><main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-7 lg:px-9"><Outlet /></main></div>
  </div>;
}
