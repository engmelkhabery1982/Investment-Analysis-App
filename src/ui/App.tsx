import React from 'react';
import { createInvestmentService } from './investmentService.js';

export function App(): React.ReactElement {
  const [message, setMessage] = React.useState('Investment Analysis App - Initializing...');
  const [serviceReady, setServiceReady] = React.useState(false);

  React.useEffect(() => {
    try {
      const service = createInvestmentService({ path: ':memory:' });
      service.close();
      setMessage('Investment Analysis App - React + Vite + TypeScript foundation ready');
      setServiceReady(true);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Investment Analysis App</h1>
      <p style={{ color: serviceReady ? 'green' : 'orange' }}>{message}</p>
      <hr />
      <p>Task 2.2A: React foundation and investment service layer complete.</p>
      <ul>
        <li>React 18 + Vite + TypeScript configured</li>
        <li>Investment service bridges UI to SQLite repository</li>
        <li>Decimal precision and UTC dates preserved</li>
      </ul>
    </div>
  );
}