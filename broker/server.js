import net from "node:net";

// Create a TCP server
const server = net.createServer((conn) => {
    // Create a connection
    console.log("Client connected");

    // handle on "data" event when client sends data
    conn.on("data", (data) => {
        console.log(`Received data: ${data} with length ${data.length}`);

        // echo back same data
        conn.write(`${data}`);
    });

    // handle on "end" event when client closes connection
    conn.on("end", () => {
        console.log("Client disconnected");
    });

    // handle on "error" event
    conn.on("error", (err) => {
        console.log(`Error: ${err}`);
    });
});


// server listens on port 9092
server.listen(9092, () => {
    console.log("Server listening on port 9092");
});