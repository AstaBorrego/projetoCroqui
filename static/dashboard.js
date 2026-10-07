// Importa as instâncias de autenticação e banco de dados do arquivo de configuração do Firebase
import { auth, database } from './firebase-config.js';
// Importa a função de escuta do estado de autenticação do Firebase Auth
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// Importa as funções para consultar, gravar e escutar alterações no Realtime Database
import { ref, set, onValue, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
// Importa o motor de desenho da tela canvas
import { CroquiEngine } from './canvas.js';

// Variável para armazenar o e-mail do colaborador selecionado no painel do admin
let colaboradorSelecionado = null;
// Instância global da engine de desenho do canvas
let croquiEngine = null;

// Garante que o script só execute após o carregamento completo do DOM da página
document.addEventListener('DOMContentLoaded', () => {

    // Inicializa o CroquiEngine passando o ID do canvas e o callback de gravação automática
    croquiEngine = new CroquiEngine('croquiCanvas', (dataUrl) => {
        // Obtém o usuário atualmente autenticado
        const user = auth.currentUser;
        // Cancela a gravação se não houver usuário autenticado
        if (!user) return;

        // Se o usuário for administrador e houver um colaborador selecionado, salva no croqui do colaborador
        // Caso contrário, salva no croqui do próprio colaborador logado
        const targetEmail = colaboradorSelecionado || user.email;
        // Formata o e-mail substituindo pontos por underline para ser chave do Firebase
        const userSanitized = targetEmail.replace(/\./g, '_');

        // Atualiza a imagem do croqui no caminho correspondente no Realtime Database
        set(ref(database, `croquis/${userSanitized}`), {
            // Guarda a imagem convertida para formato Base64
            imagem: dataUrl,
            // Registra a data e hora da última atualização
            atualizadoEm: new Date().toISOString()
        });
    });

    // 🔒 VERIFICAÇÃO DE AUTENTICAÇÃO E CARREGAMENTO EM TEMPO REAL
    onAuthStateChanged(auth, (user) => {
        // Caso o usuário não esteja logado, redireciona imediatamente para a tela de login
        if (!user) {
            window.location.href = '/';
            return;
        }

        // Obtém o elemento onde o e-mail do usuário logado é exibido no topo da página
        const userDisplay = document.getElementById('userDisplay');
        // Se o elemento existir, atualiza seu texto com o e-mail autenticado
        if (userDisplay) userDisplay.innerText = user.email;

        // Obtém o perfil armazenado localmente para identificar se é 'admin' ou 'campo'
        const role = localStorage.getItem('userRole') || 'campo';

        // 👥 1. SINCRONIZAÇÃO DE USUÁRIOS ONLINE (GERAÇÃO DINÂMICA DE ABAS)
        const statusRef = ref(database, 'status_usuarios');
        // Escuta em tempo real qualquer alteração de status dos usuários
        onValue(statusRef, (snapshot) => {
            // Obtém a lista de containers de abas/colaboradores do admin no HTML
            const tabsContainer = document.getElementById('tabsContainer') || document.getElementById('colaboradoresList');
            // Cancela se o elemento de abas não estiver presente na página
            if (!tabsContainer) return;

            // Limpa o conteúdo atual do container de abas
            tabsContainer.innerHTML = '';
            // Obtém o objeto contendo todos os usuários cadastrados no nó status_usuarios
            const usuarios = snapshot.val();

            // Se existirem usuários cadastrados no banco de dados
            if (usuarios) {
                // Percorre cada usuário da lista
                Object.values(usuarios).forEach((u) => {
                    // FILTRO CRUCIAL: Só exibe no painel os colaboradores que estiverem com status ONLINE e não forem admin
                    if (u.status === 'online' && u.role !== 'admin') {
                        // Cria um elemento de botão para representar a aba do colaborador
                        const btn = document.createElement('button');
                        // Aplica a classe CSS padrão de botão de aba
                        btn.className = 'tab-btn';
                        // Insere o e-mail do colaborador como rótulo do botão
                        btn.innerText = u.email;

                        // Se este for o colaborador selecionado atualmente, aplica a classe de botão ativo
                        if (u.email === colaboradorSelecionado) {
                            btn.classList.add('active');
                        }

                        // Registra o evento de clique na aba para alternar a visualização do croqui
                        btn.addEventListener('click', () => {
                            // Atualiza a variável com o e-mail do colaborador clicado
                            colaboradorSelecionado = u.email;
                            // Carrega o croqui em tempo real correspondente a este colaborador
                            carregarCroquiColaborador(u.email);
                            // Atualiza os estilos de destaque dos botões de aba
                            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
                        });

                        // Adiciona a nova aba de colaborador ao container
                        tabsContainer.appendChild(btn);
                    }
                });
            }

            // Se o colaborador que o admin estava visualizando ficou offline, limpa a seleção
            if (colaboradorSelecionado && (!usuarios || !usuarios[colaboradorSelecionado.replace(/\./g, '_')] || usuarios[colaboradorSelecionado.replace(/\./g, '_')].status !== 'online')) {
                // Reseta a variável de seleção de colaborador
                colaboradorSelecionado = null;
                // Limpa o conteúdo exibido na tela de desenho (canvas)
                if (croquiEngine) croquiEngine.clear();
            }
        });

        // 🎨 2. CARREGAMENTO DO CROQUI INICIAL DO USUÁRIO LOGADO
        if (role !== 'admin') {
            // Se for um colaborador em campo, carrega automaticamente seu próprio croqui
            carregarCroquiColaborador(user.email);
        }

        // 💬 3. ESCUTA EM TEMPO REAL DAS MENSAGENS DO CHAT
        const chatRef = ref(database, 'chat_mensagens');
        // Escuta o envio de novas mensagens de chat
        onValue(chatRef, (snapshot) => {
            // Obtém a caixa de exibição de histórico do chat
            const chatBox = document.getElementById('chatBox');
            // Cancela se a caixa de chat não existir
            if (!chatBox) return;

            // Limpa o histórico atual de mensagens na tela
            chatBox.innerHTML = '';
            // Extrai as mensagens do snapshot
            const mensagens = snapshot.val();

            // Se houver mensagens gravadas no banco de dados
            if (mensagens) {
                // Percorre cada mensagem gravada
                Object.values(mensagens).forEach((msg) => {
                    // Cria um novo parágrafo para a mensagem
                    const p = document.createElement('p');
                    // Define o conteúdo com o e-mail do remetente e a mensagem enviada
                    p.innerHTML = `<strong>${msg.usuario}:</strong> ${msg.texto}`;
                    // Adiciona o parágrafo na caixa do chat
                    chatBox.appendChild(p);
                });
                // Rola o scroll do chat até o final automaticamente para exibir a última mensagem
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        });
    });

    // 📤 ENVIO DE MENSAGENS NO CHAT
    const chatForm = document.getElementById('chatForm');
    // Registra o ouvinte para a submissão do formulário do chat
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            // Impede o recarregamento padrão da página ao enviar
            e.preventDefault();
            // Obtém o campo de texto do chat
            const input = document.getElementById('chatInput');
            // Cancela se o campo estiver vazio ou possuir apenas espaços
            if (!input || !input.value.trim()) return;

            // Obtém o usuário atualmente logado
            const user = auth.currentUser;
            // Se houver usuário logado, salva a nova mensagem no nó chat_mensagens do Firebase
            if (user) {
                push(ref(database, 'chat_mensagens'), {
                    // Registra o e-mail do remetente
                    usuario: user.email,
                    // Registra o texto digitado
                    texto: input.value.trim(),
                    // Registra a data e hora do envio
                    data: new Date().toISOString()
                });
                // Limpa o campo de entrada de texto
                input.value = '';
            }
        });
    }
});

// 🔄 FUNÇÃO PARA CARREGAR O CROQUI DE UM COLABORADOR ESPECÍFICO EM TEMPO REAL
function carregarCroquiColaborador(email) {
    // Substitui pontos por underline para obter a chave correta
    const userSanitized = email.replace(/\./g, '_');
    // Cria a referência ao caminho do croqui do colaborador no banco
    const croquiRef = ref(database, `croquis/${userSanitized}`);

    // Escuta em tempo real as atualizações de desenho feitas por este colaborador
    onValue(croquiRef, (snapshot) => {
        // Extrai os dados do croqui
        const data = snapshot.val();
        // Se houver dados de imagem salvos e a engine do canvas estiver ativa
        if (data && data.imagem && croquiEngine) {
            // Renderiza a imagem no canvas do administrador
            croquiEngine.loadImageData(data.imagem);
        }
    });
}
