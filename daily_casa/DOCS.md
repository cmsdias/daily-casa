# Daily Casa

Aplicação para organizar a casa em conjunto: tarefas pontuais, rotinas recorrentes, lista de compras, equipamentos e documentos da casa, registo de horas e finanças domésticas.

## Vem da «Casa em Dia»?

A 3.0.0 é um add-on novo (`daily_casa`). Os dados passam com uma cópia de segurança: no add-on antigo, *Casa → Definições → Cópias de segurança* → criar e descarregar; parar o antigo; instalar o Daily Casa (repositório `https://github.com/cmsdias/daily-casa`); criar uma conta provisória; **Carregar ficheiro** → **Restaurar**; entrar com a conta de sempre; desinstalar o antigo. Os sensores passam a `sensor.daily_casa_*`.

## Como está organizada

- **Hoje**: o que há para fazer hoje e o que está atrasado, a semana, as compras. «Tenho 15 min / 30 min / 1 hora» sugere as tarefas que cabem nesse tempo.
- **Tarefas**: lista agrupada por quando, rotinas, calendário do mês e estado de cada divisão.
- **+**: criar uma tarefa numa linha (ex.: «Trocar lâmpada amanhã @Ana #Hall !urgente 20 min»), uma rotina, um produto, um registo de horas, uma despesa ou um equipamento.
- **Compras**: lista partilhada e modo «na loja».
- **Casa**: calendário, ocorrências (algo partiu, avariou ou falta, com fotografias), equilíbrio da casa, equipamentos, finanças, pessoas, registo de horas e definições.

## Primeiro acesso

1. Inicie a aplicação e abra **Abrir interface Web** (ou o item **Daily Casa** na barra lateral).
2. Crie a conta de administrador com o seu nome e email. Use uma palavra-passe longa (mínimo 10 caracteres) e diferente da do Home Assistant.
3. O **assistente de início** propõe divisões e rotinas para o tipo de casa (pode voltar a abri-lo em **Definições → A casa**).
4. Em **Casa → Pessoas**, crie (com nome, email e palavra-passe temporária) as contas das restantes pessoas da casa e atribua o perfil adequado.
5. Opcional: em **Definições → A casa**, ajuste as divisões e categorias e importe uma lista de tarefas em JSON.

## Convidar pessoas

Em **Casa → Pessoas → Convidar por email** (administrador): indique o email, o nome (opcional) e o perfil. A pessoa recebe um email com uma ligação válida durante 7 dias, escolhe a sua palavra-passe e entra logo. Se o email não estiver configurado, a app mostra a ligação para a enviar por outro meio (por exemplo, WhatsApp). Os convites por aceitar aparecem em Pessoas, com **Reenviar** e **Cancelar**; o administrador é avisado quando o convite é aceite. Continua a ser possível criar a conta com uma palavra-passe temporária.

## Ver como outro perfil

Em **O teu perfil → Ver como** (administrador), escolha Gestor, Morador ou Colaborador para ver a app como essas pessoas a veem. Só muda a interface neste dispositivo: os dados e as permissões continuam os do administrador. Uma etiqueta dourada indica o modo; **Voltar** regressa ao modo de administrador.

## Perfis

| Perfil | O que pode fazer |
| --- | --- |
| Administrador | Tudo: contas, perfis, definições, cópias de segurança, Home Assistant, importação/exportação, todas as tarefas partilhadas e as Finanças. |
| Gestor | Gerir tarefas partilhadas, atribuir tarefas e rotações, alterar divisões, categorias e o calendário da casa. Finanças. |
| Morador | Ver tarefas partilhadas, gerir as suas e concluir as que lhe foram atribuídas. Pode pedir para atribuir tarefas suas a colaboradores (precisa de aprovação). Sem acesso às Finanças. |
| Colaborador | Apenas tarefas que criou ou que lhe foram atribuídas. Sem acesso às finanças. Se a regra estiver ligada, o que conclui fica «Por aprovar». |

As permissões são verificadas no servidor em cada pedido, não apenas escondidas na interface. Ao mudar o perfil ou a palavra-passe de alguém, as sessões dessa pessoa terminam.

- **Tarefas privadas** só são visíveis para quem as criou, incluindo para o administrador.
- **Entrar:** cada pessoa entra com o seu email. Contas antigas sem email continuam a entrar com o nome de utilizador até acrescentarem o email no perfil.
- **Esqueci-me da palavra-passe:** é enviado um código de 6 dígitos para a app Home Assistant do telemóvel da pessoa (se o administrador lhe tiver ligado o telemóvel) e o administrador é avisado no sino; também pode repor a palavra-passe em Pessoas.
- **Contas novas e palavras-passe repostas** pelo administrador são temporárias: na primeira entrada, a pessoa tem de escolher uma palavra-passe nova.
- **Desativar conta** (em Pessoas): a pessoa deixa de conseguir entrar, as sessões terminam e as tarefas por concluir ficam por atribuir. Ao reativar a conta, essas tarefas voltam a ser atribuídas à pessoa, exceto as que entretanto foram atribuídas a outra. O histórico mantém-se.
- **Dias de acesso** (só colaboradores): o administrador escolhe os dias da semana em que a pessoa pode entrar. Sem dias marcados, o acesso é diário. Usa o fuso horário `Europe/Lisbon` (ou a variável `TZ` do contentor).
- **Equipamentos** (administrador e gestor alteram; moradores consultam; colaboradores não veem): marca, garantia, técnico, documentos e revisões. Trinta dias antes de uma revisão é criada uma tarefa e o administrador e o gestor são avisados.
- **Finanças** (só administrador e gestor): despesas grandes da casa, despesas fixas lançadas automaticamente (mensais, anuais, semestrais ou em meses à escolha), património (contas, depósitos, PPR, investimentos, imóveis, cofre) e créditos (o capital em dívida desce com cada prestação), orçamento anual e objetivos de poupança. Com taxa (TANB) ou entregas programadas, o valor de cada item é estimado todos os dias, com os juros já sem imposto (28% por omissão nas contas e depósitos); é uma estimativa, que se acerta escrevendo o valor real. Ações, ETF e cripto com símbolo (ex.: AAPL, GALP.LS, BTC-EUR) e quantidade atualizam-se uma vez por dia depois das 22:15, com o preço de fecho (Yahoo Finance; para ações americanas, Stooq como alternativa) convertido para euros pela taxa de referência do BCE. O add-on precisa de acesso à internet para isso; se uma fonte falhar, fica o último valor. Os itens do património marcados «só eu» são visíveis apenas para quem os criou.
- **Regras da casa** (Definições → A casa): «Moradores podem pedir para atribuir tarefas a colaboradores» (ligada por omissão) e «O trabalho dos colaboradores precisa de aprovação» (desligada por omissão). O administrador e o gestor aprovam em «Hoje» ou na ficha da tarefa.
- A tabela completa está em **Pessoas → O que cada perfil pode fazer**.

## Acesso

- A aplicação é aberta através do **Ingress** do Home Assistant (barra lateral ou app Companion). Não expõe nenhuma porta na rede.
- Fora de casa, funciona através do acesso remoto que já usa para o Home Assistant, ou pelo endereço próprio da app (ver «Acesso fora de casa»).
- A conta do Daily Casa é independente da conta do Home Assistant.

## Instalar no ecrã principal do telemóvel (sem o cabeçalho do Home Assistant)

Por omissão a app abre dentro do Home Assistant. Para a ter como app própria no iPhone ou no Android, na rede de casa:

1. Em **Definições → Aplicações → Daily Casa → Configuração**, na secção **Rede**, escreva `3000` no campo do acesso direto e guarde. A aplicação reinicia.
2. No telemóvel, ligado ao Wi-Fi de casa, abra no Safari (ou no Chrome) o endereço IP do Home Assistant com a porta, por exemplo `http://192.168.1.50:3000` (o IP está em Definições → Sistema → Rede). O nome `homeassistant.local` nem sempre funciona no iPhone.
   Convém reservar esse IP no router (reserva DHCP), para não mudar e a app instalada continuar a abrir.
3. Entre com o utilizador e a palavra-passe da Daily Casa.
4. iPhone: **Partilhar → Adicionar ao ecrã principal**. Android: **menu → Instalar aplicação**.

A app fica com ícone próprio e em ecrã inteiro. Só funciona na rede de casa; fora de casa continue a usar a app Home Assistant. Para desligar, apague o número no campo do acesso direto.

## Acesso fora de casa (Cloudflare Tunnel)

Com o add-on **Cloudflared** e um domínio próprio, a app fica disponível em HTTPS dentro e fora de casa (por exemplo `https://casa.o-seu-dominio.xyz`).

- No Cloudflared, aponte o endereço da app para a porta 3000. O mais robusto é usar o nome interno do add-on, que aparece em **Casa → Definições → Acesso e segurança** (`http://<nome-do-add-on>:3000`); `http://homeassistant:3000` também funciona com o acesso direto ligado.
- A app só confia nos cabeçalhos do túnel (`CF-Connecting-IP`, `X-Forwarded-Proto`) quando o pedido vem da rede interna dos add-ons (`172.30.33.0/24`). Assim vê o IP real de quem entra e marca o cookie de sessão como `Secure`. Em **Acesso e segurança → Esta ligação** confirma-se se o túnel está a ser reconhecido.
- O endereço externo é detetado na primeira vez que alguém entra pelo túnel e aparece em **Sobre a app → Instalar no telemóvel** e nos emails. Pode ser indicado à mão em **Acesso e segurança**.
- **Proteção da entrada:** 10 tentativas falhadas a partir do mesmo endereço bloqueiam-no 15 minutos (o dobro a cada reincidência, até 24 horas); 20 falhas numa conta numa hora bloqueiam essa conta 30 minutos, de qualquer endereço. O administrador recebe um aviso no sino e pode desbloquear em **Acesso e segurança**. Os pedidos de recuperação de palavra-passe estão limitados a 5 em 15 minutos por endereço e por email. Os bloqueios ficam em memória e terminam quando a app reinicia.

## Recuperar a palavra-passe por email (opcional)

1. Crie (ou use) uma conta Gmail só para a app e ative a **verificação em dois passos**.
2. Na conta Google: **Segurança → Palavras-passe de aplicações** → crie uma para «Daily Casa» e copie as 16 letras.
3. Em **Definições → Aplicações → Daily Casa → Configuração**, preencha **Email de envio (Gmail)** e **Palavra-passe de aplicação** (o campo fica oculto); o **Nome do remetente** é «Daily Casa». Guarde e reinicie a app.
4. Em **Casa → Definições → Acesso e segurança**, carregue em **Enviar email de teste para mim**.

Quem carregar em «Esqueci-me da palavra-passe» recebe um código de 6 dígitos válido 15 minutos, por email e (se estiver ligada) na app Home Assistant do telemóvel. A palavra-passe de aplicação só existe nas opções do add-on: não é mostrada na app nem vai para as cópias de segurança da app (as cópias do Home Assistant incluem as opções do add-on).

## Notificações no telemóvel

- **Notificações da app (recomendado):** em **O teu perfil**, ligue **Notificações neste telemóvel**. Tudo o que chega ao sino passa a aparecer também no telemóvel, mesmo com a app fechada. Cada pessoa liga no seu telemóvel; não depende da app Home Assistant.
  - Exige o endereço seguro (`https://…`, ver «Acesso fora de casa»).
  - No iPhone/iPad (iOS 16.4 ou mais recente), a app tem de estar **instalada no ecrã principal** e ser aberta pelo ícone; só então aparece o interruptor.
  - Ao ligar, o telemóvel pede autorização e chega logo uma notificação de teste.
- **O que chega** (o mesmo que aparece no sino):
  - **Tarefas:** tarefa atribuída a si; a sua vez numa rotina com rotação; alguém concluiu uma tarefa que criou.
  - **Aprovações** (com as regras da casa ligadas): pedido de atribuição a um colaborador e trabalho de colaborador «por aprovar» (administrador e gestor); a decisão sobre o seu pedido ou trabalho (quem pediu ou fez).
  - **Ocorrências:** nova ocorrência (administrador e gestor; urgente se a gravidade for alta); ocorrência que reportou foi resolvida.
  - **Equipamentos** (administrador e gestor): revisão marcada (30 dias antes) e garantia a terminar.
  - **Avisos diários,** a partir da hora do resumo diário (por omissão 08:30): tarefas para hoje e atrasadas; aniversários (hoje e amanhã; não para colaboradores); no início do mês, o calendário da casa (administrador e gestor).
  - **Segurança** (administrador): alguém pediu para recuperar a palavra-passe; endereço ou conta bloqueados por tentativas falhadas.
- **Escolher o que chega:** em **O teu perfil → Sobre o que te avisamos**, cada pessoa liga ou desliga cada tipo (só aparecem os que se aplicam ao seu perfil). Os avisos de segurança e os códigos de recuperação são sempre enviados; no sino continua a aparecer tudo.
- **Pela app Home Assistant (opcional):** continua disponível para quem o administrador associou em **Definições → Notificações e Home Assistant**. Quem já recebe as notificações da app deixa de as receber em duplicado pelo Home Assistant (fica o resumo diário e os códigos de recuperação).

## Dados e cópias de segurança

- Todos os dados ficam em `/data/casa.json`, criado no primeiro arranque e mantido entre atualizações. As fotografias das tarefas ficam em `/data/photos` e os documentos dos equipamentos em `/data/docs` (incluídos nas cópias do Home Assistant, não nas cópias JSON da app).
- **Cópias automáticas da aplicação:** uma por dia e outra antes de cada atualização de versão, em `/data/backups` (ficam as últimas 14 diárias). Em **Definições → Dados e cópias**, o administrador pode criar, descarregar, carregar e restaurar cópias. Antes de restaurar, o estado atual é guardado.
- As cópias de segurança do Home Assistant incluem estes dados. A aplicação é parada durante a cópia (`backup: cold`) para garantir que o ficheiro fica consistente.
- Em **Definições**, o administrador pode exportar tarefas, compras, trabalhos e histórico para JSON (sem palavras-passe). **As finanças não são incluídas nesta exportação**; dependem da cópia de segurança do Home Assistant.
- A importação aceita até 500 tarefas por ficheiro e ignora duplicados (mesmo título, divisão e tipo).

## Atualizar

1. Crie uma cópia de segurança do Home Assistant (a aplicação também guarda uma cópia própria antes de mudar de versão).
2. Em **Definições → Aplicações**, verifique se há atualizações e selecione **Atualizar** no Daily Casa.
3. Abra a aplicação, confirme a versão em **Definições** e verifique que os dados continuam presentes.

## Home Assistant (opcional)

Em **Definições → Notificações e Home Assistant** (administrador):

- **Notificações** para a app Home Assistant de cada pessoa: tarefa atribuída e resumo diário à hora escolhida.
- **Sensores** `sensor.daily_casa_*`: tarefas por fazer, atrasadas, para hoje, compras por fazer, última conclusão, «hoje» (lista das tarefas de hoje e atrasadas) e estado da casa (%).
- **Cartão para o painel**: código pronto a colar num painel (por exemplo, num tablet na cozinha) com as tarefas de hoje, o estado da casa e as compras. As tarefas privadas e as finanças nunca são incluídas.
- **Automações:** o Home Assistant pode criar tarefas e produtos de compras através de `rest_command`, com um token próprio (a configuração pronta a copiar está nessa secção).

A aplicação pede acesso à API do Home Assistant (`homeassistant_api`) só para isto. Enquanto nada for configurado, não envia nada.

## Limitações

- Sem ligação, a app abre com os últimos dados guardados no dispositivo. Concluir tarefas e mexer nas compras fica em fila e é enviado quando a ligação voltar; as restantes alterações exigem ligação.
- A aplicação não faz pedidos a serviços externos (a letra está incluída).
- Pensada para uma casa (poucas pessoas em simultâneo). Os dados são gravados num único ficheiro JSON.
