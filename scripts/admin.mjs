import { createClient } from '@supabase/supabase-js';
const arg=(key)=>{const i=process.argv.indexOf(key);return i<0?'':process.argv[i+1]||''};
if(!process.argv.includes('--email')){console.error('Uso: npm run admin:invite -- --email SEU_EMAIL_VERIFICADO');process.exit(2)}
const email=arg('--email').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){console.error('Informe um endereço de e-mail válido.');process.exit(2)}
const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key){console.error('Configure SUPABASE_URL e SUPABASE_SECRET_KEY num ambiente privado; a chave não pode começar por sb_publishable_.');process.exit(2)}
if(key.startsWith('sb_publishable_')){console.error('A chave fornecida é publicável, não tem poderes de administração.');process.exit(2)}
const supabase=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
let found=await supabase.auth.admin.listUsers({page:1,perPage:1000});if(found.error){console.error('Não foi possível verificar a conta Supabase.');process.exit(1)}
let user=found.data.users.find(u=>u.email?.toLowerCase()===email);
if(!user){const invitation=await supabase.auth.admin.inviteUserByEmail(email);if(invitation.error){console.error('Convite não enviado. Verifique a política de contas e o serviço de e-mail do Supabase.');process.exit(1)}user=invitation.data.user;console.log('Convite enviado ao endereço especificado. Após aceitá-lo, execute este mesmo comando novamente para ativar o perfil administrativo.');}
if(!user?.id){console.error('O Supabase não devolveu uma identidade válida.');process.exit(1)}
if(!user.email_confirmed_at){console.log('A conta ainda não confirmou o e-mail. O perfil não recebeu privilégios. Confirme a caixa de entrada e execute este mesmo comando novamente.');process.exit(0)}
const display=String(user.user_metadata?.display_name||email.split('@')[0]).trim().slice(0,80)||'Administrador';
const profile=await supabase.from('eleao_profiles').upsert({id:user.id,display_name:display,role:'admin',active:true},{onConflict:'id'});
if(profile.error){console.error('O convite foi processado, mas o perfil não pôde ser ativado. Verifique se as migrações e a confirmação do e-mail foram concluídas.');process.exit(1)}
console.log(`Perfil administrador provisionado para ${email}. Entre por convite ou recuperação de senha. Nunca publique SUPABASE_SECRET_KEY.`);
