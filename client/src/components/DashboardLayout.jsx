import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import NavSidebar from './NavSidebar.jsx';
import LevelUpOverlay from './LevelUpOverlay.jsx';

export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="p-6 max-w-6xl mx-auto"
        >
          <Outlet />
        </motion.div>
      </main>
      <LevelUpOverlay />
    </div>
  );
}
