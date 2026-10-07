import { auth, database } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, set, onValue, push, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { CroquiEngine } from './canvas.js';

let colaboradorSelecionado = null;
let croquiEngine = null;

document.addEventListener('DOMContentLoaded', () => {

    // 1. ENGINE DO CANVAS
    try {
        croquiEngine = new CroquiEngine('croquiCanvas', (dataUrl) => {
            const user = auth.currentUser;
            const emailAtivo = user ? user.email : localStorage.getItem('userEmail');
            if (!emailAtivo) return;

            const targetEmail = colaboradorSelecionado || emailAtivo;
            const userSanitized = targetEmail.replace(/\./g, '_');

            set(ref(database, `croquis/${userSanitized}`), {
                imagem: dataUrl,
                atualizadoEm: new Date().toISOString()
            });
        });
    } catch (err) {
        console.error("Erro ao inicializar CroquiEngine:", err);
    }

    // 2. FERRAMENTAS DE DESENHO
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            toolButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const selectedTool = button.getAttribute('data-tool');
            if (croquiEngine) croquiEngine.setTool(selectedTool);
        });
    });

    // 3. CONTROLES DE COR E ESPESSURA
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

    // 4. CHAT EM TEMPO REAL E BOTÃO LIMPAR CHAT
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
                }).then(() => { input.value = ''; });
            }
        });
    }

    // Botão para limpar todo o histórico do chat
    const btnClearChat = document.getElementById('btnClearChat');
    if (btnClearChat) {
        btnClearChat.addEventListener('click', () => {
            if (confirm("Deseja apagar todo o histórico de mensagens do chat?")) {
                remove(ref(database, 'chat_mensagens'));
            }
        });
    }

    // Escuta do Chat
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

    // 5. ESCUTA DE AUTENTICAÇÃO E ABAS ONLINE
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

            // Exibir/Ocultar botão de limpar chat se for admin
            if (btnClearChat) {
                btnClearChat.style.display = (userRole === 'admin') ? 'inline-block' : 'none';
            }

            // ESCUTA ESTRITA DOS STATUS ONLINE
            const statusRef = ref(database, 'status_usuarios');
            onValue(statusRef, (snapshot) => {
                const tabsContainer = document.getElementById('tabsContainer');
                if (!tabsContainer) return;

                tabsContainer.innerHTML = '';
                const usuarios = snapshot.val();

                if (usuarios) {
                    Object.keys(usuarios).forEach((key) => {
                        const u = usuarios[key];
                        // FILTRO: Apenas colaboradores que estejam estritamente ONLINE
                        if (u && u.status === 'online' && u.role !== 'admin') {
                            const btn = document.createElement('button');
                            btn.className = 'tab-btn';
                            btn.innerText = u.email;

                            if (u.email === colaboradorSelecionado) {
                                btn.classList.add('active');
                            }

                            btn.addEventListener('click', () => {
                                colaboradorSelecionado = u.email;
                                const canvasTitle = document.getElementById('canvasTitle');
                                if (canvasTitle) canvasTitle.innerText = `Croqui: ${u.email}`;

                                carregarCroquiColaborador(u.email);
                                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                                btn.classList.add('active');
                            });

                            tabsContainer.appendChild(btn);
                        }
                    });
                }
            });

            if (userRole !== 'admin') {
                carregarCroquiColaborador(activeEmail);
            }

        } else {
            window.location.href = '/';
        }
    });

    // 6. DEMAIS BOTOES (SALVAR, IMPRIMIR, LIMPAR)
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

    const btnClear = document.getElementById('btnClear');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (confirm("Tem certeza que deseja limpar todo o croqui?")) {
                if (croquiEngine) croquiEngine.clear();
            }
        });
    }
});

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
