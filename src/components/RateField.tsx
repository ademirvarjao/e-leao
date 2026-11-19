import {useId} from 'react';
import {ExternalLink} from 'lucide-react';
import {lc214} from '../lib/legal';
import {referenceLabel, type RateEntry, type RateReference, type Tax} from '../lib/rateReferences';

type Props = {tax: Tax; label: string; entry: RateEntry; reference?: RateReference; onChange: (next: RateEntry) => void};

export function RateField({tax, label, entry, reference, onChange}: Props) {
  const id = useId();
  const applied = !!reference && !!entry.reference && referenceLabel(entry.reference) === referenceLabel(reference);
  return <div className="field rate-field">
    <label htmlFor={id}>{label}</label>
    <input id={id} inputMode="decimal" required value={entry.value} placeholder="Informe o percentual"
      aria-describedby={reference ? `${id}-ref` : undefined} onChange={e => onChange({value:e.target.value})}/>
    {reference && <div className="rate-reference" id={`${id}-ref`}>
      <button className="ref-chip" type="button" disabled={applied} onClick={() => onChange({value:reference.percent, reference})}
        aria-label={applied ? `Referência de ${reference.percent}% aplicada a ${tax}` : `Usar referência de ${reference.percent}% para ${tax}`}>{applied ? `${reference.percent}% aplicada` : `Usar ${reference.percent}%`}</button>
      <small>{reference.scope}. <a href={lc214} target="_blank" rel="noreferrer">Art. {reference.article} <ExternalLink size={11}/></a></small>
    </div>}
  </div>;
}
