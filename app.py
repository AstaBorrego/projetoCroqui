import os
from flask import Flask, render_template, send_from_directory

# Obtém o caminho absoluto do diretório do projeto
base_dir = os.path.abspath(os.path.dirname(__file__))

# Configura o Flask com os caminhos absolutos das pastas static e templates
app = Flask(__name__, 
            static_folder=os.path.join(base_dir, 'static'),
            template_folder=os.path.join(base_dir, 'templates'))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

# Rota explícita de emergência para entregar os ficheiros da pasta static no Vercel
@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory(app.static_folder, filename)

if __name__ == '__main__':
    app.run(debug=True)
