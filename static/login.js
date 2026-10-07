// Importa as instâncias de autenticação e banco de dados do arquivo de configuração do Firebase
import { auth, database } from './firebase-config.js';
// Importa as funções de autenticação e encerramento de sessão da SDK do Firebase Auth
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// Importa as funções para consultar e gravar dados no Firebase Realtime Database
import { ref, set, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Obtém a referência do elemento de formulário de login pelo ID
const loginForm = document.getElementById('loginForm');
// Obtém a referência do parágrafo responsável pelas mensagens de erro pelo ID
const errorMsg = document.getElementById('errorMsg');

// Garante que o manipulador só seja registrado se o formulário existir na página
if (loginForm) {
    // Adiciona o ouvinte de evento para a submissão do formulário de login
    loginForm.addEventListener('submit', async (e) => {
        // Impede o recarregamento padrão da página ao submeter o formulário
        e.preventDefault();

        // Limpa o texto da mensagem de erro caso ela esteja visível
        if (errorMsg) errorMsg.innerText = '';

        // Obtém e remove espaços em branco do início e fim do email digitado
        const email = document.getElementById('email').value.trim();
        // Obtém o valor digitado no campo de senha
        const password = document.getElementById('password').value;
        // Obtém o perfil selecionado no campo select de perfil de usuário
        const role = document.getElementById('userRole').value;

        try {
            // 1. PRIMEIRO: Autentica o utilizador no Firebase para obter permissão no banco de dados
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            // Extrai as informações do utilizador autenticado
            const user = userCredential.user;

            // Formata o e-mail sem pontos para utilizar como chave no Realtime Database
            const userSanitized = user.email.replace(/\./g, '_');
            // Obtém a referência do nó de status do utilizador
            const statusRef = ref(database, `status_usuarios/${userSanitized}`);

            // 🔒 2. SEGUNDO: Verifica se a conta já possui sessão ativa marcada como 'online'
            const snapshot = await get(statusRef);

            if (snapshot.exists()) {
                const userData = snapshot.val();
                
                // Se já estiver online em outro dispositivo, cancela o login e desconecta do Auth
                if (userData.status === 'online') {
                    // Desconecta o utilizador que acabou de autenticar
                    await signOut(auth);
                    // Define a mensagem de bloqueio
                    const msg = "Esta conta já está conectada em outro dispositivo!";
                    if (errorMsg) errorMsg.innerText = msg;
                    else alert(msg);
                    return;
                }
            }

            // 🧹 3. Limpa completamente o armazenamento local do navegador antes de gravar os dados
            localStorage.clear();
            sessionStorage.clear();

            // 4. Marca o status do utilizador como 'online' no Realtime Database
            await set(statusRef, {
                email: user.email,
                status: 'online',
                role: role,
                lastSeen: new Date().toISOString()
            });

            // 5. Guarda o e-mail e perfil na sessão do navegador
            localStorage.setItem('userEmail', user.email);
            localStorage.setItem('userRole', role);

            // 6. Redireciona para o painel principal
            window.location.href = '/dashboard';

        // Bloco de captura e tratamento de exceções
        } catch (error) {
            console.error("Erro de Autenticação:", error);

            let mensagem = "Erro ao fazer login.";
            switch (error.code) {
                case 'auth/invalid-credential':
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                    mensagem = "E-mail ou senha incorretos.";
                    break;
                case 'auth/invalid-email':
                    mensagem = "O formato do e-mail é inválido.";
                    break;
                case 'auth/user-disabled':
                    mensagem = "Esta conta foi desativada.";
                    break;
                case 'PERMISSION_DENIED':
                    mensagem = "Erro de permissão no banco de dados. Atualize as Regras do Firebase.";
                    break;
                default:
                    mensagem = "Erro: " + error.message;
            }

            if (errorMsg) {
                errorMsg.innerText = mensagem;
            } else {
                alert(mensagem);
            }
        }
    });
}

// 🚪 Exporta a função de logout do utilizador para encerramento de sessão e atualização no banco
export async function fazerLogout() {
    // Obtém o e-mail salvo na sessão local
    const userEmail = localStorage.getItem('userEmail');
    
    // Se houver um e-mail registrado, altera o status para 'offline' no Firebase
    if (userEmail) {
        const userSanitized = userEmail.replace(/\./g, '_');
        await set(ref(database, `status_usuarios/${userSanitized}/status`), 'offline');
    }

    // Encerra a sessão no Firebase Auth
    await signOut(auth);
    // Remove todos os dados guardados no localStorage e sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    // Redireciona a navegação para a página de login
    window.location.href = '/';
}

// Torna a função de logout acessível globalmente pelo objeto window
window.fazerLogout = fazerLogout;

// 🔴 DESCONECTA AUTOMATICAMENTE CASO O UTILIZADOR FECHE A ABA DO NAVEGADOR
window.addEventListener('beforeunload', () => {
    const userEmail = localStorage.getItem('userEmail');
    if (userEmail) {
        const userSanitized = userEmail.replace(/\./g, '_');
        set(ref(database, `status_usuarios/${userSanitized}/status`), 'offline');
    }
});
