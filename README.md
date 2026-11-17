# Lunna SDR

App desktop (Windows e Mac) que chama no WhatsApp quem responde o seu formulário do **Respondi**.

Fluxo: o lead responde o Respondi → o Respondi grava a linha numa planilha Google → o Lunna SDR lê a planilha a cada 2 min → envia a mensagem pelo **seu** WhatsApp (conectado por QR code, como no WhatsApp Web).

## Baixar e instalar

Vá em **[Releases](../../releases/latest)** e baixe:

| Sistema | Arquivo |
|---|---|
| Windows | `Lunna-SDR-Setup-x.y.z.exe` |
| Mac com chip Apple (M1, M2, M3, M4) | `Lunna-SDR-x.y.z-mac-arm64.dmg` |
| Mac com Intel | `Lunna-SDR-x.y.z-mac-x64.dmg` |

**Pré-requisito:** o **Google Chrome** precisa estar instalado (o app usa ele, invisível, para o WhatsApp).

### Windows
Abra o `.exe`. Se aparecer "O Windows protegeu o computador", clique **Mais informações → Executar assim mesmo** (o app não tem certificado pago de assinatura).

### Mac
1. Abra o `.dmg` e arraste **Lunna SDR** para **Aplicativos**.
2. Na primeira vez, o Mac bloqueia apps sem certificado da Apple. Abra o **Terminal** e rode:
   ```bash
   xattr -cr "/Applications/Lunna SDR.app"
   ```
   Depois abra normalmente. (Alternativa: **Ajustes do Sistema → Privacidade e Segurança → Abrir Mesmo Assim**.)

## Primeiro uso

1. **WhatsApp:** escaneie o QR que aparece no app (celular: **WhatsApp → Aparelhos conectados → Conectar um aparelho**). O login fica salvo.
2. **Respondi → planilha:** no formulário do Respondi, **Opções → Configurar integrações → Google Planilhas → Conectar**, e adicione a ação "Adicionar uma nova linha na planilha".
3. **Planilha → app (Apps Script, ~3 min):**
   1. No app, **Configurações → 1. Copiar código do Apps Script**.
   2. Na planilha **Respondi | ...**: **Extensões → Apps Script**, apague o conteúdo, cole e salve (Ctrl/Cmd+S).
   3. **Implantar → Nova implantação** → engrenagem → **App da Web**. *Executar como:* Eu. *Quem pode acessar:* Qualquer pessoa. **Implantar** e autorize (se aparecer "O Google não verificou este app": **Avançado → Acessar**).
   4. Copie o **URL do app da Web** (termina em `/exec`), cole em **2. Link do App da Web** e clique **Salvar**.

   O link só devolve dados com o código secreto gerado pelo app (já embutido no script). Não compartilhe o link.

## Como o envio funciona

- **Automático:** respostas que chegarem **depois** da primeira abertura do app são enviadas sozinhas, uma por vez, com 25–37 s entre elas.
- Respostas **antigas** ficam como **Aguardando** — clique **Enviar** se quiser chamá-las. Evita disparar para a base inteira por engano.
- Ninguém recebe duas vezes (o app guarda o histórico por telefone).
- Respostas **incompletas**, telefones **inválidos** e números **sem WhatsApp** não recebem.
- **Pausar envios** para a fila na hora.
- O app só envia **enquanto estiver aberto**. Ao reabrir, ele chama quem respondeu enquanto estava fechado.

Mensagem, intervalo e frequência de busca ficam em **Configurações** (`{nome}` = primeiro nome do lead).

## Onde ficam os dados

Botão **Pasta de dados**:
- Windows: `%APPDATA%\Lunna SDR`
- Mac: `~/Library/Application Support/Lunna SDR`

Contém `config.json`, `historico.json` e a sessão do WhatsApp (`whatsapp-sessao`).

## Para desenvolvedores

```bash
npm install
npm start          # abre o app em modo desenvolvimento
npm run check      # testes da leitura de leads
npm run dist:win   # gera o instalador Windows em dist/
npm run dist:mac   # gera os .dmg (precisa rodar num Mac)
```

Os instaladores de Windows e Mac são gerados automaticamente pelo GitHub Actions ao publicar uma tag `v*` (ex.: `v1.0.1`) e anexados em Releases.

Alternativa à planilha via Apps Script: conta de serviço do Google com chave JSON (**Configurações → Alternativa: chave de conta de serviço**), compartilhando a planilha com o e-mail da conta como Leitor.

## Aviso

O app automatiza o WhatsApp Web (biblioteca `whatsapp-web.js`), o que não é oficialmente permitido pelo WhatsApp. Mantenha volume baixo e intervalo entre envios para reduzir o risco de bloqueio do número.
