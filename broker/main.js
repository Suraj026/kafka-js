import net from "node:net";

const server = net.createServer((c) => {
    // Create a connection
    console.log("Client connected");
});

server.listen(9092, () => {
    console.log("Server listening on port 9092");
});