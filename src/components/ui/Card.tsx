import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

function CardRoot({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3', className)}
      {...props}
    />
  )
}

function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-body" className={cn('p-4', className)} {...props} />
}

function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center justify-end gap-2 border-t border-[var(--border)] px-4 py-3', className)}
      {...props}
    />
  )
}

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
})
