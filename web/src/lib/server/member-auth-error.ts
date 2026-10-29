export function memberAuthError(status: 400 | 403 | 503): Response {
  const heading = status === 403 ? 'Approval comes next.' : status === 400 ? 'Let’s start sign-in again.' : 'Sign-in needs a moment.';
  const message = status === 403
    ? 'This account needs Terrace approval before it can enter the member community. Current members and alumni are both welcome to request access from the club.'
    : status === 400
      ? 'That sign-in link expired or could not be verified. Start a fresh sign-in to continue.'
      : 'Member sign-in is temporarily unavailable. Please try again shortly.';
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Member sign-in · Terrace F. Club</title>
<style>body{margin:0;background:#f3ecda;color:#33253a;font:1rem/1.7 system-ui,sans-serif}main{max-width:42rem;margin:8vh auto;padding:2rem}h1{font-size:clamp(2rem,6vw,3.5rem);line-height:1.1}a{color:inherit;text-underline-offset:.2em}a:focus-visible,button:focus-visible{outline:3px solid #33253a;outline-offset:5px}.button{display:inline-block;border:0;font:inherit;cursor:pointer;background:#33253a;color:#fff7df;padding:.8rem 1.2rem;font-weight:700}nav{display:flex;flex-wrap:wrap;gap:1rem;margin-top:1.5rem}</style></head>
<body><main><p>TERRACE F. CLUB / MEMBER SIGN-IN</p><h1>${heading}</h1><p>${message}</p><form method="POST" action="/auth/login"><button class="button" type="submit">Use a different account</button></form><nav aria-label="Sign-in help"><a href="/auth/login">Try sign-in again</a><a href="/contact/">Contact Terrace</a><a href="/">Back to the public site</a></nav></main></body></html>`, {
    status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'strict-origin', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}
