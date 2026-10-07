import { auth, database } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

            if (!emailInput || !passwordInput || !roleInput) {
                if (errorMsg) errorMsg.innerText = "Campos não encontrados.";
                return;
            }

            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const role = roleInput.value;

            if (errorMsg) errorMsg.innerText = "Autenticando...";
            if (btnLogin) btnLogin.disabled = true;

            try {
                // 1. Autentica no Firebase Auth
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // 2. Armazena a sessão localmente
                localStorage.setItem('userEmail', user.email);
                localStorage.setItem('userRole', role);

                // 3. Atualiza o status no banco de dados (sem travar a navegação caso dê timeout)
                const userSanitized = user.email.replace(/\./g, '_');
                try {
                    await update(ref(database, `status_usuarios/${userSanitized}`), {
                        email: user.email,
                        status: 'online',
                        role: role,
                        ultimoAcesso: new Date().toISOString()
                    });
                } catch (dbErr) {
                    console.warn("Aviso ao atualizar status no Realtime Database:", dbErr);
                }

                // 4. Redireciona imediatamente para o Dashboard
                window.location.href = '/dashboard';

            } catch (error) {
                console.error("Erro ao autenticar:", error);
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

// Logout Global
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
