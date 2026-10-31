export function memberAuthError(status: 400 | 403 | 503): Response {
  const heading = status === 403 ? 'Approval comes next.' : status === 400 ? 'Let’s start sign-in again.' : 'Sign-in needs a moment.';
  const message = status === 403
    ? 'This account needs Terrace approval before it can enter the member community. Current members and alumni are both welcome to request access from the club.'
    : status === 400
      ? 'That sign-in link expired or could not be verified. Start a fresh sign-in to continue.'
      : 'Member sign-in is temporarily unavailable. Please try again shortly.';
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Member sign-in · Terrace F. Club</title>
<style>
@font-face{font-family:Anton;font-style:normal;font-weight:400;font-display:swap;src:url(/fonts/anton-latin-400.woff2) format('woff2')}
:root{--ink:#231c2b;--paper:#faf5e9;--acid:#d9ed72;--lilac:#d3b8e4}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:var(--ink);color:var(--paper);font:1.0625rem/1.7 'DM Sans Variable','DM Sans','Trebuchet MS',system-ui,sans-serif}
main{max-width:46rem;margin:0 auto;padding:clamp(2rem,8vh,5rem) 1.25rem 4rem}
.badge{width:4.5rem;height:4.5rem;border-radius:50%;box-shadow:4px 4px 0 var(--acid);transform:rotate(-8deg);margin-bottom:1.5rem}
.kicker{margin:0;color:var(--acid);font:700 .75rem/1.5 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase}
h1{margin:.4rem 0 1rem;font:400 clamp(2.9rem,10vw,5.2rem)/1 Anton,Impact,'Arial Narrow',sans-serif;letter-spacing:.01em;text-transform:uppercase;overflow-wrap:anywhere}
p{max-width:60ch}
.message{color:#e5dfe7;font-size:1.15rem}
a{color:inherit;text-underline-offset:.25em}
a:focus-visible,button:focus-visible{outline:3px solid var(--acid);outline-offset:5px}
.button{display:inline-block;margin-top:.75rem;border:2px solid var(--acid);border-radius:0;background:var(--acid);color:var(--ink);box-shadow:4px 4px 0 var(--lilac);font:inherit;font-weight:800;padding:.75rem 1.3rem;cursor:pointer}
.button:hover{background:#e8f4a6}
nav{display:flex;flex-wrap:wrap;gap:.75rem 1.5rem;margin-top:2rem;padding-top:1.25rem;border-top:2px dashed #665670;font-weight:700}
@media(forced-colors:active){.button{border-color:ButtonText}}
</style></head>
<body><main><img class="badge" src="/culture/club-badge.png" alt="" width="72" height="72"><p class="kicker">Terrace F. Club / Member sign-in</p><h1>${heading}</h1><p class="message">${message}</p><form method="POST" action="/auth/login"><button class="button" type="submit">Use a different account</button></form><nav aria-label="Sign-in help"><a href="/auth/login">Try sign-in again</a><a href="/contact/">Contact Terrace</a><a href="/">Back to the public site</a></nav></main></body></html>`, {
    status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'strict-origin', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}
