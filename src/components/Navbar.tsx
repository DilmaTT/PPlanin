import { Link, useLocation } from 'react-router-dom';
import { Home, Settings, PlayCircle, CalendarCheck, Database } from 'lucide-react'; // Import Database icon
import { cn } from '@/lib/utils';

const Navbar = () => {
  const location = useLocation();

  const navLinkClasses = (path: string) =>
    cn(
      'flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-md text-sm font-medium',
      location.pathname === path && 'bg-muted text-foreground'
    );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 hidden md:flex">
          <nav className="flex items-center gap-4 text-sm lg:gap-6">
            <Link to="/session" className={navLinkClasses('/session')}>
              <PlayCircle className="h-4 w-4" />
              Сессия
            </Link>
            <Link to="/" className={navLinkClasses('/')}>
              <Home className="h-4 w-4" />
              Дашборд
            </Link>
            <Link to="/planning" className={navLinkClasses('/planning')}>
              <CalendarCheck className="h-4 w-4" />
              Планирование
            </Link>
            <Link to="/data" className={navLinkClasses('/data')}> {/* Add new link for DataPage */}
              <Database className="h-4 w-4" />
              Данные
            </Link>
            <Link to="/settings" className={navLinkClasses('/settings')}>
              <Settings className="h-4 w-4" />
              Настройки
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
