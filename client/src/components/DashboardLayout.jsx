import { Outlet } from 'react-router-dom';
import TopBar from './TopBar.jsx';
import NavSidebar from './NavSidebar.jsx';

// White header with the logo, white menu on the left (a row of tabs on phones),
// content on the off-white page. `app-content` turns on the light-theme bridge
// in index.css for the older screens.
export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-offwhite text-navy">
      <TopBar />
      <div className="md:flex">
        <NavSidebar />
        <main className="app-content min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1180px] px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
