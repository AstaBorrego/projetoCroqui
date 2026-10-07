// Importa as instâncias de autenticação e banco de dados
import { auth, database } from './firebase-config.js';
// Importa as funções de login e encerramento de sessão do Firebase Auth
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// Importa as funções para consultar e gravar dados no Realtime Database
import { ref, set, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Obtém referências dos elementos do formulário pelo ID
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
            // 1. Realiza o login no Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const userSanitized = user.email.replace(/\./g, '_');
            const statusRef = ref(database, `status_usuarios/${userSanitized}`);

            // 🔒 2. Verifica se a conta já está online em outro dispositivo
            const snapshot = await get(statusRef);

            if (snapshot.exists()) {
                const userData = snapshot.val();
                
                if (userData.status === 'online') {
                    await signOut(auth);
                    const msg = "Esta conta já está conectada em outro dispositivo!";
                    if (errorMsg) errorMsg.innerText = msg;
                    else alert(msg);
                    return;
                }
            }

            // 3. Limpa a sessão local e atualiza o status para 'online'
            localStorage.clear();
            sessionStorage.clear();

            await set(statusRef, {
                email: user.email,
                status: 'online',
                role: role,
                lastSeen: new Date().toISOString()
            });

            localStorage.setItem('userEmail', user.email);
            localStorage.setItem('userRole', role);

            window.location.href = '/dashboard';

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
                default:
                    mensagem = "Erro: " + error.message;
            }

            if (errorMsg) errorMsg.innerText = mensagem;
            else alert(mensagem);
        }
    });
}

// 🚪 FUNÇÃO DE LOGOUT (MARCA COMO OFFLINE NO BANCO)
export async function fazerLogout() {
    const userEmail = localStorage.getItem('userEmail');
    
    if (userEmail) {
        const userSanitized = userEmail.replace(/\./g, '_');
        // Grava 'offline' no nó status do Realtime Database
        await set(ref(database, `status_usuarios/${userSanitized}/status`), 'offline');
    }

    await signOut(auth);
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
}

window.fazerLogout = fazerLogout;

// 🔴 ATUALIZA O STATUS PARA OFFLINE SE O NAVEGADOR FOR FECHADO
window.addEventListener('beforeunload', () => {
    const userEmail = localStorage.getItem('userEmail');
    if (userEmail) {
        const userSanitized = userEmail.replace(/\./g, '_');
        set(ref(database, `status_usuarios/${userSanitized}/status`), 'offline');
    }
});
