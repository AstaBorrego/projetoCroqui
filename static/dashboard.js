import { auth, database } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, set, onValue, push, remove, update, onDisconnect, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { CroquiEngine } from './canvas.js';

let colaboradorSelecionado = null;
let croquiEngine = null;
let todosCroquisCache = {};
let unsubscribeCroquiListener = null;
let unsubscribeChatListener = null;

function getFormattedDate() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

document.addEventListener('DOMContentLoaded', () => {

    // 1. ENGINE DO CANVAS (TRANSMISSÃO BIDIRECIONAL EM TEMPO REAL)
    try {
        croquiEngine = new CroquiEngine('croquiCanvas', (dataUrl) => {
            const user = auth.currentUser;
            const activeEmail = user ? user.email : localStorage.getItem('userEmail');
            const targetEmail = colaboradorSelecionado || activeEmail;
            
            if (targetEmail) {
                const userSanitized = targetEmail.replace(/\./g, '_');
                set(ref(database, `croquis_tempo_real/${userSanitized}`), {
                    usuario: targetEmail,
                    imagem: dataUrl,
                    atualizadoPor: activeEmail,
                    atualizadoEm: new Date().toISOString()
                }).catch(err => console.error("Erro ao transmitir tempo real:", err));
            }
        });
    } catch (err) {
        console.error("Erro ao inicializar CroquiEngine:", err);
    }

    // 2. FERRAMENTAS DE DESENHO
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

    // 3. CHAT PRIVADO (ADMIN ↔ COLABORADOR)
    const chatForm = document.getElementById('chatForm');
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('chatInput');
            if (!input || !input.value.trim()) return;

            const user = auth.currentUser;
            const activeEmail = user ? user.email : localStorage.getItem('userEmail');
            const userRole = localStorage.getItem('userRole') || 'campo';

            const targetEmail = (userRole === 'admin') ? colaboradorSelecionado : activeEmail;

            if (!targetEmail) {
                alert("Nenhum colaborador selecionado para o chat.");
                return;
            }

            const targetSanitized = targetEmail.replace(/\./g, '_');

            push(ref(database, `chat_mensagens/${targetSanitized}`), {
                usuario: activeEmail,
                texto: input.value.trim(),
                data: new Date().toISOString()
            }).then(() => { 
                input.value = ''; 
            }).catch(err => console.error("Erro ao enviar mensagem:", err));
        });
    }

    const btnClearChat = document.getElementById('btnClearChat');
    if (btnClearChat) {
        btnClearChat.addEventListener('click', () => {
            const userRole = localStorage.getItem('userRole') || 'campo';
            const user = auth.currentUser;
            const activeEmail = user ? user.email : localStorage.getItem('userEmail');
            const targetEmail = (userRole === 'admin') ? colaboradorSelecionado : activeEmail;

            if (targetEmail && confirm(`Deseja apagar o histórico de chat com ${targetEmail}?`)) {
                const targetSanitized = targetEmail.replace(/\./g, '_');
                remove(ref(database, `chat_mensagens/${targetSanitized}`));
            }
        });
    }

    // 4. AUTENTICAÇÃO E RENDERIZAÇÃO DAS ABAS SOMENTE PARA LOGADOS
    onAuthStateChanged(auth, async (user) => {
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

            onDisconnect(myStatusRef).update({
                status: 'offline',
                ultimoAcesso: new Date().toISOString()
            });

            await update(myStatusRef, {
                email: activeEmail,
                status: 'online',
                role: userRole,
                ultimoAcesso: new Date().toISOString()
            });

            if (btnClearChat) {
                btnClearChat.style.display = (userRole === 'admin') ? 'inline-block' : 'none';
            }

            const tabsContainer = document.getElementById('tabsContainer');

            if (userRole === 'admin') {
                if (tabsContainer) tabsContainer.style.display = 'flex';

                // 🎯 FILTRO RÍGIDO: Lista APENAS colaboradores ONLINE no Realtime Database
                onValue(ref(database, 'status_usuarios'), (statusSnapshot) => {
                    const statusData = statusSnapshot.val() || {};
                    if (!tabsContainer) return;

                    tabsContainer.innerHTML = '';
                    const colabsOnline = [];

                    Object.keys(statusData).forEach((key) => {
                        const userStatus = statusData[key];

                        if (userStatus && userStatus.status === 'online' && userStatus.role !== 'admin' && userStatus.email) {
                            const emailFormatado = userStatus.email;
                            colabsOnline.push(emailFormatado);

                            const btn = document.createElement('button');
                            btn.className = 'tab-btn';
                            if (emailFormatado === colaboradorSelecionado) {
                                btn.classList.add('active');
                            }

                            btn.innerHTML = `
                                <span class="status-dot dot-online"></span>
                                ${emailFormatado}
                            `;

                            btn.addEventListener('click', () => {
                                colaboradorSelecionado = emailFormatado;
                                const canvasTitle = document.getElementById('canvasTitle');
                                if (canvasTitle) canvasTitle.innerText = `Croqui: ${emailFormatado}`;

                                escutarCroquiEmTempoReal(emailFormatado);
                                escutarChatPrivado(emailFormatado);

                                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                                btn.classList.add('active');
                            });

                            tabsContainer.appendChild(btn);
                        }
                    });

                    // Seleciona o primeiro da lista caso nenhum esteja ativo
                    if (colabsOnline.length > 0 && (!colaboradorSelecionado || !colabsOnline.includes(colaboradorSelecionado))) {
                        colaboradorSelecionado = colabsOnline[0];
                        const canvasTitle = document.getElementById('canvasTitle');
                        if (canvasTitle) canvasTitle.innerText = `Croqui: ${colaboradorSelecionado}`;
                        
                        escutarCroquiEmTempoReal(colaboradorSelecionado);
                        escutarChatPrivado(colaboradorSelecionado);

                        const primeiroBtn = tabsContainer.querySelector('.tab-btn');
                        if (primeiroBtn) primeiroBtn.classList.add('active');
                    }
                });

            } else {
                // COLABORADOR: Oculta barra de abas e conecta ao próprio canal
                if (tabsContainer) tabsContainer.style.display = 'none';
                
                colaboradorSelecionado = activeEmail;
                const canvasTitle = document.getElementById('canvasTitle');
                if (canvasTitle) canvasTitle.innerText = `Croqui: ${activeEmail}`;

                escutarCroquiEmTempoReal(activeEmail);
                escutarChatPrivado(activeEmail);
            }

        } else {
            window.location.href = '/';
        }
    });

    // 5. SALVAR CROQUI FINAL
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
                await set(ref(database, `croquis/${userSanitized}_${dataFormatada}`), {
                    usuario: targetEmail,
                    imagem: dataUrl,
                    dataCriacao: new Date().toLocaleString('pt-BR'),
                    atualizadoEm: new Date().toISOString()
                });

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

    // 6. MODAL DE BUSCA DE CROQUIS SALVOS
    const modalLoad = document.getElementById('modalLoad');
    const btnLoadModal = document.getElementById('btnLoadModal');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const searchCroqui = document.getElementById('searchCroqui');
    const croquiList = document.getElementById('croquiList');

    if (btnLoadModal && modalLoad) {
        btnLoadModal.addEventListener('click', async () => {
            modalLoad.classList.add('active');
            croquiList.innerHTML = '<p style="text-align: center; color: #888; font-size: 12px; margin-top: 20px;">Carregando croquis do Firebase...</p>';

            try {
                const snapshot = await get(ref(database, 'croquis'));
                todosCroquisCache = snapshot.val() || {};
                renderizarListaCroquis(todosCroquisCache, '');
            } catch (err) {
                console.error("Erro ao buscar croquis:", err);
                croquiList.innerHTML = '<p style="text-align: center; color: red; font-size: 12px;">Erro ao carregar lista de croquis.</p>';
            }
        });
    }

    if (btnCloseModal && modalLoad) {
        btnCloseModal.addEventListener('click', () => {
            modalLoad.classList.remove('active');
        });
    }

    if (searchCroqui) {
        searchCroqui.addEventListener('input', (e) => {
            renderizarListaCroquis(todosCroquisCache, e.target.value.toLowerCase().trim());
        });
    }

    function renderizarListaCroquis(croquis, termoBusca) {
        croquiList.innerHTML = '';
        const chaves = Object.keys(croquis);

        if (chaves.length === 0) {
            croquiList.innerHTML = '<p style="text-align: center; color: #888; font-size: 12px; margin-top: 20px;">Nenhum croqui salvo no Firebase.</p>';
            return;
        }

        let encontrou = false;

        chaves.sort().reverse().forEach(key => {
            const item = croquis[key];
            const usuario = item.usuario || key;
            const data = item.dataCriacao || item.atualizadoEm || '';

            if (usuario.toLowerCase().includes(termoBusca) || data.toLowerCase().includes(termoBusca) || key.toLowerCase().includes(termoBusca)) {
                encontrou = true;
                const div = document.createElement('div');
                div.className = 'croqui-item';
                div.innerHTML = `
                    <div>
                        <strong>${usuario}</strong><br>
                        <small style="color: #666;">${data}</small>
                    </div>
                    <button class="btn-abrir-croqui">Abrir</button>
                `;

                div.querySelector('.btn-abrir-croqui').addEventListener('click', () => {
                    if (item.imagem && croquiEngine) {
                        croquiEngine.loadImageData(item.imagem);
                        const canvasTitle = document.getElementById('canvasTitle');
                        if (canvasTitle) canvasTitle.innerText = `Croqui: ${usuario}`;
                        modalLoad.classList.remove('active');
                    }
                });

                croquiList.appendChild(div);
            }
        });

        if (!encontrou) {
            croquiList.innerHTML = '<p style="text-align: center; color: #888; font-size: 12px; margin-top: 20px;">Nenhum croqui encontrado para essa pesquisa.</p>';
        }
    }

    // 7. IMPRIMIR E LIMPAR CANVAS
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

// 8. ESCUTA PRIVADA DO CHAT
function escutarChatPrivado(email) {
    if (!email) return;
    const userSanitized = email.replace(/\./g, '_');

    if (unsubscribeChatListener) {
        unsubscribeChatListener();
    }

    unsubscribeChatListener = onValue(ref(database, `chat_mensagens/${userSanitized}`), (snapshot) => {
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
}

// 9. ESCUTA EM TEMPO REAL DO DESENHO
function escutarCroquiEmTempoReal(email) {
    if (!email) return;
    const userSanitized = email.replace(/\./g, '_');
    
    if (unsubscribeCroquiListener) {
        unsubscribeCroquiListener();
    }

    unsubscribeCroquiListener = onValue(ref(database, `croquis_tempo_real/${userSanitized}`), (snapshot) => {
        const data = snapshot.val();
        if (data && data.imagem && croquiEngine) {
            croquiEngine.loadImageData(data.imagem);
        } else {
            get(ref(database, 'croquis')).then((snap) => {
                const todosCroquis = snap.val();
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
            });
        }
    });
}
