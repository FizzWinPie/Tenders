import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Search } from 'lucide-react'

export type SearchBarProps = {
  value: string
  onChange: (value: string) => void
  onSearch: () => void
  placeholder?: string
}

export function InputButtonGroup({ value, onChange, onSearch, placeholder = 'Suchen...' }: SearchBarProps) {
  return (
    <Field>
      <FieldLabel htmlFor="input-button-group" className="display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight text-[var(--sea-ink)] sm:text-6xl">Suchergebnisse</FieldLabel>
      <ButtonGroup>
        <Input
          id="input-button-group"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
        />
        <Button type="button" variant="outline" onClick={onSearch} aria-label="Suchen">
          <Search />
        </Button>
      </ButtonGroup>
    </Field>
  )
}
