import { formatCurrency, formatDate } from '../lib/format';

describe('formatCurrency', () => {
  it('formata valor inteiro em COP', () => {
    const result = formatCurrency(15000);
    // Deve conter o símbolo de COP e o valor formatado
    expect(result).toContain('15');
    expect(result).toContain('000');
  });

  it('formata zero corretamente', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });

  it('formata valor grande corretamente', () => {
    const result = formatCurrency(1500000);
    expect(result).toContain('1');
    expect(result).toContain('500');
    expect(result).toContain('000');
  });

  it('formata valor negativo', () => {
    const result = formatCurrency(-5000);
    expect(result).toContain('5');
    expect(result).toContain('000');
  });
});

describe('formatDate', () => {
  it('formata objeto Date', () => {
    const date = new Date(2025, 2, 15, 14, 30); // 15/03/2025 14:30
    const result = formatDate(date);
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('formata string ISO', () => {
    const result = formatDate('2025-03-15T14:30:00Z');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });
});
