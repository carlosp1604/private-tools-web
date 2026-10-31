import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Link href="/" className="text-3xl font-semibold tracking-tight">404</Link>
    </main>
  )
}
