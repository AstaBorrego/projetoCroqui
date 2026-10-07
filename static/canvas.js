// Exporta a classe CroquiEngine para ser utilizada por outros módulos JS
export class CroquiEngine {
    // Método construtor da classe que recebe o ID do elemento canvas e a função de callback
    constructor(canvasId, onDrawCallback) {
        // Obtém o elemento Canvas do documento HTML através do seu ID
        this.canvas = document.getElementById(canvasId);
        // Cancela a execução da inicialização caso o elemento canvas não seja localizado na página
        if (!this.canvas) return;

        // Configura o contexto de renderização 2D ativando a otimização de leitura frequente de pixels
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        // Define a ferramenta de desenho inicial padrão como lápis
        this.currentTool = 'pencil';
        // Define a cor inicial do traço como preta
        this.currentColor = '#000000';
        // Define a espessura inicial da linha como 3 pixels
        this.lineWidth = 3;
        
        // Inicializa a variável de controle para verificar se o utilizador está a desenhar
        this.isDrawing = false;
        // Armazena a posição X do ponto onde o traço foi iniciado
        this.startX = 0;
        // Armazena a posição Y do ponto onde o traço foi iniciado
        this.startY = 0;
        // Variável reservada para armazenar o estado atual da imagem do canvas durante o desenho de formas
        this.snapshot = null;
        
        // Array para armazenar o histórico de estados do canvas para a funcionalidade de desfazer
        this.history = [];
        // Guarda a função de callback enviada por parâmetro para notificar alterações no desenho
        this.onDrawCallback = onDrawCallback;

        // Executa o método responsável por vincular os eventos de rato e de ecrã tátil
        this.initEvents();
    }

    // Método responsável por configurar todos os ouvintes de eventos
    initEvents() {
        // Vincula o clique inicial do rato ao método startDraw
        this.canvas.addEventListener('mousedown', (e) => this.startDraw(e));
        // Vincula o movimento do rato no canvas ao método drawing
        this.canvas.addEventListener('mousemove', (e) => this.drawing(e));
        // Vincula a libertação do botão do rato ao método stopDraw
        this.canvas.addEventListener('mouseup', (e) => this.stopDraw(e));
        // Vincula a saída do ponteiro do rato da área do canvas ao método stopDraw
        this.canvas.addEventListener('mouseleave', (e) => this.stopDraw(e));

        // Vincula o toque inicial no ecrã tátil (telemóveis e tablets)
        this.canvas.addEventListener('touchstart', (e) => {
            // Previne o comportamento padrão de rolagem da página ao tocar no canvas
            e.preventDefault();
            // Inicia o desenho utilizando as coordenadas do primeiro toque tátil
            this.startDraw(e.touches[0]);
        // Configura o ouvinte como não passivo para permitir o cancelamento do evento com preventDefault
        }, { passive: false });

        // Vincula o movimento do dedo no ecrã tátil durante o desenho
        this.canvas.addEventListener('touchmove', (e) => {
            // Previne a rolagem do ecrã durante o arrasto do desenho
            e.preventDefault();
            // Atualiza o desenho com a nova posição do toque tátil
            this.drawing(e.touches[0]);
        // Garante a permissão de cancelamento do evento de rolagem
        }, { passive: false });

        // Vincula o momento em que o dedo é retirado do ecrã tátil
        this.canvas.addEventListener('touchend', (e) => {
            // Finaliza o processo de desenho
            this.stopDraw(e);
        });
    }

    // Método para alterar a ferramenta de desenho atual
    setTool(tool) {
        // Atualiza a propriedade da ferramenta selecionada
        this.currentTool = tool;
    }

    // Método para definir a cor do desenho
    setColor(color) {
        // Atualiza a cor atual do traço e preenchimento
        this.currentColor = color;
    }

    // Método para alterar a espessura da linha
    setLineWidth(width) {
        // Atualiza o valor da largura da linha
        this.lineWidth = width;
    }

    // Método que guarda a imagem atual no histórico de estados
    saveState() {
        // Limita o histórico a 20 passos removendo o registo mais antigo caso atinja a capacidade máxima
        if (this.history.length >= 20) this.history.shift();
        // Insere a imagem atual em formato de dados de pixel no histórico
        this.history.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
    }

