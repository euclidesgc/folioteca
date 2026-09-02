---
name: react-auth-guards
description: "Rota protegida e papéis no cliente: guarda de rota com destino de retorno, renderização condicional por papel, e o limite de que o cliente esconde mas não autoriza."
---

# Rota protegida e papéis no cliente

## O aviso que vem antes de tudo

**O cliente não autoriza. Ele esconde.**

Todo o código desta skill roda no navegador do usuário, num pacote que ele pode
ler, pausar e editar. Qualquer pessoa consegue trocar `role: 'viewer'` por
`role: 'admin'` no estado da aplicação, ou simplesmente chamar a API com `curl`
sem passar pela tela. **A autorização real é do servidor, sempre, em toda rota
da API.**

A guarda de rota existe por outra razão, legítima e diferente: **não mostrar ao
usuário uma tela que ele não vai conseguir usar.** Uma tela de administração que
carrega, pisca e devolve 403 em cada requisição é uma experiência pior do que um
item de menu que não aparece — e nenhuma das duas é segurança.

Se a única coisa que impede um usuário comum de apagar um registro é o botão
estar escondido, o registro está desprotegido.

## Quando esta skill vale

Vale ao montar uma rota que exige sessão, ao esconder um controle por papel e ao
revisar qualquer código que leia `user.role`.

## A regra

1. **Uma guarda por rota, em `src/app/routes/`**, não uma verificação repetida
   dentro de cada página.
2. **A guarda distingue três situações**: sessão carregando, sem sessão, e com
   sessão mas sem papel. As três têm destinos diferentes.
3. **Sem sessão vai para o login com o destino guardado**, para que o usuário
   volte ao que estava tentando fazer.
4. **Papel é lido de um único lugar** — a fatia de sessão da skill
   `react-state-app` —, nunca de `localStorage` espalhado pelos componentes.
5. **Token de acesso em memória**, não em `localStorage`; o refresh fica em
   cookie `HttpOnly` emitido pelo servidor.

## Exemplo

**Errado** — verificação dentro da página, sem estado de carregamento, sem
destino de retorno:

```tsx
function AdminPage() {
  const user = JSON.parse(localStorage.getItem('user') ?? 'null');
  if (user?.role !== 'admin') return <p>Sem permissão.</p>;
  return <AdminDashboard />;
}
```

Três defeitos: enquanto a sessão carrega, `user` é `null` e a página pisca "Sem
permissão"; o usuário deslogado perde o endereço que queria; e a leitura de
`localStorage` se repete em toda página que precisar do papel.

**Certo** — guarda única, três situações, destino preservado:

```tsx
type ProtectedRouteProps = {
  roles?: UserRole[];
  children: ReactNode;
};

export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const location = useLocation();
  const { user, status } = useSession();

  if (status === 'loading') return <FullPageSpinner label="Verificando sua sessão…" />;

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/sem-acesso" replace />;
  }

  return children;
}
```

```tsx
<Route
  path="/admin"
  element={
    <ProtectedRoute roles={['admin']}>
      <AdminDashboard />
    </ProtectedRoute>
  }
/>
```

E o login devolve o usuário ao ponto de partida:

```tsx
const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/';
navigate(from, { replace: true });
```

## Esconder controle por papel

**Certo** — um componente único, e o servidor continua sendo quem decide:

```tsx
export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const user = useSessionUser();
  if (!user || !roles.includes(user.role)) return null;
  return children;
}
```

```tsx
<RequireRole roles={['admin', 'manager']}>
  <Button variant="destructive" onClick={() => deleteOrder.mutate(order.id)}>
    Excluir pedido
  </Button>
</RequireRole>
```

A rota `DELETE /orders/:id` verifica o papel de novo, no servidor. Sem isso, o
botão escondido é decoração.

## Sessão expirada

O 401 tem um dono único: o interceptador de resposta do cliente HTTP, descrito
na skill `react-api-layer`. Ele encerra a sessão, limpa o cache das queries e
manda para o login com o destino guardado.

**Errado** — cada tela decidindo o que fazer com 401:

```tsx
if (error.status === 401) navigate('/login');
```

Espalha a decisão, e cada cópia esquece um pedaço — limpar o cache, guardar o
destino, evitar o redirecionamento em cascata quando três queries falham juntas.

## Erros comuns

- **Tratar a guarda como segurança.** É o erro que esta skill existe para
  impedir. A rota da API é que autoriza.
- **Redirecionar durante a carga da sessão.** O usuário logado é jogado para o
  login a cada refresh, porque `status` ainda era `loading`.
- **Token em `localStorage`.** Qualquer script de terceiro na página o lê. Em
  memória, com refresh em cookie `HttpOnly`, o roubo por script deixa de ser
  trivial.
- **Papel decodificado do JWT no cliente para tomar decisão de negócio.** O
  cliente lê o token sem verificar a assinatura; serve para desenhar a tela, não
  para liberar operação.
- **`<Navigate>` sem `replace`.** O botão voltar devolve o usuário à rota
  protegida, que redireciona de novo, e o histórico entra em laço.
- **Cache das queries não limpo no logout.** O próximo usuário na mesma máquina
  vê, por um instante, os dados do anterior.

## Ponteiros

- `templates/protected-route.tsx` — guarda com as três situações.
- `templates/require-role.tsx` — renderização condicional por papel.
- Onde a sessão vive: skill `react-state-app`.
- Onde o 401 é tratado: skill `react-api-layer`.
- Autorização no servidor e varredura de segredo: skill `security-baseline`.
