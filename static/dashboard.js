// Importa as instâncias de autenticação e banco de dados do arquivo de configuração do Firebase
import { auth, database } from './firebase-config.js';
// Importa o escutador de estado de autenticação do Firebase Auth
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// Importa as funções para consultar, gravar e escutar o Realtime Database
import { ref, set, onValue, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
// Importa o motor de desenho do canvas
import { CroquiEngine } from './canvas.js';

// Variáveis de controle do colaborador selecionado e da engine do canvas
let colaboradorSelecionado = null;
let croquiEngine = null;

// Aguarda o carregamento do DOM antes de registrar os ouvintes
document.addEventListener('DOMContentLoaded', () => {

    // Inicializa a engine do canvas
    croquiEngine = new CroquiEngine('croquiCanvas', (dataUrl) => {
        // Obtém o usuário atual do Firebase Auth
        const user = auth.currentUser;
        if (!user) return;

        // Determina o e-mail alvo (do colaborador selecionado ou do próprio usuário)
        const targetEmail = colaboradorSelecionado || user.email;
        // Substitui pontos por underline para formatação de chave no Firebase
        const userSanitized = targetEmail.replace(/\./g, '_');

        // Salva/Atualiza o desenho em Base64 no nó 'croquis' do Firebase
        set(ref(database, `croquis/${userSanitized}`), {
            imagem: dataUrl,
            atualizadoEm: new Date().toISOString()
        });
    });

    // 🔒 1. AUTENTICAÇÃO E CONTROLE DE ACESSO
    onAuthStateChanged(auth, (user) => {
        // Redireciona para o login se não houver usuário autenticado
        if (!user) {
            window.location.href = '/';
            return;
        }

        // Exibe o e-mail do usuário logado no topo da tela
        const userDisplay = document.getElementById('userDisplay');
        if (userDisplay) userDisplay.innerText = user.email;

        // Recupera o perfil do usuário armazenado na sessão local
        const userRole = localStorage.getItem('userRole') || 'campo';
        // Seleciona o botão de impressão no HTML
        const btnPrint = document.getElementById('btnPrint');

        // 🖨️ EXCLUSIVIDADE DO ADMINISTRADOR PARA IMPRESSÃO EM PDF
        if (btnPrint) {
            if (userRole === 'admin') {
                // Torna o botão visível caso o usuário seja administrador
                btnPrint.style.display = 'inline-block';
            } else {
                // Oculta completamente o botão de impressão para colaboradores em campo
                btnPrint.style.display = 'none';
            }
        }

        // Escuta os usuários online para montagem dinâmica das abas no painel admin
        const statusRef = ref(database, 'status_usuarios');
        onValue(statusRef, (snapshot) => {
            const tabsContainer = document.getElementById('tabsContainer');
            if (!tabsContainer) return;

            tabsContainer.innerHTML = '';
            const usuarios = snapshot.val();

            if (usuarios) {
                Object.values(usuarios).forEach((u) => {
                    // Exibe apenas colaboradores com status online na visão do admin
                    if (u.status === 'online' && u.role !== 'admin') {
                        const btn = document.createElement('button');
                        btn.className = 'tab-btn';
                        btn.innerText = u.email;

                        if (u.email === colaboradorSelecionado) {
                            btn.classList.add('active');
                        }

                        // Registra o clique para alternar de colaborador
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

        // Escuta o chat de mensagens em tempo real
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
    });

    // 🖨️ 2. AÇÃO DE IMPRESSÃO EM PDF (APENAS ADMINISTRADOR)
    const btnPrint = document.getElementById('btnPrint');
    if (btnPrint) {
        btnPrint.addEventListener('click', () => {
            // Verifica novamente a permissão antes de executar
            const userRole = localStorage.getItem('userRole');
            if (userRole !== 'admin') {
                alert("Apenas o Administrador tem permissão para imprimir em PDF!");
                return;
            }

            // Exporta a imagem do canvas em formato Base64
            const dataUrl = croquiEngine.exportDataURL();
            // Identifica o colaborador do qual o croqui pertence
            const autorCroqui = colaboradorSelecionado || localStorage.getItem('userEmail');

            // Abre uma nova janela limpa configurada para impressão/PDF
            const printWindow = window.open('', '_blank', 'width=900,height=700');
            
            if (printWindow) {
                // Monta o layout do relatório para o PDF
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Relatório Pericial de Croqui - PDF</title>
                        <style>
                            @page {
                                size: A4;
                                margin: 20mm;
                            }
                            body {
                                font-family: Arial, sans-serif;
                                text-align: center;
                                color: #333;
                            }
                            .header {
                                border-bottom: 2px solid #007bff;
                                padding-bottom: 10px;
                                margin-bottom: 20px;
                            }
                            .info-table {
                                width: 100%;
                                margin-bottom: 20px;
                                text-align: left;
                                font-size: 14px;
                            }
                            .croqui-container {
                                border: 2px solid #333;
                                border-radius: 4px;
                                padding: 10px;
                                display: inline-block;
                            }
                            img {
                                max-width: 100%;
                                height: auto;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h2>SISTEMA CROQUI - RELATÓRIO TÉCNICO</h2>
                        </div>
                        <table class="info-table">
                            <tr>
                                <td><strong>Colaborador em Campo:</strong> ${autorCroqui}</td>
                            </tr>
                            <tr>
                                <td><strong>Data de Emissão:</strong> ${new Date().toLocaleString('pt-BR')}</td>
                            </tr>
                        </table>
                        <div class="croqui-container">
                            <img src="${dataUrl}" alt="Croqui">
                        </div>
                    </body>
                    </html>
                `);

                printWindow.document.close();
                printWindow.focus();

                // Aguarda a renderização completa da imagem e chama a caixa de impressão/salvar em PDF
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 500);
            }
        });
    }

    // 🧹 3. BOTÃO LIMPAR CANVAS
    const btnClear = document.getElementById('btnClear');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (confirm("Deseja realmente limpar o canvas?")) {
                croquiEngine.clear();
            }
        });
    }
});

// Função de apoio para carregar o croqui do colaborador via Firebase
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
