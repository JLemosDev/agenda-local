# Agenda Local

Uma agenda para pequenos negócios, com profissionais, serviços e reservas persistidas. A demonstração usa o **Estúdio Horizonte**, um negócio fictício, e separa os dados de cada visitante.

> Projeto de portfólio desenvolvido com assistência de IA. Serve para demonstrar implementação, organização e regras de negócio; não representa um serviço comercial contratado.

![Tela da Agenda Local](docs/agenda-local.png)

## O que você pode experimentar

- Consultar a agenda por data e profissional.
- Criar uma reserva, escolhendo um horário realmente disponível.
- Finalizar ou cancelar um atendimento; cancelamentos liberam o horário.
- Acompanhar quantidade de atendimentos, tempo reservado e valor previsto dos serviços.
- Usar a interface no celular, com estados de carregamento, erro e lista vazia.

Serviços fictícios: corte (30 min), barba (30 min) e combo (60 min). Atendimento de segunda a sábado, das 9h às 18h, com datas até 90 dias à frente. Horários seguem **America/Sao_Paulo**.

## Tecnologias e decisões

React 19, TypeScript, Vinext/Vite, Cloudflare Workers, SQLite/D1 e Drizzle.

- **Banco real:** reservas não dependem do armazenamento do navegador.
- **Isolamento da demonstração:** um cookie de sessão identifica o espaço fictício de cada visitante. Apagar o cookie inicia outro espaço; ele não é uma conta de usuário.
- **Concorrência:** os intervalos ocupados têm chave única por espaço, profissional, data e minuto. Inserção e ocupação são feitas em uma transação D1; reservas sobrepostas retornam conflito sem criar registros parciais.
- **Cancelamento:** altera o estado e libera os intervalos ocupados em uma operação atômica.
- **Validação no servidor:** calendário, horários, duração, limites de texto e origem das alterações.
- **WebMCP:** a página oferece leitura da agenda, criação e cancelamento com as mesmas regras usadas pela interface.

## Executar localmente

Requisitos: Node.js 22.13 ou superior e npm.

```sh
git clone https://github.com/JLemosDev/agenda-local.git
cd agenda-local
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_busy_gertrude_yorkes.sql
npm run dev
```

Abra o endereço indicado no terminal (normalmente http://localhost:5173). A migração cria o banco **uma vez**. O diretório local `.wrangler` contém os dados e não é enviado ao GitHub.

Para executar o build local: `npm start`.

## Verificar

```sh
npm test
npx tsc --noEmit
npm run build
```

Os testes de domínio cobrem datas inválidas, fuso horário, domingo, horário de encerramento, grade de atendimento, conflitos, encaixe entre reservas, duração dos serviços e limites de entrada. O fluxo completo também foi verificado no navegador com o banco local.

## Estrutura

| Pasta | Responsabilidade |
|---|---|
| app | Interface e rotas HTTP |
| lib | Regras e operações no banco |
| db | Esquema de dados |
| drizzle | Migrações versionadas |
| tests | Testes do domínio |
| scripts | Execução do framework e ambiente local |

## Limites e próximos passos

Esta versão é uma **demonstração pública de portfólio**, destinada somente a nomes e observações fictícios. Não cadastre informações pessoais ou de clientes reais.

Não inclui contas de empresas, recuperação de senha, cobrança, WhatsApp, notificações ou bloqueios personalizados por profissional. Os serviços e profissionais são dados de exemplo. Um uso comercial exigiria autenticação, permissões, gestão de disponibilidade, retenção de dados e operação com backups.

Os espaços de demonstração não têm limpeza automática nesta versão. O limite de reservas por espaço reduz uso acidental, mas não substitui proteção contra abuso. O framework Vinext está em versão beta.

## Contato

[JLemosDev no GitHub](https://github.com/JLemosDev) · lemosjoaovitorlemos@gmail.com