    // Método para desfazer a última alteração efetuada no canvas
    undo() {
        // Verifica se existem dados gravados no histórico
        if (this.history.length > 0) {
            // Remove e obtém o último estado gravado no histórico
            const lastState = this.history.pop();
            // Restaura os dados do estado anterior no contexto do canvas
            this.ctx.putImageData(lastState, 0, 0);
            // Executa a função de callback enviando a imagem atualizada caso ela exista
            if (this.onDrawCallback) this.onDrawCallback(this.exportDataURL());
        }
    }

    // Método para calcular as coordenadas exatas do cursor ou toque no canvas
    getPos(e) {
        // Obtém os limites e a posição física do canvas na janela do navegador
        const rect = this.canvas.getBoundingClientRect();
        // Calcula o fator de escala horizontal entre a resolução interna e a largura exibida na tela
        const scaleX = this.canvas.width / rect.width;
        // Calcula o fator de escala vertical entre a resolução interna e a altura exibida na tela
        const scaleY = this.canvas.height / rect.height;

        // Retorna um objeto com as coordenadas X e Y corrigidas pela escala
        return {
            // Posição X corrigida subtraindo a margem esquerda do elemento e aplicando a escala
            x: (e.clientX - rect.left) * scaleX,
            // Posição Y corrigida subtraindo a margem superior do elemento e aplicando a escala
            y: (e.clientY - rect.top) * scaleY
        };
    }

    // Método invocado ao iniciar um traço ou forma
    startDraw(e) {
        // Marca a flag de desenho ativo como verdadeira
        this.isDrawing = true;
        // Salva o estado atual no histórico antes da nova alteração
        this.saveState();
        
        // Calcula a posição do evento de início
        const pos = this.getPos(e);
        // Define a posição X inicial
        this.startX = pos.x;
        // Define a posição Y inicial
        this.startY = pos.y;

        // Define a cor do traço de acordo com a ferramenta (branco caso seja borracha)
        this.ctx.strokeStyle = this.currentTool === 'eraser' ? '#ffffff' : this.currentColor;
        // Define a cor de preenchimento
        this.ctx.fillStyle = this.currentColor;
        // Aplica a largura da linha no contexto do canvas
        this.ctx.lineWidth = this.lineWidth;
        // Configura o acabamento das extremidades da linha como arredondado
        this.ctx.lineCap = 'round';
        // Configura o acabamento das junções das linhas como arredondado
        this.ctx.lineJoin = 'round';
        // Aplica transparência de 0.4 para a ferramenta pincel ou opacidade total (1.0) para as restantes
        this.ctx.globalAlpha = this.currentTool === 'brush' ? 0.4 : 1.0;

        // Captura o estado do canvas para renderização dinâmica de formas geométricas
        this.snapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        // Verifica se a ferramenta atual é de desenho livre (lápis, pincel ou borracha)
        if (this.currentTool === 'pencil' || this.currentTool === 'brush' || this.currentTool === 'eraser') {
            // Inicia o novo caminho de vetor no canvas
            this.ctx.beginPath();
            // Move o cursor para o ponto inicial de desenho
            this.ctx.moveTo(this.startX, this.startY);
        // Executa o fluxo de inserção de texto caso a ferramenta seja 'text'
        } else if (this.currentTool === 'text') {
            // Exibe uma caixa de diálogo solicitando o texto ao utilizador
            const text = prompt("Digite o texto para o croqui:");
            // Caso o utilizador informe um texto válido
            if (text) {
                // Restaura a opacidade total para o texto
                this.ctx.globalAlpha = 1.0;
                // Define a fonte e o tamanho proporcional à espessura da linha
                this.ctx.font = `${Math.max(14, this.lineWidth * 4)}px Arial`;
                // Renderiza o texto nas posições X e Y capturadas
                this.ctx.fillText(text, this.startX, this.startY);
                // Finaliza o ciclo de desenho
                this.stopDraw();
            // Se o utilizador cancelar a caixa de diálogo
            } else {
                // Cancela o estado de desenho ativo
                this.isDrawing = false;
            }
        }
    }

