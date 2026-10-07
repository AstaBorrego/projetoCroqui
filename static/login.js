// Importa as instâncias de autenticação e banco de dados do arquivo de configuração do Firebase
import { auth, database } from './firebase-config.js';
// Importa a função de autenticação por email e senha da SDK do Firebase Auth
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// Importa as funções para definir e vincular referências no Firebase Realtime Database
import { ref, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

        // Bloco de tentativa e tratamento de exceções para a autenticação
        try {
            // 1. Tenta realizar o login do utilizador na plataforma Firebase Authentication
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            // Extrai as informações do objeto do utilizador autenticado
            const user = userCredential.user;

            // 🧹 2. Limpa completamente o armazenamento local e de sessão do navegador para evitar conflitos
            localStorage.clear();
            // Limpa o armazenamento da sessão atual
            sessionStorage.clear();

            // 3. Formata o email do utilizador para uso como chave no Realtime Database (substituindo pontos por underline)
            const userSanitized = user.email.replace(/\./g, '_');
            // Atualiza os dados de estado e presença do utilizador no banco de dados Firebase
            await set(ref(database, `status_usuarios/${userSanitized}`), {
                // Registra o endereço de e-mail do utilizador
                email: user.email,
                // Define o estado inicial do utilizador como online
                status: 'online',
                // Define o perfil de permissão do utilizador
                role: role,
                // Registra a data e hora do último acesso em formato ISO de tempo universal
                lastSeen: new Date().toISOString()
            });

            // 4. Salva as credenciais básicas do utilizador no armazenamento local do navegador
            localStorage.setItem('userEmail', user.email);
            // Salva o perfil do utilizador no armazenamento local
            localStorage.setItem('userRole', role);

            // 5. Redireciona o utilizador para a página do painel administrativo
            if (role === 'admin') {
                // Redireciona para o dashboard caso o perfil seja admin
                window.location.href = '/dashboard';
            // Tratamento genérico para o perfil de colaborador em campo
            } else {
                // Redireciona igualmente para o dashboard
                window.location.href = '/dashboard';
            }

        // Bloco de captura e tratamento de erros de autenticação
        } catch (error) {
            // Exibe a mensagem de erro detalhada no console do navegador para depuração
            console.error("Erro de Autenticação:", error);

            // Define uma mensagem genérica padrão de erro
            let mensagem = "Erro ao fazer login.";
            // Trata as mensagens amigáveis baseadas nos códigos de erro retornados pelo Firebase
            switch (error.code) {
                // Tratamento de credenciais inválidas ou senha errada
                case 'auth/invalid-credential':
                // Tratamento de utilizador não localizado
                case 'auth/user-not-found':
                // Tratamento de senha incorreta
                case 'auth/wrong-password':
                    // Atribui mensagem simplificada ao utilizador
                    mensagem = "E-mail ou senha incorretos.";
                    // Interrompe o bloco switch
                    break;
                // Tratamento para e-mail com sintaxe incorreta
                case 'auth/invalid-email':
                    // Atribui mensagem para e-mail inválido
                    mensagem = "O formato do e-mail é inválido.";
                    // Interrompe o bloco switch
                    break;
                // Tratamento para contas bloqueadas ou desativadas
                case 'auth/user-disabled':
                    // Atribui mensagem de conta desativada
                    mensagem = "Esta conta foi desativada.";
                    // Interrompe o bloco switch
                    break;
                // Caso seja qualquer outro erro não mapeado
                default:
                    // Exibe a mensagem nativa capturada da exceção
                    mensagem = "Erro: " + error.message;
            }

            // Exibe o texto de erro no elemento na tela se ele estiver presente
            if (errorMsg) {
                // Insere o texto no parágrafo de erro
                errorMsg.innerText = mensagem;
            // Caso não haja o parágrafo de erro, exibe uma mensagem popup na tela
            } else {
                // Exibe alerta nativo do navegador com o erro
                alert(mensagem);
            }
        }
    });
}

// 🚪 Exporta a função de logout do utilizador para encerramento de sessão
export function fazerLogout() {
    // Remove todos os dados guardados no localStorage
    localStorage.clear();
    // Remove todos os dados guardados no sessionStorage
    sessionStorage.clear();
    // Redireciona a navegação para a raiz da aplicação (página de login)
    window.location.href = '/';
}

// Torna a função de logout acessível globalmente pelo objeto window para execução direta em eventos HTML
window.fazerLogout = fazerLogout;
