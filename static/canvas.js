export class CroquiEngine {
    constructor(canvasId, onDrawCallback) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.onDrawCallback = onDrawCallback;

        this.isDrawing = false;
        this.currentTool = 'pencil';
        this.currentColor = '#000000';
        this.currentLineWidth = 3;

        this.startX = 0;
        this.startY = 0;
        this.snapshot = null;

        this.history = [];
        this.historyIndex = -1;

        this.initCanvas();
        this.bindEvents();
    }

    initCanvas() {
        // Define a resolução interna real do Canvas
        if (!this.canvas.width) this.canvas.width = 800;
        if (!this.canvas.height) this.canvas.height = 500;

        this.ctx.fillStyle = "#ffffff";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";

        this.saveState();
    }

    saveState() {
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        this.history.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
        this.historyIndex++;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.ctx.putImageData(this.history[this.historyIndex], 0, 0);
            if (this.onDrawCallback) this.onDrawCallback(this.exportDataURL());
        }
    }

    clear() {
        this.ctx.fillStyle = "#ffffff";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.saveState();
        if (this.onDrawCallback) this.onDrawCallback(this.exportDataURL());
    }

    setTool(tool) {
        this.currentTool = tool;
    }

    setColor(color) {
        this.currentColor = color;
    }

    setLineWidth(width) {
        this.currentLineWidth = parseInt(width, 10);
    }

    // 🎯 Mapeamento exato de coordenadas compensando margens superiores/inferiores e laterais (Letterbox Fix)
    getCanvasCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;

        const containerAspect = rect.width / rect.height;
        const canvasAspect = canvasWidth / canvasHeight;

        let renderWidth = rect.width;
        let renderHeight = rect.height;
        let offsetX = 0;
        let offsetY = 0;

        if (containerAspect > canvasAspect) {
            // Margens nas laterais (Notebook / PC)
            renderWidth = rect.height * canvasAspect;
            offsetX = (rect.width - renderWidth) / 2;
        } else {
            // Margens no topo/base (Celular / Tablet)
            renderHeight = rect.width / canvasAspect;
            offsetY = (rect.height - renderHeight) / 2;
        }

        const clickX = clientX - rect.left - offsetX;
        const clickY = clientY - rect.top - offsetY;

        const x = (clickX / renderWidth) * canvasWidth;
        const y = (clickY / renderHeight) * canvasHeight;

        // Limita o traço rigidamente dentro do retângulo de 800x500
        return {
            x: Math.max(0, Math.min(canvasWidth, x)),
            y: Math.max(0, Math.min(canvasHeight, y))
        };
    }

    bindEvents() {
        const startDraw = (e) => {
            e.preventDefault();
            this.isDrawing = true;
            const pos = this.getCanvasCoordinates(e);
            this.startX = pos.x;
            this.startY = pos.y;

            this.snapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

            if (this.currentTool === 'pencil' || this.currentTool === 'brush' || this.currentTool === 'eraser') {
                this.ctx.beginPath();
                this.ctx.moveTo(this.startX, this.startY);
            } else if (this.currentTool === 'text') {
                const text = prompt("Digite o texto a ser inserido:");
                if (text) {
                    this.ctx.font = `${this.currentLineWidth * 5}px Arial`;
                    this.ctx.fillStyle = this.currentColor;
                    this.ctx.fillText(text, this.startX, this.startY);
                    this.saveState();
                    if (this.onDrawCallback) this.onDrawCallback(this.exportDataURL());
                }
                this.isDrawing = false;
            }
        };

        const drawing = (e) => {
            if (!this.isDrawing) return;
            e.preventDefault();

            const pos = this.getCanvasCoordinates(e);

            this.ctx.strokeStyle = (this.currentTool === 'eraser') ? "#ffffff" : this.currentColor;
            this.ctx.lineWidth = (this.currentTool === 'brush' || this.currentTool === 'eraser') 
                ? this.currentLineWidth * 3 
                : this.currentLineWidth;

            if (this.currentTool === 'pencil' || this.currentTool === 'brush' || this.currentTool === 'eraser') {
                this.ctx.lineTo(pos.x, pos.y);
                this.ctx.stroke();
            } else if (this.currentTool === 'line') {
                this.ctx.putImageData(this.snapshot, 0, 0);
                this.ctx.beginPath();
                this.ctx.moveTo(this.startX, this.startY);
                this.ctx.lineTo(pos.x, pos.y);
                this.ctx.stroke();
            } else if (this.currentTool === 'rect') {
                this.ctx.putImageData(this.snapshot, 0, 0);
                this.ctx.beginPath();
                this.ctx.strokeRect(this.startX, this.startY, pos.x - this.startX, pos.y - this.startY);
            } else if (this.currentTool === 'circle') {
                this.ctx.putImageData(this.snapshot, 0, 0);
                this.ctx.beginPath();
                const radius = Math.sqrt(Math.pow(pos.x - this.startX, 2) + Math.pow(pos.y - this.startY, 2));
                this.ctx.arc(this.startX, this.startY, radius, 0, 2 * Math.PI);
                this.ctx.stroke();
            }
        };

        const stopDraw = (e) => {
            if (!this.isDrawing) return;
            this.isDrawing = false;
            this.saveState();
            if (this.onDrawCallback) this.onDrawCallback(this.exportDataURL());
        };

        // Eventos de Rato (Desktop / Notebook)
        this.canvas.addEventListener('mousedown', startDraw);
        this.canvas.addEventListener('mousemove', drawing);
        this.canvas.addEventListener('mouseup', stopDraw);
        this.canvas.addEventListener('mouseleave', stopDraw);

        // Eventos de Toque (Celular / Tablet)
        this.canvas.addEventListener('touchstart', startDraw, { passive: false });
        this.canvas.addEventListener('touchmove', drawing, { passive: false });
        this.canvas.addEventListener('touchend', stopDraw);
    }

    loadImageData(dataUrl) {
        if (!dataUrl) return;
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
            this.saveState();
        };
        img.src = dataUrl;
    }

    exportDataURL() {
        return this.canvas.toDataURL("image/png");
    }
}
