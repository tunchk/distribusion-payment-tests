export const cardPaymentMethod = {
  holder_name: 'Jane Doe',
  number: '4111111111111111',
  exp_month: 12,
  exp_year: 2030,
  cvc: '737',
} as const;

export const sepaPaymentMethod = {
  holder_name: 'Jane Doe',
  iban: 'DE89370400440532013000',
} as const;

export const successfulPayment = {
  amount: 1000,
  currency: 'EUR' as const,
};
