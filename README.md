# Carteira — aplicativo de empréstimos

Aplicativo PWA para GitHub Pages com acesso por nome da conta e senha, separação de dados por usuário, clientes, empréstimos, parcelas, pagamentos, atrasos e fechamento mensal.

## Passo 1 — criar o projeto no Supabase

1. Entre em https://supabase.com e crie um projeto.
2. No menu lateral, abra **SQL Editor** e clique em **New query**.
3. Abra o arquivo `supabase.sql`, copie todo o conteúdo, cole no editor e clique em **Run**.
4. Abra **Authentication > Providers > Email** e mantenha Email habilitado.
5. Desative **Confirm email** e salve. Este passo é obrigatório nesta primeira versão, pois o usuário entra somente com nome da conta e senha.

O aplicativo cria internamente um identificador técnico no formato `nome-da-conta@acesso.carteira.local`. Esse endereço nunca aparece para o usuário e não recebe mensagens. Depois dos testes, o cadastro poderá ser evoluído para usar e-mail real, recuperação de senha ou outro método de acesso.

## Passo 2 — conectar o aplicativo

1. No Supabase, abra **Project Settings > API**.
2. Copie a **Project URL**.
3. Copie a **Publishable key**. Em projetos antigos, use a chave `anon`.
4. Abra `config.js` e substitua os dois textos `COLE_AQUI...`.
5. Não coloque chave `secret` nem `service_role` no aplicativo.

## Passo 3 — subir no GitHub

Não envie um ZIP. Envie os arquivos extraídos, mantendo esta estrutura:

```text
index.html
style.css
script.js
config.js
manifest.json
sw.js
.nojekyll
supabase.sql
README.md
icons/
  icon-192.png
  icon-512.png
```

No repositório, abra **Settings > Pages**. Em **Build and deployment**, escolha **Deploy from a branch**, selecione a branch `main`, pasta `/ (root)` e salve.

## Passo 4 — configurar a URL no Supabase

1. Copie o endereço publicado pelo GitHub Pages.
2. No Supabase, abra **Authentication > URL Configuration**.
3. Em **Site URL**, cole o endereço do aplicativo.
4. Em **Redirect URLs**, adicione o mesmo endereço terminado por `/**`.

## Passo 5 — instalar no celular

Abra o endereço do GitHub Pages no Chrome. No menu do navegador, toque em **Adicionar à tela inicial** ou **Instalar app**.

## Planos incluídos

- Diário: R$ 500 = 20 × R$ 35; R$ 600 = 20 × R$ 40; R$ 700 = 20 × R$ 46; R$ 800 = 20 × R$ 54; R$ 900 = 20 × R$ 60; R$ 1.000 = 20 × R$ 65. Domingos são pulados.
- Semanal: opções de 4, 6 e 8 semanas estão na constante `WEEKLY` no início de `script.js`.
- Mensal: o valor emprestado, a quantidade de meses e o valor de cada parcela são digitados manualmente no cadastro.

## Observações importantes

- A URL e a chave pública do Supabase ficam visíveis no navegador por definição. A segurança dos dados é feita pelas políticas RLS do arquivo SQL.
- Cada usuário autenticado acessa somente os próprios registros.
- Na tela inicial, o usuário escolhe um nome de conta e uma senha. Depois, entra sempre com esses mesmos dois dados.
- Se esquecer a senha nesta primeira versão, não haverá recuperação automática. A recuperação será adicionada na próxima etapa.
- O aplicativo precisa ser testado pelo endereço HTTPS do GitHub Pages. Abrir `index.html` diretamente no computador não testa corretamente o PWA.
- Para uso real de concessão de crédito, valide as obrigações jurídicas, tributárias, de cobrança e de proteção de dados aplicáveis.
