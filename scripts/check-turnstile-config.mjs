// Never print the configured key. A missing widget cannot be allowed to replace
// a working deployment after server-side enforcement has been activated.
const key=(process.env.VITE_TURNSTILE_SITE_KEY||'').trim();
if(!key||/^[123]x0{10,}/.test(key)||!/^[a-zA-Z0-9_-]{10,100}$/.test(key)){
 console.error('Configure uma site key real do Turnstile na variável VITE_TURNSTILE_SITE_KEY do GitHub Actions.');
 process.exit(1);
}
console.log('Site key configurada; disponibilidade do widget ainda requer teste no navegador.');
