import { auth, database } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

window.fazerLogout = function() {
    const user = auth.currentUser;
    const emailAtivo = user ? user.email : localStorage.getItem('userEmail');

    if (emailAtivo) {
        const userSanitized = emailAtivo.replace(/\./g, '_');
        
        // 🚀 Atualiza status para OFFLINE no Firebase antes de encerrar sessão
        update(ref(database, `status_usuarios/${userSanitized}`), {
            status: 'offline',
            ultimoAcesso: new Date().toISOString()
        }).then(() => {
            executarSignOut();
        }).catch(() => {
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
