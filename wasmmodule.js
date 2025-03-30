(() => {
    const sid = game.options.serverId;
    const server = game.options.servers[sid];
    const ws = new WebSocket(`wss://${server.hostname}:443/`);
    ws.binaryType = "arraybuffer";
    const codec = new game.networkType().codec;

    // Initialize the wasmModule
    const Module = wasmModule((decodedData) => {
        console.log("WASM Module initialized with decoded data:", decodedData);
    }, server.ipAddress, server.hostname);

    ws.onclose = () => {
        ws.isclosed = true;
    };

    ws.onmessage = async (msg) => {
        const opcode = new Uint8Array(msg.data)[0];
        if (opcode == 5) {
            Module.onDecodeOpcode5(new Uint8Array(msg.data), server.ipAddress, (e) => {
                const socketNameElement = document.getElementsByClassName('socketName')[0];
                const displayName = socketNameElement && socketNameElement.value !== "" ? socketNameElement.value : "Player";

                ws.send(codec.encode(4, {
                    displayName: displayName,
                    extra: e[5]
                }));
                ws.enterworld2 = e[6];
            });
            return;
        }
        if (opcode == 10) {
            ws.send(Module.finalizeOpcode10(new Uint8Array(msg.data)));
            return;
        }
        const data = codec.decode(msg.data);
        if (data.name) {
            ws.data = data;

            if (ws.data.name == "Dead") {
                ws.network.sendInput({
                    respawn: 1
                });
            }
        }
        if (opcode == 4) {
            if (!data.allowed) return;
            ws.uid = data.uid;
            ws.enterworld2 && ws.send(ws.enterworld2);

            ws.send(codec.encode(9, {
                name: "JoinPartyByShareKey",
                partyShareKey: document.getElementsByClassName('partyShareKey')[0].value
            }));

            for (let i = 0; i < 26; i++) {
                ws.send(new Uint8Array([3, 17, 123, 34, 117, 112, 34, 58, 49, 44, 34, 100, 111, 119, 110, 34, 58, 48, 125]));
            }

            ws.send(new Uint8Array([7, 0]));
            ws.send(new Uint8Array([9, 6, 0, 0, 0, 126, 8, 0, 0, 108, 27, 0, 0, 146, 23, 0, 0, 82, 23, 0, 0, 8, 91, 11, 0, 8, 91, 11, 0, 0, 0, 0, 0, 32, 78, 0, 0, 76, 79, 0, 0, 172, 38, 0, 0, 120, 155, 0, 0, 166, 39, 0, 0, 140, 35, 0, 0, 36, 44, 0, 0, 213, 37, 0, 0, 100, 0, 0, 0, 120, 55, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 134, 6, 0, 0]));
        }
    };

    ws.sendPacket = (event, data) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(codec.encode(event, data));
        } else {
            console.warn("WebSocket is not open. Cannot send packet.");
        }
    };

    ws.network = {
        sendInput: (data) => {
            console.log("Sending Input Data:", data);
            try {
                ws.sendPacket(3, data);
            } catch (error) {
                console.error("Error sending input:", error);
            }
        },
        sendRpc: (data) => {
            try {
                ws.sendPacket(9, data);
            } catch (error) {
                console.error("Error sending RPC:", error);
            }
        }
    };

    window.activeSockets.push({ ws, id: socketId });

    ws.gameUpdate = () => {
        ws.moveToward = (position) => {
            let x = Math.round(position.x);
            let y = Math.round(position.y);

            let myX = Math.round(ws.playerTick.position.x);
            let myY = Math.round(ws.playerTick.position.y);

            let offset = 30;

            if (-myX + x > offset) ws.network.sendInput({ left: 0 }); else ws.network.sendInput({ left: 1 });
            if (myX - x > offset) ws.network.sendInput({ right: 0 }); else ws.network.sendInput({ right: 1 });

            if (-myY + y > offset) ws.network.sendInput({ up: 0 }); else ws.network.sendInput({ up: 1 });
            if (myY - y > offset) ws.network.sendInput({ down: 0 }); else ws.network.sendInput({ down: 1 });
        };

        ws.moveToward(game.renderer.screenToWorld(mousePosition.x, mousePosition.y));
    }


    const setupKeyListener = () => {
        window.addEventListener('keydown', (event) => {
            if (event.key === 'f' || event.key === 'F') {
                ws.network.sendRpc({
                    name: 'JoinPartyByShareKey',
                    partyShareKey: document.getElementsByClassName('partyShareKey')[0].value
                });
            } else if (event.key === 'i' || event.key === 'I') {
                ws.network.sendRpc({
                    name: "LeaveParty"
                });
            } else if (event.key === 'k' || event.key === 'K') {
                ws.network.sendRpc({
                    name: "SendChatMessage",
                    channel: "Local",
                    message: "Sockets be chating now looool"
                });
            } else if (event.key === 't' || event.key === 'T') {
                if (typeof window.toggleWsPlayerTrick === 'function') {
                    toggleWsPlayerTrick();
                } else {
                    console.warn("toggleWsPlayerTrick function is not defined.");
                }
            }
        });
    };

    setupKeyListener();
})();
