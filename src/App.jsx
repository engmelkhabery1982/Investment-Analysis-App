import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Investments from '@/pages/Investments';
import Workspace from '@/pages/Workspace';
import Portfolio from '@/pages/Portfolio';
import Comparison from '@/pages/Comparison';
import MarketData from '@/pages/MarketData';
import DataImport from '@/pages/DataImport';
import Analysis from '@/pages/Analysis';
import Audit from '@/pages/Audit';
import DataQuality from '@/pages/DataQuality';
import Settings from '@/pages/Settings';
import Tests from '@/pages/Tests';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/investments" element={<Investments />} />
        <Route path="/investments/:id" element={<Workspace />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/comparison" element={<Comparison />} />
        <Route path="/market-data" element={<MarketData />} />
        <Route path="/data-import" element={<DataImport />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/data-quality" element={<DataQuality />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/tests" element={<Tests />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App