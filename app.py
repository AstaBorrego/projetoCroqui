from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def login():
    # Mude de 'login.html' para 'index.html'
    return render_template('index.html') 

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)