const WebSocket = require('ws');
const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

let j1 = null;
let j2 = null;
let j1Listo = false;
let j2Listo = false;
let estadoJuego = 'ESPERA';

let pelota = { x: 64, y: 32, vx: 2.0, vy: 1.3 };
let raquetas = { r1: 24, r2: 24 };
let puntos = { p1: 0, p2: 0 };
let loopInterval;

console.log(`Servidor Pong iniciado en el puerto ${PORT}`);

wss.on('connection', (ws) => {
    console.log('Cliente conectado');

    // Asignación de roles estricta
    if (!j1) {
        j1 = ws;
        ws.send(JSON.stringify({ tipo: 'rol', rol: 'J1' }));
        console.log("Asignado como J1");
    } else if (!j2) {
        j2 = ws;
        ws.send(JSON.stringify({ tipo: 'rol', rol: 'J2' }));
        console.log("Asignado como J2");
    } else {
        ws.send(JSON.stringify({ tipo: 'rol', rol: 'Espectador' }));
    }

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.tipo === 'listo') {
                if (ws === j1) {
                    j1Listo = true;
                    console.log("-> J1 está LISTO");
                }
                if (ws === j2) {
                    j2Listo = true;
                    console.log("-> J2 está LISTO");
                }

                // Si los dos están listos, arrancamos de inmediato
                if (j1Listo && j2Listo && estadoJuego === 'ESPERA') {
                    estadoJuego = 'CONTEO';
                    puntos.p1 = 0;
                    puntos.p2 = 0;
                    pelota.x = 64; pelota.y = 32;
                    
                    console.log("¡Ambos listos! Iniciando conteo...");
                    broadcast({ tipo: 'iniciar_conteo' });
                    
                    setTimeout(() => {
                        estadoJuego = 'JUGANDO';
                        iniciarFisicasServidor();
                    }, 3000);
                }
            }

            if (data.rol && data.y !== undefined) {
                if (data.rol === 'J1') raquetas.r1 = data.y;
                if (data.rol === 'J2') raquetas.r2 = data.y;
            }

        } catch (e) {
            console.log("Error de JSON:", e);
        }
    });

    ws.on('close', () => {
        console.log('Cliente desconectado');
        if (ws === j1) { j1 = null; j1Listo = false; }
        if (ws === j2) { j2 = null; j2Listo = false; }
        estadoJuego = 'ESPERA';
        if (loopInterval) clearInterval(loopInterval);
        broadcast({ tipo: 'desconexion', msg: 'Oponente desconectado' });
    });
});

function broadcast(obj) {
    const mensaje = JSON.stringify(obj);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(mensaje);
        }
    });
}

function iniciarFisicasServidor() {
    if (loopInterval) clearInterval(loopInterval);
    loopInterval = setInterval(() => {
        if (estadoJuego !== 'JUGANDO') return;

        pelota.x += pelota.vx;
        pelota.y += pelota.vy;

        if (pelota.y <= 0 || pelota.y >= 61) pelota.vy *= -1;

        if (pelota.x <= 5 && pelota.y >= raquetas.r1 && pelota.y <= (raquetas.r1 + 16)) {
            pelota.vx = abs(pelota.vx) * 1.05;
        }
        if (pelota.x >= 123 && pelota.y >= raquetas.r2 && pelota.y <= (raquetas.r2 + 16)) {
            pelota.vx = -abs(pelota.vx) * 1.05;
        }

        if (pelota.x < 0) { puntos.p2++; pelota.x = 64; pelota.y = 32; }
        else if (pelota.x > 128) { puntos.p1++; pelota.x = 64; pelota.y = 32; }

        broadcast({
            tipo: 'estado',
            p1: puntos.p1, p2: puntos.p2,
            r1: raquetas.r1, r2: raquetas.r2,
            bx: pelota.x, by: pelota.y
        });
    }, 33);
}
