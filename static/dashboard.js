// Importa as instâncias de autenticação e banco do arquivo de configuração do Firebase
import { auth, database } from './firebase-config.js';
// Importa o escutador de estado do Firebase Auth
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// Importa as funções de manipulação e escuta de dados do Realtime Database
import { ref, set, onValue, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
// Importa o motor de controle do Canvas
import { CroquiEngine } from './canvas.js';

// Variáveis de controle globais
let colaboradorSelecionado = null;
let croquiEngine = null;

// Executa após a renderização completa da página
document.addEventListener('DOMContentLoaded', () => {

    // 🎨 1. INICIALIZAÇÃO DO CANVAS E REGISTRO DO SALVAMENTO AUTOMÁTICO
    try {
        croquiEngine = new CroquiEngine('croquiCanvas', (dataUrl) => {
            const user = auth.currentUser;
            const emailAtivo = user ? user.email : localStorage.getItem('userEmail');
            if (!emailAtivo) return;

            // Determina se salvará no croqui do próprio colaborador ou na aba selecionada pelo Admin
            const targetEmail = colaboradorSelecionado || emailAtivo;
            const userSanitized = targetEmail.replace(/\./g, '_');

            // Grava a imagem Base64 no banco do Firebase
            set(ref(database, `croquis/${userSanitized}`), {
                imagem: dataUrl,
                atualizadoEm: new Date().toISOString()
            });
        });
    } catch (err) {
        console.error("Erro ao inicializar o CroquiEngine:", err);
    }

    // 🛠️ 2. VINCULAÇÃO DAS FERRAMENTAS DE DESENHO
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            toolButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const selectedTool = button.getAttribute('data-tool');
            if (croquiEngine) croquiEngine.setTool(selectedTool);
        });
    });

    // 🎨 3. CONTROLE DE COR E ESPESSURA
    const colorPicker = document.getElementById('colorPicker');
    if (colorPicker) {
        colorPicker.addEventListener('input', (e) => {
            if (croquiEngine) croquiEngine.setColor(e.target.value);
        });
    }

    const lineWidth = document.getElementById('lineWidth');
    if (lineWidth) {
        lineWidth.addEventListener('input', (e) => {
            if (croquiEngine) croquiEngine.setLineWidth(e.target.value);
        });
    }

    const btnUndo = document.getElementById('btnUndo');
    if (btnUndo) {
        btnUndo.addEventListener('click', () => {
            if (croquiEngine) croquiEngine.undo();
        });
    }

    // 💬 4. ENVIO DE MENSAGENS NO CHAT
    const chatForm = document.getElementById('chatForm');
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('chatInput');
            if (!input || !input.value.trim()) return;

            const user = auth.currentUser;
            const userEmail = user ? user.email : localStorage.getItem('userEmail');

            if (userEmail) {
                push(ref(database, 'chat_mensagens'), {
                    usuario: userEmail,
                    texto: input.value.trim(),
                    data: new Date().toISOString()
                }).then(() => {
                    input.value = '';
                }).catch((err) => {
                    console.error("Erro ao enviar mensagem:", err);
                    alert("Erro ao enviar mensagem: " + err.message);
                });
            }
        });
    }

    // 💬 5. ESCUTA EM TEMPO REAL DAS MENSAGENS DO CHAT
    const chatRef = ref(database, 'chat_mensagens');
    onValue(chatRef, (snapshot) => {
        const chatBox = document.getElementById('chatBox');
        if (!chatBox) return;

        chatBox.innerHTML = '';
        const mensagens = snapshot.val();

        if (mensagens) {
            Object.values(mensagens).forEach((msg) => {
                const p = document.createElement('p');
                p.innerHTML = `<strong>${msg.usuario}:</strong> ${msg.texto}`;
                chatBox.appendChild(p);
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    });

    // 🔒 6. VERIFICAÇÃO DE AUTENTICAÇÃO E RENDERIZAÇÃO ESTREITA DE ABAS
    onAuthStateChanged(auth, (user) => {
        const headerTitle = document.querySelector('.bar h2');
        const savedEmail = localStorage.getItem('userEmail');
        const userRole = localStorage.getItem('userRole') || 'campo';
        const activeEmail = user ? user.email : savedEmail;

        if (activeEmail) {
            const userDisplay = document.getElementById('userDisplay');
            if (userDisplay) userDisplay.innerText = activeEmail;

            if (headerTitle) {
                headerTitle.innerText = (userRole === 'admin') 
                    ? "Painel de Croqui (Administrador)" 
                    : "Painel de Croqui (Colaborador em Campo)";
            }

            // 👥 ESCUTA APENAS COLABORADORES QUE ESTEJAM ESTRITAMENTE ONLINE
            const statusRef = ref(database, 'status_usuarios');
            onValue(statusRef, (snapshot) => {
                const tabsContainer = document.getElementById('tabsContainer');
                if (!tabsContainer) return;

                // Limpa completamente as abas no DOM antes de reconstruir
                tabsContainer.innerHTML = '';
                const usuarios = snapshot.val();

                if (usuarios) {
                    Object.keys(usuarios).forEach((key) => {
                        const u = usuarios[key];

                        // FILTRO ESTRITO: Deve possuir o objeto, estar marcado como 'online' e não ser admin
                        if (u && u.status === 'online' && u.role !== 'admin') {
                            const btn = document.createElement('button');
                            btn.className = 'tab-btn';
                            btn.innerText = u.email;

                            if (u.email === colaboradorSelecionado) {
                                btn.classList.add('active');
                            }

                            // Ao clicar na aba, carrega o croqui daquele colaborador específico
                            btn.addEventListener('click', () => {
                                colaboradorSelecionado = u.email;
                                
                                const titleCanvas = document.querySelector('.editor-area-center h3');
                                if (titleCanvas) titleCanvas.innerText = `Croqui: ${u.email}`;

                                carregarCroquiColaborador(u.email);
                                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                                btn.classList.add('active');
                            });

                            tabsContainer.appendChild(btn);
                        }
                    });
                }

                // Se o colaborador selecionado desconectou, reseta o canvas do admin
                if (colaboradorSelecionado) {
                    const chaveSel = colaboradorSelecionado.replace(/\./g, '_');
                    if (!usuarios || !usuarios[chaveSel] || usuarios[chaveSel].status !== 'online') {
                        colaboradorSelecionado = null;
                        if (croquiEngine) croquiEngine.clear();
                    }
                }
            });

            // Se for colaborador em campo, carrega seu próprio croqui
            if (userRole !== 'admin') {
                carregarCroquiColaborador(activeEmail);
            }

        } else {
            window.location.href = '/';
        }
    });

    // 💾 7. BOTÃO SALVAR (DOWNLOAD PNG)
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

    // 🖨️ 8. BOTÃO IMPRIMIR (PDF)
    const btnPrint = document.getElementById('btnPrint');
    if (btnPrint) {
        btnPrint.addEventListener('click', () => {
            if (!croquiEngine) return;
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

// Função para escutar e atualizar o croqui em tempo real no banco
function carregarCroquiColaborador(email) {
    const userSanitized = email.replace(/\./g, '_');
    const croquiRef = ref(database, `croquis/${userSanitized}`);

    onValue(croquiRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.imagem && croquiEngine) {
            croquiEngine.loadImageData(data.imagem);
        } else if (croquiEngine) {
            croquiEngine.clear();
        }
    });
}
