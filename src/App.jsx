import { Toaster } from "@/components/ui/toaster"
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
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
import { useStoreStatus } from '@/lib/hooks';
// Add page imports here

function App() {
  const { ready, initializationError, persistenceError } = useStoreStatus();
  if (initializationError) {
    return <div className="p-6 text-destructive">Storage initialization failed. Your V1 data was left untouched.</div>;
  }
  if (!ready) return <div className="p-6 text-muted-foreground">Loading local data…</div>;
  if (persistenceError) {
    return <div className="p-6 text-destructive">Storage update failed. The unsaved change was rolled back.</div>;
  }
  return (
    <Router>
      <ScrollToTop />
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
      <Toaster />
    </Router>
  )
}

export default App
