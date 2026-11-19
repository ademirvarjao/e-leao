// Only explicitly reviewed messages may reach the interface. Backend errors,
// third-party responses and arbitrary exception messages may contain internals.
export const integrationMessages = {
 session:'Sua sessão expirou. Entre novamente para consultar o serviço.',
 access:'Sua conta não tem acesso a esta integração.',
 quota:'Consulta bloqueada. Verifique a situação da conta e a cota diária antes de tentar novamente.',
 input:'A operação foi rejeitada. Confira o documento e os campos informados.',
 timeout:'A consulta fiscal demorou mais que o esperado. Tente novamente.',
 invalid:'Não foi possível ler o resultado do motor fiscal.',
 notConfigured:'Este serviço fiscal ainda não foi conectado. Peça ao administrador para configurar o endereço do motor. A consulta às tabelas públicas continua disponível na calculadora.',
 config:'O endereço configurado não é uma base HTTPS válida do serviço fiscal. Peça a revisão ao administrador.',
 upstreamAuth:'O motor recusou o acesso do e-Leão. O administrador deve conferir a credencial do serviço fiscal; não é necessário trocar a sua senha.',
 route:'O endereço configurado não oferece esta rota do motor. Peça ao administrador para conferir o endereço e a versão instalada.',
 upstream:'Não foi possível obter resposta do motor configurado. Tente novamente ou peça ao administrador para verificar o serviço.',
 gateway:'Não foi possível validar a conexão do e-Leão com o gateway fiscal. Contate o administrador.',
 referenceUnavailable:'O ambiente piloto da Receita não retornou a versão da base. A tabela desta publicação continua disponível.',
 oldGateway:'Esta instalação ainda não oferece a verificação de conexão. Peça ao administrador para atualizar o gateway fiscal.',
 network:'Não foi possível chegar ao gateway fiscal. Verifique a conexão de rede e tente novamente.',
 unavailable:'Serviço fiscal indisponível. Tente novamente ou contate o administrador.',
} as const;
const safeMessages=new Set<string>([...Object.values(integrationMessages),
 'Conclua a verificação de segurança antes de enviar.',
 'Não foi possível verificar ou registrar a solicitação. Refaça a verificação e tente novamente.',
 'Convite ausente. Abra o link recebido do administrador.',
 'Não foi possível utilizar o convite.',
 'Não foi possível utilizar o convite. Contate o administrador.',
 'Link inválido, usado ou expirado. Solicite outro ao administrador.',
 'Senha alterada, mas sessões antigas não puderam ser revogadas. Contate o administrador imediatamente.',
 'Não foi possível alterar a senha. Contate o administrador.',
 'Serviço indisponível. Contate o administrador para análise do convite.',
 'Não foi possível concluir a verificação de segurança. Tente novamente.',
 'Informe um número válido, sem separador de milhar.',
 'A base de cálculo deve ser maior que zero.',
 'Informe um título para a operação.',
 'Informe um nome para o cenário.',
 'Informe uma data válida para o fato gerador.',
 'Confira a vigência e as condições do cenário antes de calcular.',
 'O IS manual requer um cenário personalizado do regime regular.',
 'Informe um valor de serviço maior que zero.',
 'Preencha os nomes do serviço, do prestador e do tomador.',
 'Use um arquivo XML de até 1 MiB.',
 'XML inválido ou com declaração DTD não permitida.',
 'A transmissão não está disponível. Use o emissor autorizado. Nenhuma nota foi transmitida.',
 'O gerador espera o XML nacional com raiz NFSe, não uma DPS ou um rascunho.',
 'Sem confirmação de autorização. Consulte o emissor antes de reenviar.',
 'O gerador não retornou um PDF.',
 'Sua solicitação aguarda aprovação do administrador.',
 'Sua solicitação foi recusada. Entre em contato com o administrador.',
 'O acesso a este espaço está suspenso. Entre em contato com o administrador.',
]);
export function friendly(e:unknown):string{
 const raw=e instanceof Error?e.message:typeof e==='object'&&e!==null&&'message' in e?String(e.message):'';
 if(safeMessages.has(raw)||/^Valor acima do limite de \d+(?:\.\d+)?\.$/.test(raw))return raw;
 if(/invalid login credentials/i.test(raw))return 'E-mail ou senha incorretos.';
 if(/email not confirmed/i.test(raw))return 'Confirme seu e-mail antes de entrar.';
 if(/rate limit|over_email_send_rate_limit/i.test(raw))return 'Muitas tentativas. Aguarde alguns minutos.';
 if(/fetch|network|load failed|timeout/i.test(raw))return 'Não foi possível conectar ao serviço. Verifique a conexão e tente novamente.';
 return 'Não foi possível concluir a operação. Tente novamente ou entre em contato com o administrador.';
}
