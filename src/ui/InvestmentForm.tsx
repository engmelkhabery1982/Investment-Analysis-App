import React from 'react';
import { InvestmentService, createMockInvestmentService, formatDateForInput, parseDateFromInput } from './investmentService.js';
import { Investment, Currency, AssetClass } from '../domain/index.js';

export interface InvestmentFormProps {
  service: InvestmentService;
  mode: 'create' | 'edit';
  initialData?: Investment;
  onSuccess?: (investment: Investment) => void;
  onCancel?: () => void;
}

interface FormErrors {
  name?: string;
  propertyProject?: string;
  purchaseDate?: string;
  valuationDate?: string;
  currency?: string;
}

const CURRENCIES: Currency[] = ['EGP', 'USD', 'EUR', 'GBP'];

export function InvestmentForm({
  service,
  mode,
  initialData,
  onSuccess,
  onCancel,
}: InvestmentFormProps): React.ReactElement {
  const [name, setName] = React.useState('');
  const [propertyProject, setPropertyProject] = React.useState('');
  const [purchaseDate, setPurchaseDate] = React.useState('');
  const [valuationDate, setValuationDate] = React.useState('');
  const [currency, setCurrency] = React.useState<Currency>('EGP');
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (mode === 'edit' && initialData) {
      setName(initialData.name || '');
      setPropertyProject((initialData.metadata?.['propertyProject'] as string) || '');
      setPurchaseDate(initialData.purchaseDate ? formatDateForInput(initialData.purchaseDate) : '');
      setValuationDate(formatDateForInput(initialData.valuationDate));
      setCurrency(initialData.currency);
    }
  }, [mode, initialData]);

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Investment Name is required';
    }
    if (!propertyProject.trim()) {
      newErrors.propertyProject = 'Property / Project is required';
    }
    if (!purchaseDate) {
      newErrors.purchaseDate = 'Purchase Date is required';
    }
    if (!valuationDate) {
      newErrors.valuationDate = 'Valuation Date is required';
    }
    if (!currency) {
      newErrors.currency = 'Currency is required';
    }

    if (purchaseDate && valuationDate) {
      try {
        const purchase = parseDateFromInput(purchaseDate);
        const valuation = parseDateFromInput(valuationDate);
        if (purchase > valuation) {
          newErrors.valuationDate = 'Valuation Date must not be before Purchase Date';
        }
      } catch {
        newErrors.valuationDate = 'Invalid date format';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      const purchase = parseDateFromInput(purchaseDate);
        const valuation = parseDateFromInput(valuationDate);

      if (mode === 'edit' && initialData) {
        const updated: Investment = {
          ...initialData,
          name: name.trim(),
          currency,
          purchaseDate: purchase,
          valuationDate: valuation,
          metadata: {
            ...initialData.metadata,
            propertyProject: propertyProject.trim(),
          },
        };
        const result = await service.updateInvestment(updated);
        setFeedback({ type: 'success', message: 'Investment updated successfully.' });
        onSuccess?.(result);
      } else {
        const created = await service.createInvestment({
          name: name.trim(),
          assetClass: 'real-estate' as AssetClass,
          currency,
          valuationDate: valuation,
          purchaseDate: purchase,
          cashFlows: [],
          metadata: {
            propertyProject: propertyProject.trim(),
          },
        });
        setFeedback({ type: 'success', message: 'Investment created successfully.' });
        onSuccess?.(created);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h2>{mode === 'create' ? 'Create Investment' : 'Edit Investment'}</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '0.5rem' }}>
          <label htmlFor="inv-name">Investment Name *</label>
          <br />
          <input
            id="inv-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          {errors.name && <span style={{ color: 'red' }}>{errors.name}</span>}
        </div>

        <div style={{ marginBottom: '0.5rem' }}>
          <label htmlFor="inv-property">Property / Project *</label>
          <br />
          <input
            id="inv-property"
            type="text"
            value={propertyProject}
            onChange={(e) => setPropertyProject(e.target.value)}
            required
          />
          {errors.propertyProject && <span style={{ color: 'red' }}>{errors.propertyProject}</span>}
        </div>

        <div style={{ marginBottom: '0.5rem' }}>
          <label htmlFor="inv-purchase">Purchase Date *</label>
          <br />
          <input
            id="inv-purchase"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            required
          />
          {errors.purchaseDate && <span style={{ color: 'red' }}>{errors.purchaseDate}</span>}
        </div>

        <div style={{ marginBottom: '0.5rem' }}>
          <label htmlFor="inv-valuation">Valuation Date *</label>
          <br />
          <input
            id="inv-valuation"
            type="date"
            value={valuationDate}
            onChange={(e) => setValuationDate(e.target.value)}
            required
          />
          {errors.valuationDate && <span style={{ color: 'red' }}>{errors.valuationDate}</span>}
        </div>

        <div style={{ marginBottom: '0.5rem' }}>
          <label htmlFor="inv-currency">Currency *</label>
          <br />
          <select
            id="inv-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            required
          >
            <option value="">Select Currency</option>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {errors.currency && <span style={{ color: 'red' }}>{errors.currency}</span>}
        </div>

        <div style={{ marginTop: '1rem' }}>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} style={{ marginLeft: '0.5rem' }}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {feedback && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.5rem',
            backgroundColor: feedback.type === 'success' ? '#d4edda' : '#f8d7da',
            color: feedback.type === 'success' ? '#155724' : '#721c24',
            border: `1px solid ${feedback.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
            borderRadius: '4px',
          }}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}
