/**
 * Curated Indian Bank Registry & IFSC prefix configuration.
 */

export interface BankConfig {
  name: string;
  code: string;
  ifscPrefix: string;
  exampleIfsc: string;
}

export const SUPPORTED_BANKS: BankConfig[] = [
  {
    name: 'State Bank of India',
    code: 'SBI',
    ifscPrefix: 'SBIN',
    exampleIfsc: 'SBIN0001234',
  },
  {
    name: 'HDFC Bank',
    code: 'HDFC',
    ifscPrefix: 'HDFC',
    exampleIfsc: 'HDFC0001234',
  },
  {
    name: 'ICICI Bank',
    code: 'ICICI',
    ifscPrefix: 'ICIC',
    exampleIfsc: 'ICIC0001234',
  },
  {
    name: 'Axis Bank',
    code: 'AXIS',
    ifscPrefix: 'UTIB',
    exampleIfsc: 'UTIB0001234',
  },
  {
    name: 'Kotak Mahindra Bank',
    code: 'KOTAK',
    ifscPrefix: 'KKBK',
    exampleIfsc: 'KKBK0001234',
  },
  {
    name: 'Punjab National Bank',
    code: 'PNB',
    ifscPrefix: 'PUNB',
    exampleIfsc: 'PUNB0001234',
  },
  {
    name: 'Bank of Baroda',
    code: 'BOB',
    ifscPrefix: 'BARB',
    exampleIfsc: 'BARB0001234',
  },
  {
    name: 'Canara Bank',
    code: 'CANARA',
    ifscPrefix: 'CNRB',
    exampleIfsc: 'CNRB0001234',
  },
  {
    name: 'Union Bank of India',
    code: 'UNION',
    ifscPrefix: 'UBIN',
    exampleIfsc: 'UBIN0001234',
  },
  {
    name: 'Indian Bank',
    code: 'INDIAN',
    ifscPrefix: 'IDIB',
    exampleIfsc: 'IDIB0001234',
  },
  {
    name: 'IDBI Bank',
    code: 'IDBI',
    ifscPrefix: 'IBKL',
    exampleIfsc: 'IBKL0001234',
  },
  {
    name: 'IndusInd Bank',
    code: 'INDUSIND',
    ifscPrefix: 'INDB',
    exampleIfsc: 'INDB0001234',
  },
  {
    name: 'Federal Bank',
    code: 'FEDERAL',
    ifscPrefix: 'FDRL',
    exampleIfsc: 'FDRL0001234',
  },
  {
    name: 'Yes Bank',
    code: 'YES',
    ifscPrefix: 'YESB',
    exampleIfsc: 'YESB0001234',
  },
  {
    name: 'Bank of India',
    code: 'BOI',
    ifscPrefix: 'BKID',
    exampleIfsc: 'BKID0001234',
  },
];

export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function validateBankIfsc(bankName: string, ifsc: string): { isValid: boolean; message: string } {
  const cleanIfsc = (ifsc || '').trim().toUpperCase();
  const cleanBank = (bankName || '').trim();

  if (!cleanIfsc) {
    return { isValid: false, message: 'IFSC code is required.' };
  }

  if (!IFSC_REGEX.test(cleanIfsc)) {
    return {
      isValid: false,
      message: 'Invalid IFSC format. Must be 11 characters (4 letters, 0, 6 characters, e.g. HDFC0001234).',
    };
  }

  const foundBank = SUPPORTED_BANKS.find(
    (b) =>
      b.name.toLowerCase() === cleanBank.toLowerCase() ||
      b.code.toLowerCase() === cleanBank.toLowerCase()
  );

  if (foundBank) {
    if (!cleanIfsc.startsWith(foundBank.ifscPrefix)) {
      return {
        isValid: false,
        message: `⚠ This IFSC code does not match ${foundBank.name}. ${foundBank.name} IFSC must start with "${foundBank.ifscPrefix}" (e.g. ${foundBank.exampleIfsc}).`,
      };
    }
  }

  return { isValid: true, message: '✓ IFSC format is valid for selected bank' };
}
