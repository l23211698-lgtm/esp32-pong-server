const WebSocket = require('ws');
const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

let jugadores = [];
let estadoJuego = {
  p1: 0, p2: 0,
  r1: 24, r2: 24,
  bx: 64, by: 32,
  vx: 2.0, vy: 1.2
};

console.log(`Servidor de Pong corriendo en el puerto ${PORT}`);

wss.on('connection', function(ws) {
  if (jugadores.length >= 2) {
    ws.close(); // Solo permitimos 2 ESP32 por partida
    return;
  }
  
  jugadores.push(ws);
  let rol = jugadores.length === 1 ? "J1" : "J2";
  ws.send(JSON.stringify({ tipo: "rol", rol: rol }));
  console.log(`Nueva ESP32 conectada como: ${rol}`);

  ws.on('message', function(message) {
    try {
      let data = JSON.parse(message);
      if (data.rol === "J1") estadoJuego.r1 = data.y;
      if (data.rol === "J2") estadoJuego.r2 = data.y;
    } catch(e) {}
  });

  ws.on('close', function() {
    jugadores = jugadores.filter(client => client !== ws);
    console.log("Una ESP32 se desconectó");
    estadoJuego.p1 = 0;
    estadoJuego.p2 = 0;
  });
});

setInterval(() => {
  if (jugadores.length === 2) {
    estadoJuego.bx += estadoJuego.vx;
    estadoJuego.by += estadoJuego.vy;

    if (estadoJuego.by <= 0 || estadoJuego.by >= 61) {
      estadoJuego.vy *= -1;
    }

    if (estadoJuego.bx <= 5 && estadoJuego.by >= estadoJuego.r1 && estadoJuego.by <= estadoJuego.r1 + 16) {
      estadoJuego.vx = abs(estadoJuego.vx) * 1.05;
    }

    if (estadoJuego.bx >= 123 && estadoJuego.by >= estadoJuego.r2 && estadoJuego.by <= estadoJuego.r2 + 16) {
      estadoJuego.vx = -abs(estadoJuego.vx) * 1.05;
    }

    if (estadoJuego.bx < 0) { 
      estadoJuego.p2++; 
      reiniciarPelota(); 
    }
    if (estadoJuego.bx > 128) { 
      estadoJuego.p1++; 
      reiniciarPelota(); 
    }

    let payload = JSON.stringify({ tipo: "estado", ...estadoJuego });
    jugadores.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }
}, 30);

function abs(n) { return n < 0 ? -n : n; }

function reiniciarPelota() {
  estadoJuego.bx = 64; 
  estadoJuego.by = 32;
  estadoJuego.vx *= -1;
}