    // Método executado continuamente enquanto o cursor ou toque se move no canvas
    drawing(e) {
        // Cancela a execução se a instrução de desenho não estiver ativa
        if (!this.isDrawing) return;

        // Obtém as coordenadas atuais do cursor ou do toque
        const pos = this.getPos(e);
        // Guarda a posição X atual
        const currentX = pos.x;
        // Guarda a posição Y atual
        const currentY = pos.y;

        // Trata o desenho contínuo das ferramentas manuais
        if (this.currentTool === 'pencil' || this.currentTool === 'brush' || this.currentTool === 'eraser') {
            // Adiciona uma linha até à coordenada atual
            this.ctx.lineTo(currentX, currentY);
            // Renderiza o contorno da linha na tela
            this.ctx.stroke();
        // Trata a renderização dinâmica de formas geométricas (linha, retângulo, círculo)
        } else {
            // Restaura o estado salvo da imagem para evitar o efeito de borrão/rastro ao arrastar
            this.ctx.putImageData(this.snapshot, 0, 0);
            // Inicia o caminho da nova forma
            this.ctx.beginPath();
            // Garante opacidade padrão para o traçado da forma
            this.ctx.globalAlpha = 1.0;

            // Renderização de linha reta
            if (this.currentTool === 'line') {
                // Posiciona a origem na coordenada inicial
                this.ctx.moveTo(this.startX, this.startY);
                // Desenha a linha até à coordenada atual
                this.ctx.lineTo(currentX, currentY);
                // Exibe a linha na tela
                this.ctx.stroke();
            // Renderização de retângulo
            } else if (this.currentTool === 'rect') {
                // Desenha o contorno do retângulo com base no deslocamento inicial e final
                this.ctx.strokeRect(this.startX, this.startY, currentX - this.startX, currentY - this.startY);
            // Renderização de círculo
            } else if (this.currentTool === 'circle') {
                // Calcula o raio através do teorema de Pitágoras entre os dois pontos
                const radius = Math.sqrt(Math.pow(currentX - this.startX, 2) + Math.pow(currentY - this.startY, 2));
                // Cria o arco do círculo completo (360 graus / 2*PI)
                this.ctx.arc(this.startX, this.startY, radius, 0, 2 * Math.PI);
                // Exibe o contorno do círculo na tela
                this.ctx.stroke();
            }
        }
    }

    // Método acionado ao concluir o processo de desenho
    stopDraw() {
        // Cancela a operação se a flag de desenho não estiver ativa
        if (!this.isDrawing) return;
        // Altera a flag de estado de desenho para falso
        this.isDrawing = false;
        // Restaura o nível de opacidade global do contexto para 100%
        this.ctx.globalAlpha = 1.0;
        // Inicia um novo caminho limpo no contexto do canvas
        this.ctx.beginPath();
        // Notifica o callback enviando a imagem codificada em base64 caso exista o ouvinte
        if (this.onDrawCallback) this.onDrawCallback(this.exportDataURL());
    }

    // Exporta o desenho contido no canvas como uma URL de dados codificada em Base64
    exportDataURL() {
        // Retorna a representação em imagem do canvas
        return this.canvas.toDataURL();
    }

    // Método utilitário para obter o estado do desenho
    getImageData() {
        // Retorna a URL Base64 da imagem
        return this.exportDataURL();
    }

    // Método para carregar uma imagem Base64 existente para dentro do canvas
    loadImageData(dataUrl) {
        // Aborta a execução caso a string da imagem seja inválida
        if (!dataUrl) return;
        // Cria uma nova instância do objeto de Imagem em memória
        const img = new Image();
        // Evento disparado quando a imagem é carregada com sucesso
        img.onload = () => {
            // Limpa toda a área do canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            // Renderiza a imagem carregada na área total do canvas
            this.ctx.drawImage(img, 0, 0);
        };
        // Define a fonte da imagem como sendo a URL Base64 fornecida
        img.src = dataUrl;
    }

    // Método para limpar completamente a área do canvas
    clear() {
        // Salva o estado atual antes de apagar tudo
        this.saveState();
        // Remove todo o conteúdo desenhado no contexto do canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // Notifica o callback atualizando os ouvintes sobre a limpeza da tela
        if (this.onDrawCallback) this.onDrawCallback(this.exportDataURL());
    }
}
