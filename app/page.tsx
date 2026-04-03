// Strona główna — przekierowanie do domyślnego locale (pl)
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/pl/login')
}
