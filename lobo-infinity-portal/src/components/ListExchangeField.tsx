export default function ListExchangeField({ defaultValue = '', onChange }: { defaultValue?: string; onChange?: (value: string) => void }) {
  return (
    <label className="army-list-form-wide">
      <span>LLH game code (optional)</span>
      <input name="listExchangeCode" defaultValue={defaultValue} onChange={event => onChange?.(event.target.value)} maxLength={20} pattern="[Ll][Ll][Hh]-[A-Fa-f0-9]{16}" placeholder="LLH-0123456789ABCDEF" autoComplete="off" spellCheck={false} />
      <small>If you both locked lists with /list game ready, enter that game’s code. The portal uses your locked lists for the report; you can leave both army-code fields blank. LLH exchanges the lists after the accepted report.</small>
    </label>
  )
}
