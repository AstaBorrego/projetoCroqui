export class CroquiEngine {
    constructor(canvasId, onDrawCallback) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        // Otimização para leitura e escrita frequente no Canvas
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        this.currentTool = 'pencil';
        this.currentColor = '#000000';
        this.lineWidth = 3;
        
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.snapshot = null;
        
        this.history = [];
        this.onDrawCallback = onDrawCallback;

        this.initEvents();
    }

    initEvents() {
        // Eventos de Mouse (Desktop)
        this.canvas.addEventListener('mousedown', (e) => this.startDraw(e));
        this.canvas.addEventListener('mousemove', (e) => this.drawing(e));
        this.canvas.addEventListener('mouseup', (e) => this.stopDraw(e));
        this.canvas.addEventListener('mouseleave', (e) => this.stopDraw(e));

        // Eventos de Toque (Celulares / Tablets)
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Evita rolagem da página ao desenhar
            this.startDraw(e.touches[0]);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.drawing(e.touches[0]);
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            this.stopDraw(e);
        });
    }

    setTool(tool) {
        this.currentTool = tool;
    }

    setColor(color) {
        this.currentColor = color;
    }

    setLineWidth(width) {
        this.lineWidth = width;
    }

    saveState() {
        if (this.history.length >= 20) this.history.shift();
        this.history.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
    }

    undo() {
        if (this.history.length > 0) {
            const lastState = this.history.pop();
            this.ctx.putImageData(lastState, 0, 0);
            if (this.onDrawCallback) this.onDrawCallback(this.exportDataURL());
        }
    }

    getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Mapeia proporção correta caso o canvas seja redimensionado por CSS
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    startDraw(e) {
        this.isDrawing = true;
        this.saveState();
        
        const pos = this.getPos(e);
        this.startX = pos.x;
        this.startY = pos.y;

        this.ctx.strokeStyle = this.currentTool === 'eraser' ? '#ffffff' : this.currentColor;
        this.ctx.fillStyle = this.currentColor;
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.globalAlpha = this.currentTool === 'brush' ? 0.4 : 1.0;

        this.snapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        if (this.currentTool === 'pencil' || this.currentTool === 'brush' || this.currentTool === 'eraser') {
            this.ctx.beginPath();
            this.ctx.moveTo(this.startX, this.startY);
        } else if (this.currentTool === 'text') {
            const text = prompt("Digite o texto para o croqui:");
            if (text) {
                this.ctx.globalAlpha = 1.0;
                this.ctx.font = `${Math.max(14, this.lineWidth * 4)}px Arial`;
                this.ctx.fillText(text, this.startX, this.startY);
                this.stopDraw();
            } else {
                this.isDrawing = false;
            }
        }
    }

    drawing(e) {
        if (!this.isDrawing) return;

        const pos = this.getPos(e);
        const currentX = pos.x;
        const currentY = pos.y;

        if (this.currentTool === 'pencil' || this.currentTool === 'brush' || this.currentTool === 'eraser') {
            this.ctx.lineTo(currentX, currentY);
            this.ctx.stroke();
        } else {
            this.ctx.putImageData(this.snapshot, 0, 0);
            this.ctx.beginPath();
            this.ctx.globalAlpha = 1.0;

            if (this.currentTool === 'line') {
                this.ctx.moveTo(this.startX, this.startY);
                this.ctx.lineTo(currentX, currentY);
                this.ctx.stroke();
            } else if (this.currentTool === 'rect') {
                this.ctx.strokeRect(this.startX, this.startY, currentX - this.startX, currentY - this.startY);
            } else if (this.currentTool === 'circle') {
                const radius = Math.sqrt(Math.pow(currentX - this.startX, 2) + Math.pow(currentY - this.startY, 2));
                this.ctx.arc(this.startX, this.startY, radius, 0, 2 * Math.PI);
                this.ctx.stroke();
            }
        }
    }

    stopDraw() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.ctx.globalAlpha = 1.0;
        this.ctx.beginPath();
        if (this.onDrawCallback) this.onDrawCallback(this.exportDataURL());
    }

    exportDataURL() {
        return this.canvas.toDataURL();
    }

    getImageData() {
        return this.exportDataURL();
    }

    loadImageData(dataUrl) {
        if (!dataUrl) return;
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0);
        };
        img.src = dataUrl;
    }

    clear() {
        this.saveState();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.onDrawCallback) this.onDrawCallback(this.exportDataURL());
    }
}
