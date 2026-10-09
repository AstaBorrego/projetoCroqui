import { auth, database } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, set, onValue, push, remove, update, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { CroquiEngine } from './canvas.js';

let colaboradorSelecionado = null;
let croquiEngine = null;

function getFormattedDate() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

document.addEventListener('DOMContentLoaded', () => {

    // 1. INICIALIZAÇÃO DO CANVAS
    try {
        croquiEngine = new CroquiEngine('croquiCanvas');
    } catch (err) {
        console.error("Erro ao inicializar CroquiEngine:", err);
    }

    // 2. FERRAMENTAS
    document.querySelectorAll('.tool-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            if (croquiEngine) croquiEngine.setTool(button.getAttribute('data-tool'));
        });
    });

    const colorPicker = document.getElementById('colorPicker');
    if (colorPicker) colorPicker.addEventListener('input', (e) => croquiEngine && croquiEngine.setColor(e.target.value));

    const lineWidth = document.getElementById('lineWidth');
    if (lineWidth) lineWidth.addEventListener('input', (e) => croquiEngine && croquiEngine.setLineWidth(e.target.value));

    const btnUndo = document.getElementById('btnUndo');
    if (btnUndo) btnUndo.addEventListener('click', () => croquiEngine && croquiEngine.undo());

    // 3. CHAT EM TEMPO REAL
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

    const btnClearChat = document.getElementById('btnClearChat');
    if (btnClearChat) {
        btnClearChat.addEventListener('click', () => {
            if (confirm("Deseja apagar todo o histórico de mensagens do chat?")) {
                remove(ref(database, 'chat_mensagens'));
            }
        });
    }

    onValue(ref(database, 'chat_mensagens'), (snapshot) => {
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

    // 4. AUTENTICAÇÃO E RENDERIZAÇÃO DAS ABAS ONLINE
    onAuthStateChanged(auth, (user) => {
        const savedEmail = localStorage.getItem('userEmail');
        const userRole = localStorage.getItem('userRole') || 'campo';
        const activeEmail = user ? user.email : savedEmail;

        if (activeEmail) {
            const userDisplay = document.getElementById('userDisplay');
            if (userDisplay) userDisplay.innerText = activeEmail;

            const headerTitle = document.getElementById('headerTitle');
            if (headerTitle) {
                headerTitle.innerText = (userRole === 'admin') 
                    ? "Painel de Croqui (Administrador)" 
                    : "Painel de Croqui (Colaborador em Campo)";
            }

            const mySanitizedEmail = activeEmail.replace(/\./g, '_');
            const myStatusRef = ref(database, `status_usuarios/${mySanitizedEmail}`);

            // Garante o status online do usuário logado no Firebase
            onDisconnect(myStatusRef).update({
                status: 'offline',
                ultimoAcesso: new Date().toISOString()
            });

            update(myStatusRef, {
                email: activeEmail,
                status: 'online',
                role: userRole,
                ultimoAcesso: new Date().toISOString()
            });

            if (btnClearChat) {
                btnClearChat.style.display = (userRole === 'admin') ? 'inline-block' : 'none';
            }

            // ESCUTA DOS USUÁRIOS ONLINE (Atualiza as abas sem perder a seleção)
            onValue(ref(database, 'status_usuarios'), (snapshot) => {
                const tabsContainer = document.getElementById('tabsContainer');
                if (!tabsContainer) return;

                tabsContainer.innerHTML = '';
                const usuarios = snapshot.val();

                if (usuarios) {
                    Object.keys(usuarios).forEach((key) => {
                        const u = usuarios[key];

                        if (u && u.status === 'online' && u.role !== 'admin' && u.email) {
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

    // 5. SALVAR CROQUI SEM ZERAR AS ABAS OU PERDER A SELEÇÃO
    const btnSave = document.getElementById('btnSave');
    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            if (!croquiEngine) return;
            
            const user = auth.currentUser;
            const activeEmail = user ? user.email : localStorage.getItem('userEmail');
            const targetEmail = colaboradorSelecionado || activeEmail;

            if (!targetEmail) {
                alert("Nenhum colaborador selecionado.");
                return;
            }

            const dataUrl = croquiEngine.exportDataURL();
            const userSanitized = targetEmail.replace(/\./g, '_');
            const dataFormatada = getFormattedDate();

            try {
                // Grava a cópia do croqui no nó do Firebase sem alterar o nó status_usuarios
                await set(ref(database, `croquis/${userSanitized}_${dataFormatada}`), {
                    usuario: targetEmail,
                    imagem: dataUrl,
                    atualizadoEm: new Date().toISOString()
                });

                // Baixa o arquivo localmente
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `${userSanitized}_${dataFormatada}.png`;
                link.click();

                alert(`Croqui de ${targetEmail} salvo com sucesso!`);

            } catch (err) {
                console.error("Erro ao salvar croqui:", err);
                alert("Erro ao salvar no banco de dados.");
            }
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
    onValue(ref(database, 'croquis'), (snapshot) => {
        const todosCroquis = snapshot.val();
        if (todosCroquis && croquiEngine) {
            const chavesColaborador = Object.keys(todosCroquis).filter(k => k.startsWith(userSanitized));
            if (chavesColaborador.length > 0) {
                const ultimaChave = chavesColaborador.sort().pop();
                if (todosCroquis[ultimaChave] && todosCroquis[ultimaChave].imagem) {
                    croquiEngine.loadImageData(todosCroquis[ultimaChave].imagem);
                    return;
                }
            }
        }
        if (croquiEngine) croquiEngine.clear();
    }, { onlyOnce: true });
}
