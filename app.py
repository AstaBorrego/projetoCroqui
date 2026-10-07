import os
from flask import Flask, render_template
from whitenoise import WhiteNoise

# Caminho absoluto da raiz do projeto
base_dir = os.path.abspath(os.path.dirname(__file__))

app = Flask(
    __name__,
    static_folder=os.path.join(base_dir, 'static'),
    template_folder=os.path.join(base_dir, 'templates')
)

# Acopla o WhiteNoise para servir os arquivos estáticos (CSS/JS/Imagens) no Vercel
app.wsgi_app = WhiteNoise(app.wsgi_app, root=os.path.join(base_dir, 'static'), prefix='static/')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

if __name__ == '__main__':
    app.run(debug=True)
