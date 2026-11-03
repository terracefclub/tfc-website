import React from 'react'
import { editorialEnabled } from '../auth/editorial-policy'

export function EditorialLogin({ searchParams }: { searchParams?: { editorial?: string | string[] } }) {
  if (!editorialEnabled()) return null
  return <section aria-label="Terrace editorial sign-in">
    <h1>Behind the scenes.</h1>
    <p>Sign in with your Terrace editorial account to publish events, newsletters and club news.</p>
    {searchParams?.editorial === 'denied' && <p role="alert">We couldn’t open the editor. Try again with an approved editorial account.</p>}
    <p>Current members and alumni need a separate editorial invitation.</p>
    <form action="/api/editorial/login" method="post">
      <button className="btn btn--style-primary btn--size-large" type="submit">Sign in with Terrace</button>
    </form>
  </section>
}

export function EditorialLogout() {
  if (!editorialEnabled()) return <a href="/admin/logout">Sign out</a>
  return <form action="/api/editorial/logout" method="post">
    <button className="btn btn--style-secondary btn--size-small" type="submit">Sign out of Terrace</button>
  </form>
}
