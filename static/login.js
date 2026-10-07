import { auth, database } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, update, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMsg = document.getElementById('errorMsg');
    const btnLogin = document.getElementById('btnLogin');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            const roleInput = document.getElementById('userRole');

            if (!emailInput || !passwordInput || !roleInput) return;

            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const role = roleInput.value;

            if (errorMsg) errorMsg.innerText = "Autenticando...";
            if (btnLogin) btnLogin.disabled = true;

            try {
                // Autentica com e-mail e senha
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Salva os dados da sessão
                localStorage.setItem('userEmail', user.email);
                localStorage.setItem('userRole', role);

                const userSanitized = user.email.replace(/\./g, '_');
                const userStatusRef = ref(database, `status_usuarios/${userSanitized}`);

                // Configura o evento de desconexão automática (muda para offline ao fechar/sair)
                onDisconnect(userStatusRef).update({
                    status: 'offline',
                    ultimoAcesso: new Date().toISOString()
                });

                // Atualiza o status para ONLINE imediatamente
                await update(userStatusRef, {
                    email: user.email,
                    status: 'online',
                    role: role,
                    ultimoAcesso: new Date().toISOString()
                });

                // 🚀 LIMPA OS DADOS DO FORMULÁRIO DE LOGIN
                emailInput.value = '';
                passwordInput.value = '';

                // Redireciona para o Dashboard
                window.location.href = '/dashboard';

            } catch (error) {
                console.error("Erro no login:", error);
                if (btnLogin) btnLogin.disabled = false;
                if (errorMsg) {
                    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                        errorMsg.innerText = "E-mail ou senha incorretos.";
                    } else if (error.code === 'auth/user-not-found') {
                        errorMsg.innerText = "Usuário não encontrado.";
                    } else {
                        errorMsg.innerText = "Erro ao entrar: " + (error.message || error.code);
                    }
                }
            }
        });
    }
});

// Função Global de Logout
window.fazerLogout = function() {
    const user = auth.currentUser;
    const emailAtivo = user ? user.email : localStorage.getItem('userEmail');

    if (emailAtivo) {
        const userSanitized = emailAtivo.replace(/\./g, '_');
        update(ref(database, `status_usuarios/${userSanitized}`), {
            status: 'offline',
            ultimoAcesso: new Date().toISOString()
        }).finally(() => {
            executarSignOut();
        });
    } else {
        executarSignOut();
    }
};

function executarSignOut() {
    signOut(auth).then(() => {
        localStorage.clear();
        window.location.href = '/';
    });
}
