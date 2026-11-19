import {useState, type ClipboardEvent} from 'react';
import {NumericFormat} from 'react-number-format';

type Props = {value: string; onValueChange: (value: string) => void; name?: string; required?: boolean};

// Display reais in pt-BR, but give the fiscal parser an exact, ungrouped decimal string.
export function MoneyInput({value, onValueChange, name, required=true}: Props) {
  const [pasteError, setPasteError] = useState(false);

  function paste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData('text/plain');
    const amount = text.trim().replace(/^R\$\s*/, '');
    // A pasted 1250.50 is a decimal, not 125050 reais. Dots in 1.250,50 are groups.
    const local = /^\d+\.\d{1,2}$/.test(amount) ? amount.replace('.', ',') : amount;
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(local)) {
      event.preventDefault();
      setPasteError(true);
      return;
    }
    setPasteError(false);
    if (local !== text) {
      event.preventDefault();
      const input = event.currentTarget;
      input.setRangeText(local, input.selectionStart!, input.selectionEnd!, 'end');
      input.dispatchEvent(new Event('input', {bubbles: true}));
    }
  }

  return <>
    <NumericFormat name={name} required={required} inputMode="decimal" placeholder="0,00"
      thousandSeparator="." decimalSeparator="," decimalScale={2} fixedDecimalScale allowNegative={false}
      value={value} valueIsNumericString onValueChange={amount => onValueChange(amount.value)}
      onPaste={paste} onChange={() => setPasteError(false)}/>
    {pasteError && <small role="alert">Valor não colado. Use um valor como 1.234,56.</small>}
  </>;
}
