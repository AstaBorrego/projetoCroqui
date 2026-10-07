import { database } from './firebase-config.js';
import { CroquiEngine } from './canvas.js';
import { ref, onValue, set, push, off } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

    let croquiListener = null;
    let chatListener = null;

    const adminTabsContainer = document.getElementById('adminTabsContainer');
    const tabsHeader = document.getElementById('tabsHeader');
    const approveBtn = document.getElementById('approveBtn');
    const currentCroquiTitle = document.getElementById('currentCroquiTitle');

    // Inicializa o Motor do Canvas
    const croquiEngine = new CroquiEngine('croquiCanvas', (imageData) => {
        if (activeUserKey) {
            set(ref(database, `croquis_rascunho/${activeUserKey}`), {
                imagem: imageData,
                autor: userEmail,
                updatedAt: new Date().toISOString()
            }).catch(err => console.error("Erro ao sincronizar croqui no Firebase:", err));
        }
    });

    // Ferramentas de Desenho
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            croquiEngine.setTool(btn.getAttribute('data-tool'));
        });
    });

    const colorPicker = document.getElementById('colorPicker');
    if (colorPicker) colorPicker.addEventListener('input', (e) => croquiEngine.setColor(e.target.value));

    const lineWidth = document.getElementById('lineWidth');
    if (lineWidth) lineWidth.addEventListener('input', (e) => croquiEngine.setLineWidth(e.target.value));

    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) undoBtn.addEventListener('click', () => croquiEngine.undo());

    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            croquiEngine.clear();
            if (activeUserKey) set(ref(database, `croquis_rascunho/${activeUserKey}`), null);
        });
    }

    // Lógica do ADM e Colaborador
    if (userRole === 'admin') {
        if (adminTabsContainer) adminTabsContainer.style.display = 'flex';
        if (approveBtn) approveBtn.style.display = 'inline-block';

        // Carrega Lista de Colaboradores Online/Cadastrados
        onValue(ref(database, 'status_usuarios'), (snapshot) => {
            if (tabsHeader) tabsHeader.innerHTML = '';
            snapshot.forEach(child => {
                const user = child.val();
                if (user.role === 'campo') {
                    const btn = document.createElement('button');
                    btn.className = `tab-btn ${child.key === activeUserKey ? 'active' : ''}`;
                    btn.innerText = user.email;
                    btn.onclick = () => {
                        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        selectUserTab(child.key, user.email);
                    };
                    tabsHeader.appendChild(btn);
                }
            });
        });
    } else {
        selectUserTab(userKey, userEmail);
    }

    function selectUserTab(uKey, uEmail) {
        // Remove os ouvintes anteriores para não sobrepor abas
        if (croquiListener) off(croquiListener);
        if (chatListener) off(chatListener);

        activeUserKey = uKey;
        activeUserEmail = uEmail;
        if (currentCroquiTitle) currentCroquiTitle.innerText = uEmail;

        // Ouvinte do Croqui em Tempo Real
        croquiListener = ref(database, `croquis_rascunho/${uKey}`);
        onValue(croquiListener, (snapshot) => {
            if (croquiEngine.isDrawing) return; // Se estiver desenhando, ignora atualização remota temporária
            const data = snapshot.val();
            if (data && data.imagem) {
                croquiEngine.loadImageData(data.imagem);
            }
        });

        // Ouvinte do Chat em Tempo Real
        const chatBox = document.getElementById('chatMessages');
        if (chatBox) {
            chatListener = ref(database, `chats/${uKey}`);
            onValue(chatListener, (snapshot) => {
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

    // Envio de Mensagens (Botão e Tecla Enter)
    const sendBtn = document.getElementById('sendBtn');
    const msgInput = document.getElementById('msgInput');

    function enviarMensagem() {
        if (!msgInput || !msgInput.value.trim() || !activeUserKey) return;

        push(ref(database, `chats/${activeUserKey}`), {
            sender: userEmail,
            text: msgInput.value.trim(),
            timestamp: new Date().toISOString()
        }).then(() => {
            msgInput.value = '';
        }).catch(err => console.error("Erro ao enviar mensagem:", err));
    }

    if (sendBtn) sendBtn.addEventListener('click', enviarMensagem);
    if (msgInput) {
        msgInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') enviarMensagem();
        });
    }

    // Aprovação de Croqui pelo ADM
    if (approveBtn) {
        approveBtn.addEventListener('click', async () => {
            if (!activeUserKey) return alert("Selecione um colaborador primeiro!");

            const imageData = croquiEngine.exportDataURL();
            const recordRef = push(ref(database, `croquis_aprovados/${activeUserKey}`));

            await set(recordRef, {
                colaborador: activeUserEmail,
                croqui: imageData,
                aprovadoPor: userEmail,
                aprovadoEm: new Date().toISOString()
            });

            alert("Croqui aprovado com sucesso!");
        });
    }
});
