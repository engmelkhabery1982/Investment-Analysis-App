import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvestmentForm } from '../src/ui/InvestmentForm.js';
import { createMockInvestmentService } from '../src/ui/investmentService.js';
import { Investment } from '../src/domain/index.js';

function makeUtcDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00.000Z');
}

describe('InvestmentForm', () => {
  let service: ReturnType<typeof createMockInvestmentService>;

  beforeEach(() => {
    service = createMockInvestmentService();
  });

  afterEach(() => {
    service.close();
    cleanup();
  });

  function renderForm(props: Partial<React.ComponentProps<typeof InvestmentForm>> = {}) {
    return render(
      <InvestmentForm
        service={service}
        mode="create"
        {...props}
      />
    );
  }

  function submitForm() {
    const form = document.querySelector('form')!;
    fireEvent.submit(form);
  }

  describe('Required-field validation', () => {
    it('should show error when Investment Name is empty', async () => {
      renderForm();
      submitForm();

      await waitFor(() => {
        expect(screen.getByText('Investment Name is required')).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('should show error when Property / Project is empty', async () => {
      renderForm();
      submitForm();

      await waitFor(() => {
        expect(screen.getByText('Property / Project is required')).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('should show error when Purchase Date is empty', async () => {
      renderForm();
      submitForm();

      await waitFor(() => {
        expect(screen.getByText('Purchase Date is required')).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('should show error when Valuation Date is empty', async () => {
      renderForm();
      submitForm();

      await waitFor(() => {
        expect(screen.getByText('Valuation Date is required')).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('should show error when Currency is not selected', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.selectOptions(screen.getByLabelText(/Currency/i), '');
      submitForm();

      await waitFor(() => {
        expect(screen.getByText('Currency is required')).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('should not show validation errors when all fields are valid', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText(/Investment Name/i), 'My Investment');
      await user.type(screen.getByLabelText(/Property \/ Project/i), 'My Property');
      await user.type(screen.getByLabelText(/Purchase Date/i), '2024-01-01');
      await user.type(screen.getByLabelText(/Valuation Date/i), '2024-06-01');
      await user.selectOptions(screen.getByLabelText(/Currency/i), 'USD');

      submitForm();

      await waitFor(() => {
        expect(screen.queryByText('Investment Name is required')).toBeNull();
        expect(screen.queryByText('Property / Project is required')).toBeNull();
        expect(screen.queryByText('Purchase Date is required')).toBeNull();
        expect(screen.queryByText('Valuation Date is required')).toBeNull();
        expect(screen.queryByText('Currency is required')).toBeNull();
      }, { timeout: 3000 });
    });
  });

  describe('Date validation', () => {
    it('should show error when Valuation Date is before Purchase Date', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText(/Purchase Date/i), '2024-06-01');
      await user.type(screen.getByLabelText(/Valuation Date/i), '2024-01-01');
      await user.selectOptions(screen.getByLabelText(/Currency/i), 'USD');

      submitForm();

      await waitFor(() => {
        expect(screen.getByText('Valuation Date must not be before Purchase Date')).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('should allow Valuation Date equal to Purchase Date', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText(/Investment Name/i), 'Test');
      await user.type(screen.getByLabelText(/Property \/ Project/i), 'Test Property');
      await user.type(screen.getByLabelText(/Purchase Date/i), '2024-01-01');
      await user.type(screen.getByLabelText(/Valuation Date/i), '2024-01-01');
      await user.selectOptions(screen.getByLabelText(/Currency/i), 'USD');

      submitForm();

      await waitFor(() => {
        expect(screen.queryByText('Valuation Date must not be before Purchase Date')).toBeNull();
      }, { timeout: 3000 });
    });
  });

  describe('Successful create', () => {
    it('should create an investment and show success message', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      renderForm({ mode: 'create', onSuccess });

      await user.type(screen.getByLabelText(/Investment Name/i), 'Test Investment');
      await user.type(screen.getByLabelText(/Property \/ Project/i), 'Test Property');
      await user.type(screen.getByLabelText(/Purchase Date/i), '2024-01-01');
      await user.type(screen.getByLabelText(/Valuation Date/i), '2024-06-01');
      await user.selectOptions(screen.getByLabelText(/Currency/i), 'EGP');

      submitForm();

      await waitFor(() => {
        expect(screen.getByText('Investment created successfully.')).toBeTruthy();
      }, { timeout: 3000 });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
        const created = onSuccess.mock.calls[0][0] as Investment;
        expect(created.name).toBe('Test Investment');
        expect(created.currency).toBe('EGP');
        expect(created.valuationDate).toBeDefined();
      }, { timeout: 3000 });
    });
  });

  describe('Successful edit', () => {
    it('should pre-fill fields and update an existing investment', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      const existing: Investment = {
        id: 'inv-test',
        name: 'Old Name',
        assetClass: 'real-estate',
        currency: 'USD',
        cashFlows: [],
        purchaseDate: makeUtcDate('2023-03-01'),
        valuationDate: makeUtcDate('2023-09-01'),
        metadata: { propertyProject: 'Old Property' },
      };

      renderForm({ mode: 'edit', initialData: existing, onSuccess });

      const nameInput = screen.getByLabelText(/Investment Name/i) as HTMLInputElement;
      await waitFor(() => {
        expect(nameInput.value).toBe('Old Name');
      }, { timeout: 3000 });

      const propertyInput = screen.getByLabelText(/Property \/ Project/i) as HTMLInputElement;
      const purchaseInput = screen.getByLabelText(/Purchase Date/i) as HTMLInputElement;
      const valuationInput = screen.getByLabelText(/Valuation Date/i) as HTMLInputElement;
      const currencySelect = screen.getByLabelText(/Currency/i) as HTMLSelectElement;

      fireEvent.change(nameInput, { target: { value: 'New Name' } });
      fireEvent.change(propertyInput, { target: { value: 'New Property' } });
      fireEvent.change(purchaseInput, { target: { value: '2023-04-01' } });
      fireEvent.change(valuationInput, { target: { value: '2023-10-01' } });
      fireEvent.change(currencySelect, { target: { value: 'EUR' } });

      submitForm();

      await waitFor(() => {
        expect(screen.getByText('Investment updated successfully.')).toBeTruthy();
      }, { timeout: 3000 });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
        const updated = onSuccess.mock.calls[0][0] as Investment;
        expect(updated.name).toBe('New Name');
        expect(updated.currency).toBe('EUR');
      }, { timeout: 3000 });
    });
  });
});
