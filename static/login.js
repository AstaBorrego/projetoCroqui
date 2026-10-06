import { auth, database } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const loginForm = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMsg');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (errorMsg) errorMsg.innerText = '';

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const role = document.getElementById('userRole').value;

        try {
            // 1. Autentica no Firebase Authentication
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 🧹 2. LIMPA TODO O CACHE LOCAL ANTES DE REGISTAR OS NOVOS DADOS
            localStorage.clear();
            sessionStorage.clear();

            // 3. Atualiza status no Realtime Database
            const userSanitized = user.email.replace(/\./g, '_');
            await set(ref(database, `status_usuarios/${userSanitized}`), {
                email: user.email,
                status: 'online',
                role: role,
                lastSeen: new Date().toISOString()
            });

            // 4. Guarda as informações da nova sessão
            localStorage.setItem('userEmail', user.email);
            localStorage.setItem('userRole', role);

            // 5. Redireciona conforme o perfil selecionado
            if (role === 'admin') {
                window.location.href = '/dashboard';
            } else {
                window.location.href = '/dashboard';
            }

        } catch (error) {
            console.error("Erro de Autenticação:", error);

            // Mensagens tratadas e amigáveis de erro
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

// 🚪 Função de Logout separada
export function fazerLogout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
}

// Deixa a função disponível globalmente para uso em eventos HTML (ex: onclick="window.fazerLogout()")
window.fazerLogout = fazerLogout;