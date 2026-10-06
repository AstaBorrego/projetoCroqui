import { database } from './firebase-config.js';
import { CroquiEngine } from './canvas.js';
import { ref, onValue, set, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

document.addEventListener('DOMContentLoaded', () => {
    
    const userEmail = localStorage.getItem('userEmail');
    const userRole = localStorage.getItem('userRole');

    if (!userEmail) {
        window.location.href = '/';
        return;
    }

    document.getElementById('userEmailDisplay').innerText = userEmail;
    document.getElementById('userRoleDisplay').innerText = userRole === 'admin' ? 'Administrador' : 'Colaborador';

    const userKey = userEmail.replace(/\./g, '_');
    let activeUserKey = userRole === 'admin' ? null : userKey;
    let activeUserEmail = userRole === 'admin' ? null : userEmail;

    const adminTabsContainer = document.getElementById('adminTabsContainer');
    const tabsHeader = document.getElementById('tabsHeader');
    const approveBtn = document.getElementById('approveBtn');
    const currentCroquiTitle = document.getElementById('currentCroquiTitle');

    // Inicializa o Motor de Desenho do Canvas
    const croquiEngine = new CroquiEngine('croquiCanvas', (imageData) => {
        if (activeUserKey) {
            set(ref(database, `croquis_rascunho/${activeUserKey}`), {
                imagem: imageData,
                autor: userEmail,
                updatedAt: new Date().toISOString()
            }).catch(err => console.error("Erro no Firebase:", err));
        }
    });

    // Eventos dos Botões de Ferramentas
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tool = btn.getAttribute('data-tool');
            if (croquiEngine) {
                croquiEngine.setTool(tool);
            }
        });
    });

    // Seletor de Cor
    const colorPicker = document.getElementById('colorPicker');
    if (colorPicker) {
        colorPicker.addEventListener('input', (e) => croquiEngine.setColor(e.target.value));
    }

    // Seletor de Espessura
    const lineWidth = document.getElementById('lineWidth');
    if (lineWidth) {
        lineWidth.addEventListener('input', (e) => croquiEngine.setLineWidth(e.target.value));
    }

    // Botão Desfazer
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) {
        undoBtn.addEventListener('click', () => croquiEngine.undo());
    }

    // Botão Limpar
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            croquiEngine.clear();
            if (activeUserKey) {
                set(ref(database, `croquis_rascunho/${activeUserKey}`), null);
            }
        });
    }

    // Lógica do Administrador e Colaborador
    if (userRole === 'admin') {
        if (adminTabsContainer) adminTabsContainer.style.display = 'flex';
        if (approveBtn) approveBtn.style.display = 'inline-block';

        onValue(ref(database, 'status_usuarios'), (snapshot) => {
            if (tabsHeader) tabsHeader.innerHTML = '';
            snapshot.forEach(child => {
                const user = child.val();
                if (user.role === 'campo') {
                    const btn = document.createElement('button');
                    btn.className = 'tab-btn';
                    btn.innerText = user.email;
                    btn.onclick = () => selectUserTab(child.key, user.email);
                    tabsHeader.appendChild(btn);
                }
            });
        });
    } else {
        selectUserTab(userKey, userEmail);
    }

    function selectUserTab(uKey, uEmail) {
        activeUserKey = uKey;
        activeUserEmail = uEmail;
        if (currentCroquiTitle) currentCroquiTitle.innerText = uEmail;

        onValue(ref(database, `croquis_rascunho/${uKey}`), (snapshot) => {
            const data = snapshot.val();
            if (data && data.imagem) {
                croquiEngine.loadImageData(data.imagem);
            }
        });

        const chatBox = document.getElementById('chatMessages');
        if (chatBox) {
            onValue(ref(database, `chats/${uKey}`), (snapshot) => {
                chatBox.innerHTML = '';
                snapshot.forEach(childSnapshot => {
                    const msg = childSnapshot.val();
                    const p = document.createElement('p');
                    p.innerHTML = `<strong>${msg.sender}:</strong> ${msg.text}`;
                    chatBox.appendChild(p);
                });
                chatBox.scrollTop = chatBox.scrollHeight;
            });
        }
    }

    // Enviar mensagem no Chat
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            const input = document.getElementById('msgInput');
            if (!input || !input.value.trim() || !activeUserKey) return;

            push(ref(database, `chats/${activeUserKey}`), {
                sender: userEmail,
                text: input.value.trim(),
                timestamp: new Date().toISOString()
            });
            input.value = '';
        });
    }

    // Aprovar Croqui
    if (approveBtn) {
        approveBtn.addEventListener('click', async () => {
            if (!activeUserKey) return alert("Selecione um colaborador primeiro!");

            const imageData = croquiEngine.getImageData();
            const recordRef = push(ref(database, `croquis_aprovados/${activeUserKey}`));

            await set(recordRef, {
                colaborador: activeUserEmail,
                croqui: imageData,
                aprovadoPor: userEmail,
                aprovadoEm: new Date().toISOString()
            });

            alert("Croqui aprovado e salvo no Firebase com sucesso!");
        });
    }
});