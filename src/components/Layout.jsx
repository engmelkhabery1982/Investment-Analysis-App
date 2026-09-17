import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Building2, Database, BarChart3, History, Settings, FlaskConical, Landmark } from 'lucide-react';
import InvestmentSelector from './InvestmentSelector';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/investments', label: 'Investments', icon: Building2 },
  { to: '/market-data', label: 'Market Data', icon: Database },
  { to: '/analysis', label: 'Analysis', icon: BarChart3 },
  { to: '/audit', label: 'Audit', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/tests', label: 'Self-test', icon: FlaskConical },
];

export default function Layout() {
  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-60 flex-col border-r bg-sidebar/50 flex-shrink-0">
        <div className="px-5 py-5 flex items-center gap-2 border-b">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <Landmark className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <div className="font-heading font-semibold text-sm leading-tight">Investment</div>
            <div className="text-xs text-muted-foreground leading-tight">Analysis</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t text-xs text-muted-foreground">Personal • Local data</div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
          <div className="px-4 md:px-8 py-3 flex items-center justify-between gap-4">
            <div className="md:hidden font-heading font-semibold text-sm">Investment Analysis</div>
            <div className="hidden md:block text-sm text-muted-foreground">Select investment</div>
            <div className="flex items-center gap-2">
              <InvestmentSelector />
            </div>
          </div>
          <nav className="md:hidden flex overflow-x-auto px-2 pb-2 gap-1 border-t">
            {NAV.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end}
                className={({ isActive }) => `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                <item.icon className="w-3.5 h-3.5" />{item.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}