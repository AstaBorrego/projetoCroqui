<!-- Declaração do tipo de documento HTML5 -->
<!DOCTYPE html>
<!-- Definição do idioma da página como Português do Brasil -->
<html lang="pt-BR">
<!-- Cabeçalho da página com metadados e folhas de estilo -->
<head>
    <!-- Configuração de codificação de caracteres UTF-8 -->
    <meta charset="UTF-8">
    <!-- Meta tag de viewport para responsividade em dispositivos móveis e tablets -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Título exibido na aba do navegador -->
    <title>Painel de Croqui</title>
    <!-- Ícone da aba do navegador -->
    <link rel="icon" href="{{ url_for('static', filename='image/logo_iar.jpeg') }}" type="image/jpeg">
    <!-- Folha de estilo externa CSS -->
    <link rel="stylesheet" href="{{ url_for('static', filename='style.css') }}">
</head>
<!-- Corpo do documento -->
<body>
    <!-- Barra superior de navegação e cabeçalho -->
    <div class="bar bg-dark">
        <!-- Título do painel administrativo -->
        <h2>Painel de Croqui (Administrador)</h2>
        <!-- Área de identificação do usuário e logout -->
        <div class="user-info">
            <!-- Rótulo onde o e-mail do usuário logado será exibido dinamicamente -->
            <span id="userDisplay"></span>
            <!-- Botão de encerramento da sessão que invoca a função de logout -->
            <button onclick="window.fazerLogout()" class="btn-danger">Sair</button>
        </div>
    </div>

    <!-- Container onde as abas dos colaboradores conectados serão inseridas -->
    <div id="tabsContainer" class="tabs-container"></div>

    <!-- Workspace principal dividida em colunas -->
    <div class="workspace-container">
        <!-- Coluna da esquerda: Chat em Tempo Real -->
        <div class="sidebar-left">
            <h3>Chat em Tempo Real</h3>
            <!-- Caixa de exibição das mensagens recebidas -->
            <div id="chatBox" class="chat-box"></div>
            <!-- Formulário para envio de novas mensagens no chat -->
            <form id="chatForm" class="chat-input">
                <input type="text" id="chatInput" placeholder="Sua mensagem..." required>
                <button type="submit">Enviar</button>
            </form>
        </div>

        <!-- Coluna central: Área de visualização e edição do Canvas -->
        <div class="editor-area-center">
            <h3>Croqui do Colaborador</h3>
            <!-- Envolvente do elemento Canvas com resolução definida no HTML -->
            <div class="canvas-wrapper">
                <canvas id="croquiCanvas" width="800" height="600"></canvas>
            </div>
            
            <!-- Grupo de botões de ação do painel administrativo -->
            <div class="actions">
                <!-- Botão para limpar todo o desenho do canvas -->
                <button id="btnClear" class="btn-danger">Limpar Canvas</button>
                <!-- Botão para salvar o croqui atual como arquivo PNG no computador -->
                <button id="btnSave" class="btn-success">Salvar Croqui</button>
                <!-- Botão para enviar a imagem do croqui para a impressora -->
                <button id="btnPrint" class="action-btn">Imprimir Croqui</button>
            </div>
        </div>

        <!-- Coluna da direita: Barra de ferramentas de desenho -->
        <div class="sidebar-right">
            <h3>Ferramentas</h3>
            <div class="vertical-toolbar">
                <button class="tool-btn active" data-tool="pencil">✏️ Lápis</button>
                <button class="tool-btn" data-tool="brush">🖌️ Pincel</button>
                <button class="tool-btn" data-tool="line">📏 Linha</button>
                <button class="tool-btn" data-tool="rect">🔲 Retângulo</button>
                <button class="tool-btn" data-tool="circle">⭕ Círculo</button>
                <button class="tool-btn" data-tool="text">🔤 Texto</button>
                <button class="tool-btn" data-tool="eraser">🧹 Borracha</button>
            </div>
            <hr class="divider">
            <div class="control-group">
                <label for="colorPicker">Cor do Traço:</label>
                <input type="color" id="colorPicker" value="#000000">
            </div>
            <div class="control-group">
                <label for="lineWidth">Espessura:</label>
                <input type="range" id="lineWidth" min="1" max="20" value="3">
            </div>
            <button id="btnUndo" class="action-btn">↪️ Desfazer</button>
        </div>
    </div>

    <!-- Scripts de inicialização e módulos do sistema -->
    <script type="module" src="{{ url_for('static', filename='firebase-config.js') }}"></script>
    <script type="module" src="{{ url_for('static', filename='login.js') }}"></script>
    <script type="module" src="{{ url_for('static', filename='dashboard.js') }}"></script>
</body>
</html>
