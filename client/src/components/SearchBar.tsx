import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Search } from 'lucide-react'

export type SearchBarProps = {
  value: string
  onChange: (value: string) => void
  onSearch: () => void
  onAdd?: (term: string) => void
  placeholder?: string
}

export function InputButtonGroup({ value, onChange, onSearch, onAdd, placeholder = 'Stichwort eingeben (z. B. SAP) – mit Enter hinzufügen' }: SearchBarProps) {
  function handleAdd() {
    const term = value.trim()
    if (term && onAdd) {
      onAdd(term)
      onChange('')
    } else if (!onAdd && term) {
      onSearch()
    }
  }
  return (
    <Field>
      <FieldLabel htmlFor="input-button-group" className="display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight text-[var(--sea-ink)] sm:text-6xl">Suchergebnisse</FieldLabel>
      <ButtonGroup>
        <Input
          id="input-button-group"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (onAdd) {
                e.preventDefault()
                handleAdd()
              } else {
                onSearch()
              }
            }
          }}
        />
        {/* {onAdd && (
          <Button type="button" variant="outline" onClick={handleAdd} aria-label="Stichwort hinzufügen">
            Hinzufügen
          </Button>
        )} */}
        <Button type="button" variant="outline" onClick={onSearch} aria-label="Suchen">
          <Search />
        </Button>
      </ButtonGroup>
    </Field>
  )
}
