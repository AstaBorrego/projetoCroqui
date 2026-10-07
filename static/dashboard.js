// Importa as instâncias do Firebase Auth e Database do arquivo de configuração
import { auth, database } from './firebase-config.js';
// Importa a função de monitoramento de estado de autenticação do Firebase
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// Importa as funções de manipulação e escuta de dados no Realtime Database
import { ref, set, onValue, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
// Importa o motor de controle do Canvas
import { CroquiEngine } from './canvas.js';

// Declaração do e-mail do colaborador selecionado e da instância do motor de desenho
let colaboradorSelecionado = null;
let croquiEngine = null;

// Executa o script assim que a estrutura do DOM estiver totalmente carregada
document.addEventListener('DOMContentLoaded', () => {

    // 🎨 1. INICIALIZAÇÃO IMEDIATA DO CANVAS
    try {
        // Instancia o motor do canvas e define o callback para salvar alterações
        croquiEngine = new CroquiEngine('croquiCanvas', (dataUrl) => {
            // Obtém o usuário ativo no momento
            const user = auth.currentUser;
            // Recupera o e-mail logado na sessão caso o auth.currentUser ainda esteja carregando
            const emailAtivo = user ? user.email : localStorage.getItem('userEmail');
            if (!emailAtivo) return;

            // Define o e-mail alvo (colaborador selecionado ou o próprio usuário)
            const targetEmail = colaboradorSelecionado || emailAtivo;
            // Substitui os pontos do e-mail por underlines para formar a chave no Firebase
            const userSanitized = targetEmail.replace(/\./g, '_');

            // Salva a imagem convertida no Firebase Realtime Database
            set(ref(database, `croquis/${userSanitized}`), {
                imagem: dataUrl,
                atualizadoEm: new Date().toISOString()
            });
        });
    } catch (err) {
        // Exibe erro no console caso o canvas falhe na inicialização
        console.error("Erro ao inicializar CroquiEngine:", err);
    }

    // 🛠️ 2. VINCULAÇÃO DAS FERRAMENTAS DE DESENHO (LÁPIS, PINCEL, BORRACHA, ETC)
    // Obtém todos os botões que possuem o atributo data-tool
    const toolButtons = document.querySelectorAll('.tool-btn');
    // Percorre cada botão de ferramenta encontrado
    toolButtons.forEach(button => {
        // Adiciona o ouvinte de clique no botão da ferramenta
        button.addEventListener('click', () => {
            // Remove a classe de destaque 'active' de todos os botões de ferramentas
            toolButtons.forEach(btn => btn.classList.remove('active'));
            // Adiciona a classe 'active' apenas ao botão clicado
            button.classList.add('active');

            // Captura o nome da ferramenta do atributo data-tool
            const selectedTool = button.getAttribute('data-tool');
            // Altera a ferramenta ativa no motor do canvas
            if (croquiEngine) {
                croquiEngine.setTool(selectedTool);
            }
        });
    });

    // 🎨 3. CONTROLE DE COR E ESPESSURA DA LINHA
    const colorPicker = document.getElementById('colorPicker');
    if (colorPicker) {
        // Atualiza a cor no canvas sempre que o usuário alterar o seletor de cor
        colorPicker.addEventListener('input', (e) => {
            if (croquiEngine) croquiEngine.setColor(e.target.value);
        });
    }

    const lineWidth = document.getElementById('lineWidth');
    if (lineWidth) {
        // Atualiza a espessura do traço no canvas sempre que o slider for movido
        lineWidth.addEventListener('input', (e) => {
            if (croquiEngine) croquiEngine.setLineWidth(e.target.value);
        });
    }

    const btnUndo = document.getElementById('btnUndo');
    if (btnUndo) {
        // Vincula a ação de desfazer a última alteração do canvas ao botão Desfazer
        btnUndo.addEventListener('click', () => {
            if (croquiEngine) croquiEngine.undo();
        });
    }

    // 💬 4. ENVIO DE MENSAGENS NO CHAT
    const chatForm = document.getElementById('chatForm');
    if (chatForm) {
        // Adiciona o ouvinte para envio do formulário do chat
        chatForm.addEventListener('submit', (e) => {
            // Previne o comportamento padrão de recarregar a página
            e.preventDefault();
            // Obtém o campo de texto do chat
            const input = document.getElementById('chatInput');
            // Aborta se o campo não existir ou contiver apenas espaços
            if (!input || !input.value.trim()) return;

            // Recupera o usuário do Firebase ou da sessão salva no localStorage
            const user = auth.currentUser;
            const userEmail = user ? user.email : localStorage.getItem('userEmail');

            if (userEmail) {
                // Insere a nova mensagem no nó 'chat_mensagens' do Firebase
                push(ref(database, 'chat_mensagens'), {
                    usuario: userEmail,
                    texto: input.value.trim(),
                    data: new Date().toISOString()
                }).then(() => {
                    // Limpa o campo de entrada após enviar com sucesso
                    input.value = '';
                }).catch((err) => {
                    // Exibe alerta caso haja erro de permissão no envio
                    console.error("Erro ao enviar mensagem:", err);
                    alert("Erro ao enviar mensagem: " + err.message);
                });
            } else {
                alert("Sessão não identificada. Faça login novamente.");
            }
        });
    }

    // 💬 5. ESCUTA EM TEMPO REAL DAS MENSAGENS DO CHAT (FORA DO AUTH PARA CARREGAR IMEDIATAMENTE)
    const chatRef = ref(database, 'chat_mensagens');
    onValue(chatRef, (snapshot) => {
        const chatBox = document.getElementById('chatBox');
        if (!chatBox) return;

        // Limpa as mensagens antigas
        chatBox.innerHTML = '';
        const mensagens = snapshot.val();

        if (mensagens) {
            // Percorre todas as mensagens retornadas pelo banco de dados
            Object.values(mensagens).forEach((msg) => {
                const p = document.createElement('p');
                p.innerHTML = `<strong>${msg.usuario}:</strong> ${msg.texto}`;
                chatBox.appendChild(p);
            });
            // Rola a caixa do chat para exibir a mensagem mais recente
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    });

    // 🔒 6. AUTENTICAÇÃO E VERIFICAÇÃO DE SESSÃO
    onAuthStateChanged(auth, (user) => {
        // Elemento h2 do cabeçalho
        const headerTitle = document.querySelector('.bar h2');
        // Obtém o e-mail e o perfil armazenados na sessão do navegador
        const savedEmail = localStorage.getItem('userEmail');
        const userRole = localStorage.getItem('userRole') || 'campo';

        // E-mail final a ser considerado
        const activeEmail = user ? user.email : savedEmail;

        if (activeEmail) {
            // Exibe o e-mail do usuário no topo da tela
            const userDisplay = document.getElementById('userDisplay');
            if (userDisplay) userDisplay.innerText = activeEmail;

            // Remove o texto "(A carregar...)" do topo da página
            if (headerTitle) {
                headerTitle.innerText = userRole === 'admin' 
                    ? "Painel de Croqui (Administrador)" 
                    : "Painel de Croqui (Colaborador em Campo)";
            }

            // Exibe o botão de impressão apenas para o Administrador
            const btnPrint = document.getElementById('btnPrint');
            if (btnPrint) {
                btnPrint.style.display = (userRole === 'admin') ? 'inline-block' : 'none';
            }

            // 👥 ESCUTA OS COLABORADORES ONLINE (SOMENTE PAINEL ADMIN)
            if (userRole === 'admin') {
                const statusRef = ref(database, 'status_usuarios');
                onValue(statusRef, (snapshot) => {
                    const tabsContainer = document.getElementById('tabsContainer');
                    if (!tabsContainer) return;

                    tabsContainer.innerHTML = '';
                    const usuarios = snapshot.val();

                    if (usuarios) {
                        Object.values(usuarios).forEach((u) => {
                            // Cria a aba apenas para colaboradores em campo que estejam online
                            if (u.status === 'online' && u.role !== 'admin') {
                                const btn = document.createElement('button');
                                btn.className = 'tab-btn';
                                btn.innerText = u.email;

                                if (u.email === colaboradorSelecionado) {
                                    btn.classList.add('active');
                                }

                                // Troca o croqui exibido ao clicar na aba do colaborador
                                btn.addEventListener('click', () => {
                                    colaboradorSelecionado = u.email;
                                    carregarCroquiColaborador(u.email);
                                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                                    btn.classList.add('active');
                                });

                                tabsContainer.appendChild(btn);
                            }
                        });
                    }
                });
            }

            // Se for colaborador em campo, carrega o seu próprio croqui automaticamente
            if (userRole !== 'admin') {
                carregarCroquiColaborador(activeEmail);
            }

        } else {
            // Se não houver e-mail de sessão válido, redireciona para a página de login
            window.location.href = '/';
        }
    });

    // 💾 7. BOTÃO SALVAR (DOWNLOAD DO DESENHO EM PNG)
    const btnSave = document.getElementById('btnSave');
    if (btnSave) {
        btnSave.addEventListener('click', () => {
            if (!croquiEngine) return;
            const dataUrl = croquiEngine.exportDataURL();
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `croqui_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
            link.click();
        });
    }

    // 🖨️ 8. BOTÃO IMPRIMIR (EXCLUSIVO PARA ADMINISTRADOR)
    const btnPrint = document.getElementById('btnPrint');
    if (btnPrint) {
        btnPrint.addEventListener('click', () => {
            const userRole = localStorage.getItem('userRole');
            if (userRole !== 'admin') {
                alert("Apenas o Administrador pode imprimir em PDF.");
                return;
            }

            const dataUrl = croquiEngine.exportDataURL();
            const autor = colaboradorSelecionado || localStorage.getItem('userEmail');
            const printWindow = window.open('', '_blank', 'width=900,height=700');

            if (printWindow) {
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Relatório de Croqui</title>
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                            h2 { color: #007bff; }
                            img { max-width: 100%; border: 2px solid #333; margin-top: 15px; }
                        </style>
                    </head>
                    <body>
                        <h2>SISTEMA CROQUI - RELATÓRIO</h2>
                        <p><strong>Colaborador:</strong> ${autor}</p>
                        <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                        <img src="${dataUrl}" alt="Croqui">
                    </body>
                    </html>
                `);
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 500);
            }
        });
    }

    // 🧹 9. BOTÃO LIMPAR CANVAS
    const btnClear = document.getElementById('btnClear');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (confirm("Tem certeza que deseja limpar todo o croqui?")) {
                if (croquiEngine) croquiEngine.clear();
            }
        });
    }
});

// Função para carregar o croqui do colaborador selecionado do Firebase
function carregarCroquiColaborador(email) {
    const userSanitized = email.replace(/\./g, '_');
    const croquiRef = ref(database, `croquis/${userSanitized}`);

    onValue(croquiRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.imagem && croquiEngine) {
            croquiEngine.loadImageData(data.imagem);
        }
    });
}
