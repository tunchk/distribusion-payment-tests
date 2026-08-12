export const cardPaymentMethod = {
  holder_name: 'Jane Doe',
  number: '4111111111111111',
  exp_month: 12,
  exp_year: 2030,
  cvc: '737',
} as const;

export const declineCardPaymentMethod = {
  holder_name: 'Jane Doe',
  number: '4000000000000002',
  exp_month: 12,
  exp_year: 2030,
  cvc: '737',
} as const;

export const invalidLuhnCardNumber = '4111111111111112';

export const invalidCvc = '12';

export const invalidIban = 'DE89370400440532013001';

export const invalidHolderName = '';

export const invalidBic = 'BAD';

export const validBic = 'COBADEFF';

export const expiredCardPaymentMethod = {
  holder_name: 'Jane Doe',
  number: '4111111111111111',
  exp_month: 1,
  exp_year: 2020,
  cvc: '737',
} as const;

export const sepaPaymentMethod = {
  holder_name: 'Jane Doe',
  iban: 'DE89370400440532013000',
} as const;

export const declineSepaPaymentMethod = {
  holder_name: 'Jane Doe',
  iban: 'DE62370400440532013001',
} as const;

export const successfulPayment = {
  amount: 1000,
  currency: 'EUR' as const,
};

export const invalidPaymentAmount = 0;

export const negativePaymentAmount = -1;

export const unsupportedCurrency = 'TRY';

export const supportedCurrencies = ['EUR', 'USD', 'GBP'] as const;

export const unknownPaymentMethodId = 'pm_nonexistent_test_id';

export const nonexistentPaymentId = 'pay_nonexistent_test_id';

export const nonexistentPaymentMethodLookupId = 'pm_nonexistent_404_test_id';

export const invalidApiKey = 'invalid-test-api-key';
