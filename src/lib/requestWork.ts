// Small client-side computational cost per request. Not a CAPTCHA or per-IP rate limit.
export async function requestWork(name:string,email:string):Promise<{issued_at:number;nonce:string}>{
 const issued_at=Math.floor(Date.now()/1000),prefix=`${name.trim()}\n${email.trim().toLowerCase()}\n${issued_at}\n`;
 const seed=crypto.getRandomValues(new Uint32Array(1))[0];
 for(let i=0;i<1_000_000;i++){
  const nonce=(BigInt(seed)*1000000n+BigInt(i)).toString(16).padStart(16,'0');
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(prefix+nonce)));
  if(digest[0]===0&&digest[1]===0)return {issued_at,nonce};
 }
 throw Error('Não foi possível concluir a verificação de segurança. Tente novamente.');
}
