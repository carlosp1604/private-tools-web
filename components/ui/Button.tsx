import { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

const BASE_CLASS_NAME = 'cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium transition-colors '
  + 'disabled:cursor-not-allowed disabled:opacity-50'

const VARIANTS = {
  primary: 'bg-accent text-background hover:bg-muted',
  secondary: 'border border-border text-foreground hover:bg-surface-hover',
}

export function Button({ variant = 'primary', className = '', ...props }: Props) {
  return (
    <button
      type="button"
      className={ `${BASE_CLASS_NAME} ${VARIANTS[variant]} ${className}` }
      { ...props }
    />
  )
}
