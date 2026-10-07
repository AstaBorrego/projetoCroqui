import { auth, database } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, get, update, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMsg = document.getElementById('errorMsg');
    const btnLogin = document.getElementById('btnLogin');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    // Limpa os campos no carregamento
    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const roleInput = document.getElementById('userRole');
            if (!emailInput || !passwordInput || !roleInput) return;

            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const perfilSelecionado = roleInput.value; // 'admin' ou 'campo'

            if (errorMsg) {
                errorMsg.style.color = '#007bff';
                errorMsg.innerText = "A verificar credenciais...";
            }
            if (btnLogin) btnLogin.disabled = true;

            try {
                // 1. Autentica e-mail e senha no Firebase Auth
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                const userSanitized = user.email.replace(/\./g, '_');

                // 2. VERIFICAÇÃO DE PERFIL NO REALTIME DATABASE
                const userRef = ref(database, `usuarios_autorizados/${userSanitized}`);
                const snapshot = await get(userRef);
                
                let perfilReal = 'campo'; // Perfil padrão se não houver registro específico
                
                if (snapshot.exists()) {
                    const dadosUsuario = snapshot.val();
                    perfilReal = dadosUsuario.role || 'campo';
                } else {
                    // Fallback: se for o e-mail master do admin
                    if (user.email.toLowerCase().includes('astarote')) {
                        perfilReal = 'admin';
                    }
                }

                // 🚀 3. VALIDAÇÃO: Se tentou entrar como Admin mas não tem permissão
                if (perfilSelecionado === 'admin' && perfilReal !== 'admin') {
                    await signOut(auth); // Desloga imediatamente
                    if (btnLogin) btnLogin.disabled = false;
                    if (errorMsg) {
                        errorMsg.style.color = 'red';
                        errorMsg.innerText = "Acesso Negado: O seu utilizador não possui privilégios de Administrador.";
                    }
                    return;
                }

                // 4. Salva os dados de sessão se a validação passar
                localStorage.setItem('userEmail', user.email);
                localStorage.setItem('userRole', perfilReal);

                const userStatusRef = ref(database, `status_usuarios/${userSanitized}`);

                // Configura alteração para offline no disconnect
                onDisconnect(userStatusRef).update({
                    status: 'offline',
                    ultimoAcesso: new Date().toISOString()
                });

                // Atualiza status para ONLINE
                await update(userStatusRef, {
                    email: user.email,
                    status: 'online',
                    role: perfilReal,
                    ultimoAcesso: new Date().toISOString()
                });

                // Limpa o formulário
                emailInput.value = '';
                passwordInput.value = '';

                // Redireciona para o Dashboard
                window.location.href = '/dashboard';

            } catch (error) {
                console.error("Erro na autenticação:", error);
                if (btnLogin) btnLogin.disabled = false;
                if (errorMsg) {
                    errorMsg.style.color = 'red';
                    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                        errorMsg.innerText = "E-mail ou senha incorretos.";
                    } else if (error.code === 'auth/user-not-found') {
                        errorMsg.innerText = "Utilizador não encontrado.";
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
